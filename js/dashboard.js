/**
 * Diagnostics Dashboard — client-side rendering.
 *
 * Fetches diagnostic data from the JSON API and renders
 * the same dashboard UI that was previously server-rendered.
 */

// --- Constants ---

const API_BASE = '/api/chess/diagnostics';
const ONGOING_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const DOT_RECENT_MS = 5 * 60 * 1000;
const DOT_GRACE_MS = 30 * 60 * 1000;

const PILL_COLORS = {
  complete:          { border: '#22c55e', bg: '#14532d', activeBg: '#166534', text: '#4ade80' },
  abandoned:         { border: '#eab308', bg: '#422006', activeBg: '#713f12', text: '#fbbf24' },
  connection_failed: { border: '#ef4444', bg: '#450a0a', activeBg: '#7f1d1d', text: '#f87171' },
  ongoing:           { border: '#3b82f6', bg: '#0c2340', activeBg: '#1d4ed8', text: '#60a5fa' },
  has_issues:        { border: '#ffffff', bg: '#2d2d2d', activeBg: '#3d3d3d', text: '#ffffff' },
};

const CATEGORY_COLORS = {
  lifecycle: '#3b82f6',
  error:     '#ef4444',
  move:      '#22c55e',
  connection:'#f59e0b',
  sync:      '#8b5cf6',
  webrtc:    '#06b6d4',
  unknown:   '#6b7280',
};

// --- Helpers ---

function esc(str) {
  const el = document.createElement('span');
  el.textContent = String(str);
  return el.innerHTML;
}

function catColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.unknown;
}

