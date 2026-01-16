const els = {
  // Auth
  authStatus: document.getElementById('authStatus'),
  authBtn: document.getElementById('authBtn'),
  
  // Upload
  csvFile: document.getElementById('csvFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  uploadStatus: document.getElementById('uploadStatus'),
  
  // Controls
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  delay: document.getElementById('delay'),
  autoResumeBtn: document.getElementById('autoResumeBtn'),
  
  // Stats
  statSuccess: document.getElementById('statSuccess'),
  statSuccessPercent: document.getElementById('statSuccessPercent'),
  statError: document.getElementById('statError'),
  statErrorPercent: document.getElementById('statErrorPercent'),
  statPending: document.getElementById('statPending'),
  statPendingPercent: document.getElementById('statPendingPercent'),
  statQuota: document.getElementById('statQuota'),
  statQuotaDetail: document.getElementById('statQuotaDetail'),
  
  // Progress
  progressText: document.getElementById('progressText'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  progressBar: document.getElementById('progressBar'),
  statusBadge: document.getElementById('statusBadge'),
  runInfo: document.getElementById('runInfo'),
  
  // Error counts
  errorCountQuota: document.getElementById('errorCountQuota'),
  errorCountNetwork: document.getElementById('errorCountNetwork'),
  errorCountAuth: document.getElementById('errorCountAuth'),
  errorCountPermanent: document.getElementById('errorCountPermanent'),
  
  // Buttons
  retryQuotaBtn: document.getElementById('retryQuotaBtn'),
  retryQuotaManualBtn: document.getElementById('retryQuotaManualBtn'),
  
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Logs
  logAll: document.getElementById('logAll'),
  logSuccess: document.getElementById('logSuccess'),
  logErrors: document.getElementById('logErrors'),
  logQuota: document.getElementById('logQuota'),
  logPending: document.getElementById('logPending'),
  
  // Filter buttons
  filterBtns: document.querySelectorAll('.filter-btn'),
  
  // Dashboard
  statsDashboard: document.getElementById('statsDashboard'),
  errorBreakdown: document.getElementById('errorBreakdown'),
  
  // Quota
  quotaUsed: document.getElementById('quotaUsed'),
  quotaRemaining: document.getElementById('quotaRemaining'),
  quotaBar: document.getElementById('quotaBar'),
  quotaFill: document.getElementById('quotaFill'),
  quotaWarning: document.getElementById('quotaWarning'),
};

let currentRunId = null;
let polling = null;
let currentFilter = 'all-errors';
let allEntries = [];
let successEntries = [];
let errorEntries = [];
let quotaEntries = [];
let pendingEntries = [];

// Auth
function setAuthStatus(authenticated) {
  els.authStatus.textContent = authenticated ? '✓ Autenticado' : '✗ Não conectado';
  els.authStatus.className = `badge ${authenticated ? 'authenticated' : 'not-authenticated'}`;
  els.startBtn.disabled = !authenticated || !currentRunId;
}

async function fetchAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    setAuthStatus(data.authenticated);
  } catch (err) {
    console.error('Erro ao verificar autenticação:', err);
  }
}

// Stats
function updateStats(run, retry) {
  if (!run) return;

  const total = run.total || 1;
  const success = run.success || 0;
  const error = run.error || 0;
  const pending = retry?.pendingCount || 0;
  const processed = run.processed || 0;

  // Success stats
  els.statSuccess.textContent = success.toLocaleString();
  els.statSuccessPercent.textContent = `${((success / total) * 100).toFixed(1)}%`;

  // Error stats
  els.statError.textContent = error.toLocaleString();
  els.statErrorPercent.textContent = `${((error / total) * 100).toFixed(1)}%`;

  // Pending stats
  els.statPending.textContent = pending.toLocaleString();
  els.statPendingPercent.textContent = `${((pending / total) * 100).toFixed(1)}%`;

  // Quota stats
  const quotaUsed = (success * 50);
  const quotaLimit = 10000;
  const quotaPercent = ((quotaUsed / quotaLimit) * 100);
  
  els.statQuota.textContent = quotaUsed.toLocaleString();
  els.statQuotaDetail.textContent = `${quotaUsed.toLocaleString()} / ${quotaLimit.toLocaleString()}`;

  // Show/hide dashboard
  els.statsDashboard.style.display = 'grid';
  els.errorBreakdown.style.display = 'block';
}

