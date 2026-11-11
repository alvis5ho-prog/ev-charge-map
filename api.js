/* ============================================================
   api.js — 營運商 API / 快取同步
   CLP：透過每日 cron webfetch → data/clp-cache.json
   眾包回報：即時改外環
   ============================================================ */

const CLP_CACHE_URL = 'data/clp-cache.json';
const API_POLL_INTERVAL = 300000; // 5 分鐘重讀快取

let apiRefreshTimer = null;

/**
 * 讀取 CLP 快取數據
 */
async function fetchCLPData() {
  try {
    const resp = await fetch(CLP_CACHE_URL);
    if (!resp.ok) return [];
    const json = await resp.json();
    if (!json.geoLocationResult && !Array.isArray(json)) return [];
    return json.geoLocationResult || json;
  } catch (err) {
    console.warn('[API] CLP cache read failed:', err.message);
    return [];
  }
}

/**
 * 將 CLP 即時數據 patch 到 STATIONS（透過座標匹配）
 */
function patchStationsWithCLP(clpStations) {
  if (!clpStations.length) return 0;

  let patched = 0;
  STATIONS.forEach(st => {
    if (st.providerCode !== 'CLP') return;

    let nearest = null;
    let minDist = Infinity;
    clpStations.forEach(clp => {
      // 座標匹配（1km 內）
      const d = estimateDriveMin(st.lat, st.lng, clp.lat, clp.lng).distKm;
      if (d < minDist && d < 1.0) {
        minDist = d;
        nearest = clp;
      }
      // 名稱匹配（後備）
      if (!nearest && clp.title) {
        const stName = (st.name.en || '').toLowerCase();
        const clpName = clp.title.toLowerCase();
        if (stName.includes(clpName) || clpName.includes(stName)) {
          nearest = clp;
        }
      }
    });
    if (!nearest) return;

    // 更新可用數
    if (st.floors && st.floors.length > 0) {
      const floor = st.floors[0];
      floor.available = Math.min(nearest.available, floor.total);
    }

    // 更新外環
    if (nearest.outOfService > nearest.total * 0.3) {
      st.ring = 'maintenance';
    } else if (nearest.available === 0) {
      st.ring = 'crowded';
    } else if (nearest.available < nearest.total * 0.2) {
      st.ring = 'busy';
    } else {
      st.ring = 'available';
    }

    st.apiSynced = true;
    st.apiLastUpdate = nearest.lastUpdate;
    patched++;
  });

  return patched;
}

/**
 * 標記數據透明度：有 API vs 無 API 的站點
 * 無 API 供應商強制標灰色外環 + 標註「無即時數據」
 */
function applyDataTransparency() {
  const API_PROVIDERS = ['CLP'];

  STATIONS.forEach(st => {
    // CLP 有公開 API，就算快取匹配唔到都視為有即時數據來源
    const hasAPI = API_PROVIDERS.includes(st.providerCode);
    st.hasLiveAPI = hasAPI;

    if (hasAPI && st.apiSynced) {
      st.dataSource = 'api';
    } else if (hasAPI) {
      st.dataSource = 'api';  // CLP 有 API，標示為即時數據
    } else if (st._userReported) {
      st.dataSource = 'crowd';
    } else {
      st.ring = 'nodata';
      st.dataSource = 'static';
    }
  });
}

/**
 * 眾包回報 → 自動改外環（帶時間戳）
 */
function applyCrowdReportToStation(stationId, issueType, queueCount) {
  const st = STATIONS.find(s => s.id === stationId);
  if (!st) return;

  st._userReported = true;
  st.dataSource = 'crowd';
  st.lastUserReportTime = new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });

  if (typeof queueCount === 'number') {
    st.queue = queueCount;
    if (queueCount >= 3) {
      st.ring = 'crowded';
    } else if (queueCount > 0) {
      st.ring = 'busy';
    } else if (st.ring !== 'maintenance') {
      st.ring = 'available';
    }
    st.queueConfidence = 'user';
  }

  if (issueType === 'broken' || issueType === 'payment') {
    st.ring = 'maintenance';
  } else if (issueType === 'occupied') {
    st.ring = 'crowded';
    st.queue = (st.queue || 0) + 1;
  }

  if (typeof refreshMarkers === 'function') refreshMarkers();
  if (window.APP_STATE?.selectedStationId === stationId && typeof renderPanel === 'function') {
    renderPanel(stationId);
  }
}

/**
 * 啟動 API 快取同步
 */
function startAPISync() {
  applyDataTransparency();  // 立即標記透明度，唔等 fetch
  syncNow();
  if (apiRefreshTimer) clearInterval(apiRefreshTimer);
  apiRefreshTimer = setInterval(syncNow, API_POLL_INTERVAL);
  console.log('[API] Cache sync started, refreshing every', API_POLL_INTERVAL / 1000, 's');
}

async function syncNow() {
  const clpStations = await fetchCLPData();
  const patched = patchStationsWithCLP(clpStations);
  applyDataTransparency();  // 無 API 站點標灰色
  if (typeof refreshMarkers === 'function') {
    refreshMarkers();
    console.log(`[API] Synced ${patched} CLP stations, transparency applied at ${new Date().toLocaleTimeString()}`);
  }
}

function stopAPISync() {
  if (apiRefreshTimer) {
    clearInterval(apiRefreshTimer);
    apiRefreshTimer = null;
  }
}
