/* ============================================================
   chat.js — ICQ 式即時通訊 + GPS 用戶頭像
   訊息存 IndexedDB，由用戶最後活動開始計時 24 小時後清理
   ============================================================ */

const CHAT_DB_NAME = 'EVChargeChat';
const CHAT_DB_VERSION = 1;
const ACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 小時
const MAX_SESSION_MESSAGES = 200; // 當日最多保留 200 則

let chatDB = null;
let chatListeners = [];
let userPosition = null;
let nearbyUsers = [];

/* ===== IndexedDB 初始化 ===== */
function initChatDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('saved', 'saved');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => {
      chatDB = e.target.result;
      resolve(chatDB);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/* ===== 活動計時（由最後使用開始計） ===== */
async function updateActivity() {
  if (!chatDB) return;
  const now = Date.now();
  const tx = chatDB.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  store.put({ key: 'lastActivity', value: now });
  return new Promise(resolve => { tx.oncomplete = resolve; });
}

async function getLastActivity() {
  if (!chatDB) return null;
  return new Promise(resolve => {
    const tx = chatDB.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get('lastActivity');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

/* ===== 訊息清理（24hr 後） ===== */
async function cleanupOldMessages() {
  if (!chatDB) return;
  const lastActivity = await getLastActivity();
  if (!lastActivity) return;

  const cutoff = lastActivity; // 由最後活動時間開始計
  const tx = chatDB.transaction('messages', 'readwrite');
  const store = tx.objectStore('messages');
  const index = store.index('timestamp');

  // 刪除超過 24hr 且未 save 的訊息
  const range = IDBKeyRange.upperBound(cutoff);
  const req = index.openCursor(range);
  req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const msg = cursor.value;
      if (!msg.saved) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  // 限制當日訊息數量
  const allReq = index.openCursor(null, 'prev'); // 最新在前
  let count = 0;
  allReq.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      count++;
      if (count > MAX_SESSION_MESSAGES && !cursor.value.saved) {
        cursor.delete();
      }
      cursor.continue();
    }
  };
}

/* ===== 訊息 CRUD ===== */
async function addMessage(text, userId, userName, userAvatar, stationId) {
  if (!chatDB) return null;
  const msg = {
    text,
    userId,
    userName,
    userAvatar: userAvatar || null,
    stationId: stationId || null,
    timestamp: Date.now(),
    saved: false,
    likes: 0
  };

  return new Promise((resolve, reject) => {
    const tx = chatDB.transaction('messages', 'readwrite');
    const req = tx.objectStore('messages').add(msg);
    req.onsuccess = (e) => {
      msg.id = e.target.result;
      notifyListeners('add', msg);
      resolve(msg);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function saveAllTodayMessages() {
  if (!chatDB) return 0;
  const messages = await getMessages(MAX_SESSION_MESSAGES);
  const today = new Date().toDateString();
  let savedCount = 0;

  return new Promise((resolve) => {
    const tx = chatDB.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    messages.forEach(msg => {
      if (!msg.saved && new Date(msg.timestamp).toDateString() === today) {
        msg.saved = true;
        store.put(msg);
        savedCount++;
      }
    });

    tx.oncomplete = () => {
      notifyListeners('saveAll', savedCount);
      renderChatPanel();
      resolve(savedCount);
    };
  });
}

async function saveMessage(msgId) {
  if (!chatDB) return;
  return new Promise((resolve, reject) => {
    const tx = chatDB.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const req = store.get(msgId);
    req.onsuccess = () => {
      const msg = req.result;
      if (msg) {
        msg.saved = true;
        store.put(msg);
        notifyListeners('save', msg);
      }
      resolve(msg);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getMessages(limit = 50) {
  if (!chatDB) return [];
  return new Promise(resolve => {
    const tx = chatDB.transaction('messages', 'readonly');
    const req = tx.objectStore('messages').index('timestamp').openCursor(null, 'prev');
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };
    req.onerror = () => resolve([]);
  });
}

async function getSavedMessages() {
  if (!chatDB) return [];
  return new Promise(resolve => {
    const tx = chatDB.transaction('messages', 'readonly');
    const req = tx.objectStore('messages').index('saved').openCursor();
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.saved) results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results.reverse());
      }
    };
    req.onerror = () => resolve([]);
  });
}

/* ===== 事件監聽 ===== */
function onChatUpdate(callback) {
  chatListeners.push(callback);
}

function notifyListeners(type, data) {
  chatListeners.forEach(cb => cb(type, data));
}

/* ===== GPS 用戶頭像 ===== */
function updateUserPosition(lat, lng) {
  userPosition = { lat, lng };
  updateActivity(); // 更新活動計時
  if (typeof renderUserMarkers === 'function') renderUserMarkers();
}

function getNearbyUsers(centerLat, centerLng, radiusKm = 5) {
  // 模擬附近用戶（實際需從 server / WebRTC 獲取）
  const mockUsers = [
    { id: 'u1', name: 'EV_Driver_01', avatar: '🚗', lat: centerLat + 0.003, lng: centerLng + 0.002, status: 'online' },
    { id: 'u2', name: 'HK_Tesla', avatar: '⚡', lat: centerLat - 0.002, lng: centerLng + 0.004, status: 'off_gps' },
    { id: 'u3', name: 'GreenRider', avatar: '🔋', lat: centerLat + 0.005, lng: centerLng - 0.003, status: 'online' },
    { id: 'u4', name: 'NightOwl', avatar: '🌙', lat: centerLat - 0.004, lng: centerLng - 0.002, status: 'online' },
    { id: 'u5', name: 'Speedy', avatar: '⚡', lat: centerLat + 0.006, lng: centerLng + 0.005, status: 'off_gps' },
  ];
  return mockUsers.filter(u => {
    const d = estimateDriveMin(centerLat, centerLng, u.lat, u.lng).distKm;
    return d <= radiusKm;
  });
}

/* ===== 通訊 UI ===== */
function renderChatPanel() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  getMessages(50).then(messages => {
    // 保存全部按鈕（喺頂部）
    const todayMsgs = messages.filter(m => new Date(m.timestamp).toDateString() === new Date().toDateString());
    const unsavedCount = todayMsgs.filter(m => !m.saved).length;

    container.innerHTML = `
      ${unsavedCount > 0 ? `
        <div class="chat-save-all-bar">
          <span class="text-xs">${todayMsgs.length} 則當日訊息（${unsavedCount} 未保存）</span>
          <button class="chat-save-all-btn" onclick="saveAllTodayMessages()">
            💾 保存全部當日訊息
          </button>
        </div>
      ` : ''}
      ${messages.map(m => `
        <div class="chat-msg ${m.saved ? 'saved' : ''}" data-id="${m.id}">
          <div class="chat-msg-header">
            <span class="chat-avatar">${m.userAvatar || '👤'}</span>
            <span class="chat-username">${m.userName}</span>
            <span class="chat-time">${formatTime(m.timestamp)}</span>
            ${m.saved ? '<span class="chat-saved-badge">💾</span>' : ''}
          </div>
          <div class="chat-msg-text">${escapeHtml(m.text)}</div>
          <div class="chat-msg-actions">
            ${m.stationId ? `<button class="chat-action-btn" onclick="openStation('${m.stationId}')" title="查看站點">📍 站點</button>` : ''}
          </div>
        </div>
      `).join('')}
    `;
    container.scrollTop = container.scrollHeight;
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ===== 初始化 ===== */
async function initChat() {
  await initChatDB();
  await cleanupOldMessages();
  await updateActivity();
  renderChatPanel();

  // 每 5 分鐘清理一次
  setInterval(async () => {
    await cleanupOldMessages();
    await updateActivity();
    renderChatPanel();
  }, 5 * 60 * 1000);

  console.log('[Chat] Initialized with activity-based 24hr cleanup');
}

/* ===== 發送訊息 ===== */
async function sendChatMessage(text, stationId) {
  if (!text.trim()) return;
  const userId = 'user_' + (localStorage.getItem('ev-user-id') || 'anon');
  const userName = localStorage.getItem('ev-user-name') || '用戶';
  const userAvatar = localStorage.getItem('ev-user-avatar') || '👤';

  await addMessage(text.trim(), userId, userName, userAvatar, stationId);
  await updateActivity();
  renderChatPanel();
}