function formatTs(ms) {
  if (!ms) return '\u2014';
  return new Date(ms).toLocaleString('en-AU', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function formatRelMs(a, b) {
  const diff = b - a;
  if (diff < 0) return '';
  if (diff < 1000) return `+${diff}ms`;
  return `+${(diff / 1000).toFixed(1)}s`;
}

function computePillStatus(game) {
  const { result, resultReason, moveCount, lastTs } = game;
  if (result === null) {
    return (Date.now() - (lastTs || 0)) < ONGOING_THRESHOLD_MS ? 'ongoing' : 'connection_failed';
  }
  if (resultReason === 'abandoned') return 'connection_failed';
  if ((moveCount || 0) <= 2 || resultReason === 'resignation') return 'abandoned';
  return 'complete';
}

function computeDotColor(sessionState) {
  const { connectionState, lastTs } = sessionState;
  const age = Date.now() - (lastTs || 0);
  const connected    = connectionState === 'connected' || connectionState === 'completed';
  const disconnected = connectionState === 'disconnected' || connectionState === 'failed' || connectionState === 'closed';

  if (connected && age < DOT_RECENT_MS) return '#4ade80';
  if (connected && age < DOT_GRACE_MS)  return '#fbbf24';
  if (disconnected)                      return '#f87171';
  if (age < DOT_GRACE_MS)               return '#fbbf24';
  return '#f87171';
}

function groupBySession(events) {
  const map = new Map();
  for (const e of events) {
    const sid = e.sessionId || 'unknown';
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(e);
  }
  return [...map.entries()]
    .sort((a, b) => (a[1][0].timestamp || 0) - (b[1][0].timestamp || 0));
}

// --- WebRTC summary ---

function computeWebRtcSummary(events) {
  const webrtcEvents = events.filter(e => e.category === 'webrtc');
  if (webrtcEvents.length === 0) return null;

  const summary = {
    hasTurn: false, turnProvider: null, serverCount: 0,
    candidates: { host: 0, srflx: 0, relay: 0, prflx: 0, unknown: 0 },
    iceState: null, connectionState: null,
    videoReceived: false, audioReceived: false,
  };

  for (const e of webrtcEvents) {
    const d = e.data || {};
    if (e.eventType === 'ice_servers_config') {
      summary.hasTurn = !!d.hasTurn;
      summary.turnProvider = d.turnProvider || null;
      summary.serverCount = d.count || 0;
    } else if (e.eventType === 'ice_candidate_local') {
      const t = d.type || 'unknown';
      if (t in summary.candidates) summary.candidates[t]++;
      else summary.candidates.unknown++;
    } else if (e.eventType === 'ice_state_change') {
      summary.iceState = d.state || d.iceState || null;
    } else if (e.eventType === 'connection_state_change') {
      summary.connectionState = d.state || d.connectionState || null;
    } else if (e.eventType === 'remote_track_received') {
      if (d.kind === 'video') summary.videoReceived = true;
      if (d.kind === 'audio') summary.audioReceived = true;
    }
  }
  return summary;
}

function renderWebRtcSummary(summary) {
  if (!summary) return '';
  const relay = summary.candidates.relay;
  const turnOk = relay > 0;
  const iceOk = summary.iceState === 'connected' || summary.iceState === 'completed';
  const connOk = summary.connectionState === 'connected';
  const prov = summary.turnProvider ? ` [${esc(summary.turnProvider)}]` : '';

  const turnLabel = summary.hasTurn
    ? (turnOk
        ? `<span class="wrtc-ok">TURN${prov} \u2713 (${relay} relay)</span>`
        : `<span class="wrtc-warn">TURN${prov} \u26A0 (0 relay)</span>`)
    : `<span class="wrtc-off">TURN off${prov}</span>`;

  const iceLabel = summary.iceState
    ? (iceOk
        ? `<span class="wrtc-ok">ICE: ${esc(summary.iceState)}</span>`
        : `<span class="wrtc-fail">ICE: ${esc(summary.iceState)}</span>`)
    : '';

  const connLabel = summary.connectionState
    ? (connOk
        ? `<span class="wrtc-ok">conn: ${esc(summary.connectionState)}</span>`
        : `<span class="wrtc-fail">conn: ${esc(summary.connectionState)}</span>`)
    : '';

  const candLabel = `<span class="wrtc-dim">host:${summary.candidates.host} srflx:${summary.candidates.srflx} relay:${relay}</span>`;
  const videoLabel = summary.videoReceived
    ? '<span class="wrtc-ok">video \u2713</span>'
    : '<span class="wrtc-fail">video \u2717</span>';

  return `<div class="webrtc-summary">${turnLabel} \u00B7 ${iceLabel}${connLabel ? ' \u00B7 ' + connLabel : ''} \u00B7 ${candLabel} \u00B7 ${videoLabel}</div>`;
}

// --- Render sections ---

function renderEventRow(e, baseTs) {
  const color = catColor(e.category);
  const dataStr = esc(JSON.stringify(e.data || {}, null, 2));
  const dataCompact = esc(JSON.stringify(e.data || {}));
  const rel = baseTs ? formatRelMs(baseTs, e.timestamp) : '';
  const cat = esc(e.category || 'unknown');
  return `<div class="event-row" data-cat="${cat}">
    <div class="event-time">
      <span class="ts-abs">${formatTs(e.timestamp)}</span>
      ${rel ? `<span class="ts-rel">${esc(rel)}</span>` : ''}
    </div>
    <span class="badge" style="background:${color}">${cat}</span>
    <span class="event-type">${esc(e.eventType || '\u2014')}</span>
    <details class="data-detail"><summary>${dataCompact}</summary><pre>${dataStr}</pre></details>
  </div>`;
}

function renderSessionSection(sessionId, events) {
  const d = events[0].deviceInfo || {};
  const shortId = String(sessionId).slice(0, 8);
  const baseTs = events[0].timestamp;
  const catCounts = {};
  for (const e of events) {
    const c = e.category || 'unknown';
    catCounts[c] = (catCounts[c] || 0) + 1;
  }
  const catSummary = Object.entries(catCounts)
    .map(([c, n]) => `<span class="badge sm" style="background:${catColor(c)}">${n} ${esc(c)}</span>`)
    .join(' ');

  const wrtc = renderWebRtcSummary(computeWebRtcSummary(events));

  return `<details class="session-section" open>
  <summary class="session-header">
    <div class="session-device">
      <span class="device-icon">${esc(d.device || '?')}</span>
      <span class="device-browser">${esc(d.browser || '?')} ${esc(d.browserVersion || '')}</span>
      <span class="device-os">${esc(d.os || '?')} ${esc(d.osVersion || '')}</span>
      <span class="device-screen">${esc(String(d.screenWidth || '?'))}\u00D7${esc(String(d.screenHeight || '?'))}</span>
    </div>
    <div class="session-right">
      ${catSummary}
      <span class="session-id" title="${esc(sessionId)}">${esc(shortId)}\u2026</span>
    </div>
  </summary>
  ${wrtc}
  <div class="session-events">
    ${events.map(e => renderEventRow(e, baseTs)).join('\n')}
  </div>
</details>`;
}

function renderMovesSection(game) {
  if (!game || !game.moves || game.moves.length === 0) return '';

  const { white, black, timeControl, result, resultReason, moves } = game;
  const wName = esc(white && white.name ? white.name : '?');
  const bName = esc(black && black.name ? black.name : '?');
  const wAI = white && white.isAI ? ' (AI)' : '';
  const bAI = black && black.isAI ? ' (AI)' : '';
  const tc = timeControl ? esc(JSON.stringify(timeControl)) : '\u2014';
  const resultStr = result ? `${esc(result)}${resultReason ? ' \u00B7 ' + esc(resultReason) : ''}` : 'In progress';

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ num: Math.floor(i / 2) + 1, white: moves[i], black: moves[i + 1] || null });
  }

  const tableRows = rows.map(r => {
    const wTs = r.white.timestamp ? `<span class="move-ts">${formatTs(r.white.timestamp)}</span>` : '';
    const bTs = r.black && r.black.timestamp ? `<span class="move-ts">${formatTs(r.black.timestamp)}</span>` : '';
    const bSan = r.black ? `<span class="move-black">${esc(r.black.san)}</span> ${bTs}` : '';
    return `<tr>
      <td class="move-num">${r.num}.</td>
      <td><span class="move-white">${esc(r.white.san)}</span> ${wTs}</td>
      <td>${bSan}</td>
    </tr>`;
  }).join('');

  return `<details class="moves-panel">
  <summary>
    <span>Game Moves \u2014 ${moves.length} ply</span>
    <span style="color:#475569;font-weight:400;text-transform:none;letter-spacing:0">${resultStr}</span>
  </summary>
  <div class="moves-meta">
    <span>\u2659 <span class="moves-meta-val">${wName}${wAI}</span></span>
    <span>\u265F <span class="moves-meta-val">${bName}${bAI}</span></span>
    <span>Time control: <span class="moves-meta-val">${tc}</span></span>
  </div>
  <table class="moves-table">
    <thead><tr><th>#</th><th>White</th><th>Black</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</details>`;
}

