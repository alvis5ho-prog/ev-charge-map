/* ============================================================
   app.js — EV Charging PWA 主控制器
   ============================================================ */

window.APP_STATE = {
  lang: localStorage.getItem('ev-lang') || 'zh-HK',
  theme: localStorage.getItem('ev-theme') || 'auto',
  highContrast: localStorage.getItem('ev-contrast') === '1',
  soc: parseFloat(localStorage.getItem('ev-soc') || '35'),          // 0-100
  carModelId: localStorage.getItem('ev-car') || 'tesla-m3',
  customBattery: parseFloat(localStorage.getItem('ev-cbat') || '60'),
  customMaxDC: parseFloat(localStorage.getItem('ev-cdc') || '100'),
  favorites: JSON.parse(localStorage.getItem('ev-fav') || '[]'),
  offlineRegions: JSON.parse(localStorage.getItem('ev-offline') || '[]'),
  filteredStations: [...STATIONS],
  selectedStationId: null,
  mapCenter: { lat: 22.32, lng: 114.17 },
  mapZoom: 11,
  installed: localStorage.getItem('ev-installed') === '1',
  installDismissed: localStorage.getItem('ev-install-dismissed') === '1'
};

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyLang();
  setupEventListeners();
  setupReportHandlers();
  setupBatterySlider();
  requestGeoAndInitMap();
  renderCarModelOptions();
  setupInstallPrompt();
  updateOnlineStatus();
  startAPISync();  // CLP API 即時同步

  if (navigator.onLine && !APP_STATE.installed && !APP_STATE.installDismissed) {
    setTimeout(() => {
      const b = document.getElementById('installBanner');
      if (b && !APP_STATE.installed) b.classList.add('show');
    }, 3000);
  }
});

/* ---------- Geo + Map ---------- */
function requestGeoAndInitMap() {
  const fallback = () => {
    initMap(22.32, 114.17);
    scoreAndFilter();
  };
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        APP_STATE.mapCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        initMap(pos.coords.latitude, pos.coords.longitude);
        setUserLocation(pos.coords.latitude, pos.coords.longitude);
        scoreAndFilter();
      },
      () => fallback(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  } else fallback();
}

/* ---------- AI scoring + filter ---------- */
function computeScore(st) {
  const car = getCarParams();
  const here = APP_STATE.mapCenter;
  const { distKm, driveMin } = estimateDriveMin(here.lat, here.lng, st.lat, st.lng);
  return computeAIScore(st, {
    carBattery: car.battery,
    carMaxDC: car.maxDC,
    soc: APP_STATE.soc / 100,
    nowHour: new Date().getHours(),
    distKm, driveMin
  });
}
window.computeScore = computeScore;

function getCarParams() {
  const m = EV_MODELS.find(x => x.id === APP_STATE.carModelId) || EV_MODELS[0];
  if (m.id === 'other') {
    return { battery: APP_STATE.customBattery, maxDC: APP_STATE.customMaxDC, model: m };
  }
  return { battery: m.battery, maxDC: m.maxDC, model: m };
}

function scoreAndFilter() {
  APP_STATE.filteredStations = [...STATIONS];
  refreshMarkers();
}