function updateErrorBreakdown(retry) {
  if (!retry) return;

  els.errorCountQuota.textContent = (retry.quotaErrors || 0).toLocaleString();
  els.errorCountNetwork.textContent = (retry.networkErrors || 0).toLocaleString();
  els.errorCountAuth.textContent = (retry.authErrors || 0).toLocaleString();
  
  // Calculate permanent errors (total errors - retryable errors)
  const totalErrors = parseInt(els.statError.textContent.replace(/,/g, '')) || 0;
  const retryableErrors = (retry.quotaErrors || 0) + (retry.networkErrors || 0) + (retry.authErrors || 0);
  const permanentErrors = Math.max(0, totalErrors - retryableErrors);
  els.errorCountPermanent.textContent = permanentErrors.toLocaleString();

  // Enable/disable retry button
  els.retryQuotaBtn.disabled = !retry.quotaErrors || retry.quotaErrors === 0;
  els.retryQuotaManualBtn.disabled = !retry.quotaErrors || retry.quotaErrors === 0;
}

function updateProgress(run) {
  if (!run) return;

  const total = run.total || 1;
  const processed = run.processed || 0;
  const percent = ((processed / total) * 100).toFixed(1);

  els.progressText.textContent = `${processed.toLocaleString()} / ${total.toLocaleString()}`;
  els.progressPercent.textContent = `${percent}%`;
  els.progressFill.style.width = `${percent}%`;

  // Status badge
  els.statusBadge.textContent = run.status || 'PENDING';
  els.statusBadge.className = `status-badge ${run.status?.toLowerCase() || 'pending'}`;
  els.runInfo.textContent = `Run ID: ${run.id.substring(0, 8)}... | Criado: ${new Date(run.createdAt).toLocaleString('pt-BR')}`;
}

function updateQuotaInfo(run) {
  if (!run) return;

  const quotaUsed = (run.success || 0) * 50;
  const quotaLimit = 10000;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercent = ((quotaUsed / quotaLimit) * 100);

  els.quotaUsed.textContent = quotaUsed.toLocaleString();
  els.quotaRemaining.textContent = quotaRemaining.toLocaleString();
  els.quotaFill.style.width = `${Math.min(100, quotaPercent)}%`;
  
  if (quotaPercent >= 100) {
    els.quotaFill.classList.add('warning');
    els.quotaWarning.style.display = 'block';
  } else {
    els.quotaFill.classList.remove('warning');
    els.quotaWarning.style.display = quotaPercent >= 90 ? 'block' : 'none';
  }
}

// Logs
function renderLogEntry(entry, container, className = '') {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.status?.toLowerCase()} ${className}`;
  
  const timestamp = new Date(entry.updatedAt || entry.createdAt).toLocaleTimeString('pt-BR');
  const channelId = entry.channelId || '';
  const title = entry.channelTitle ? ` (${entry.channelTitle})` : '';
  const message = entry.errorMessage ? ` - ${entry.errorMessage.substring(0, 100)}` : '';
  
  div.innerHTML = `
    <span class="log-channel-id">[${timestamp}] ${channelId}</span>${title}
    ${message ? `<div class="log-message">${message}</div>` : ''}
  `;
  
  container.appendChild(div);
}

function renderLogs(entries, container, filter = null) {
  container.innerHTML = '';
  
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="log-empty">Nenhuma entrada encontrada</div>';
    return;
  }

  entries.forEach(entry => {
    if (filter && filter !== 'all') {
      if (filter === 'quota' && entry.errorType !== 'QUOTA') return;
      if (filter === 'network' && entry.errorType !== 'NETWORK') return;
      if (filter === 'auth' && entry.errorType !== 'AUTH') return;
      if (filter === 'permanent' && !['QUOTA', 'NETWORK', 'AUTH'].includes(entry.errorType)) return;
    }

    let className = '';
    if (entry.errorType) {
      className = `log-entry-${entry.errorType.toLowerCase()}`;
    }

    renderLogEntry(entry, container, className);
  });
}

function updateAllLogs(data) {
  if (!data) return;

  const recent = data.recent || [];
  allEntries = recent;
  
  // Separate entries by status
  successEntries = recent.filter(e => e.status === 'SUCCESS');
  errorEntries = recent.filter(e => e.status === 'ERROR');
  quotaEntries = recent.filter(e => e.errorType === 'QUOTA');
  pendingEntries = recent.filter(e => e.status === 'PENDING');

  // Render logs based on active tab
  const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
  
  if (activeTab === 'all') {
    renderLogs(allEntries, els.logAll);
  } else if (activeTab === 'success') {
    renderLogs(successEntries, els.logSuccess);
  } else if (activeTab === 'errors') {
    renderLogs(errorEntries, els.logErrors, currentFilter.replace('all-', ''));
  } else if (activeTab === 'quota') {
    renderLogs(quotaEntries, els.logQuota);
  } else if (activeTab === 'pending') {
    renderLogs(pendingEntries, els.logPending);
  }
}

// Tabs
els.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    
    // Update active tab button
    els.tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active tab content
    els.tabContents.forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    // Refresh logs for active tab
    updateAllLogs({ recent: allEntries });
  });
});

// Filter buttons
els.filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    els.filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    updateAllLogs({ recent: allEntries });
  });
});

// Polling
async function pollRun() {
  if (!currentRunId) return;
  
  try {
    const res = await fetch(`/api/imports/${currentRunId}`);
    if (!res.ok) return;
    
    const data = await res.json();
    const run = data.run;
    const retry = data.retry;
    
    updateStats(run, retry);
    updateProgress(run);
    updateQuotaInfo(run);
    updateErrorBreakdown(retry);
    updateAllLogs(data);
    
    // Update pause button
    if (retry?.paused) {
      els.pauseBtn.textContent = '▶ Retomar';
      els.autoResumeBtn.style.display = 'inline-flex';
    } else {
      els.pauseBtn.textContent = '⏸ Pausar';
      els.autoResumeBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Erro ao buscar status:', err);
  }
}

// Upload
els.uploadBtn.addEventListener('click', async () => {
  const file = els.csvFile.files[0];
  if (!file) {
    alert('Selecione um arquivo CSV primeiro.');
    return;
  }
  
  els.uploadBtn.disabled = true;
  els.uploadStatus.textContent = 'Enviando...';
  
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/imports', { method: 'POST', body: form });
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao criar importação.');
    }
    
    currentRunId = data.run.id;
    els.startBtn.disabled = false;
    els.pauseBtn.disabled = false;
    els.uploadStatus.textContent = `✓ Importação criada: ${data.run.total} canais`;
    els.uploadStatus.style.color = '#10b981';
    
    renderRun(data.run);
    
    if (polling) clearInterval(polling);
    polling = setInterval(pollRun, 3000);
    pollRun();
  } catch (err) {
    els.uploadStatus.textContent = `✗ Erro: ${err.message}`;
    els.uploadStatus.style.color = '#ef4444';
  } finally {
    els.uploadBtn.disabled = false;
  }
});

// Start
els.startBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  
  els.startBtn.disabled = true;
  const delayMs = Math.max(2000, Number(els.delay.value || 8) * 1000);
  
  try {
    await fetch(`/api/imports/${currentRunId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delayMs }),
    });
    
    pollRun();
  } catch (err) {
    console.error('Erro ao iniciar:', err);
  } finally {
    els.startBtn.disabled = false;
  }
});

