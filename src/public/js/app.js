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
    const catId = document.getElementById('produce-music-category').value;
    if (!catId) return toast('Select a category first', 'error');

    const imageConcept = document.getElementById('produce-image-concept').value.trim();
    const musicConcept = document.getElementById('produce-music-concept').value.trim();
    const prompts = getPrompts();
    const cat = CATEGORY_GROUPS.flatMap((g) => g.categories).find((c) => c.id === catId);

    body.topic = cat ? cat.name : catId;
    if (imageConcept) body.topic += ` | ${imageConcept}`;
    body.imageConcept = imageConcept;
    body.musicConcept = musicConcept;
    body.musicCategory = catId;
    body.universeModifier = document.getElementById('produce-modifier').value.trim() || undefined;
    body.imagePrompt = prompts.imagePrompt;
    body.musicPrompt = prompts.musicPrompt;
    body.animationPrompt = prompts.animationPrompt;

    const dur = document.getElementById('produce-duration').value;
    const seg = document.getElementById('produce-segments').value;
    if (dur) body.durationMinutes = parseInt(dur, 10);
    if (seg) body.segmentCount = parseInt(seg, 10);
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
      document.getElementById('produce-music-concept').value = '';
      document.getElementById('produce-bpm').value = '';
      document.getElementById('produce-music-category').value = '';
      document.getElementById('produce-modifier').value = '';
      document.getElementById('produce-duration').value = '';
      document.getElementById('produce-segments').value = '';
      document.getElementById('picker-selected-text').textContent = 'None selected';
      document.getElementById('prompt-preview').style.display = 'none';
      promptOverrides = { image: null, music: null, animation: null };
      pickerSelectedCategory = null;
      pickerSelectedModifier = null;
      pickerSelectedSubject = 'A';
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

// === Category Picker ===
let pickerSelectedCategory = null;
let pickerSelectedModifier = null;
let pickerSelectedSubject = 'A'; // 'A' or 'B'

