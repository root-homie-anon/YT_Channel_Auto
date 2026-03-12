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
  const topic = document.getElementById('produce-topic').value.trim();
  if (!topic) return toast('Enter a topic', 'error');
  if (!currentChannel) return;

  try {
    const res = await api(`/channels/${currentChannel}/produce`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
    document.getElementById('produce-topic').value = '';
    toast(`Pipeline started: ${res.productionId}`);
    loadActivePipelines();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Queue ===
async function addToQueue() {
  const topic = document.getElementById('produce-topic').value.trim();
  if (!topic) return toast('Enter a topic', 'error');
  if (!currentChannel) return;

  try {
    await api(`/channels/${currentChannel}/queue`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
    document.getElementById('produce-topic').value = '';
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
      <thead><tr><th>ID</th><th>Topic</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${runs
        .map(
          (r) => `<tr>
        <td style="font-size:12px">${r.productionId}</td>
        <td>${r.topic || '-'}</td>
        <td>${badge(r.stage)}</td>
        <td style="font-size:12px">${new Date(r.startedAt).toLocaleString()}</td>
      </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    toast(err.message, 'error');
  }
}

// === Pipeline Monitor ===
const PIPELINE_STAGES = ['planning', 'scripting', 'asset_generation', 'compilation', 'approval', 'publishing', 'complete'];

async function loadActivePipelines() {
  try {
    const pipelines = await api('/pipelines/active');
    const list = document.getElementById('pipeline-list');
    const empty = document.getElementById('pipeline-empty');

    if (pipelines.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = pipelines
      .map((p) => {
        const currentIdx = PIPELINE_STAGES.indexOf(p.stage);
        const steps = PIPELINE_STAGES.map(
          (s, i) =>
            `<div class="progress-step ${i < currentIdx ? 'done' : i === currentIdx ? 'current' : ''}"></div>`
        ).join('');

        return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3>${p.channelSlug}</h3>
            ${badge(p.stage)}
          </div>
          <div style="color:var(--text2);font-size:13px;margin:4px 0">${p.topic}</div>
          <div class="progress-bar">${steps}</div>
          <div style="font-size:12px;color:var(--text2)">
            Started: ${new Date(p.startedAt).toLocaleTimeString()}
          </div>
        </div>`;
      })
      .join('');
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
    }
  };
  source.onerror = () => {
    source.close();
    setTimeout(connectSSE, 5000);
  };
}

// === New Channel Form ===
document.getElementById('nc-format').addEventListener('change', (e) => {
  document.getElementById('music-only-fields').style.display =
    e.target.value === 'music-only' ? 'block' : 'none';
});

document.getElementById('new-channel-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const body = {
      name: document.getElementById('nc-name').value.trim(),
      niche: document.getElementById('nc-niche').value.trim(),
      format: document.getElementById('nc-format').value,
      elevenLabsVoiceId: document.getElementById('nc-voice').value.trim() || undefined,
    };

    if (body.format === 'music-only') {
      const dur = document.getElementById('nc-duration').value;
      const seg = document.getElementById('nc-segments').value;
      body.musicOnly = {
        defaultDurationHours: dur ? parseFloat(dur) : null,
        defaultSegmentCount: seg ? parseInt(seg, 10) : null,
      };
    }

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
