const state = {
  rows: [],
  index: 0,
  running: false,
  paused: false,
  token: null,
  delayMs: 8000,
};

const els = {
  csvFile: document.getElementById('csvFile'),
  loadBtn: document.getElementById('loadBtn'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  fileInfo: document.getElementById('fileInfo'),
  progress: document.getElementById('progress'),
  status: document.getElementById('status'),
  progressBar: document.getElementById('progressBar'),
  log: document.getElementById('log'),
  delay: document.getElementById('delay'),
  clientWarning: document.getElementById('clientWarning'),
};

function logLine(msg) {
  const ts = new Date().toISOString();
  els.log.textContent += `[${ts}] ${msg}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

function setStatus(text) {
  els.status.textContent = text;
}

function setProgress(current, total) {
  els.progress.textContent = `${current} / ${total}`;
  els.progressBar.value = current;
  els.progressBar.max = total;
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function detectColumns(header) {
  const lower = header.map((h) => h.toLowerCase());
  let idIdx = lower.findIndex((h) => h.includes('id') && h.includes('canal'));
  if (idIdx === -1) {
    idIdx = lower.findIndex((h) => h.includes('channel') && h.includes('id'));
  }
  let urlIdx = lower.findIndex((h) => h.includes('url') && h.includes('canal'));
  if (urlIdx === -1) {
    urlIdx = lower.findIndex((h) => h.includes('url') && h.includes('channel'));
  }
  return { idIdx, urlIdx };
}

function extractChannelId(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/\/channel\/([A-Za-z0-9_-]+)/i);
  if (match) return match[1];
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

async function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err.message || 'token error');
        return;
      }
      resolve(token);
    });
  });
}

async function revokeToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function subscribeChannel(channelId) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        resourceId: {
          kind: 'youtube#channel',
          channelId,
        },
      },
    }),
  });

  if (res.status === 401) {
    await revokeToken(state.token);
    state.token = await getToken();
    return subscribeChannel(channelId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
}

async function processQueue() {
  if (!state.running) return;
  if (state.paused) {
    setStatus('Pausado');
    return;
  }

  if (state.index >= state.rows.length) {
    setStatus('Concluido');
    state.running = false;
    els.pauseBtn.disabled = true;
    return;
  }

  const item = state.rows[state.index];
  const current = state.index + 1;
  setProgress(current, state.rows.length);
  setStatus(`Processando ${current}`);

  try {
    await subscribeChannel(item.channelId);
    logLine(`OK: ${item.channelId}`);
  } catch (err) {
    logLine(`ERRO: ${item.channelId} -> ${err.message}`);
  }

  state.index += 1;
  setTimeout(processQueue, state.delayMs);
}

function validateClientId() {
  const manifest = chrome.runtime.getManifest();
  const clientId = manifest.oauth2 && manifest.oauth2.client_id;
  if (!clientId || clientId.startsWith('YOUR_CLIENT_ID')) {
    els.clientWarning.classList.remove('hidden');
    els.startBtn.disabled = true;
    return false;
  }
  els.clientWarning.classList.add('hidden');
  return true;
}

els.loadBtn.addEventListener('click', async () => {
  const file = els.csvFile.files[0];
  if (!file) {
    logLine('Selecione um CSV primeiro.');
    return;
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    logLine('CSV vazio ou invalido.');
    return;
  }

  const header = parsed[0];
  const { idIdx, urlIdx } = detectColumns(header);
  if (idIdx === -1 && urlIdx === -1) {
    logLine('Nao encontrei colunas de ID ou URL de canal.');
    return;
  }

  const rows = [];
  const seen = new Set();
  for (let i = 1; i < parsed.length; i += 1) {
    const row = parsed[i];
    const idValue = idIdx !== -1 ? row[idIdx] : '';
    const urlValue = urlIdx !== -1 ? row[urlIdx] : '';
    const channelId = extractChannelId(idValue) || extractChannelId(urlValue);
    if (!channelId) continue;
    if (seen.has(channelId)) continue;
    seen.add(channelId);
    rows.push({ channelId });
  }

  state.rows = rows;
  state.index = 0;
  setProgress(0, rows.length);
  setStatus('CSV carregado');
  els.fileInfo.textContent = `${file.name} (${rows.length} canais)`;
  els.startBtn.disabled = rows.length === 0 || !validateClientId();
});

els.startBtn.addEventListener('click', async () => {
  if (!validateClientId()) return;
  if (state.running) return;

  state.delayMs = Math.max(2000, Number(els.delay.value || 8) * 1000);
  state.running = true;
  state.paused = false;
  els.pauseBtn.disabled = false;
  els.startBtn.disabled = true;
  setStatus('Autenticando');

  try {
    state.token = await getToken();
  } catch (err) {
    logLine(`Falha ao autenticar: ${err}`);
    state.running = false;
    els.startBtn.disabled = false;
    els.pauseBtn.disabled = true;
    setStatus('Erro de autenticacao');
    return;
  }

  setStatus('Iniciado');
  processQueue();
});

els.pauseBtn.addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  els.pauseBtn.textContent = state.paused ? 'Retomar' : 'Pausar';
  if (!state.paused) processQueue();
});

els.clearLogBtn.addEventListener('click', () => {
  els.log.textContent = '';
});

validateClientId();