function renderIssueReports(issueReports) {
  if (!issueReports || issueReports.length === 0) return '';

  const cards = issueReports.map(r => {
    const catBadges = (r.categories || []).map(c =>
      `<span class="ir-cat-badge">${esc(c.replace(/_/g, ' '))}</span>`
    ).join(' ');
    const autoTag = r.autoDetected ? '<span class="ir-auto-tag">auto-detected</span>' : '';
    const desc = r.description
      ? `<div class="ir-desc">${esc(r.description)}</div>`
      : '<div class="ir-desc ir-desc-empty">No description provided</div>';
    const di = r.deviceInfo || {};
    const deviceStr = [di.browser, di.os].filter(Boolean).join(' \u00B7 ') || '\u2014';

    return `<div class="ir-report-card">
      <div class="ir-report-header">
        <span class="ir-flag-icon">\u2691</span>
        <span class="ir-report-time">${formatTs(r.createdAt)}</span>
        ${autoTag}
        <span class="ir-report-session" title="${esc(r.sessionId)}">${esc(String(r.sessionId).slice(0, 8))}\u2026</span>
        <span class="ir-report-device">${esc(deviceStr)}</span>
      </div>
      ${catBadges ? `<div class="ir-cats">${catBadges}</div>` : ''}
      ${desc}
    </div>`;
  }).join('\n');

  return `<div class="ir-section">
  <div class="ir-section-title">\u2691 ${issueReports.length} Issue Report${issueReports.length !== 1 ? 's' : ''}</div>
  ${cards}
</div>`;
}

function renderConnectionDots(sessionStates) {
  if (!sessionStates || sessionStates.length === 0) return '';
  return sessionStates.slice(0, 2).map(s => {
    const color = computeDotColor(s);
    const title = `Session ${String(s.sessionId).slice(0, 8)}\u2026 \u00B7 state: ${s.connectionState || 'unknown'}`;
    return `<span class="conn-dot" style="background:${color}" title="${esc(title)}"></span>`;
  }).join('');
}

