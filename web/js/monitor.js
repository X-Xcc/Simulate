/* ============================================================
   monitor.js - Real-time monitoring dashboard
   Connects to backend APIs for live data
   ============================================================ */
(function() {
  'use strict';

  const API_BASE = '/yolov8-security';
  const DETECTION_TYPES = {
    fall:    { label: '跌倒', color: '#ef4444' },
    fight:   { label: '打架', color: '#f97316' },
    fatigue: { label: '疲劳', color: '#a855f7' },
    eye_fatigue: { label: '眼疲劳', color: '#8b5cf6' },
    absent:  { label: '离岗', color: '#3b82f6' },
    crowd:   { label: '聚集', color: '#eab308' },
  };

  // State
  let cameras = [];
  let stats = { totalDetections: 0, activeAlerts: 0, onlineDevices: '0/0', fps: 0 };
  let recentDetections = [];

  // ============================================================
  // CLOCK
  // ============================================================
  function updateClock() {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ============================================================
  // CAMERA GRID
  // ============================================================
  function renderCameras() {
    const grid = document.getElementById('cameraGrid');
    if (!grid) return;

    if (cameras.length === 0) {
      grid.innerHTML = Array.from({length: 6}, (_, i) => `
        <div class="cam-panel" data-cam="${i}">
          <div class="cam-header">
            <div class="cam-name">
              <span class="cam-status offline"></span>
              摄像头 ${i}
            </div>
            <div class="cam-meta">--</div>
          </div>
          <div class="cam-view">
            <div class="cam-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>等待摄像头连接...</span>
            </div>
          </div>
        </div>
      `).join('');
      return;
    }

    grid.innerHTML = cameras.map((cam, i) => {
      const camAlerts = recentDetections.filter(d =>
        d.actions && d.actions.length > 0
      );
      const hasAlert = camAlerts.length > 0 && i === 0;
      const alertType = hasAlert ? camAlerts[0].actions[0] : null;

      return `
        <div class="cam-panel ${hasAlert ? 'has-alert' : ''}" data-cam="${cam.id || i}">
          <div class="cam-header">
            <div class="cam-name">
              <span class="cam-status ${cam.online !== false ? '' : 'offline'}"></span>
              ${cam.name || cam.id || '摄像头 ' + i}
            </div>
            <div class="cam-meta">${cam.resolution || '1920x1080'}</div>
          </div>
          <div class="cam-view">
            <img src="${API_BASE}/video_feed?cam=${cam.id || i}" alt="${cam.name || '摄像头 ' + i}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                 onload="this.style.display='block';this.nextElementSibling.style.display='none'">
            <div class="cam-placeholder" style="display:none">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span>设备离线</span>
            </div>
            ${hasAlert ? `
              <div class="cam-alert-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                ${DETECTION_TYPES[alertType]?.label || alertType}
              </div>
            ` : ''}
            <div class="cam-hud">
              <div class="cam-hud-left">
                <div class="hud-tag ${hasAlert ? 'alert' : ''}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  <span class="val">${cam.personCount || 0}人</span>
                </div>
              </div>
              <div class="cam-hud-right">${new Date().toLocaleTimeString('zh-CN', { hour12: false })}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // ALERTS
  // ============================================================
  function renderAlerts() {
    const list = document.getElementById('alertList');
    const count = document.getElementById('alertCount');
    if (!list) return;

    const alerts = recentDetections
      .filter(d => d.actions && d.actions.length > 0)
      .slice(0, 20);

    if (count) count.textContent = alerts.length;

    if (alerts.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
          <span>暂无告警</span>
        </div>
      `;
      return;
    }

    list.innerHTML = alerts.map(d => {
      const action = d.actions[0];
      const type = DETECTION_TYPES[action];
      const severity = ['fall', 'fight'].includes(action) ? 'critical' : 'warning';
      return `
        <div class="alert-item ${severity}">
          <div class="alert-row">
            <span class="alert-type">${type?.label || action}</span>
            <span class="alert-time">${d.timestamp || '--'}</span>
          </div>
          <div class="alert-detail">检测到 ${type?.label || action} 行为，置信度 ${((d.confidence || 0) * 100).toFixed(0)}%</div>
        </div>
      `;
    }).join('');
  }

  // ============================================================
  // DEVICES
  // ============================================================
  function renderDevices() {
    const list = document.getElementById('deviceList');
    const count = document.getElementById('deviceCount');
    if (!list) return;

    if (count) count.textContent = cameras.length;

    if (cameras.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span>暂无设备</span>
        </div>
      `;
      return;
    }

    list.innerHTML = cameras.map(cam => `
      <div class="device-item">
        <div class="device-icon ${cam.online !== false ? 'online' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div class="device-info">
          <div class="device-name">${cam.name || cam.id}</div>
          <div class="device-meta">${cam.zone || cam.address || ''}</div>
        </div>
        <div class="device-status ${cam.online !== false ? 'online' : 'offline'}">${cam.online !== false ? '在线' : '离线'}</div>
      </div>
    `).join('');
  }

  // ============================================================
  // STATS
  // ============================================================
  function updateStats(data) {
    const totalEl = document.getElementById('totalDetections');
    const alertEl = document.getElementById('totalAlerts');
    const onlineEl = document.getElementById('onlineDevices');
    const fpsEl = document.getElementById('avgFps');

    if (totalEl && data.totalDetections !== undefined) {
      totalEl.textContent = data.totalDetections.toLocaleString();
    }
    if (alertEl && data.activeAlerts !== undefined) {
      alertEl.textContent = data.activeAlerts;
    }
    if (onlineEl && data.onlineDevices !== undefined) {
      onlineEl.textContent = data.onlineDevices;
    }
    if (fpsEl && data.fps !== undefined) {
      fpsEl.textContent = Math.round(data.fps);
    }
  }

  // ============================================================
  // API POLLING
  // ============================================================
  async function fetchStats() {
    try {
      const resp = await fetch(API_BASE + '/api/stats/summary');
      if (!resp.ok) return;
      const data = await resp.json();
      updateStats(data);
    } catch (e) { /* API not available */ }
  }

  async function fetchDetections() {
    try {
      const resp = await fetch(API_BASE + '/api/stats');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.recentDetections) {
        recentDetections = data.recentDetections;
      }
      renderAlerts();
    } catch (e) { /* API not available */ }
  }

  async function fetchCameras() {
    try {
      const [configResp, camerasResp] = await Promise.all([
        fetch(API_BASE + '/api/camera_config'),
        fetch(API_BASE + '/api/cameras')
      ]);

      let configData = [];
      let liveData = new Set();

      if (configResp.ok) {
        configData = await configResp.json();
      }
      if (camerasResp.ok) {
        const live = await camerasResp.json();
        if (Array.isArray(live)) liveData = new Set(live);
      }

      cameras = configData.map(cam => ({
        ...cam,
        online: liveData.has(cam.id) || liveData.has(String(cam.id))
      }));

      renderCameras();
      renderDevices();
    } catch (e) { /* API not available */ }
  }

  // ============================================================
  // FULLSCREEN
  // ============================================================
  document.addEventListener('click', e => {
    const btn = e.target.closest('.cam-fullscreen');
    if (!btn) return;
    const panel = btn.closest('.cam-panel');
    if (!panel) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      panel.requestFullscreen().catch(() => {});
    }
  });

  // ============================================================
  // INIT
  // ============================================================
  renderCameras();
  renderAlerts();
  renderDevices();

  // Initial fetch
  fetchStats();
  fetchDetections();
  fetchCameras();

  // Polling intervals (single shared timers)
  setInterval(fetchStats, 2000);
  setInterval(fetchDetections, 5000);
  setInterval(fetchCameras, 10000);

  // Update HUD timestamps
  setInterval(() => {
    document.querySelectorAll('.cam-hud-right').forEach(el => {
      el.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    });
  }, 1000);

})();
