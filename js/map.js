/* ============================================================
   map.js — Leaflet 地圖 + 自訂圓點/分群 + 縮放層級行為
   ============================================================ */

let map = null;
let markerLayer = null;
let stationMarkers = new Map();  // stationId → L.marker
let userMarker = null;

const ZOOM_OVERVIEW = 10;   // 50km 總覽
const ZOOM_BRAND    = 13;   // 展開品牌
const ZOOM_DETAIL   = 15;   // 超高倍率

/* 品牌色 */
const BRAND_COLORS = {
  'TS':   '#CC0000',
  'SH':   '#FFD500',
  'CLP':  '#0057B8',
  'HKE':  '#00A651',
  'PIT':  '#E8430A',
  'DCH':  '#1A237E',
  'JOVE': '#00897B',
  'CP':   '#FF6F00',
  'CS':   '#6A1B9A',
  'S3':   '#37474F',
  'GCSS': '#0097A7',
  'RX':   '#2E7D32',
  'TP':   '#E91E63',
  'EC':   '#00BCD4'
};

function initMap(lat, lng) {
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([lat, lng], ZOOM_OVERVIEW + 1);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // 使用者位置
  const userIcon = L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35);"></div>`
  });
  userMarker = L.marker([lat, lng], { icon: userIcon, interactive: false }).addTo(map);

  map.on('zoomend', () => renderMarkers());
  map.on('moveend', () => {
    if (window.APP_STATE) {
      window.APP_STATE.mapCenter = map.getCenter();
      window.APP_STATE.mapZoom = map.getZoom();
    }
  });

  renderMarkers();
}

function setUserLocation(lat, lng) {
  if (!map) return;
  userMarker.setLatLng([lat, lng]);
}

/* ---------- Marker rendering ---------- */

function renderMarkers() {
  if (!markerLayer) return;
  markerLayer.clearLayers();
  stationMarkers.clear();

  const zoom = map.getZoom();
  const stations = (window.APP_STATE?.filteredStations || STATIONS);

  if (zoom < ZOOM_BRAND - 1) {
    // — 分群模式 —
    renderClusters(stations, zoom);
  } else {
    // — 單站模式 —
    stations.forEach(st => {
      const marker = L.marker([st.lat, st.lng], {
        icon: createStationIcon(st, zoom),
        riseOnHover: true
      });
      marker.on('click', () => {
        if (window.onStationClick) window.onStationClick(st.id);
      });
      marker.addTo(markerLayer);
      stationMarkers.set(st.id, marker);
    });
  }
}