function openCategoryPicker() {
  const overlay = document.getElementById('category-picker-overlay');
  const body = document.getElementById('picker-body');

  // Pre-select from current hidden inputs
  const currentCat = document.getElementById('produce-music-category').value;
  const currentMod = document.getElementById('produce-modifier').value;
  if (currentCat) pickerSelectedCategory = currentCat;
  if (currentMod) pickerSelectedModifier = currentMod;

  body.innerHTML = CATEGORY_GROUPS.map((group) => {
    const mods = UNIVERSE_MODIFIERS[group.id] || [];
    return `
      <div class="picker-group">
        <div class="picker-group-header">
          ${group.name}
          <span class="picker-group-rule">${group.modifierRule}</span>
        </div>
        ${group.categories.map((cat) => `
          <div class="picker-cat ${pickerSelectedCategory === cat.id ? 'selected' : ''}"
               onclick="selectCategory('${cat.id}', '${group.id}', this)" data-group="${group.id}">
            <div class="picker-cat-header">
              <input type="radio" name="picker-cat" value="${cat.id}"
                     ${pickerSelectedCategory === cat.id ? 'checked' : ''}>
              <span class="picker-cat-name">${cat.name}</span>
            </div>
            <div class="picker-cat-details">
              <div><span>Scene:</span> ${cat.scene}</div>
              <div class="picker-subject-choice" onclick="event.stopPropagation()" style="margin:6px 0;display:flex;gap:12px;">
                <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;flex:1;">
                  <input type="radio" name="subject-${cat.id}" value="A" ${pickerSelectedCategory === cat.id && pickerSelectedSubject === 'B' ? '' : 'checked'} onchange="selectSubject('A')" style="accent-color:var(--accent);margin-top:3px;">
                  <span><strong>A:</strong> ${cat.subjectA}</span>
                </label>
                <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;flex:1;">
                  <input type="radio" name="subject-${cat.id}" value="B" ${pickerSelectedCategory === cat.id && pickerSelectedSubject === 'B' ? 'checked' : ''} onchange="selectSubject('B')" style="accent-color:var(--accent);margin-top:3px;">
                  <span><strong>B:</strong> ${cat.subjectB}</span>
                </label>
              </div>
              <div><span>Palette:</span> ${cat.palette}</div>
              <div style="margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">
                <div><span>Music Mood:</span> ${cat.musicMood}</div>
                <div><span>Energy:</span> ${cat.musicEnergy} &middot; <span>BPM:</span> ${cat.musicBPM}</div>
                <div><span>Instruments:</span> ${cat.musicInstrumentation}</div>
              </div>
            </div>
            ${mods.length > 0 ? `
              <div class="picker-modifiers">
                <div class="picker-modifiers-label">Universe Modifiers</div>
                ${mods.map((mod) => `
                  <label class="picker-mod" onclick="event.stopPropagation()">
                    <input type="checkbox" value="${mod.name}"
                           onchange="selectModifier(this, '${mod.name}')"
                           ${pickerSelectedModifier === mod.name ? 'checked' : ''}>
                    <div class="picker-mod-info">
                      <div class="picker-mod-name">${mod.name}</div>
                      <div class="picker-mod-style">${mod.artStyle}</div>
                      <div class="picker-mod-style">${mod.envShift || ''}</div>
                      <div class="picker-mod-colors">${mod.colorShift}</div>
                    </div>
                  </label>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  overlay.style.display = 'flex';
}

function selectCategory(catId, groupId, el) {
  // Deselect all
  document.querySelectorAll('.picker-cat').forEach((c) => {
    c.classList.remove('selected');
    const radio = c.querySelector('input[type="radio"]');
    if (radio) radio.checked = false;
  });

  // Select this one
  el.classList.add('selected');
  const radio = el.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
  pickerSelectedCategory = catId;

  // Clear modifier if switching groups
  const prevGroup = document.querySelector('.picker-cat.selected')?.dataset.group;
  if (prevGroup !== groupId) {
    pickerSelectedModifier = null;
    document.querySelectorAll('.picker-mod input[type="checkbox"]').forEach((cb) => cb.checked = false);
  }
}

function selectSubject(choice) {
  pickerSelectedSubject = choice;
}

function selectModifier(checkbox, modName) {
  // Only allow one modifier at a time
  document.querySelectorAll('.picker-mod input[type="checkbox"]').forEach((cb) => {
    if (cb !== checkbox) cb.checked = false;
  });
  pickerSelectedModifier = checkbox.checked ? modName : null;
}

function confirmCategoryPicker() {
  document.getElementById('produce-music-category').value = pickerSelectedCategory || '';
  document.getElementById('produce-modifier').value = pickerSelectedModifier || '';
  document.getElementById('produce-subject').value = pickerSelectedSubject || 'A';

  // Update display text
  let text = '';
  if (pickerSelectedCategory) {
    const cat = CATEGORY_GROUPS.flatMap((g) => g.categories).find((c) => c.id === pickerSelectedCategory);
    text = cat ? cat.name : pickerSelectedCategory;
    text += ` (Subject ${pickerSelectedSubject})`;
    if (pickerSelectedModifier) {
      text += ` + ${pickerSelectedModifier}`;
    }
  }
  document.getElementById('picker-selected-text').textContent = text || 'None selected';

  closeCategoryPicker();
  updatePromptPreview();
}

function clearCategoryPicker() {
  pickerSelectedCategory = null;
  pickerSelectedModifier = null;
  pickerSelectedSubject = 'A';
  document.querySelectorAll('.picker-cat').forEach((c) => {
    c.classList.remove('selected');
    const radio = c.querySelector('input[type="radio"]');
    if (radio) radio.checked = false;
  });
  document.querySelectorAll('.picker-mod input[type="checkbox"]').forEach((cb) => cb.checked = false);
}

function closeCategoryPicker(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('category-picker-overlay').style.display = 'none';
}

// === Prompt Preview ===
let promptOverrides = { image: null, music: null, animation: null };

function getSelectedCatAndMod() {
  const catId = document.getElementById('produce-music-category').value;
  const modName = document.getElementById('produce-modifier').value;
  const subject = document.getElementById('produce-subject').value || 'A';
  if (!catId) return { cat: null, mod: null, subject: 'A' };

  const cat = CATEGORY_GROUPS.flatMap((g) => g.categories).find((c) => c.id === catId);
  let mod = null;
  if (modName) {
    for (const groupMods of Object.values(UNIVERSE_MODIFIERS)) {
      const found = groupMods.find((m) => m.name === modName);
      if (found) { mod = found; break; }
    }
  }
  return { cat, mod, subject };
}

function updatePromptPreview() {
  const { cat, mod, subject } = getSelectedCatAndMod();
  const preview = document.getElementById('prompt-preview');

  if (!cat) {
    preview.style.display = 'none';
    return;
  }

  preview.style.display = 'block';

  const imageConcept = document.getElementById('produce-image-concept').value.trim();
  const musicConcept = document.getElementById('produce-music-concept').value.trim();
  const bpmOverride = document.getElementById('produce-bpm').value.trim() || null;

  const imagePrompt = buildImagePrompt(cat, mod, imageConcept, subject);
  const musicPrompt = buildMusicPromptFromSelection(cat, musicConcept, bpmOverride);
  const animPrompt = buildAnimationPrompt(cat, mod, imageConcept);

  // Only update preview text if not overridden
  if (!promptOverrides.image) {
    document.getElementById('prompt-image-preview').textContent = imagePrompt;
    document.getElementById('prompt-image-override').value = imagePrompt;
  }
  if (!promptOverrides.music) {
    document.getElementById('prompt-music-preview').textContent = musicPrompt;
    document.getElementById('prompt-music-override').value = musicPrompt;
  }
  if (!promptOverrides.animation) {
    document.getElementById('prompt-animation-preview').textContent = animPrompt;
    document.getElementById('prompt-animation-override').value = animPrompt;
  }
}

function togglePromptEdit(type) {
  const previewEl = document.getElementById(`prompt-${type}-preview`);
  const overrideEl = document.getElementById(`prompt-${type}-override`);

  if (overrideEl.style.display === 'none') {
    // Switch to edit mode
    if (!promptOverrides[type]) {
      overrideEl.value = previewEl.textContent;
    }
    previewEl.style.display = 'none';
    overrideEl.style.display = 'block';
    overrideEl.focus();
  } else {
    // Switch back to preview
    previewEl.style.display = 'block';
    overrideEl.style.display = 'none';
    if (promptOverrides[type]) {
      previewEl.textContent = promptOverrides[type];
    }
  }
}

function markOverride(type) {
  const overrideEl = document.getElementById(`prompt-${type}-override`);
  const { cat, mod, subject } = getSelectedCatAndMod();
  const imageConcept = document.getElementById('produce-image-concept').value.trim();
  const musicConcept = document.getElementById('produce-music-concept').value.trim();
  const bpmOverride = document.getElementById('produce-bpm').value.trim() || null;

  // Check if text differs from auto-generated
  let autoPrompt = '';
  if (cat) {
    if (type === 'image') autoPrompt = buildImagePrompt(cat, mod, imageConcept, subject);
    if (type === 'music') autoPrompt = buildMusicPromptFromSelection(cat, musicConcept, bpmOverride);
    if (type === 'animation') autoPrompt = buildAnimationPrompt(cat, mod, imageConcept);
  }

  if (overrideEl.value.trim() !== autoPrompt.trim()) {
    promptOverrides[type] = overrideEl.value.trim();
    overrideEl.classList.add('overridden');
  } else {
    promptOverrides[type] = null;
    overrideEl.classList.remove('overridden');
  }
}

function getPrompts() {
  const { cat, mod, subject } = getSelectedCatAndMod();
  const imageConcept = document.getElementById('produce-image-concept').value.trim();
  const musicConcept = document.getElementById('produce-music-concept').value.trim();
  const bpmOverride = document.getElementById('produce-bpm').value.trim() || null;

  if (!cat) return { imagePrompt: imageConcept, musicPrompt: musicConcept, animationPrompt: imageConcept };

  return {
    imagePrompt: promptOverrides.image || buildImagePrompt(cat, mod, imageConcept, subject),
    musicPrompt: promptOverrides.music || buildMusicPromptFromSelection(cat, musicConcept, bpmOverride),
    animationPrompt: promptOverrides.animation || buildAnimationPrompt(cat, mod, imageConcept),
  };
}

// === Init ===
loadStatus();
connectSSE();
