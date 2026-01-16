const els = {
  authStatus: document.getElementById('authStatus'),
  authBtn: document.getElementById('authBtn'),
  csvFile: document.getElementById('csvFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  runInfo: document.getElementById('runInfo'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  delay: document.getElementById('delay'),
  progressText: document.getElementById('progressText'),
  progressBar: document.getElementById('progressBar'),
  log: document.getElementById('log'),
};

let currentRunId = null;
let polling = null;

function setAuthStatus(authenticated) {
  els.authStatus.textContent = authenticated ? 'Authenticated' : 'Not connected';
  els.authStatus.style.background = authenticated ? '#dff5e7' : '#f5e3e3';
  els.startBtn.disabled = !authenticated || !currentRunId;
}

async function fetchAuthStatus() {
  const res = await fetch('/api/auth/status');
  const data = await res.json();
  setAuthStatus(data.authenticated);
}

function renderRun(run) {
  if (!run) return;
  els.progressText.textContent = `${run.processed} / ${run.total}`;
  els.progressBar.max = run.total;
  els.progressBar.value = run.processed;
  els.runInfo.textContent = `Run ${run.id} - ${run.status}`;
}

function renderLog(entries) {
  const lines = entries.map((entry) => {
    const msg = entry.errorMessage ? ` - ${entry.errorMessage}` : '';
    return `${entry.status} ${entry.channelId}${msg}`;
  });
  els.log.textContent = lines.join('\n');
}

async function pollRun() {
  if (!currentRunId) return;
  const res = await fetch(`/api/imports/${currentRunId}`);
  if (!res.ok) return;
  const data = await res.json();
  renderRun(data.run);
  renderLog(data.recent || []);
}

els.uploadBtn.addEventListener('click', async () => {
  const file = els.csvFile.files[0];
  if (!file) {
    alert('Select a CSV file first.');
    return;
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/imports', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to create import.');
    return;
  }
  currentRunId = data.run.id;
  els.startBtn.disabled = false;
  els.pauseBtn.disabled = false;
  renderRun(data.run);
  if (polling) clearInterval(polling);
  polling = setInterval(pollRun, 3000);
});

els.startBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  const delayMs = Math.max(2000, Number(els.delay.value || 8) * 1000);
  await fetch(`/api/imports/${currentRunId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delayMs }),
  });
  pollRun();
});

els.pauseBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  const res = await fetch(`/api/imports/${currentRunId}/pause`, { method: 'POST' });
  const data = await res.json();
  els.pauseBtn.textContent = data.paused ? 'Resume' : 'Pause';
});

fetchAuthStatus();
