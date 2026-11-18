/* ============================================================
   transport.js — 通訊傳輸層抽象
   當前：自適應 polling（慳流量）
   預留：WebSocket / Web Push 接口（未來升級用）
   ============================================================ */

/* ===== 傳輸模式 ===== */
const TRANSPORT_MODES = {
  ADAPTIVE_POLLING: 'adaptive_polling',
  WEBSOCKET: 'websocket',       // 預留
  WEB_PUSH: 'web_push'          // 預留
};

let currentMode = TRANSPORT_MODES.ADAPTIVE_POLLING;

/* ===== 自適應 polling 設定 ===== */
const POLL_CONFIG = {
  activeInterval: 5000,    // 活動時 5 秒
  idleInterval: 60000,     // 閒置時 60 秒
  backgroundInterval: 0,   // 背景時暫停
  activeTimeout: 60000,    // 60 秒無活動 → 轉閒置
  idleThreshold: 5 * 60000 // 5 分鐘無活動 → 轉背景
};

let pollTimer = null;
let lastActivityTime = Date.now();
let pollInterval = POLL_CONFIG.activeInterval;
let isPaused = false;
let listeners = { message: [], presence: [], error: [] };

/* ===== 活動偵測 ===== */
function markActive() {
  lastActivityTime = Date.now();
  if (isPaused || pollInterval !== POLL_CONFIG.activeInterval) {
    pollInterval = POLL_CONFIG.activeInterval;
    isPaused = false;
    restartPolling();
  }
  // 通知活動（用於計時器重置）
  if (typeof updateActivity === 'function') updateActivity();
}

function checkIdleStatus() {
  const now = Date.now();
  const idleTime = now - lastActivityTime;

  if (idleTime > POLL_CONFIG.idleThreshold) {
    // 長時間無活動 → 暫停
    if (!isPaused) {
      isPaused = true;
      pollInterval = POLL_CONFIG.backgroundInterval;
      stopPolling();
      console.log('[Transport] Long idle, polling paused');
    }
  } else if (idleTime > POLL_CONFIG.activeTimeout) {
    // 短暫無活動 → 降頻
    if (pollInterval !== POLL_CONFIG.idleInterval) {
      pollInterval = POLL_CONFIG.idleInterval;
      restartPolling();
      console.log('[Transport] Idle, poll reduced to 60s');
    }
  }
}

/* ===== Polling 引擎 ===== */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (pollInterval <= 0) return;

  pollTimer = setInterval(async () => {
    checkIdleStatus();
    if (isPaused) return;

    try {
      // 拉取新訊息（本地 IndexedDB）
      if (typeof getMessages === 'function') {
        const msgs = await getMessages(20);
        emit('message', msgs);
      }

      // 拉取附近用戶位置（模擬）
      if (typeof getNearbyUsers === 'function' && APP_STATE.mapCenter) {
        const users = getNearbyUsers(APP_STATE.mapCenter.lat, APP_STATE.mapCenter.lng, 5);
        emit('presence', users);
      }
    } catch (err) {
      emit('error', err);
    }
  }, pollInterval);

  console.log(`[Transport] Polling started at ${pollInterval / 1000}s interval`);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function restartPolling() {
  stopPolling();
  startPolling();
}

/* ===== WebSocket 接口（預留） ===== */
function initWebSocket(url) {
  console.log('[Transport] WebSocket mode — reserved for future');
  // 升級為 WebSocket 時使用：
  // const ws = new WebSocket(url);
  // ws.onmessage = (e) => { const data = JSON.parse(e.data); emit('message', data); };
  // ws.onopen = () => { console.log('WS connected'); stopPolling(); };
  // ws.onclose = () => { console.log('WS disconnected'); startPolling(); }; // fallback
  // return ws;
  return null;
}

/* ===== Web Push 接口（預留） ===== */
function initWebPush(vapidPublicKey) {
  console.log('[Transport] Web Push mode — reserved for future');
  // 升級為 Web Push 時使用：
  // if ('serviceWorker' in navigator && 'PushManager' in window) {
  //   navigator.serviceWorker.register('sw.js').then(reg => {
  //     reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey })
  //       .then(sub => { /* send sub to server */ });
  //   });
  // }
  return null;
}

/* ===== 事件系統 ===== */
function onTransportEvent(event, callback) {
  if (listeners[event]) listeners[event].push(callback);
}

function emit(event, data) {
  if (listeners[event]) listeners[event].forEach(cb => cb(data));
}

/* ===== 初始化 ===== */
function initTransport() {
  // 監聽用戶活動
  ['click', 'touchstart', 'keydown', 'scroll', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, markActive, { passive: true });
  });

  // 監聽頁面可見性（背景/前景）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
      console.log('[Transport] Page hidden, polling stopped');
    } else {
      markActive();
      startPolling();
      console.log('[Transport] Page visible, polling resumed');
    }
  });

  // 啟動 polling
  startPolling();

  // 定期檢查閒置狀態
  setInterval(checkIdleStatus, 30000);

  console.log(`[Transport] Initialized — mode: ${currentMode}, adaptive polling active`);
}

/* ===== 切換模式（未來升級用） ===== */
function setTransportMode(mode) {
  currentMode = mode;
  stopPolling();

  if (mode === TRANSPORT_MODES.WEBSOCKET) {
    // initWebSocket('wss://...');
  } else if (mode === TRANSPORT_MODES.WEB_PUSH) {
    // initWebPush('...');
    // WebSocket 作為 fallback
    startPolling();
  } else {
    startPolling();
  }
}