function renderGamesNav(navEntries, currentGameId, currentRoomCode) {
  if (!navEntries || navEntries.length === 0) return '';

  const items = navEntries.map(g => {
    const isRoom = !g.gameId && g.roomCode;
    const isCurrent = isRoom
      ? g.roomCode === currentRoomCode
      : g.gameId === currentGameId;
    const status = g.issueCount > 0 ? 'has_issues' : computePillStatus(g);
    const colors = PILL_COLORS[status];
    const label = isRoom
      ? `Room ${g.roomCode} \u00B7 ${g.eventCount} event${g.eventCount !== 1 ? 's' : ''} \u00B7 ${formatTs(g.lastTs)}`
      : `#${g.gameId} \u00B7 ${g.eventCount} event${g.eventCount !== 1 ? 's' : ''} \u00B7 ${formatTs(g.lastTs)}`;

    const dots = status === 'ongoing' ? renderConnectionDots(g.sessionStates) : '';
    const pillBg = isCurrent ? colors.activeBg : colors.bg;
    const isStale = (Date.now() - (g.lastTs || 0)) > 24 * 60 * 60 * 1000;
    const opacityStyle = isStale ? 'opacity:0.5;' : '';
    const style = `background:${pillBg};border-color:${colors.border};color:${colors.text};${opacityStyle}`;
    const href = isRoom
      ? `dashboard.html?roomCode=${encodeURIComponent(g.roomCode)}`
      : `dashboard.html?gameId=${g.gameId}`;

    if (isCurrent) {
      return `<span class="game-nav-item game-nav-current" style="${style}" title="Currently viewing">${dots}${esc(label)}</span>`;
    }
    return `<a class="game-nav-item" href="${href}" style="${style}">${dots}${esc(label)}</a>`;
  }).join('');

  const legend = `<div class="pill-legend">
    <span class="pill-legend-item" style="color:#4ade80">\u25A0 complete</span>
    <span class="pill-legend-item" style="color:#fbbf24">\u25A0 abandoned / short</span>
    <span class="pill-legend-item" style="color:#f87171">\u25A0 conn. failed</span>
    <span class="pill-legend-item" style="color:#60a5fa">\u25A0 ongoing</span>
    <span class="pill-legend-item" style="color:#94a3b8">\u00B7 dots = player conn. status</span>
  </div>`;

  return `<div class="games-nav">
  <span class="games-nav-label">GAMES</span>
  <div class="games-nav-list">${items}</div>
</div>
${legend}`;
}

function renderCategoryFilterBar(events) {
  const catCounts = {};
  for (const e of events) {
    const c = e.category || 'unknown';
    catCounts[c] = (catCounts[c] || 0) + 1;
  }
  return Object.entries(catCounts).map(([cat, n]) => {
    const color = catColor(cat);
    return `<button class="pill-filter active" data-cat="${esc(cat)}" style="--pill-border:${color};--pill-bg:${color}18;--pill-text:${color}">${n} ${esc(cat)}</button>`;
  }).join('');
}

// --- TURN status banner ---

function renderUsageBar(usageData) {
  if (!usageData || !usageData.available) return '';
  const { usageInGB = 0, quotaInGB = 0, overageInGB = 0 } = usageData;
  const usageStr = usageInGB.toFixed(2);
  const quotaStr = quotaInGB > 0 ? quotaInGB.toFixed(0) : '\u221E';
  const pct = quotaInGB > 0 ? Math.min((usageInGB / quotaInGB) * 100, 100) : 0;
  const overStr = overageInGB > 0 ? ` \u00B7 <span class="turn-usage-overage">+${overageInGB.toFixed(2)} GB overage</span>` : '';
  const barClass = overageInGB > 0 ? 'turn-usage-fill overage' : (pct >= 80 ? 'turn-usage-fill warn' : 'turn-usage-fill');
  return `<div class="turn-usage-row">
    <span class="turn-usage-label">Metered usage:</span>
    <span class="turn-usage-text">${esc(usageStr)} / ${esc(quotaStr)} GB${overStr}</span>
    ${quotaInGB > 0 ? `<div class="turn-usage-track"><div class="${barClass}" style="width:${pct.toFixed(1)}%"></div></div>` : ''}
  </div>`;
}