function renderClusters(stations, zoom) {
  // 依經緯度簡單分群（格狀）
  const cellSize = zoom <= 9 ? 0.12 : 0.06;  // degree grid
  const cells = new Map();

  stations.forEach(st => {
    const key = `${Math.floor(st.lat / cellSize)}_${Math.floor(st.lng / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(st);
  });

  cells.forEach((group, key) => {
    if (group.length === 1) {
      const st = group[0];
      const marker = L.marker([st.lat, st.lng], {
        icon: createStationIcon(st, zoom),
        riseOnHover: true
      });
      marker.on('click', () => {
        if (window.onStationClick) window.onStationClick(st.id);
      });
      marker.addTo(markerLayer);
      stationMarkers.set(st.id, marker);
      return;
    }

    // 分群圓點
    const avgLat = group.reduce((s, x) => s + x.lat, 0) / group.length;
    const avgLng = group.reduce((s, x) => s + x.lng, 0) / group.length;

    // 以最高 AI 評分當群組顏色
    let bestLevel = 'unknown';
    let bestOrder = 0;
    group.forEach(st => {
      const sc = window.computeScore ? window.computeScore(st) : null;
      const lv = sc ? sc.level : 'unknown';
      const ord = AI_LEVELS[lv] ? AI_LEVELS[lv].order : 1;
      if (ord > bestOrder) { bestOrder = ord; bestLevel = lv; }
    });
    const color = AI_LEVELS[bestLevel] ? AI_LEVELS[bestLevel].color : '#999';

    const icon = L.divIcon({
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: `<div class="cluster-marker"><div class="cluster-fill" style="background:${color}">${group.length}</div></div>`
    });

    const marker = L.marker([avgLat, avgLng], { icon, riseOnHover: true });
    marker.on('click', () => {
      map.setView([avgLat, avgLng], ZOOM_BRAND, { animate: true });
    });
    marker.addTo(markerLayer);
  });
}

function createStationIcon(st, zoom) {
  const ring = RING_STYLES[st.ring] || RING_STYLES.nodata;
  const ringClass = ring.shape === 'double' ? 'ring-double'
                  : ring.shape === 'dotted' ? 'ring-dotted'
                  : ring.shape === 'dash'   ? 'ring-dash' : '';
  const ringStyle = ring.dash ? `border-style:dashed;border-color:${ring.color};` : `border-color:${ring.color};`;

  const totals = stationTotals(st);

  // 填充色 = 充電位狀況（取代 AI 評分色，更醒目）
  // 綠=有空位、黃=繁忙、紅=滿座/大排長龍、灰=無數據、藍=維修
  const availColor = getAvailabilityColor(st, totals);

  // 數據透明度角標
  const noLiveBadge = !st.hasLiveAPI && st.dataSource !== 'crowd'
    ? `<div class="no-live-badge">?</div>` : '';
  const crowdBadge = st.dataSource === 'crowd' && st.lastUserReportTime
    ? `<div class="crowd-badge">⏱</div>` : '';

  if (zoom >= ZOOM_BRAND) {
    const brandBg = BRAND_COLORS[st.providerCode] || '#0D47A1';
    const showCount = zoom >= ZOOM_DETAIL;
    // 品牌徽章帶空位顏色邊框
    return L.divIcon({
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      html: `
        <div class="station-marker" title="${st.name.zh || st.name.en}">
          <div class="ring ${ringClass}" style="${ringStyle}"></div>
          <div class="brand-badge" style="--badge-bg:${brandBg};--avail-color:${availColor}">${st.providerCode}</div>
          ${showCount ? `<div class="avail-dot ${totals.available === 0 ? 'none' : ''}"></div>` : ''}
          ${noLiveBadge}${crowdBadge}
        </div>`
    });
  }

  // 總覽：填充色 = 空位狀況，中間顯示可用數
  const availLabel = totals.total > 0 ? `${totals.available}` : '·';
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div class="station-marker" title="${st.name.zh || st.name.en}">
        <div class="ring ${ringClass}" style="${ringStyle}"></div>
        <div class="fill" style="background:${availColor}">${availLabel}</div>
        ${noLiveBadge}${crowdBadge}
      </div>`
  });
}

/** 根據空位狀況回傳填充色 */
function getAvailabilityColor(st, totals) {
  if (st.ring === 'maintenance') return '#3B82F6';   // 藍 = 維修

  // 即使外環是 nodata（無即時 API），填充色仍顯示已知空位狀態
  if (st.ring === 'crowded') return '#EF4444';       // 紅 = 大排長龍
  if (st.ring === 'busy')    return '#F59E0B';       // 黃 = 繁忙

  // 根據可用比例（我們的靜態/用戶數據）
  const ratio = totals.total > 0 ? totals.available / totals.total : 0;
  if (totals.available === 0) return '#EF4444';       // 紅 = 滿座
  if (ratio >= 0.5) return '#22C55E';                 // 綠 = 空位充足
  if (ratio >= 0.2) return '#84CC16';                 // 淺綠 = 少量空位
  return '#F59E0B';                                   // 黃 = 即將滿座
}

/* 導航到指定站點 */
function flyToStation(st) {
  if (!map) return;
  map.setView([st.lat, st.lng], ZOOM_DETAIL, { animate: true });
}

/* 重繪（資料更新後） */
function refreshMarkers() {
  renderMarkers();
}