// Pause
els.pauseBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  
  try {
    const res = await fetch(`/api/imports/${currentRunId}/pause`, { method: 'POST' });
    const data = await res.json();
    pollRun();
  } catch (err) {
    console.error('Erro ao pausar:', err);
  }
});

// Auto Resume
els.autoResumeBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  
  els.autoResumeBtn.disabled = true;
  try {
    const res = await fetch(`/api/imports/${currentRunId}/auto-resume`, { method: 'POST' });
    const data = await res.json();
    if (data.resumed) {
      alert('✓ Processamento retomado automaticamente!');
    } else {
      alert('ℹ Quota ainda não resetou. O sistema verificará automaticamente a cada 30 minutos.');
    }
    pollRun();
  } catch (err) {
    console.error('Erro ao retomar:', err);
  } finally {
    els.autoResumeBtn.disabled = false;
  }
});

// Retry Quota Errors
els.retryQuotaBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  
  els.retryQuotaBtn.disabled = true;
  try {
    const res = await fetch(`/api/imports/${currentRunId}/retry-quota-errors`, { method: 'POST' });
    const data = await res.json();
    if (data.reset > 0) {
      alert(`✓ ${data.reset} erros de quota resetados para retry!`);
      pollRun();
    } else {
      alert('ℹ Nenhum erro de quota encontrado para resetar.');
    }
  } catch (err) {
    console.error('Erro ao retry quota:', err);
  } finally {
    els.retryQuotaBtn.disabled = false;
  }
});

els.retryQuotaManualBtn.addEventListener('click', async () => {
  if (!currentRunId) return;
  
  els.retryQuotaManualBtn.disabled = true;
  try {
    const res = await fetch(`/api/imports/${currentRunId}/retry-quota-errors`, { method: 'POST' });
    const data = await res.json();
    if (data.reset > 0) {
      alert(`✓ ${data.reset} erros de quota resetados para retry!`);
      pollRun();
    } else {
      alert('ℹ Nenhum erro de quota encontrado para resetar.');
    }
  } catch (err) {
    console.error('Erro ao retry quota:', err);
  } finally {
    els.retryQuotaManualBtn.disabled = false;
  }
});

// Helper
function renderRun(run) {
  if (!run) return;
  updateProgress(run);
  updateStats(run, {});
}

// Initialize
fetchAuthStatus();
setInterval(fetchAuthStatus, 60000); // Refresh auth status every minute