/* ---------- Theme / Lang ---------- */
function applyTheme() {
  const html = document.documentElement;
  if (APP_STATE.theme === 'auto') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', APP_STATE.theme);
  }
  html.setAttribute('data-contrast', APP_STATE.highContrast ? 'high' : 'normal');
}
function applyLang() {
  document.documentElement.setAttribute('data-lang', APP_STATE.lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  updateBatteryDisplay();
}

/* ---------- Event listeners ---------- */
function setupEventListeners() {
  // search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', debounce(() => onSearch(searchInput.value), 250));
  searchInput.addEventListener('focus', () => {
    if (searchInput.value) onSearch(searchInput.value);
  });

  // topbar buttons
  document.getElementById('btnSettings').addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('btnList').addEventListener('click', () => toggleListPanel());
  document.getElementById('btnDark').addEventListener('click', toggleDarkMode);

  // fab
  document.getElementById('fabReport').addEventListener('click', () => openReport());

  // panel close
  document.getElementById('panelClose').addEventListener('click', closePanel);
  document.getElementById('listClose').addEventListener('click', () => {
    document.getElementById('listPanel').classList.remove('open');
  });

  // legend toggle
  document.getElementById('legendToggle').addEventListener('click', () => {
    document.getElementById('legend').classList.add('collapsed');
  });
  document.getElementById('legendOpen').addEventListener('click', () => {
    document.getElementById('legend').classList.remove('collapsed');
  });

  // modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.remove('open');
    });
  });

  // settings
  document.getElementById('selLang').addEventListener('change', e => {
    APP_STATE.lang = e.target.value;
    localStorage.setItem('ev-lang', APP_STATE.lang);
    applyLang();
    if (APP_STATE.selectedStationId) renderPanel(APP_STATE.selectedStationId);
  });
  document.getElementById('selTheme').addEventListener('change', e => {
    APP_STATE.theme = e.target.value;
    localStorage.setItem('ev-theme', APP_STATE.theme);
    applyTheme();
  });
  document.getElementById('chkContrast').addEventListener('change', e => {
    APP_STATE.highContrast = e.target.checked;
    localStorage.setItem('ev-contrast', APP_STATE.highContrast ? '1' : '0');
    applyTheme();
  });
  document.getElementById('selCarModel').addEventListener('change', e => {
    APP_STATE.carModelId = e.target.value;
    localStorage.setItem('ev-car', APP_STATE.carModelId);
    renderCarModelOptions();
    scoreAndFilter();
  });

  // install banner
  document.getElementById('installBtn').addEventListener('click', () => doInstall());
  document.getElementById('installClose').addEventListener('click', () => {
    document.getElementById('installBanner').classList.remove('show');
    APP_STATE.installDismissed = true;
    localStorage.setItem('ev-install-dismissed', '1');
  });

  // online/offline
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // close search results on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('.search-results')) {
      document.getElementById('searchResults').classList.remove('open');
    }
  });
}

function toggleDarkMode() {
  const html = document.documentElement;
  const cur = html.getAttribute('data-theme');
  APP_STATE.theme = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ev-theme', APP_STATE.theme);
  applyTheme();
}

/* ---------- Battery slider ---------- */
function setupBatterySlider() {
  const slider = document.getElementById('batterySlider');
  slider.value = APP_STATE.soc;
  slider.addEventListener('input', e => {
    APP_STATE.soc = parseFloat(e.target.value);
    localStorage.setItem('ev-soc', APP_STATE.soc);
    updateBatteryDisplay();
    scoreAndFilter();
    if (APP_STATE.selectedStationId) renderPanel(APP_STATE.selectedStationId);
  });
  updateBatteryDisplay();
}

function updateBatteryDisplay() {
  const v = APP_STATE.soc;
  const el = document.getElementById('batteryValue');
  el.textContent = `${Math.round(v)}%`;
  el.classList.toggle('low', v < 15);
  const alert = document.getElementById('lowBatAlert');
  if (v < 15) {
    alert.classList.remove('hidden');
    alert.textContent = t('lowBattery');
  } else {
    alert.classList.add('hidden');
  }
}

function renderCarModelOptions() {
  const sel = document.getElementById('selCarModel');
  if (!sel) return;
  sel.innerHTML = EV_MODELS.map(m =>
    `<option value="${m.id}" ${m.id === APP_STATE.carModelId ? 'selected' : ''}>${m[APP_STATE.lang === 'en' ? 'en' : 'zh']}</option>`
  ).join('');
  const customWrap = document.getElementById('customCarWrap');
  if (customWrap) {
    customWrap.classList.toggle('hidden', APP_STATE.carModelId !== 'other');
    if (APP_STATE.carModelId === 'other') {
      document.getElementById('inpCustomBat').value = APP_STATE.customBattery;
      document.getElementById('inpCustomDC').value = APP_STATE.customMaxDC;
    }
  }
}

/* ---------- Search ---------- */
function onSearch(q) {
  const box = document.getElementById('searchResults');
  if (!q || q.length < 1) {
    box.classList.remove('open');
    return;
  }
  const lower = q.toLowerCase();
  const langKey = APP_STATE.lang === 'en' ? 'en' : 'zh';
  const results = STATIONS.filter(st =>
    st.name[langKey].toLowerCase().includes(lower) ||
    st.name.zh.includes(q) ||
    st.name.en.toLowerCase().includes(lower) ||
    st.address[langKey].toLowerCase().includes(lower) ||
    st.provider[langKey].toLowerCase().includes(lower) ||
    st.providerCode.toLowerCase().includes(lower)
  ).slice(0, 8);

  if (results.length === 0) {
    box.innerHTML = `<div class="search-result-item"><div class="sr-info"><div class="sr-name">${APP_STATE.lang === 'en' ? 'No results' : '找不到結果'}</div></div></div>`;
  } else {
    box.innerHTML = results.map(st => {
      const sc = computeScore(st);
      const color = AI_LEVELS[sc.level]?.color || '#999';
      return `
        <div class="search-result-item" data-sid="${st.id}">
          <div class="sr-icon" style="background:${color}">${st.providerCode}</div>
          <div class="sr-info">
            <div class="sr-name">${st.name[langKey]}</div>
            <div class="sr-sub">${st.address[langKey]}</div>
          </div>
        </div>`;
    }).join('');
    box.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const sid = item.getAttribute('data-sid');
        box.classList.remove('open');
        document.getElementById('searchInput').value = '';
        openStation(sid);
      });
    });
  }
  box.classList.add('open');
}

