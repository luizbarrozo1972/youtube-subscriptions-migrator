const path = require('path');
require('dotenv/config');
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({});
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const workers = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function normalizeHeader(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectColumnKeys(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  let idIdx = normalized.findIndex((h) => h.includes('id') && (h.includes('canal') || h.includes('channel')));
  if (idIdx === -1) {
    idIdx = normalized.findIndex((h) => h.includes('channel') && h.includes('id'));
  }
  let urlIdx = normalized.findIndex((h) => h.includes('url') && (h.includes('canal') || h.includes('channel')));
  if (urlIdx === -1) {
    urlIdx = normalized.findIndex((h) => h.includes('url') && h.includes('channel'));
  }
  let titleIdx = normalized.findIndex((h) => h.includes('titulo') || h.includes('title'));
  return {
    idKey: idIdx === -1 ? null : headers[idIdx],
    urlKey: urlIdx === -1 ? null : headers[urlIdx],
    titleKey: titleIdx === -1 ? null : headers[titleIdx],
  };
}

function extractChannelId(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/\/channel\/([A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function getStoredToken() {
  return prisma.oAuthToken.findUnique({ where: { id: 'default' } });
}

async function saveToken(tokens) {
  const data = {
    accessToken: tokens.access_token || null,
    scope: tokens.scope || null,
    tokenType: tokens.token_type || null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };

  const update = { ...data };
  if (tokens.refresh_token) {
    update.refreshToken = tokens.refresh_token;
  }

  await prisma.oAuthToken.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      refreshToken: tokens.refresh_token || null,
      ...data,
    },
    update,
  });
}

async function ensureAuth() {
  const stored = await getStoredToken();
  if (!stored) {
    throw new Error('Not authenticated.');
  }

  oauth2Client.setCredentials({
    access_token: stored.accessToken || undefined,
    refresh_token: stored.refreshToken || undefined,
    scope: stored.scope || undefined,
    token_type: stored.tokenType || undefined,
    expiry_date: stored.expiry ? stored.expiry.getTime() : undefined,
  });
}

async function subscribeChannel(channelId) {
  await ensureAuth();
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  try {
    await youtube.subscriptions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          resourceId: {
            kind: 'youtube#channel',
            channelId,
          },
        },
      },
    });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401) {
      const refreshed = await oauth2Client.refreshAccessToken();
      if (refreshed?.credentials) {
        await saveToken(refreshed.credentials);
      }
      await youtube.subscriptions.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            resourceId: {
              kind: 'youtube#channel',
              channelId,
            },
          },
        },
      });
      return;
    }
    throw err;
  }
}

async function markRunComplete(runId) {
  await prisma.importRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETED',
      finishedAt: new Date(),
    },
  });
}

async function processNext(runId) {
  const worker = workers.get(runId);
  if (!worker || worker.paused) return;

  const entry = await prisma.channelEntry.findFirst({
    where: { runId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  if (!entry) {
    await markRunComplete(runId);
    workers.delete(runId);
    return;
  }

  try {
    await subscribeChannel(entry.channelId);
    await prisma.$transaction([
      prisma.channelEntry.update({
        where: { id: entry.id },
        data: { status: 'SUCCESS', attempts: { increment: 1 }, errorMessage: null },
      }),
      prisma.importRun.update({
        where: { id: runId },
        data: {
          processed: { increment: 1 },
          success: { increment: 1 },
        },
      }),
    ]);
  } catch (err) {
    await prisma.$transaction([
      prisma.channelEntry.update({
        where: { id: entry.id },
        data: {
          status: 'ERROR',
          attempts: { increment: 1 },
          errorMessage: err?.message ? String(err.message).slice(0, 1000) : 'Unknown error',
        },
      }),
      prisma.importRun.update({
        where: { id: runId },
        data: {
          processed: { increment: 1 },
          error: { increment: 1 },
        },
      }),
    ]);
  }

  const delayMs = worker.delayMs || 8000;
  worker.timer = setTimeout(() => processNext(runId), delayMs);
}

app.get('/api/auth/status', async (_req, res) => {
  const stored = await getStoredToken();
  res.json({ authenticated: Boolean(stored && (stored.refreshToken || stored.accessToken)) });
});

app.get('/auth', (_req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube'],
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  fs.appendFileSync(
    path.join(__dirname, '../oauth.log'),
    `[${new Date().toISOString()}] /oauth2callback hit\n`
  );
  const code = req.query.code;
  if (!code) {
    res.status(400).send('Missing code.');
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await saveToken(tokens);
    res.redirect('/?auth=ok');
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('OAuth token exchange failed:', status, data || err?.message || err);
    fs.appendFileSync(
      path.join(__dirname, '../oauth.log'),
      `[${new Date().toISOString()}] OAuth failed: ${status || ''} ${JSON.stringify(data || err?.message || err)}\n`
    );
    res.status(500).send(`OAuth failed. ${status ? `Status ${status}` : ''}`);
  }
});

app.post('/api/imports', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'CSV file required.' });
    return;
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid CSV.' });
    return;
  }

  if (!records.length) {
    res.status(400).json({ error: 'CSV is empty.' });
    return;
  }

  const headers = Object.keys(records[0]);
  const { idKey, urlKey, titleKey } = detectColumnKeys(headers);
  if (!idKey && !urlKey) {
    res.status(400).json({ error: 'No channel ID or URL column found.' });
    return;
  }

  const seen = new Set();
  const entries = [];
  for (const row of records) {
    const idValue = idKey ? row[idKey] : null;
    const urlValue = urlKey ? row[urlKey] : null;
    const titleValue = titleKey ? row[titleKey] : null;
    const channelId = extractChannelId(idValue) || extractChannelId(urlValue);
    if (!channelId) continue;
    if (seen.has(channelId)) continue;
    seen.add(channelId);
    entries.push({
      channelId,
      channelUrl: urlValue ? String(urlValue).trim() : null,
      channelTitle: titleValue ? String(titleValue).trim() : null,
    });
  }

  const run = await prisma.importRun.create({
    data: {
      status: 'PENDING',
      total: entries.length,
    },
  });

  if (entries.length) {
    await prisma.channelEntry.createMany({
      data: entries.map((entry) => ({ ...entry, runId: run.id })),
      skipDuplicates: true,
    });
  }

  const total = await prisma.channelEntry.count({ where: { runId: run.id } });
  const updated = await prisma.importRun.update({
    where: { id: run.id },
    data: { total },
  });

  res.json({ run: updated });
});

app.post('/api/imports/:id/start', async (req, res) => {
  const runId = req.params.id;
  const delayMs = Math.max(2000, Number(req.body?.delayMs || 8000));

  await prisma.importRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  let worker = workers.get(runId);
  if (!worker) {
    worker = { paused: false, delayMs, timer: null };
    workers.set(runId, worker);
  } else {
    worker.paused = false;
    worker.delayMs = delayMs;
  }

  processNext(runId);
  res.json({ ok: true });
});

app.post('/api/imports/:id/pause', async (req, res) => {
  const runId = req.params.id;
  const worker = workers.get(runId);
  if (!worker) {
    res.json({ paused: true });
    return;
  }
  worker.paused = !worker.paused;
  if (!worker.paused) {
    processNext(runId);
  }
  res.json({ paused: worker.paused });
});

app.get('/api/imports/:id', async (req, res) => {
  const runId = req.params.id;
  const run = await prisma.importRun.findUnique({ where: { id: runId } });
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  const recent = await prisma.channelEntry.findMany({
    where: { runId, status: { not: 'PENDING' } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  res.json({ run, recent });
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