function renderTurnStatus(iceData, usageData = null) {
  if (iceData === null) {
    return `<div class="turn-status-bar turn-fail"><span class="turn-status-label">\u26A0 TURN status unavailable</span><span class="turn-status-detail">Could not reach /api/chess/ice-servers</span></div>`;
  }

  const servers = iceData.iceServers || [];
  const turnCount = servers.filter(s => s.username !== undefined).length;
  const stunCount = servers.filter(s => s.username === undefined).length;
  const provider = iceData.turnProvider || 'unknown';
  const usage = renderUsageBar(usageData);

  if (provider === 'stun-only' || turnCount === 0) {
    return `<div class="turn-status-bar turn-warn"><span class="turn-status-label">\u26A0 STUN only</span><span class="turn-status-detail">No TURN servers configured \u00B7 ${stunCount} stun</span>${usage}</div>`;
  }

  return `<div class="turn-status-bar turn-ok"><span class="turn-status-label">\u2713 TURN active</span><span class="turn-status-detail">provider: ${esc(provider)} \u00B7 ${turnCount} turn server${turnCount !== 1 ? 's' : ''} \u00B7 ${stunCount} stun</span>${usage}</div>`;
}

// --- Main render ---

function renderDashboard(data, navEntries, versions = {}, iceData = null, usageData = null) {
  const { events = [], count = 0, gameId, roomCode, game, issueReports = [] } = data;
  const ctxLabel = gameId ? `Game ${gameId}` : (roomCode ? `Room ${roomCode}` : 'Recent');
  const versionLine = (versions.client || versions.api)
    ? `<div class="header-version">${versions.client ? `client v${esc(versions.client)}` : ''}${versions.client && versions.api ? ' \u00B7 ' : ''}${versions.api ? `api v${esc(versions.api)}` : ''}</div>`
    : '';

  const firstTs = events.length ? events[0].timestamp : null;
  const lastTs  = events.length ? events[events.length - 1].timestamp : null;
  const timeRange = firstTs ? `${formatTs(firstTs)} \u2192 ${formatTs(lastTs)}` : 'No events';
  const sessions = groupBySession(events);
  const roomCodes = [...new Set(events.map(e => e.roomCode).filter(Boolean))].join(', ') || '\u2014';

  const resultWithExtras = { ...data, issueReports, game };

  document.title = `Diagnostics \u2014 ${ctxLabel}`;

  return `
<div class="header">
  <div>
    <div class="header-title">Chess Diagnostics</div>
    <div class="header-meta">${esc(ctxLabel)}</div>
    ${versionLine}
  </div>
  <div class="header-actions">
    ${gameId ? '<button class="btn" id="api-link-btn">&#x29C9; Copy API link</button>' : ''}
    <button class="btn" id="refresh-btn">\u21BB Refresh</button>
  </div>
</div>

${renderTurnStatus(iceData, usageData)}

<div class="summary">
  <div class="stat"><span class="stat-label">Game ID</span><span class="stat-value">${esc(String(gameId || '\u2014'))}</span></div>
  <div class="stat"><span class="stat-label">Room</span><span class="stat-value">${esc(roomCodes)}</span></div>
  <div class="stat"><span class="stat-label">Events</span><span class="stat-value">${count}</span></div>
  <div class="stat"><span class="stat-label">Sessions</span><span class="stat-value">${sessions.length}</span></div>
  <div class="stat"><span class="stat-label">Time range</span><span class="stat-value" style="font-size:12px">${timeRange}</span></div>
  ${issueReports.length > 0 ? `<div class="stat"><span class="stat-label">Issues</span><span class="stat-value" style="color:#f87171">\u2691 ${issueReports.length} flagged</span></div>` : ''}
</div>

${renderGamesNav(navEntries, gameId, roomCode)}

${events.length > 0 ? `<div class="filter-bar"><span class="filter-label">Show</span>${renderCategoryFilterBar(events)}</div>` : ''}

${renderMovesSection(game)}

${renderIssueReports(issueReports)}

<div class="sessions">
  ${events.length === 0
    ? '<div class="empty">No diagnostic events found</div>'
    : `<div class="section-title">${sessions.length} Session${sessions.length !== 1 ? 's' : ''}</div>
       ${sessions.map(([sid, evts]) => renderSessionSection(sid, evts)).join('\n')}`
  }
</div>

<div class="copy-section">
  <button class="btn" id="copy-btn">&#x29C9; Copy JSON</button>
</div>`;
}