/* ---------- Station panel ---------- */
function openStation(id) {
  const st = STATIONS.find(s => s.id === id);
  if (!st) return;
  APP_STATE.selectedStationId = id;
  renderPanel(id);
  document.getElementById('stationPanel').classList.add('open');
  flyToStation(st);
}

function closePanel() {
  document.getElementById('stationPanel').classList.remove('open');
  APP_STATE.selectedStationId = null;
}
window.onStationClick = openStation;

function renderPanel(id) {
  const st = STATIONS.find(s => s.id === id);
  if (!st) return;
  const langKey = APP_STATE.lang === 'en' ? 'en' : 'zh';
  const sc = computeScore(st);
  const totals = stationTotals(st);
  const ring = RING_STYLES[st.ring] || RING_STYLES.nodata;
  const links = navLinks(st.lat, st.lng, st.name[langKey]);
  const isFav = APP_STATE.favorites.includes(id);
  const car = getCarParams();

  document.getElementById('panelTitle').textContent = st.name[langKey];

  // 數據來源標籤
  const dataSourceLabel = {
    api:   `<span class="chip available">🟢 ${t('liveData')}</span>`,
    crowd: `<span class="chip busy">⏱ ${t('crowdData')} ${st.lastUserReportTime || ''}</span>`,
    static: `<span class="chip nodata">⚪ ${t('staticData')}</span>`
  }[st.dataSource] || '';

  // ring key mapping: nodata → ringNoData
  const ringKeyMap = {
    'available': 'ringAvailable', 'busy': 'ringBusy', 'crowded': 'ringCrowded',
    'nodata': 'ringNoData', 'maintenance': 'ringMaintenance', 'unverified': 'ringUnverified'
  };
  const ringKey = ringKeyMap[st.ring] || 'ringNoData';

  document.getElementById('panelSub').innerHTML = `
    <span class="score-badge ${sc.level}">${sc.score} · ${t('ai' + sc.level.charAt(0).toUpperCase() + sc.level.slice(1))}</span>
    <span class="chip ${st.ring}"><span class="chip-dot" style="background:${ring.color}"></span>${t(ringKey)}</span>
    ${dataSourceLabel}
  `;

  const body = document.getElementById('panelBody');
  body.innerHTML = `
    ${(!st.hasLiveAPI && st.dataSource !== 'crowd') ? `
      <div class="transparency-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <div>
          <b>${t('staticData')}</b><br>
          <span class="text-xs">${t('dataTransparencyNote')}${st.lastUserReportTime ? ' ' + st.lastUserReportTime : ' —'}</span>
        </div>
      </div>
    ` : st.dataSource === 'crowd' ? `
      <div class="transparency-note crowd">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <div>
          <b>${t('crowdData')} ${st.lastUserReportTime || ''}</b><br>
          <span class="text-xs">${t('reportTime')}: ${st.lastUserReportTime || '—'}</span>
        </div>
      </div>
    ` : ''}

    <div class="p-section">
      <div class="p-section-title">${t('stationDetail')}</div>
      <div class="kv-row"><span class="kv-key">${t('provider')}</span><span class="kv-val">${st.provider[langKey]}</span></div>
      <div class="kv-row"><span class="kv-key">${t('address')}</span><span class="kv-val">${st.address[langKey]}</span></div>
      <div class="kv-row"><span class="kv-key">${t('parking')}</span><span class="kv-val">${st.parking[langKey]}</span></div>
      <div class="kv-row"><span class="kv-key">${t('parkingNote')}</span><span class="kv-val">${st.parkingNote[langKey]}</span></div>
      <div class="kv-row"><span class="kv-key">${t('payment')}</span><span class="kv-val">${st.payment[langKey]}</span></div>
      <div class="kv-row"><span class="kv-key">${t('hours')}</span><span class="kv-val">${st.hours[langKey]}</span></div>
      <div class="kv-row">
        <span class="kv-key">${t('queue')}</span>
        <span class="kv-val">
          ${st.queue === null ? t('queueUnknown') : st.queue === 0 ? t('queueNone') : `${st.queue} ${t('queueCars')}`}
          <span class="text-xs text-muted">(${t('conf' + st.queueConfidence.charAt(0).toUpperCase() + st.queueConfidence.slice(1))})</span>
        </span>
      </div>
    </div>

    <!-- 樓層 -->
    <div class="p-section">
      <div class="p-section-title">${t('floors')} · ${t('totalStalls')} ${totals.total} · ${t('available')} ${totals.available}</div>
      ${st.floors.map((f, i) => `
        <div class="floor-item ${i === 0 ? 'open' : ''}" data-floor="${i}">
          <button class="floor-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="floor-name">${f.level[langKey]}</span>
            <span class="floor-count"><b>${f.available}</b>/${f.total}</span>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="floor-body">
            ${f.stalls.map(s => `
              <div class="stall-row">
                <span class="stall-connector">${s.connector}</span>
                <span class="stall-kw">${s.kw} kW</span>
                <span class="stall-avail ${s.available === 0 ? 'zero' : ''}">${s.available}/${s.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 評分明細 -->
    <div class="p-section">
      <div class="p-section-title">${t('scoreBreakdown')}</div>
      <div class="score-bar-row">
        <span class="score-bar-label">${t('factorCost')}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc.factors.cost}%"></div></div>
        <span class="score-bar-val">${sc.factors.cost}</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">${t('factorEase')}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc.factors.ease}%"></div></div>
        <span class="score-bar-val">${sc.factors.ease}</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">${t('factorTime')}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc.factors.time}%"></div></div>
        <span class="score-bar-val">${sc.factors.time}</span>
      </div>
      <div class="score-bar-row">
        <span class="score-bar-label">${t('factorPower')}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${sc.factors.powerMatch}%"></div></div>
        <span class="score-bar-val">${sc.factors.powerMatch}</span>
      </div>
      <div class="kv-row mt-2">
        <span class="kv-key">${t('aiTotal')}</span>
        <span class="kv-val"><span class="score-badge ${sc.level}">${sc.score}</span></span>
      </div>
      <div class="kv-row">
        <span class="kv-key">${t('aiReason')}</span>
        <span class="kv-val text-sm">${t(sc.reasonKey)}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">${t('estChargeTime')}</span>
        <span class="kv-val">${sc.chargeMin} ${t('min')}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Model</span>
        <span class="kv-val text-xs text-muted">${car.model[langKey]} · ${car.battery}kWh · ${car.maxDC}kW</span>
      </div>
    </div>

    <!-- 用戶回報 -->
    ${st.reports.length > 0 ? `
      <div class="p-section">
        <div class="p-section-title">${t('reports')} (${st.reports.length})</div>
        ${st.reports.map(r => `
          <div class="report-item">
            <div class="report-meta">
              <span class="report-user">@${r.user}</span>
              <span class="report-timestamp">🕐 ${r.at}</span>
              ${r.issueType ? `<span class="report-issue-tag">${issueTypeLabel(r.issueType)}</span>` : ''}
              ${r.verified
                ? `<span class="report-badge verified">✓ ${t('verifyConfirmed')}</span>`
                : r.matchCount > 0
                  ? `<span class="report-badge verified">✓ ${r.matchCount} ${t('likes')}</span>`
                  : `<span class="report-badge unverified">${t('verifyUnconfirmed')}</span>`
              }
              <span class="report-likes">♥ ${r.likes || 0} ${t('likes')}</span>
            </div>
            <div>${r[langKey]}</div>
            ${r.photo ? `<div class="text-xs text-muted mt-1">📷 ${t('photoRequired')}</div>` : ''}
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Actions -->
    <div class="action-row">
      <a class="btn btn-primary" href="${links.google}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
        ${t('navigate')}
      </a>
      <button class="btn btn-outline btn-icon-only" id="btnFav" title="${t('favorite')}">
        ${isFav
          ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
        }
      </button>
    </div>
  `;

  // fav button
  const favBtn = document.getElementById('btnFav');
  if (favBtn) {
    favBtn.addEventListener('click', () => toggleFav(id));
  }

  // Apple Maps link also
  const googleLink = body.querySelector('a[href*="google"]');
  if (googleLink) {
    // add apple as secondary
    const row = googleLink.parentElement;
    row.innerHTML = `
      <a class="btn btn-primary" href="${links.google}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
        ${t('googleMaps')}
      </a>
      <a class="btn btn-ghost" href="${links.apple}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
        ${t('appleMaps')}
      </a>
      <button class="btn btn-outline btn-icon-only" id="btnFav2" title="${t('favorite')}">
        ${APP_STATE.favorites.includes(id)
          ? `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
        }
      </button>`;
    row.querySelector('#btnFav2').addEventListener('click', () => toggleFav(id));
  }
}

function toggleFav(id) {
  const idx = APP_STATE.favorites.indexOf(id);
  if (idx >= 0) APP_STATE.favorites.splice(idx, 1);
  else APP_STATE.favorites.push(id);
  localStorage.setItem('ev-fav', JSON.stringify(APP_STATE.favorites));
  if (APP_STATE.selectedStationId === id) renderPanel(id);
}

/* ---------- List panel ---------- */
function toggleListPanel() {
  const el = document.getElementById('listPanel');
  const isOpen = el.classList.contains('open');
  if (isOpen) {
    el.classList.remove('open');
    return;
  }
  renderStationList();
  el.classList.add('open');
}

function renderStationList(sortBy) {
  sortBy = sortBy || 'ai';
  const langKey = APP_STATE.lang === 'en' ? 'en' : 'zh';
  const here = APP_STATE.mapCenter;

  const scored = STATIONS.map(st => {
    const sc = computeScore(st);
    const { distKm } = estimateDriveMin(here.lat, here.lng, st.lat, st.lng);
    return { st, sc, distKm };
  });

  if (sortBy === 'dist') scored.sort((a, b) => a.distKm - b.distKm);
  else scored.sort((a, b) => b.sc.score - a.sc.score);

  const body = document.getElementById('listBody');
  body.innerHTML = scored.map(({ st, sc, distKm }) => {
    const color = AI_LEVELS[sc.level]?.color || '#999';
    const ring = RING_STYLES[st.ring] || RING_STYLES.nodata;
    return `
      <div class="list-item" data-sid="${st.id}">
        <div class="li-dot" style="background:${color};border-color:${ring.color}">${st.providerCode}</div>
        <div class="li-info">
          <div class="li-name">${st.name[langKey]}</div>
          <div class="li-sub">${distKm} ${t('km')} · ${t('estChargeTime')} ${sc.chargeMin}${t('min')}</div>
        </div>
        <div class="li-score" style="background:${color}">${sc.score}</div>
      </div>`;
  }).join('');

  body.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const sid = item.getAttribute('data-sid');
      document.getElementById('listPanel').classList.remove('open');
      openStation(sid);
    });
  });

  // sort chips
  const sortWrap = document.getElementById('listSort');
  sortWrap.innerHTML = `
    <button class="sort-chip ${sortBy === 'ai' ? 'active' : ''}" data-sort="ai">${t('sortByAI')}</button>
    <button class="sort-chip ${sortBy === 'dist' ? 'active' : ''}" data-sort="dist">${t('sortByDist')}</button>
  `;
  sortWrap.querySelectorAll('.sort-chip').forEach(chip => {
    chip.addEventListener('click', () => renderStationList(chip.getAttribute('data-sort')));
  });
}

/* ---------- Report system ---------- */
let reportState = {
  photoData: null,
  issueType: null,
  stationId: null
};

/* ---------- AI Photo Analysis ---------- */
function analyzePhoto(photoDataUrl) {
  const analysisDiv = document.getElementById('aiAnalysis');
  const grid = document.getElementById('aiResultGrid');

  // Show loading
  analysisDiv.classList.remove('hidden');
  grid.innerHTML = `
    <div class="ai-loading" style="grid-column:1/-1">
      <div class="spinner"></div>
      <span>AI 正在分析相片內容…</span>
    </div>
  `;

  // Simulate AI analysis (in production: call vision API)
  setTimeout(() => {
    const aiResult = simulateAIVision(photoDataUrl);
    renderAIResult(aiResult);
  }, 2000);
}

function simulateAIVision(photoDataUrl) {
  // In production: send to GPT-4V / Gemini Vision / etc.
  // For now, return plausible estimates based on issue type
  const issue = reportState.issueType || 'other';
  const results = {
    queue: issue === 'queue' ? Math.floor(Math.random() * 8) + 1 : 0,
    availableStalls: Math.floor(Math.random() * 5),
    brokenChargers: issue === 'broken' ? Math.floor(Math.random() * 3) + 1 : 0,
    confidence: 0.75 + Math.random() * 0.2
  };
  return results;
}

function renderAIResult(result) {
  const grid = document.getElementById('aiResultGrid');
  grid.innerHTML = `
    <div class="ai-result-item">
      <label>排隊車輛數</label>
      <input type="number" id="aiQueue" value="${result.queue}" min="0" max="50">
      <div class="ai-confidence">AI 信心: ${Math.round(result.confidence * 100)}%</div>
    </div>
    <div class="ai-result-item">
      <label>可用充電位</label>
      <input type="number" id="aiAvailable" value="${result.availableStalls}" min="0" max="50">
      <div class="ai-confidence">AI 信心: ${Math.round((result.confidence - 0.05) * 100)}%</div>
    </div>
    <div class="ai-result-item">
      <label>損壞充電槍</label>
      <input type="number" id="aiBroken" value="${result.brokenChargers}" min="0" max="20">
      <div class="ai-confidence">AI 信心: ${Math.round((result.confidence - 0.1) * 100)}%</div>
    </div>
    <div class="ai-result-item">
      <label>問題類型</label>
      <select id="aiIssueType">
        <option value="queue" ${reportState.issueType === 'queue' ? 'selected' : ''}>排隊狀況</option>
        <option value="broken" ${reportState.issueType === 'broken' ? 'selected' : ''}>充電槍損壞</option>
        <option value="payment" ${reportState.issueType === 'payment' ? 'selected' : ''}>付款故障</option>
        <option value="occupied" ${reportState.issueType === 'occupied' ? 'selected' : ''}>被佔位</option>
      </select>
      <div class="ai-confidence">可手動修改</div>
    </div>
  `;
}

/* ---------- Report submission (with photo upload) ---------- */
function submitReport() {
  if (!reportState.photoData) {
    alert(t('photoRequired'));
    return;
  }
  if (!reportState.issueType) {
    alert(t('issueType') + ' — ' + t('submit'));
    return;
  }

  const st = STATIONS.find(s => s.id === reportState.stationId);
  const text = document.getElementById('reportText').value.trim();
  const langKey = APP_STATE.lang === 'en' ? 'en' : 'zh';

  // Get AI-analyzed values (user can edit)
  const aiQueue = document.getElementById('aiQueue') ? parseInt(document.getElementById('aiQueue').value) : null;
  const aiAvailable = document.getElementById('aiAvailable') ? parseInt(document.getElementById('aiAvailable').value) : null;
  const aiBroken = document.getElementById('aiBroken') ? parseInt(document.getElementById('aiBroken').value) : null;
  const aiIssue = document.getElementById('aiIssueType') ? document.getElementById('aiIssueType').value : reportState.issueType;

  // Close report modal
  document.getElementById('reportModal').classList.remove('open');

  // 上載結構化數據（唔存相片，慳 server space）
  fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stationId: reportState.stationId,
      issueType: aiIssue,
      description: text,
      queueCount: aiQueue || 0,
      availableStalls: aiAvailable || 0,
      brokenChargers: aiBroken || 0,
      hasPhoto: !!reportState.photoData  // 只記錄有冇相，唔存相
    })
  }).then(r => r.json()).then(data => {
    console.log('[Report] Saved:', data.message);
    // 釋放相片記憶體
    reportState.photoData = null;
  }).catch(err => {
    console.warn('[Report] Save failed:', err);
    reportState.photoData = null;
  });

  // Update station with AI-analyzed data (synchronous)
  if (st) {
    st.reports.push({
      user: 'You',
      at: new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }),
      zh: text || `${issueTypeLabel(aiIssue)}：排隊 ${aiQueue} 台，可用 ${aiAvailable} 位`,
      en: text || `${issueTypeLabel(aiIssue)}: queue ${aiQueue}, available ${aiAvailable}`,
      likes: 0,
      issueType: aiIssue,
      photo: true,
      verified: false,
      matchCount: 0
    });

    // Apply crowd report to update ring + queue
    if (typeof applyCrowdReportToStation === 'function') {
      applyCrowdReportToStation(st.id, aiIssue, aiQueue);
    }
    // Also update available stalls if AI detected
    if (aiAvailable !== null && st.floors && st.floors.length > 0) {
      st.floors[0].available = aiAvailable;
    }
  }

  // Show verification modal
  const verifyBody = document.getElementById('verifyBody');
  verifyBody.innerHTML = `
    <div class="text-center" style="padding:var(--sp-6) 0">
      <div class="spinner" style="margin:0 auto"></div>
      <div class="mt-3 text-sm text-muted">${t('verifyChecking')}</div>
    </div>
  `;
  openModal('verifyModal');

  setTimeout(() => {
    const matches = simulateCrossReference(st, aiIssue);
    renderVerificationResult(st, matches, text);
  }, 1500);
}

function openReport() {
  const st = APP_STATE.selectedStationId ? STATIONS.find(s => s.id === APP_STATE.selectedStationId) : null;
  reportState = { photoData: null, issueType: null, stationId: APP_STATE.selectedStationId };
  document.getElementById('reportStationName').textContent = st
    ? st.name[APP_STATE.lang === 'en' ? 'en' : 'zh']
    : (APP_STATE.lang === 'en' ? 'Select a station first' : '請先選擇站點');
  document.getElementById('reportText').value = '';
  document.getElementById('photoPreview').classList.add('hidden');
  document.getElementById('photoUploadPrompt').classList.remove('hidden');
  document.getElementById('photoUploadZone').classList.remove('has-photo');
  document.querySelectorAll('.issue-chip').forEach(c => c.classList.remove('active'));
  openModal('reportModal');
}

function setupReportHandlers() {
  // Issue type selection
  document.querySelectorAll('.issue-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.issue-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      reportState.issueType = chip.getAttribute('data-type');
    });
  });

  // Photo upload
  const photoZone = document.getElementById('photoUploadZone');
  const photoInput = document.getElementById('photoInput');
  photoZone.addEventListener('click', (e) => {
    if (e.target === photoInput || e.target.closest('.photo-remove-btn')) return;
    photoInput.click();
  });

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      reportState.photoData = ev.target.result;
      document.getElementById('photoPreviewImg').src = ev.target.result;
      document.getElementById('photoPreview').classList.remove('hidden');
      document.getElementById('photoUploadPrompt').classList.add('hidden');
      photoZone.classList.add('has-photo');
      // 觸發 AI 分析
      analyzePhoto(ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('photoRemoveBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    reportState.photoData = null;
    document.getElementById('photoPreview').classList.add('hidden');
    document.getElementById('photoUploadPrompt').classList.remove('hidden');
    photoZone.classList.remove('has-photo');
    photoInput.value = '';
  });

  // Submit report
  document.getElementById('reportSubmitBtn').addEventListener('click', submitReport);
}

/* Simulate searching online for similar reports */
function simulateCrossReference(station, issueType) {
  // In production: search EV-BOY, forums, social media for similar reports
  // For now, generate plausible results based on station history
  const results = [];
  const now = new Date();
  const issueNames = {
    broken: t('issueBroken'),
    payment: t('issuePayment'),
    occupied: t('issueOccupied'),
    queue: t('issueQueue'),
    info: t('issueInfo'),
    other: t('issueOther')
  };

  // Check station's own reports
  if (station && station.reports && station.reports.length > 0) {
    station.reports.forEach(r => {
      results.push({
        source: '本站用戶回報',
        sourceEn: 'Station user report',
        user: r.user,
        time: r.at,
        text: r[APP_STATE.lang === 'en' ? 'en' : 'zh'],
        match: true
      });
    });
  }

  // Simulated external reports (random chance of finding matches)
  const externalTemplates = {
    broken: [
      { source: 'EV-BOY 用戶回報', text: { zh: '有人回報同樣位置充電槍故障', en: 'User reported charger fault at same location' } },
      { source: 'Facebook EV 群組', text: { zh: '群組有人提及此站充電槍問題', en: 'Mentioned in Facebook EV group' } }
    ],
    payment: [
      { source: 'EV-BOY 用戶回報', text: { zh: '有人回報 App 付款失敗', en: 'User reported app payment failure' } },
      { source: 'LIHKG 討論區', text: { zh: '討論區有類似付款問題討論', en: 'Similar payment issues discussed on forum' } }
    ],
    occupied: [
      { source: 'EV-BOY 用戶回報', text: { zh: '有人回報佔位情況', en: 'User reported ICE / blocked situation' } }
    ],
    queue: [
      { source: 'GPS 圍欄數據', text: { zh: 'GPS 數據顯示此站排隊人數上升', en: 'GPS geofence data shows queue increasing' } }
    ],
    info: [],
    other: []
  };

  const external = externalTemplates[issueType] || [];
  // 50% chance of finding external matches
  if (Math.random() > 0.3 && external.length > 0) {
    const n = Math.min(external.length, 1 + Math.floor(Math.random() * external.length));
    for (let i = 0; i < n; i++) {
      results.push({
        source: external[i].source,
        text: external[i].text[APP_STATE.lang === 'en' ? 'en' : 'zh'],
        match: true
      });
    }
  }

  return results;
}

function renderVerificationResult(station, matches, description) {
  const langKey = APP_STATE.lang === 'en' ? 'en' : 'zh';
  const matchCount = matches.filter(m => m.match).length;
  const isConfirmed = matchCount >= 2;

  // Update station ring if confirmed issue
  if (isConfirmed && station && reportState.issueType === 'broken') {
    station.ring = 'maintenance';
  }

  const html = `
    <div class="text-sm" style="margin-bottom:var(--sp-3)">
      <b>${station ? station.name[langKey] : '—'}</b>
      <div class="mt-1">
        <span class="report-issue-tag">${issueTypeLabel(reportState.issueType)}</span>
        ${reportState.photoData ? `<img class="report-photo-thumb" src="${reportState.photoData}" alt="report photo">` : ''}
      </div>
      ${description ? `<div class="text-xs text-muted mt-2">${description}</div>` : ''}
    </div>

    <div class="p-section-title">${t('verifySource')}</div>

    ${matches.length === 0 ? `
      <div class="verify-result-row">
        <div class="verify-icon nomatch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
        </div>
        <div class="verify-status-text">
          <b>${t('verifyNoMatch')}</b>
          <small>${t('verifySingleReport')}</small>
        </div>
        <span class="report-badge unverified">${t('verifyUnconfirmed')}</span>
      </div>
    ` : matches.map(m => `
      <div class="verify-result-row">
        <div class="verify-icon ${m.match ? 'match' : 'nomatch'}">
          ${m.match
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><path d="M20 6L9 17l-5-5"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>`
          }
        </div>
        <div class="verify-status-text">
          <b>${m.source}${m.user ? ` (@${m.user})` : ''}</b>
          <small>${m.text}${m.time ? ` · ${m.time}` : ''}</small>
        </div>
      </div>
    `).join('')}

    <div class="mt-3" style="text-align:center">
      ${isConfirmed
        ? `<span class="report-badge multi">${t('verifyConfirmed')}</span>`
        : matchCount > 0
          ? `<span class="report-badge verified">${t('verifyMatchFound').replace('{n}', matchCount)}</span>`
          : `<span class="report-badge unverified">${t('verifyUnconfirmed')}</span>`
      }
    </div>

    <!-- Add to station reports -->
    <div class="action-row mt-4">
      <button class="btn btn-primary" id="verifyConfirmBtn">${t('close')}</button>
    </div>
  `;

  document.getElementById('verifyBody').innerHTML = html;

  // Save report to station
  if (station) {
    station.reports.push({
      user: 'You',
      at: new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }),
      zh: description || issueTypeLabel('broken'),
      en: description || 'User report',
      likes: 0,
      issueType: reportState.issueType,
      photo: reportState.photoData ? true : false,
      verified: isConfirmed,
      matchCount: matchCount
    });

    // 自動改外環：眾包回報即時更新狀態
    const queueMatch = description ? description.match(/(\d+)\s*(?:台|架|輛|架車|cars?)/i) : null;
    const queueCount = queueMatch ? parseInt(queueMatch[1]) : (reportState.issueType === 'queue' ? 1 : 0);
    if (typeof applyCrowdReportToStation === 'function') {
      applyCrowdReportToStation(station.id, reportState.issueType, queueCount);
    }
  }

  // Confirm button
  document.getElementById('verifyConfirmBtn').addEventListener('click', () => {
    document.getElementById('verifyModal').classList.remove('open');
    if (APP_STATE.selectedStationId) renderPanel(APP_STATE.selectedStationId);
  });
}

function issueTypeLabel(type) {
  const labels = {
    broken: t('issueBroken'),
    payment: t('issuePayment'),
    occupied: t('issueOccupied'),
    queue: t('issueQueue'),
    info: t('issueInfo'),
    other: t('issueOther')
  };
  return labels[type] || t('issueOther');
}

/* ---------- Modal helpers ---------- */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

/* ---------- Install PWA ---------- */
let deferredPrompt = null;
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    APP_STATE.installed = true;
    localStorage.setItem('ev-installed', '1');
    document.getElementById('installBanner').classList.remove('show');
    deferredPrompt = null;
  });
}
function doInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') {
        APP_STATE.installed = true;
        localStorage.setItem('ev-installed', '1');
      }
      deferredPrompt = null;
    });
  } else {
    openModal('installModal');
  }
  document.getElementById('installBanner').classList.remove('show');
}

/* ---------- Network status ---------- */
function updateOnlineStatus() {
  const badge = document.getElementById('netBadge');
  if (navigator.onLine) {
    badge.classList.remove('offline');
    badge.querySelector('.net-text').textContent = t('online');
  } else {
    badge.classList.add('offline');
    badge.querySelector('.net-text').textContent = t('offline');
  }
}

/* ---------- Utilities ---------- */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
