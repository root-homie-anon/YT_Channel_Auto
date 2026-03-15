// === State ===
let currentChannel = null;
let channels = [];

// === API helpers ===
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`;
}

// === Tab navigation ===
document.querySelectorAll('.nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

    if (btn.dataset.tab === 'status') loadStatus();
    if (btn.dataset.tab === 'channels') loadChannels();
    if (btn.dataset.tab === 'pipeline') loadActivePipelines();
    if (btn.dataset.tab === 'ready') loadReadyProductions();
  });
});

// === Status Board ===
async function loadStatus() {
  try {
    channels = await api('/channels');
    const tbody = document.getElementById('status-table');
    const empty = document.getElementById('status-empty');

    if (channels.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = channels
      .map(
        (ch) => `
      <tr>
        <td>${ch.name}</td>
        <td>${ch.format}</td>
        <td>${ch.niche}</td>
        <td>${badge(ch.status)}</td>
        <td>${ch.currentTopic || '-'}</td>
      </tr>`
      )
      .join('');

    const active = channels.filter((c) => c.status !== 'idle').length;
    document.getElementById('active-count').textContent =
      active > 0 ? `${active} active pipeline${active > 1 ? 's' : ''}` : '';
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Channels ===
async function loadChannels() {
  try {
    channels = await api('/channels');
    const grid = document.getElementById('channel-list');

    if (channels.length === 0) {
      grid.innerHTML = '<div class="empty">No channels yet. Create one to get started.</div>';
      return;
    }

    grid.innerHTML = channels
      .map(
        (ch) => `
      <div class="channel-card" onclick="openChannel('${ch.slug}')">
        <div class="name">${ch.name}</div>
        <div class="meta">${ch.format} &middot; ${ch.niche}</div>
        ${badge(ch.status)}
      </div>`
      )
      .join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openChannel(slug) {
  try {
    const data = await api(`/channels/${slug}`);
    currentChannel = slug;

    document.getElementById('channel-list').style.display = 'none';
    document.getElementById('channel-detail').style.display = 'block';
    document.getElementById('detail-name').textContent = data.config.channel.name;
    document.getElementById('detail-status').innerHTML = badge(data.status);

    const s = data.stats || {};
    const ch = data.config.channel;
    const check = (ok) => ok ? '<span style="color:var(--green)">Ready</span>' : '<span style="color:var(--yellow)">Not set</span>';
    document.getElementById('detail-stats').innerHTML = `
      <table>
        <tr><td style="color:var(--text2)">Format</td><td>${ch.format}</td></tr>
        <tr><td style="color:var(--text2)">Niche</td><td>${ch.niche}</td></tr>
        <tr><td style="color:var(--text2)">Videos Produced</td><td>${s.completedVideos || 0}</td></tr>
        <tr><td style="color:var(--text2)">Failed Runs</td><td>${s.failedVideos || 0}</td></tr>
        <tr><td style="color:var(--text2)">Queued Topics</td><td>${s.queuedCount || 0}</td></tr>
        <tr><td style="color:var(--text2)">Last Production</td><td>${s.lastProduction || 'Never'}</td></tr>
        <tr><td style="color:var(--text2)">YouTube OAuth</td><td>${check(s.hasOAuth)}</td></tr>
        <tr><td style="color:var(--text2)">Voice ID</td><td>${check(s.hasVoiceId)}</td></tr>
      </table>`;

    // Toggle production fields based on format
    const isMusicOnly = ch.format === 'music-only';
    document.getElementById('music-only-produce').style.display = isMusicOnly ? 'block' : 'none';
    document.getElementById('narrated-produce').style.display = isMusicOnly ? 'none' : 'block';

    loadQueue();
    loadHistory();
    loadOAuthStatus();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadOAuthStatus() {
  if (!currentChannel) return;
  try {
    const status = await api(`/channels/${currentChannel}/oauth/status`);
    const section = document.getElementById('oauth-section');
    if (status.hasTokens) {
      section.innerHTML = '<div style="color:var(--green);font-size:13px">YouTube connected</div>';
    } else {
      section.innerHTML = '<button class="btn btn-primary" onclick="startOAuth()">Connect YouTube Account</button>';
    }
  } catch (err) {
    console.error('OAuth status check failed:', err);
  }
}

async function startOAuth() {
  if (!currentChannel) return;
  try {
    const res = await api(`/channels/${currentChannel}/oauth/start`, { method: 'POST' });
    if (res.authUrl) {
      window.open(res.authUrl, '_blank', 'width=600,height=700');
      document.getElementById('oauth-section').innerHTML =
        '<div style="color:var(--yellow);font-size:13px">Waiting for authorization... Complete it in the popup window.</div>';
      // Poll for completion
      const poll = setInterval(async () => {
        const status = await api(`/channels/${currentChannel}/oauth/status`);
        if (status.hasTokens) {
          clearInterval(poll);
          document.getElementById('oauth-section').innerHTML =
            '<div style="color:var(--green);font-size:13px">YouTube connected</div>';
          toast('YouTube account connected');
          openChannel(currentChannel);
        }
      }, 3000);
      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(poll), 300000);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showChannelList() {
  currentChannel = null;
  document.getElementById('channel-list').style.display = 'grid';
  document.getElementById('channel-detail').style.display = 'none';
  loadChannels();
}

// === Production ===
async function startProduction() {
  if (!currentChannel) return;

  const isMusicOnly = document.getElementById('music-only-produce').style.display !== 'none';
  const body = {};

  if (isMusicOnly) {
    const titleIdeas = document.getElementById('produce-image-concept').value.trim();
    if (!titleIdeas) return toast('Enter title ideas', 'error');

    body.topic = titleIdeas;

    const seg = document.getElementById('produce-segments').value;
    body.segmentCount = seg ? parseInt(seg, 10) : 1;

  } else {
    const topic = document.getElementById('produce-topic').value.trim();
    if (!topic) return toast('Enter a topic', 'error');
    body.topic = topic;
  }

  try {
    const res = await api(`/channels/${currentChannel}/produce`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    // Clear form fields
    document.getElementById('produce-topic').value = '';
    if (isMusicOnly) {
      document.getElementById('produce-image-concept').value = '';
      document.getElementById('produce-segments').value = '1';
    }
    if (res.status === 'pending_script') {
      toast(`Production created — waiting for @script-writer (${res.productionId})`);
    } else {
      toast(`Pipeline started: ${res.productionId}`);
    }
    loadActivePipelines();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Queue ===
async function addToQueue() {
  const isMusicOnly = document.getElementById('music-only-produce').style.display !== 'none';
  const topic = isMusicOnly
    ? document.getElementById('produce-image-concept').value.trim()
    : document.getElementById('produce-topic').value.trim();
  if (!topic) return toast(isMusicOnly ? 'Enter title ideas' : 'Enter a topic', 'error');
  if (!currentChannel) return;

  try {
    await api(`/channels/${currentChannel}/queue`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
    if (isMusicOnly) {
      document.getElementById('produce-image-concept').value = '';
    } else {
      document.getElementById('produce-topic').value = '';
    }
    toast('Added to queue');
    loadQueue();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadQueue() {
  if (!currentChannel) return;
  try {
    const queue = await api(`/channels/${currentChannel}/queue`);
    const list = document.getElementById('queue-list');
    const empty = document.getElementById('queue-empty');

    if (queue.items.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = queue.items
      .map(
        (item, i) => `
      <div class="queue-item">
        <span class="topic">${item.topic}</span>
        ${badge(item.status)}
        <div class="actions">
          ${item.status === 'queued' ? `<button class="btn btn-sm btn-primary" onclick="produceFromQueue(${i})">Produce</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="removeFromQueue(${i})">Remove</button>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function removeFromQueue(index) {
  if (!currentChannel) return;
  try {
    await api(`/channels/${currentChannel}/queue/${index}`, { method: 'DELETE' });
    loadQueue();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function produceFromQueue(index) {
  if (!currentChannel) return;
  try {
    const queue = await api(`/channels/${currentChannel}/queue`);
    const item = queue.items[index];
    if (!item) return;

    await api(`/channels/${currentChannel}/produce`, {
      method: 'POST',
      body: JSON.stringify({ topic: item.topic }),
    });
    toast(`Pipeline started: ${item.topic}`);
    loadQueue();
    loadActivePipelines();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === History ===
async function loadHistory() {
  if (!currentChannel) return;
  try {
    const runs = await api(`/channels/${currentChannel}/history`);
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    if (runs.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = `<table>
      <thead><tr><th>ID</th><th>Topic</th><th>Status</th><th>Date</th><th></th></tr></thead>
      <tbody>${runs
        .map(
          (r) => `<tr>
        <td style="font-size:12px">${r.productionId}</td>
        <td>${r.topic || '-'}</td>
        <td>${badge(r.stage)}</td>
        <td style="font-size:12px">${new Date(r.startedAt).toLocaleString()}</td>
        <td>${(r.stage === 'failed' || r.stage === 'rejected') ? `<button class="btn btn-sm btn-secondary" onclick="retryProduction('${currentChannel}', '${r.productionId}')">Retry</button>` : ''}</td>
      </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Pipeline Monitor ===
const PIPELINE_STAGES = [
  'pending_script', 'planning', 'scripting', 'asset_generation',
  'asset_preview', 'awaiting_asset_approval', 'compilation',
  'metadata_generation', 'approval', 'awaiting_final_approval',
  'ready', 'publishing', 'complete',
];

async function loadActivePipelines() {
  try {
    const pipelines = await api('/pipelines/active');
    const list = document.getElementById('pipeline-list');
    const empty = document.getElementById('pipeline-empty');

    if (pipelines.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';

      list.innerHTML = pipelines
        .map((p) => {
          const isFailed = p.stage === 'failed' || p.stage === 'rejected';
          const displayStage = isFailed ? (p.failedAtStage || 'unknown') : p.stage;
          const currentIdx = PIPELINE_STAGES.indexOf(displayStage);
          const steps = PIPELINE_STAGES.map(
            (s, i) => {
              let cls = '';
              if (isFailed && i === currentIdx) cls = 'error';
              else if (i < currentIdx) cls = 'done';
              else if (i === currentIdx) cls = 'current';
              return `<div class="progress-step ${cls}" title="${s.replace(/_/g, ' ')}"></div>`;
            }
          ).join('');

          const errorHtml = isFailed && p.error
            ? `<div style="color:var(--red);font-size:12px;margin-top:6px">Failed at ${(p.failedAtStage || p.stage).replace(/_/g, ' ')}: ${p.error}</div>`
            : '';

          return `<div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>${p.channelSlug}</h3>
              ${badge(p.stage)}
            </div>
            <div style="color:var(--text2);font-size:13px;margin:4px 0">${p.topic}</div>
            <div class="progress-bar">${steps}</div>
            ${errorHtml}
            <div style="font-size:12px;color:var(--text2)">
              Started: ${new Date(p.startedAt).toLocaleTimeString()}
            </div>
          </div>`;
        })
        .join('');
    }

    // Load system status
    loadSystemStatus();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadSystemStatus() {
  try {
    const status = await api('/pipelines/system-status');
    const el = document.getElementById('system-status');
    const c = status.concurrency;

    const pipelineBar = `${'●'.repeat(c.activePipelines)}${'○'.repeat(c.maxPipelines - c.activePipelines)}`;
    const compileBar = `${'●'.repeat(c.activeCompilations)}${'○'.repeat(c.maxCompilations - c.activeCompilations)}`;

    el.innerHTML = `<div class="card" style="padding:12px 16px;">
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;font-size:13px;">
        <div><span style="color:var(--text2)">Pipeline Slots:</span> <span style="font-family:monospace">${pipelineBar}</span> ${c.activePipelines}/${c.maxPipelines}</div>
        <div><span style="color:var(--text2)">Compile Slots:</span> <span style="font-family:monospace">${compileBar}</span> ${c.activeCompilations}/${c.maxCompilations}</div>
        <div><span style="color:var(--text2)">Queued:</span> ${c.queueLength}</div>
      </div>
    </div>`;
  } catch { /* system status is optional */ }
}

async function retryProduction(slug, productionId) {
  try {
    const res = await api(`/channels/${slug}/retry/${productionId}`, { method: 'POST' });
    toast(res.message);
    loadActivePipelines();
    if (currentChannel) loadHistory();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Ready to Publish ===
async function loadReadyProductions() {
  try {
    const ready = await api('/pipelines/ready');
    const list = document.getElementById('ready-list');
    const empty = document.getElementById('ready-empty');

    if (ready.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = ready
      .map((r) => {
        const approved = r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '-';
        return `<div class="card" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <h3 style="margin:0">${r.title}</h3>
              <div style="color:var(--text2);font-size:13px;margin-top:2px">${r.channelSlug} &middot; ${r.productionId}</div>
            </div>
            <div style="font-size:12px;color:var(--text2)">Approved: ${approved}</div>
          </div>
          <div style="display:flex;gap:12px;margin-top:12px;align-items:flex-end;flex-wrap:wrap">
            <div class="form-group" style="margin:0;flex:1;min-width:180px">
              <label style="font-size:12px">Schedule Date/Time</label>
              <input type="datetime-local" id="schedule-time-${r.productionId}" style="width:100%">
            </div>
            <div class="form-group" style="margin:0;min-width:120px">
              <label style="font-size:12px">Privacy</label>
              <select id="schedule-privacy-${r.productionId}" style="width:100%">
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary" onclick="scheduleProduction('${r.channelSlug}', '${r.productionId}')">Schedule</button>
              <button class="btn btn-secondary" onclick="publishNow('${r.channelSlug}', '${r.productionId}')">Publish Now</button>
            </div>
          </div>
        </div>`;
      })
      .join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function scheduleProduction(slug, productionId) {
  const timeInput = document.getElementById(`schedule-time-${productionId}`);
  const privacySelect = document.getElementById(`schedule-privacy-${productionId}`);

  if (!timeInput.value) return toast('Select a schedule date/time', 'error');

  const scheduledTime = new Date(timeInput.value).toISOString();

  try {
    const res = await api(`/channels/${slug}/schedule/${productionId}`, {
      method: 'POST',
      body: JSON.stringify({ scheduledTime, privacy: privacySelect.value }),
    });
    toast(res.message);
    loadReadyProductions();
    loadActivePipelines();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function publishNow(slug, productionId) {
  const privacySelect = document.getElementById(`schedule-privacy-${productionId}`);

  try {
    const res = await api(`/channels/${slug}/schedule/${productionId}`, {
      method: 'POST',
      body: JSON.stringify({ privacy: privacySelect.value }),
    });
    toast(res.message);
    loadReadyProductions();
    loadActivePipelines();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === SSE ===
function connectSSE() {
  const source = new EventSource('/api/pipelines/events');
  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'stage_change' || data.type === 'pipeline_started' || data.type === 'pipeline_removed') {
      loadActivePipelines();
      loadStatus();
      if (data.type === 'pipeline_removed') {
        if (currentChannel) loadHistory();
        loadReadyProductions();
      }
    }
  };
  source.onerror = () => {
    source.close();
    setTimeout(connectSSE, 5000);
  };
}

// === New Channel Form ===
document.getElementById('new-channel-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const body = {
      name: document.getElementById('nc-name').value.trim(),
      niche: document.getElementById('nc-niche').value.trim(),
      format: document.getElementById('nc-format').value,
      elevenLabsVoiceId: document.getElementById('nc-voice').value.trim() || undefined,
    };

    const res = await api('/channels', { method: 'POST', body: JSON.stringify(body) });
    toast(`Channel "${res.slug}" created`);
    document.getElementById('new-channel-form').reset();

    // Switch to channels tab
    document.querySelector('[data-tab="channels"]').click();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// === Init ===
loadStatus();
connectSSE();

// Polling fallback — refresh active pipelines every 10s when pipeline tab is visible
setInterval(() => {
  const pipelineTab = document.getElementById('tab-pipeline');
  if (pipelineTab && pipelineTab.classList.contains('active')) {
    loadActivePipelines();
  }
}, 10000);