// --- Event binding ---

function bindEvents(data) {
  const resultJson = JSON.stringify(data);

  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(resultJson).then(() => {
        copyBtn.textContent = '\u2713 Copied!';
        setTimeout(() => { copyBtn.textContent = '\u29C9 Copy JSON'; }, 2000);
      }).catch(() => {
        copyBtn.textContent = 'Copy failed';
      });
    });
  }

  const apiBtn = document.getElementById('api-link-btn');
  if (apiBtn && data.gameId) {
    apiBtn.addEventListener('click', () => {
      const url = `${location.origin}/api/chess/diagnostics/game/${data.gameId}`;
      navigator.clipboard.writeText(url).then(() => {
        apiBtn.textContent = '\u2713 Copied!';
        setTimeout(() => { apiBtn.textContent = '\u29C9 Copy API link'; }, 2000);
      }).catch(() => {
        apiBtn.textContent = 'Copy failed';
      });
    });
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => location.reload());
  }

  // Category filter pills
  const hiddenCats = new Set();
  document.querySelectorAll('.pill-filter[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (hiddenCats.has(cat)) {
        hiddenCats.delete(cat);
        document.querySelectorAll(`.pill-filter[data-cat="${cat}"]`).forEach(b => b.classList.add('active'));
        document.querySelectorAll(`.event-row[data-cat="${cat}"]`).forEach(r => { r.style.display = ''; });
      } else {
        hiddenCats.add(cat);
        document.querySelectorAll(`.pill-filter[data-cat="${cat}"]`).forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.event-row[data-cat="${cat}"]`).forEach(r => { r.style.display = 'none'; });
      }
    });
  });
}

// --- Init ---

async function init() {
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);

  try {
    // Build the diagnostics data URL
    let dataUrl = API_BASE;
    const qp = [];
    if (params.has('gameId')) qp.push(`gameId=${encodeURIComponent(params.get('gameId'))}`);
    if (params.has('roomCode')) qp.push(`roomCode=${encodeURIComponent(params.get('roomCode'))}`);
    if (params.has('category')) qp.push(`category=${encodeURIComponent(params.get('category'))}`);
    if (qp.length) dataUrl += '?' + qp.join('&');

    // Fetch data, nav, version info, ICE server status, and TURN usage in parallel
    const [dataRes, navRes, healthRes, pkgRes, iceRes, usageRes] = await Promise.all([
      fetch(dataUrl),
      fetch(`${API_BASE}/nav`),
      fetch('/api/chess/health').catch(() => null),
      fetch('/package.json').catch(() => null),
      fetch('/api/chess/ice-servers').catch(() => null),
      fetch('/api/chess/turn-usage').catch(() => null),
    ]);

    if (!dataRes.ok) {
      const err = await dataRes.json().catch(() => ({ error: 'Unknown error' }));
      app.innerHTML = `<div class="empty">${esc(err.error || 'Failed to load diagnostics')}</div>`;
      return;
    }

    const data = await dataRes.json();
    const navData = navRes.ok ? await navRes.json() : { entries: [] };
    const healthData = healthRes && healthRes.ok ? await healthRes.json().catch(() => ({})) : {};
    const pkgData = pkgRes && pkgRes.ok ? await pkgRes.json().catch(() => ({})) : {};
    const iceData = iceRes && iceRes.ok ? await iceRes.json().catch(() => null) : null;
    const usageData = usageRes && usageRes.ok ? await usageRes.json().catch(() => null) : null;
    const versions = { client: pkgData.version || null, api: healthData.version || null };

    app.innerHTML = renderDashboard(data, navData.entries, versions, iceData, usageData);
    bindEvents(data);
  } catch (e) {
    app.innerHTML = `<div class="empty">Error loading diagnostics: ${esc(e.message)}</div>`;
  }
}

init();
