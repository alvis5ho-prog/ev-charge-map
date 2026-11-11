/* EV Charging PWA — 站點資料層
 * 預設使用 Mock 資料（座標為香港真實位置）。
 * 對接 DATA.GOV.HK 時，只需把 fetchStations() 改為打 API 並映射到同一結構。 */

const REGIONS = {
  hk:   { id: 'hk',   zh: '港島區',       en: 'Hong Kong Island', bbox: [22.20, 114.10, 22.28, 114.24] },
  kln:  { id: 'kln',  zh: '九龍區',       en: 'Kowloon',          bbox: [22.28, 114.15, 22.36, 114.22] },
  nt:   { id: 'nt',   zh: '新界及離島區', en: 'New Territories & Islands', bbox: [22.24, 113.85, 22.56, 114.30] }
};

/* AI 評分等級 — 圓點填充色 */
const AI_LEVELS = {
  best:     { key: 'best',     zh: '最適合',     en: 'Best',           color: '#1B7A3D', order: 5 },
  good:     { key: 'good',     zh: '適合',       en: 'Good',           color: '#4CAF50', order: 4 },
  fair:     { key: 'fair',     zh: '一般',       en: 'Fair',           color: '#F5B301', order: 3 },
  poor:     { key: 'poor',     zh: '不太適合',   en: 'Not ideal',      color: '#E8674A', order: 2 },
  unknown:  { key: 'unknown',  zh: '資料不足',   en: 'No data',        color: '#9E9E9E', order: 1 }
};

/* 現場實況 — 外環 */
const RING_STYLES = {
  available:  { key: 'available',  zh: '有空位',                     en: 'Available',           color: '#22C55E', dash: null,     shape: 'solid'  },
  busy:       { key: 'busy',       zh: '滿座（排隊 < 3）',           en: 'Full (queue < 3)',    color: '#F59E0B', dash: null,     shape: 'double' },
  crowded:    { key: 'crowded',    zh: '大排長龍',                   en: 'Long queue',          color: '#EF4444', dash: null,     shape: 'solid'  },
  nodata:     { key: 'nodata',     zh: '暫無數據',                   en: 'No data',             color: '#9CA3AF', dash: null,     shape: 'dotted' },
  maintenance:{ key: 'maintenance',zh: '維修中／暫停服務',           en: 'Maintenance',         color: '#3B82F6', dash: null,     shape: 'solid'  },
  unverified: { key: 'unverified', zh: '用戶回報（未經官方驗證）',   en: 'User report (unverified)', color: '#A78BFA', dash: '4 3', shape: 'dash'  }
};

const CONNECTORS = ['CCS2', 'CHAdeMO', 'Type2'];

/* 車型資料庫（電池 kWh / 最大 DC 接收功率 kW） */
const EV_MODELS = [
  { id: 'tesla-m3',   zh: 'Tesla Model 3',           en: 'Tesla Model 3',           battery: 60,  maxDC: 170 },
  { id: 'tesla-my',   zh: 'Tesla Model Y',           en: 'Tesla Model Y',           battery: 75,  maxDC: 250 },
  { id: 'byd-atto3',  zh: 'BYD Atto 3',              en: 'BYD Atto 3',              battery: 60.5,maxDC: 88  },
  { id: 'byd-dolphin',zh: 'BYD Dolphin',             en: 'BYD Dolphin',             battery: 60.5,maxDC: 88  },
  { id: 'mg-zs-ev',   zh: 'MG ZS EV',                en: 'MG ZS EV',                battery: 51,  maxDC: 92  },
  { id: 'ioniq5',     zh: 'Hyundai IONIQ 5',         en: 'Hyundai IONIQ 5',         battery: 77.4,maxDC: 220 },
  { id: 'ev6',        zh: 'Kia EV6',                 en: 'Kia EV6',                 battery: 77.4,maxDC: 240 },
  { id: 'id4',        zh: 'VW ID.4',                 en: 'VW ID.4',                 battery: 77,  maxDC: 135 },
  { id: 'eqb',        zh: 'Mercedes EQB',            en: 'Mercedes EQB',            battery: 66.5,maxDC: 100 },
  { id: 'ix3',        zh: 'BMW iX3',                 en: 'BMW iX3',                 battery: 74,  maxDC: 150 },
  { id: 'other',      zh: '其他／自訂',              en: 'Other / Custom',          battery: 60,  maxDC: 100 }
];

/* ---- Mock 站點資料（座標為真實香港位置） ---- */
const STATIONS = [
  {
    id: 'st-cwb-1', name: { zh: '時代廣場停車場', en: 'Times Square Car Park' },
    region: 'hk', lat: 22.2782, lng: 114.1823,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '銅鑼灣勿地臣街 1 號', en: '1 Matheson St, Causeway Bay' },
    parking: { zh: '時租 HK$32 / 小時', en: 'HK$32 / hour' },
    parkingNote: { zh: '充電滿 HK$200 豁免 2 小時泊車', en: 'HK$200 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App / 即插即充', en: 'Octopus / App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 8, available: 3, stalls: [
        { connector: 'CCS2', kw: 250, count: 2, available: 1 },
        { connector: 'CCS2', kw: 120, count: 4, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]},
      { level: { zh: 'B2', en: 'B2' }, total: 6, available: 2, stalls: [
        { connector: 'CCS2', kw: 150, count: 3, available: 1 },
        { connector: 'CHAdeMO', kw: 50, count: 3, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-ic-1', name: { zh: 'IFC 商場充電站', en: 'IFC Mall Charging Hub' },
    region: 'hk', lat: 22.2850, lng: 114.1585,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '中環金融街 8 號', en: '8 Finance St, Central' },
    parking: { zh: '時租 HK$45 / 小時', en: 'HK$45 / hour' },
    parkingNote: { zh: '充電滿 HK$300 豁免 3 小時泊車', en: 'HK$300 charging spend waives 3h parking' },
    payment: { zh: '信用卡 / App', en: 'Credit Card / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B3', en: 'B3' }, total: 10, available: 1, stalls: [
        { connector: 'CCS2', kw: 350, count: 2, available: 0 },
        { connector: 'CCS2', kw: 150, count: 6, available: 1 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]}
    ],
    queue: 2, queueConfidence: 'gps',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-wc-1', name: { zh: '灣仔合和中心停車場', en: 'Hopewell Centre Car Park' },
    region: 'hk', lat: 22.2748, lng: 114.1718,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '灣仔皇后大道東 183 號', en: '183 Queen\'s Road East, Wan Chai' },
    parking: { zh: '時租 HK$38 / 小時', en: 'HK$38 / hour' },
    parkingNote: { zh: '無豁免', en: 'No waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '07:00 – 23:00', en: '07:00 – 23:00' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 5, available: 3, stalls: [
        { connector: 'CCS2', kw: 180, count: 3, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-abd-1', name: { zh: '鴨脷洲海怡停車場', en: 'South Horizons Car Park' },
    region: 'hk', lat: 22.2428, lng: 114.1525,
    provider: { zh: 'HK Electric', en: 'HK Electric' }, providerCode: 'HKE',
    ring: 'nodata', unverified: true,
    address: { zh: '鴨脷洲鴨脷洲橋道', en: 'Ap Lei Chau Bridge Rd' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '免費充電豁免泊車 2 小時', en: 'Free charging waives 2h parking' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'G', en: 'G' }, total: 4, available: 3, stalls: [
        { connector: 'CCS2', kw: 120, count: 2, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'user',
    historyFailRate: 0.05,
    reports: [{ user: 'EVloverHK', at: '14:30', zh: 'B 層新增 2 支 CCS2 120kW', en: 'Level B has 2 new CCS2 120kW', likes: 12 }]
  },
  {
    id: 'st-tst-1', name: { zh: '海港城停車場', en: 'Harbour City Car Park' },
    region: 'kln', lat: 22.2958, lng: 114.1688,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '尖沙咀廣東道 3–27 號', en: '3–27 Canton Road, TST' },
    parking: { zh: '時租 HK$40 / 小時', en: 'HK$40 / hour' },
    parkingNote: { zh: '充電滿 HK$250 豁免 2 小時泊車', en: 'HK$250 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App / 即插即充', en: 'Octopus / App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 12, available: 1, stalls: [
        { connector: 'CCS2', kw: 250, count: 4, available: 0 },
        { connector: 'CCS2', kw: 120, count: 6, available: 1 },
        { connector: 'CHAdeMO', kw: 50, count: 2, available: 0 }
      ]},
      { level: { zh: 'B3', en: 'B3' }, total: 8, available: 0, stalls: [
        { connector: 'CCS2', kw: 150, count: 8, available: 0 }
      ]}
    ],
    queue: 7, queueConfidence: 'gps',
    historyFailRate: 0.04,
    reports: []
  },
  {
    id: 'st-mk-1', name: { zh: '朗豪坊停車場', en: 'Langham Place Car Park' },
    region: 'kln', lat: 22.3178, lng: 114.1688,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '旺角亞皆老街 8 號', en: '8 Argyle Street, Mong Kok' },
    parking: { zh: '時租 HK$35 / 小時', en: 'HK$35 / hour' },
    parkingNote: { zh: '充電滿 HK$180 豁免 2 小時泊車', en: 'HK$180 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B4', en: 'B4' }, total: 6, available: 1, stalls: [
        { connector: 'CCS2', kw: 180, count: 4, available: 1 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]}
    ],
    queue: 2, queueConfidence: 'gps',
    historyFailRate: 0.06,
    reports: []
  },
  {
    id: 'st-kc-1', name: { zh: '葵涌廣場充電站', en: 'Kwai Chung Plaza Charging' },
    region: 'kln', lat: 22.3562, lng: 114.1288,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '葵涌葵富路 7–11 號', en: '7–11 Kwai Fu Rd, Kwai Chung' },
    parking: { zh: '時租 HK$22 / 小時', en: 'HK$22 / hour' },
    parkingNote: { zh: '免費充電豁免泊車 3 小時', en: 'Free charging waives 3h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'L1', en: 'L1' }, total: 8, available: 5, stalls: [
        { connector: 'CCS2', kw: 150, count: 4, available: 3 },
        { connector: 'CCS2', kw: 60,  count: 2, available: 1 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-kc-2', name: { zh: '新都會廣場停車場', en: 'Metroplaza Car Park' },
    region: 'kln', lat: 22.3590, lng: 114.1340,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '葵涌興芳路 223 號', en: '223 Shing Fung Rd, Kwai Chung' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '充電滿 HK$150 豁免 2 小時泊車', en: 'HK$150 charging spend waives 2h parking' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 6, available: 4, stalls: [
        { connector: 'CCS2', kw: 250, count: 4, available: 3 },
        { connector: 'CCS2', kw: 120, count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-sp-1', name: { zh: '科學園停車場', en: 'Science Park Car Park' },
    region: 'nt', lat: 22.4188, lng: 114.2092,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '沙田白石角科學園', en: 'Science Park, Pak Shek Kok, Sha Tin' },
    parking: { zh: '時租 HK$18 / 小時', en: 'HK$18 / hour' },
    parkingNote: { zh: '免費充電豁免泊車 4 小時', en: 'Free charging waives 4h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'G', en: 'G' }, total: 14, available: 9, stalls: [
        { connector: 'CCS2', kw: 350, count: 2, available: 2 },
        { connector: 'CCS2', kw: 150, count: 8, available: 5 },
        { connector: 'Type2', kw: 22,  count: 4, available: 2 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-st-1', name: { zh: '新城市廣場停車場', en: 'New Town Plaza Car Park' },
    region: 'nt', lat: 22.3812, lng: 114.1865,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '沙田正街 18 號', en: '18 Sha Tin Centre St, Sha Tin' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '充電滿 HK$200 豁免 2 小時泊車', en: 'HK$200 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App / 即插即充', en: 'Octopus / App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 10, available: 2, stalls: [
        { connector: 'CCS2', kw: 250, count: 4, available: 1 },
        { connector: 'CCS2', kw: 120, count: 4, available: 1 },
        { connector: 'CHAdeMO', kw: 50, count: 2, available: 0 }
      ]},
      { level: { zh: 'B2', en: 'B2' }, total: 6, available: 0, stalls: [
        { connector: 'CCS2', kw: 150, count: 6, available: 0 }
      ]}
    ],
    queue: 2, queueConfidence: 'gps',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-tp-1', name: { zh: '大埔超級城停車場', en: 'Tai Po Mega Mall Car Park' },
    region: 'nt', lat: 22.4502, lng: 114.1642,
    provider: { zh: 'HK Electric', en: 'HK Electric' }, providerCode: 'HKE',
    ring: 'nodata', unverified: false,
    address: { zh: '大埔安邦路 8 號', en: '8 On Pong Rd, Tai Po' },
    parking: { zh: '時租 HK$20 / 小時', en: 'HK$20 / hour' },
    parkingNote: { zh: '免費充電豁免泊車 2 小時', en: 'Free charging waives 2h parking' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'L3', en: 'L3' }, total: 6, available: 4, stalls: [
        { connector: 'CCS2', kw: 120, count: 4, available: 3 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-tm-1', name: { zh: '屯門市廣場停車場', en: 'Tuen Mun Town Plaza Car Park' },
    region: 'nt', lat: 22.3925, lng: 113.9752,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '屯門屯順街 1 號', en: '1 Tuen Shun St, Tuen Mun' },
    parking: { zh: '時租 HK$22 / 小時', en: 'HK$22 / hour' },
    parkingNote: { zh: '充電滿 HK$120 豁免 2 小時泊車', en: 'HK$120 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 8, available: 6, stalls: [
        { connector: 'CCS2', kw: 150, count: 4, available: 3 },
        { connector: 'CCS2', kw: 60,  count: 2, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-tc-1', name: { zh: '東薈城停車場', en: 'Citygate Outlets Car Park' },
    region: 'nt', lat: 22.2892, lng: 113.9402,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '大嶼山達東路 20 號', en: '20 Tat Tung Rd, Tung Chung' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '充電滿 HK$180 豁免 3 小時泊車', en: 'HK$180 charging spend waives 3h parking' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 8, available: 5, stalls: [
        { connector: 'CCS2', kw: 250, count: 4, available: 3 },
        { connector: 'CCS2', kw: 120, count: 4, available: 2 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-cp-1', name: { zh: '數碼港停車場', en: 'Cyberport Car Park' },
    region: 'hk', lat: 22.2298, lng: 114.1282,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: true,
    address: { zh: '鋼綫灣數碼港道 100 號', en: '100 Cyberport Rd, Telegraph Bay' },
    parking: { zh: '時租 HK$32 / 小時', en: 'HK$32 / hour' },
    parkingNote: { zh: '資料待確認', en: 'Info pending' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 6, available: 0, stalls: [
        { connector: 'CCS2', kw: 150, count: 4, available: 0 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]}
    ],
    queue: null, queueConfidence: 'none',
    historyFailRate: 0.08,
    reports: [{ user: 'DriverCK', at: '昨天 21:05', zh: '今日 B1 全部充電位運作正常', en: 'All B1 chargers operational today', likes: 5 }]
  },
  {
    id: 'st-rb-1', name: { zh: '淺水灣停車場', en: 'Repulse Bay Car Park' },
    region: 'hk', lat: 22.2372, lng: 114.1912,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '淺水灣海灘道 109 號', en: '109 Repulse Bay Beach Rd' },
    parking: { zh: '時租 HK$40 / 小時', en: 'HK$40 / hour' },
    parkingNote: { zh: '暫停服務中', en: 'Suspended' },
    payment: { zh: '—', en: '—' },
    hours: { zh: '維修中', en: 'Under maintenance' },
    floors: [
      { level: { zh: 'G', en: 'G' }, total: 4, available: 0, stalls: [
        { connector: 'CCS2', kw: 100, count: 2, available: 0 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]}
    ],
    queue: null, queueConfidence: 'none',
    historyFailRate: 0.20,
    reports: []
  },
  {
    id: 'st-ap-1', name: { zh: '機場一號停車場', en: 'Airport Terminal 1 Car Park' },
    region: 'nt', lat: 22.3082, lng: 113.9168,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '赤鱲角機場路一號客運大樓', en: 'Terminal 1, Airport Rd, Chek Lap Kok' },
    parking: { zh: '時租 HK$35 / 小時', en: 'HK$35 / hour' },
    parkingNote: { zh: '充電滿 HK$200 豁免 2 小時泊車', en: 'HK$200 charging spend waives 2h parking' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'L4', en: 'L4' }, total: 12, available: 7, stalls: [
        { connector: 'CCS2', kw: 250, count: 6, available: 4 },
        { connector: 'CCS2', kw: 120, count: 4, available: 2 },
        { connector: 'CHAdeMO', kw: 50, count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-stan-1', name: { zh: '赤柱停車場', en: 'Stanley Car Park' },
    region: 'hk', lat: 22.2182, lng: 114.2125,
    provider: { zh: 'HK Electric', en: 'HK Electric' }, providerCode: 'HKE',
    ring: 'nodata', unverified: true,
    address: { zh: '赤柱赤柱大街', en: 'Stanley Main St, Stanley' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '用戶回報：充電豁免 2 小時泊車', en: 'User report: charging waives 2h parking' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '08:00 – 22:00', en: '08:00 – 22:00' },
    floors: [
      { level: { zh: 'G', en: 'G' }, total: 3, available: 2, stalls: [
        { connector: 'CCS2', kw: 60,  count: 2, available: 1 },
        { connector: 'Type2', kw: 22,  count: 1, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'user',
    historyFailRate: 0.06,
    reports: [{ user: 'IslandDriver', at: '12:15', zh: '2 支 CCS2 60kW 有位，Type2 壞咗一支', en: '2 CCS2 60kW free; one Type2 out of order', likes: 8 }]
  },
  {
    id: 'st-kct-1', name: { zh: '九龍灣 MegaBox 停車場', en: 'MegaBox Car Park, Kowloon Bay' },
    region: 'kln', lat: 22.3198, lng: 114.2122,
    provider: { zh: 'Tesla / JOVE', en: 'Tesla / JOVE' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣宏照道 38 號企業廣場 5 期', en: 'Enterprise Square Five, 38 Wang Chiu Rd, Kowloon Bay' },
    parking: { zh: 'L5–L16 HK$25/hr（一至五）· HK$26/hr（六日假期）；地庫 HK$28/hr（一至五）· HK$29/hr（六日假期）', en: 'L5–L16 HK$25/hr (Mon–Fri) · HK$26/hr (Sat/Sun/PH); Basement HK$28/hr (Mon–Fri) · HK$29/hr (Sat/Sun/PH)' },
    parkingNote: { zh: '食肆消費滿 HK$100 或零售滿 HK$200 免 3 小時；夜泊 18:00–10:00 HK$80', en: 'Restaurant spend HK$100+ or retail HK$200+ = 3h free; night parking 18:00–10:00 HK$80' },
    payment: { zh: '八達通（停車場）/ Tesla App / JOVE', en: 'Octopus (car park) / Tesla App / JOVE' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '地庫 (Tesla V4)', en: 'Basement (Tesla V4)' }, total: 3, available: 2, stalls: [
        { connector: 'CCS2', kw: 250, count: 3, available: 2 }
      ]},
      { level: { zh: 'L15', en: 'L15' }, total: 19, available: 10, stalls: [
        { connector: 'Type2', kw: 21,  count: 10, available: 5 },
        { connector: 'CCS2', kw: 60,  count: 6,  available: 3 },
        { connector: 'CCS2', kw: 120, count: 4,  available: 2 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-lcb-1', name: { zh: '藍田匯景廣場', en: 'Laguna Plaza, Lam Tin' },
    region: 'kln', lat: 22.3072, lng: 114.2282,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '藍田匯景道 8 號', en: '8 Laguna Verde, Lam Tin' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '免費充電豁免泊車 2 小時', en: 'Free charging waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 6, available: 1, stalls: [
        { connector: 'CCS2', kw: 120, count: 4, available: 1 },
        { connector: 'Type2', kw: 22,  count: 2, available: 0 }
      ]}
    ],
    queue: 1, queueConfidence: 'gps',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-sk-1', name: { zh: '西貢停車場', en: 'Sai Kung Car Park' },
    region: 'nt', lat: 22.3832, lng: 114.2688,
    provider: { zh: 'HK Electric', en: 'HK Electric' }, providerCode: 'HKE',
    ring: 'nodata', unverified: true,
    address: { zh: '西貢親民街', en: 'Chan Man St, Sai Kung' },
    parking: { zh: '時租 HK$15 / 小時', en: 'HK$15 / hour' },
    parkingNote: { zh: '免費充電', en: 'Free charging' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '07:00 – 23:00', en: '07:00 – 23:00' },
    floors: [
      { level: { zh: 'G', en: 'G' }, total: 2, available: 2, stalls: [
        { connector: 'CCS2', kw: 60,  count: 1, available: 1 },
        { connector: 'Type2', kw: 22,  count: 1, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'user',
    historyFailRate: 0.07,
    reports: [{ user: 'SaiKungEV', at: '09:40', zh: '得 2 支，假日好快滿', en: 'Only 2 stalls, fills up fast on weekends', likes: 3 }]
  },
  {
    id: 'st-tsy-1', name: { zh: '青衣城停車場', en: 'Tsing Yi Plaza Car Park' },
    region: 'nt', lat: 22.3552, lng: 114.1082,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '青衣青敬路 33 號', en: '33 Tsing King Rd, Tsing Yi' },
    parking: { zh: '時租 HK$22 / 小時', en: 'HK$22 / hour' },
    parkingNote: { zh: '充電滿 HK$100 豁免 2 小時泊車', en: 'HK$100 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 4, available: 3, stalls: [
        { connector: 'CCS2', kw: 120, count: 2, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-sy-1', name: { zh: '將軍廣場停車場', en: 'TKO Gateway Car Park' },
    region: 'nt', lat: 22.3072, lng: 114.2562,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐德街 9 號', en: '9 Tong Tak St, Tseung Kwan O' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '充電滿 HK$150 豁免 2 小時泊車', en: 'HK$150 charging spend waives 2h parking' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 8, available: 1, stalls: [
        { connector: 'CCS2', kw: 250, count: 2, available: 0 },
        { connector: 'CCS2', kw: 120, count: 4, available: 1 },
        { connector: 'CHAdeMO', kw: 50, count: 2, available: 0 }
      ]}
    ],
    queue: 2, queueConfidence: 'gps',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-hun-1', name: { zh: '置富都會停車場', en: 'Fortune Metropolis Car Park' },
    region: 'hk', lat: 22.2692, lng: 114.1298,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '薄扶林薄扶林道 118 號', en: '118 Pok Fu Lam Rd' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '充電滿 HK$150 豁免 2 小時泊車', en: 'HK$150 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 5, available: 3, stalls: [
        { connector: 'CCS2', kw: 150, count: 3, available: 2 },
        { connector: 'Type2', kw: 22,  count: 2, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  /* ===== 觀塘區（EV-BOY 2026-11 資料） ===== */
  {
    id: 'st-dtf2', name: { zh: '德福廣場二期', en: 'Telford Plaza Phase 2' },
    region: 'kln', lat: 22.3226, lng: 114.2136,
    provider: { zh: 'Jove（港鐵）', en: 'Jove (MTR)' }, providerCode: 'JOVE',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣偉業街 33 號', en: '33 Wai Yip St, Kowloon Bay' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '德福廣場消費可換泊車優惠', en: 'Spending at Telford Plaza for parking waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '停車場', en: 'Car Park' }, total: 41, available: 22, stalls: [
        { connector: 'CCS2', kw: 120, count: 20, available: 11 },
        { connector: 'Type2', kw: 22,  count: 21, available: 11 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-cmh-dtf2', name: { zh: '充美好德福廣場 2 期超充站', en: 'ChargePlus Telford Plaza 2 Super' },
    region: 'kln', lat: 22.3228, lng: 114.2134,
    provider: { zh: '充美好（華潤）', en: 'ChargePlus (CR)' }, providerCode: 'CP',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣偉業街 33 號德福廣場 2 期停車場', en: 'Telford Plaza 2 Car Park, 33 Wai Yip St, Kowloon Bay' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '2 期停車場', en: 'Phase 2 Car Park' }, total: 38, available: 20, stalls: [
        { connector: 'CCS2', kw: 250, count: 20, available: 11 },
        { connector: 'Type2', kw: 22,  count: 18, available: 9 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-ctf-tesla', name: { zh: '周大福保險中心 Tesla', en: 'CTF Insurance Centre Tesla' },
    region: 'kln', lat: 22.3188, lng: 114.2122,
    provider: { zh: 'Tesla（品牌專用）', en: 'Tesla (Brand Only)' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣常悅道 18 號', en: '18 Sheung Yuet Rd, Kowloon Bay' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'Tesla App / 即插即充', en: 'Tesla App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '停車場', en: 'Car Park' }, total: 18, available: 10, stalls: [
        { connector: 'CCS2', kw: 250, count: 18, available: 10 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-cendas', name: { zh: 'THE CENDAS', en: 'THE CENDAS' },
    region: 'kln', lat: 22.3172, lng: 114.2148,
    provider: { zh: 'Cornerstone', en: 'Cornerstone' }, providerCode: 'CS',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣常悅道 15 號', en: '15 Sheung Yuet Rd, Kowloon Bay' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '停車場', en: 'Car Park' }, total: 169, available: 95, stalls: [
        { connector: 'Type2', kw: 7, count: 169, available: 95 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-apac-tesla', name: { zh: '1 亞太中心 Tesla', en: '1 Asia Pacific Centre Tesla' },
    region: 'kln', lat: 22.3158, lng: 114.2152,
    provider: { zh: 'Tesla（品牌專用）', en: 'Tesla (Brand Only)' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '觀塘道 414 號 B3', en: '414 Kwun Tong Rd, B3' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'Tesla App / 即插即充', en: 'Tesla App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B3', en: 'B3' }, total: 61, available: 35, stalls: [
        { connector: 'CCS2', kw: 250, count: 9,  available: 5 },
        { connector: 'Type2', kw: 22,  count: 52, available: 30 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-ym2', name: { zh: 'YM² 裕民坊', en: 'YM² Yue Man Square' },
    region: 'kln', lat: 22.3118, lng: 114.2258,
    provider: { zh: 'Jove（港鐵）', en: 'Jove (MTR)' }, providerCode: 'JOVE',
    ring: 'nodata', unverified: false,
    address: { zh: '觀塘協和街 33 號', en: '33 Hip Wo St, Kwun Tong' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '消費可換泊車優惠', en: 'Spending for parking waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '停車場', en: 'Car Park' }, total: 57, available: 30, stalls: [
        { connector: 'CCS2', kw: 120, count: 8,  available: 5 },
        { connector: 'Type2', kw: 22,  count: 49, available: 25 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-hontin-tesla', name: { zh: '宏天廣場 Tesla', en: 'Horizon Plaza Tesla' },
    region: 'kln', lat: 22.3212, lng: 114.2108,
    provider: { zh: 'Tesla（全 EV 開放）', en: 'Tesla (Open to All EV)' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣宏光道 39 號 3F', en: '39 Wang Kwong Rd, 3F, Kowloon Bay' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'Tesla App / 即插即充', en: 'Tesla App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '3F', en: '3F' }, total: 53, available: 30, stalls: [
        { connector: 'CCS2', kw: 250, count: 6,  available: 4 },
        { connector: 'Type2', kw: 22,  count: 47, available: 26 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-metro', name: { zh: '九龍灣美羅中心', en: 'Metro Centre Kowloon Bay' },
    region: 'kln', lat: 22.3196, lng: 114.2118,
    provider: { zh: '三號電站', en: 'Station 3' }, providerCode: 'S3',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣臨興街 32 號美羅中心 1 期地下 7–8 室', en: 'Shop 7-8, Metro Centre 1, 32 Lam Hing St, Kowloon Bay' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '地下', en: 'G/F' }, total: 12, available: 7, stalls: [
        { connector: 'CCS2', kw: 120, count: 12, available: 7 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-hungto-gcss', name: { zh: '觀塘鴻圖道威德超充', en: 'Wai Tak Super, Hung To Rd' },
    region: 'kln', lat: 22.3142, lng: 114.2218,
    provider: { zh: 'GCSS 全港充', en: 'GCSS' }, providerCode: 'GCSS',
    ring: 'nodata', unverified: false,
    address: { zh: '觀塘鴻圖道 8 號樂居工業大廈 G/F', en: 'G/F, Lok Kui Industrial Bldg, 8 Hung To Rd, Kwun Tong' },
    parking: { zh: '時租 HK$20 / 小時', en: 'HK$20 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'App / 掃碼', en: 'App / QR code' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'G/F', en: 'G/F' }, total: 11, available: 6, stalls: [
        { connector: 'CCS2', kw: 120, count: 11, available: 6 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.03,
    reports: []
  },
  {
    id: 'st-harbour-fast', name: { zh: '海濱滙快充站', en: 'Harbour East Fast Charge' },
    region: 'kln', lat: 22.3102, lng: 114.2192,
    provider: { zh: '潤心充', en: 'Runxin' }, providerCode: 'RX',
    ring: 'nodata', unverified: false,
    address: { zh: '觀塘海濱道 77 號海濱匯停車場 B2', en: 'B2, Harbour East Car Park, 77 Hoi Bun Rd, Kwun Tong' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 10, available: 6, stalls: [
        { connector: 'CCS2', kw: 120, count: 10, available: 6 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-shunli-clpe', name: { zh: '順利街市停車場', en: 'Shun Lee Market Car Park' },
    region: 'kln', lat: 22.3332, lng: 114.2268,
    provider: { zh: 'CLPe', en: 'CLPe' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '觀塘利安道 15 號順利商場', en: 'Shun Lee Shopping Centre, 15 Lei On Rd, Kwun Tong' },
    parking: { zh: '時租 HK$22 / 小時', en: 'HK$22 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '停車場', en: 'Car Park' }, total: 16, available: 8, stalls: [
        { connector: 'CCS2', kw: 120, count: 10, available: 5 },
        { connector: 'Type2', kw: 22,  count: 6,  available: 3 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-dch-kb', name: { zh: '大昌行集團大廈', en: 'Dah Chong Hong Tower' },
    region: 'kln', lat: 22.3248, lng: 114.2077,
    provider: { zh: '大昌行', en: 'Dah Chong Hong' }, providerCode: 'DCH',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍灣啟祥道 20 號大昌行集團大廈一樓', en: '1/F, Dah Chong Hong Tower, 20 Kai Cheung Rd, Kowloon Bay' },
    parking: { zh: '時租 HK$25 / 小時（訪客專用停車場）', en: 'HK$25 / hour (visitor car park)' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '營運商 App', en: 'Operator App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '一樓', en: '1/F' }, total: 42, available: 26, stalls: [
        { connector: 'CCS2', kw: 240, count: 4,  available: 3 },
        { connector: 'CCS2', kw: 120, count: 8,  available: 5 },
        { connector: 'CCS2', kw: 90,  count: 14, available: 9 },
        { connector: 'CHAdeMO', kw: 50, count: 12, available: 7 },
        { connector: 'CHAdeMO', kw: 30, count: 4,  available: 2 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.02,
    reports: []
  },
  {
    id: 'st-pit-kb', name: { zh: 'PIT Ultra 九龍灣超充站', en: 'PIT Ultra Kowloon Bay Max:600kW' },
    region: 'kln', lat: 22.3205, lng: 114.2057,
    provider: { zh: '中石化 PIT', en: 'Sinopec PIT (Power In Time)' }, providerCode: 'PIT',
    ring: 'crowded', unverified: false, _userReported: true,
    address: { zh: '九龍灣啟福道 8 號（啟福道與承佑街交界，前身為蜆殼油站）', en: '8 Kai Fuk Rd, Kowloon Bay (junction of Kai Fuk Rd & Shing Yau St, former Shell station)' },
    parking: { zh: '免費充電期間泊車', en: 'Free parking while charging' },
    parkingNote: { zh: '站內設 Easy Joy 便利店、Tiki Easy Coffee、扭蛋機、夾公仔機', en: 'Easy Joy store, Tiki Easy Coffee, gachapon, claw machine on site' },
    payment: { zh: 'PIT EV Charging App（掃碼啟動）', en: 'PIT EV Charging App (scan to start)' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '全場', en: 'Site-wide' }, total: 28, available: 4, stalls: [
        { connector: 'CCS2', kw: 600, count: 6,  available: 1 },   // 30% 全液冷極速車位
        { connector: 'CCS2', kw: 120, count: 22, available: 3 }   // 其餘共享 5x600kW 主機，每車位保持 100kW+
      ]}
    ],
    queue: 8, queueConfidence: 'user',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-syp-1', name: { zh: '西營盤高街停車場', en: 'High St Car Park, Sai Ying Pun' },
    region: 'hk', lat: 22.2848, lng: 114.1428,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '西營盤高街 60 號', en: '60 High St, Sai Ying Pun' },
    parking: { zh: '時租 HK$35 / 小時', en: 'HK$35 / hour' },
    parkingNote: { zh: '充電滿 HK$150 豁免 2 小時泊車', en: 'HK$150 charging spend waives 2h parking' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B1', en: 'B1' }, total: 3, available: 2, stalls: [
        { connector: 'CCS2', kw: 100, count: 2, available: 1 },
        { connector: 'Type2', kw: 22,  count: 1, available: 1 }
      ]}
    ],
    queue: 0, queueConfidence: 'gps',
    historyFailRate: 0.03,
    reports: []
  },
  /* ===== 將軍澳 / 西貢區（EV-BOY 2026-11 資料） ===== */
  {
    id: 'st-choiming2', name: { zh: '彩明 2 號停車場', en: 'Choi Ming Car Park 2' },
    region: 'nt', lat: 22.3050, lng: 114.2550,
    provider: { zh: 'CLPe', en: 'CLPe' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '調景嶺彩明街 1 號彩明商場', en: 'Choi Ming Shopping Centre, 1 Choi Ming St, Tiu Keng Leng' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 39, available: 18, stalls: [
      { connector: 'CCS2', kw: 120, count: 30, available: 14 },
      { connector: 'Type2', kw: 22,  count: 9,  available: 4 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-lohas', name: { zh: 'The LOHAS 康城', en: 'The LOHAS LOHAS Park' },
    region: 'nt', lat: 22.2970, lng: 114.2700,
    provider: { zh: 'Jove（港鐵）', en: 'Jove (MTR)' }, providerCode: 'JOVE',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳康城路 1 號', en: '1 LOHAS Rd, Tseung Kwan O' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '消費可換泊車優惠', en: 'Spending for parking waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 46, available: 22, stalls: [
      { connector: 'CCS2', kw: 120, count: 18, available: 9 },
      { connector: 'Type2', kw: 22,  count: 28, available: 13 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-cp-lohas', name: { zh: '充美好康城超充站', en: 'ChargePlus LOHAS Super' },
    region: 'nt', lat: 22.2975, lng: 114.2705,
    provider: { zh: '充美好（華潤）', en: 'ChargePlus (CR)' }, providerCode: 'CP',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳康城路 1 號康城停車場', en: 'LOHAS Park Car Park, 1 LOHAS Rd, Tseung Kwan O' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 42, available: 20, stalls: [
      { connector: 'CCS2', kw: 250, count: 18, available: 8 },
      { connector: 'Type2', kw: 22,  count: 24, available: 12 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.01, reports: []
  },
  {
    id: 'st-tko-gateway-e', name: { zh: 'TKO Gateway 東翼', en: 'TKO Gateway East Wing' },
    region: 'nt', lat: 22.3130, lng: 114.2550,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳常寧路 2 號 TKO Gateway 東翼 4 樓', en: '4/F, TKO Gateway East, 2 Sheung Ning Rd, TKO' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '4 樓', en: '4/F' }, total: 15, available: 7, stalls: [
      { connector: 'CCS2', kw: 120, count: 8, available: 4 },
      { connector: 'Type2', kw: 22,  count: 7, available: 3 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-tko-centre', name: { zh: '將軍澳中心', en: 'Park Central TKO' },
    region: 'nt', lat: 22.3100, lng: 114.2570,
    provider: { zh: 'Tesla（品牌專用）', en: 'Tesla (Brand Only)' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐德街 9 號', en: '9 Tong Tak St, Tseung Kwan O' },
    parking: { zh: '時租 HK$30 / 小時', en: 'HK$30 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'Tesla App / 即插即充', en: 'Tesla App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: 'G', en: 'G' }, total: 18, available: 8, stalls: [
      { connector: 'CCS2', kw: 250, count: 6,  available: 3 },
      { connector: 'Type2', kw: 22,  count: 12, available: 5 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.01, reports: []
  },
  {
    id: 'st-east-point', name: { zh: '東港城 East Point City', en: 'East Point City' },
    region: 'nt', lat: 22.3150, lng: 114.2600,
    provider: { zh: 'The Point 特快充電', en: 'The Point' }, providerCode: 'TP',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳重華路 8 號', en: '8 Chung Wa Rd, Tseung Kwan O' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 6, available: 3, stalls: [
      { connector: 'CCS2', kw: 120, count: 6, available: 3 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.03, reports: []
  },
  {
    id: 'st-tko-spot-tesla', name: { zh: 'TKO Spot Tesla', en: 'TKO Spot Tesla' },
    region: 'nt', lat: 22.3115, lng: 114.2580,
    provider: { zh: 'Tesla（品牌專用）', en: 'Tesla (Brand Only)' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐明街 2 號', en: '2 Tong Ming St, Tseung Kwan O' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: 'Tesla App / 即插即充', en: 'Tesla App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 13, available: 6, stalls: [
      { connector: 'CCS2', kw: 250, count: 4,  available: 2 },
      { connector: 'Type2', kw: 22,  count: 9,  available: 4 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.01, reports: []
  },
  {
    id: 'st-nam-tong', name: { zh: '充美好藍塘滙超充站', en: 'ChargePlus Nam Tong Hui Super' },
    region: 'nt', lat: 22.3055, lng: 114.2650,
    provider: { zh: '充美好（華潤）', en: 'ChargePlus (CR)' }, providerCode: 'CP',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐賢街 29 號停車場', en: '29 Tong Yin St, Tseung Kwan O' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '停車場', en: 'Car Park' }, total: 13, available: 5, stalls: [
      { connector: 'CCS2', kw: 250, count: 6, available: 2 },
      { connector: 'Type2', kw: 22,  count: 7, available: 3 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-kinming', name: { zh: '健明邨', en: 'Kin Ming Estate' },
    region: 'nt', lat: 22.3055, lng: 114.2555,
    provider: { zh: 'Shell Recharge', en: 'Shell Recharge' }, providerCode: 'SH',
    ring: 'nodata', unverified: false,
    address: { zh: '調景嶺彩明街 1 號健明邨 1 樓', en: '1/F, Kin Ming Estate, 1 Choi Ming St, Tiu Keng Leng' },
    parking: { zh: '時租 HK$20 / 小時', en: 'HK$20 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: '1 樓', en: '1/F' }, total: 20, available: 10, stalls: [
      { connector: 'CCS2', kw: 120, count: 8,  available: 4 },
      { connector: 'Type2', kw: 22,  count: 12, available: 6 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-shangtak', name: { zh: '尚德廣場', en: 'Sheung Tak Plaza' },
    region: 'nt', lat: 22.3125, lng: 114.2565,
    provider: { zh: 'CLPe', en: 'CLPe' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐明街 2 號尚德廣場 B 停車場', en: 'B Car Park, Sheung Tak Plaza, 2 Tong Ming St, TKO' },
    parking: { zh: '時租 HK$25 / 小時', en: 'HK$25 / hour' },
    parkingNote: { zh: '無特別豁免', en: 'No special waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [{ level: { zh: 'B', en: 'B' }, total: 8, available: 4, stalls: [
      { connector: 'CCS2', kw: 120, count: 8, available: 4 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.02, reports: []
  },
  {
    id: 'st-tko-sport', name: { zh: '將軍澳運動場', en: 'TKO Sports Ground' },
    region: 'nt', lat: 22.3085, lng: 114.2590,
    provider: { zh: 'E-Charge', en: 'E-Charge' }, providerCode: 'EC',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳寶康路', en: 'Po Hong Rd, Tseung Kwan O' },
    parking: { zh: '免費', en: 'Free' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App', en: 'App' },
    hours: { zh: '07:00 – 23:00', en: '07:00 – 23:00' },
    floors: [{ level: { zh: '露天', en: 'Outdoor' }, total: 4, available: 2, stalls: [
      { connector: 'CCS2', kw: 60, count: 1, available: 1 },
      { connector: 'Type2', kw: 22, count: 3, available: 1 }
    ]}],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.03, reports: []
  },
  {
    id: 'st-popcorn', name: { zh: 'PopCorn 一二期', en: 'PopCorn 1 & 2' },
    region: 'nt', lat: 22.3105, lng: 114.2595,
    provider: { zh: 'Jove（港鐵）', en: 'Jove (MTR)' }, providerCode: 'JOVE',
    ring: 'nodata', unverified: false,
    address: { zh: '將軍澳唐賢街 9 號', en: '9 Tong Yin St, Tseung Kwan O' },
    parking: { zh: '時租 HK$28 / 小時', en: 'HK$28 / hour' },
    parkingNote: { zh: '消費可換泊車優惠', en: 'Spending for parking waiver' },
    payment: { zh: '八達通 / App', en: 'Octopus / App' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '一期', en: 'Ph 1' }, total: 1, available: 1, stalls: [{ connector: 'Type2', kw: 22, count: 1, available: 1 }] },
      { level: { zh: '二期', en: 'Ph 2' }, total: 1, available: 0, stalls: [{ connector: 'Type2', kw: 22, count: 1, available: 0 }] }
    ],
    queue: 0, queueConfidence: 'none', historyFailRate: 0.03, reports: []
  },
  {
    id: 'st-tmt-1', name: { zh: '屯門公路休息區', en: 'Tuen Mun Rd Rest Area' },
    region: 'nt', lat: 22.3782, lng: 114.0182,
    provider: { zh: 'CLP', en: 'CLP' }, providerCode: 'CLP',
    ring: 'nodata', unverified: false,
    address: { zh: '屯門公路近深井', en: 'Tuen Mun Rd near Sham Tseng' },
    parking: { zh: '免費', en: 'Free' },
    parkingNote: { zh: '充電期間免費泊車', en: 'Free parking while charging' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: '露天', en: 'Outdoor' }, total: 6, available: 4, stalls: [
        { connector: 'CCS2', kw: 350, count: 2, available: 1 },
        { connector: 'CCS2', kw: 150, count: 4, available: 3 }
      ]}
    ],
    queue: 0, queueConfidence: 'operator',
    historyFailRate: 0.01,
    reports: []
  },
  {
    id: 'st-kln-1', name: { zh: '又一城停車場', en: 'Festival Walk Car Park' },
    region: 'kln', lat: 22.3372, lng: 114.1728,
    provider: { zh: 'Tesla', en: 'Tesla' }, providerCode: 'TS',
    ring: 'nodata', unverified: false,
    address: { zh: '九龍塘達之路 80 號', en: '80 Tat Chee Ave, Kowloon Tong' },
    parking: { zh: '時租 HK$32 / 小時', en: 'HK$32 / hour' },
    parkingNote: { zh: '充電滿 HK$200 豁免 2 小時泊車', en: 'HK$200 charging spend waives 2h parking' },
    payment: { zh: 'App / 即插即充', en: 'App / Plug & Charge' },
    hours: { zh: '24 小時', en: '24 hours' },
    floors: [
      { level: { zh: 'B2', en: 'B2' }, total: 8, available: 1, stalls: [
        { connector: 'CCS2', kw: 250, count: 2, available: 0 },
        { connector: 'CCS2', kw: 120, count: 4, available: 1 },
        { connector: 'CHAdeMO', kw: 50, count: 2, available: 0 }
      ]},
      { level: { zh: 'B3', en: 'B3' }, total: 4, available: 0, stalls: [
        { connector: 'CCS2', kw: 120, count: 4, available: 0 }
      ]}
    ],
    queue: 2, queueConfidence: 'gps',
    historyFailRate: 0.03,
    reports: []
  }
];

/* ---- 計算工具 ---- */

/** 彙總站點的充電樁與可用數 */
function stationTotals(st) {
  let total = 0, available = 0;
  const byKw = { fast: 0, mid: 0, slow: 0 };  // fast>=100, mid>=30, slow<30
  st.floors.forEach(f => {
    total += f.total;
    available += f.available;
    f.stalls.forEach(s => {
      if (s.kw >= 100) byKw.fast += s.count;
      else if (s.kw >= 30) byKw.mid += s.count;
      else byKw.slow += s.count;
    });
  });
  return { total, available, byKw };
}

/** 站點最高功率 */
function maxKw(st) {
  let m = 0;
  st.floors.forEach(f => f.stalls.forEach(s => { if (s.kw > m) m = s.kw; }));
  return m;
}

/** 站點所有 connector 類型 */
function stationConnectors(st) {
  const set = new Set();
  st.floors.forEach(f => f.stalls.forEach(s => set.add(s.connector)));
  return [...set];
}

/**
 * AI 綜合評分（簡化版，示意用）
 * 因子：成本 / 易用度 / 時間成本 / 功率匹配
 * 回傳 0–100 分與等級
 */
function computeAIScore(st, ctx) {
  // ctx: { carBattery, carMaxDC, soc (0-1), nowHour, distKm, driveMin }
  if (st.ring === 'maintenance' || st.ring === 'nodata') {
    return { score: 0, level: 'unknown', factors: {}, reasonKey: 'noData' };
  }
  const kw = maxKw(st);
  const powerMatch = Math.min(1, kw / ctx.carMaxDC);          // 0-1
  const totals = stationTotals(st);
  const availRatio = totals.total ? totals.available / totals.total : 0;

  // 成本（越低越好）：這裡用簡單的估算
  const costScore = st.parkingNote.en.includes('Free') || st.parkingNote.en.includes('free') ? 0.9
                  : st.parkingNote.zh.includes('豁免') ? 0.75 : 0.5;

  // 易用度
  const queueScore = st.queue === null ? 0.4 : Math.max(0, 1 - st.queue / 8);
  const ease = 0.35 * queueScore + 0.30 * availRatio + 0.20 * (1 - st.historyFailRate * 5) + 0.15 * (st.payment.zh.includes('即插即充') ? 1 : 0.7);

  // 時間成本：行車時間 + 充電時間（越低越好）
  const needKwh = ctx.carBattery * (0.85 - ctx.soc);
  const effKw = Math.min(kw, ctx.carMaxDC) * 0.75;  // 平均有效功率
  const chargeMin = effKw > 0 ? (needKwh / effKw) * 60 : 999;
  const timeScore = Math.max(0, 1 - (ctx.driveMin + chargeMin) / 90);

  const score = Math.round(100 * (
    0.30 * costScore +
    0.35 * ease +
    0.20 * timeScore +
    0.15 * powerMatch
  ));

  let level = 'unknown';
  if (score >= 80) level = 'best';
  else if (score >= 65) level = 'good';
  else if (score >= 45) level = 'fair';
  else level = 'poor';

  return {
    score,
    level,
    factors: {
      cost: Math.round(costScore * 100),
      ease: Math.round(ease * 100),
      time: Math.round(timeScore * 100),
      powerMatch: Math.round(powerMatch * 100)
    },
    chargeMin: Math.round(chargeMin),
    reasonKey: score >= 80 ? 'reasonBest' : score >= 65 ? 'reasonGood' : score >= 45 ? 'reasonFair' : 'reasonPoor'
  };
}

/* 粗略行車時間估算（分鐘）—— haversine 距離 / 平均 40km/h + 轉換 */
function estimateDriveMin(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const dKm = 2 * R * Math.asin(Math.sqrt(a));
  return { distKm: Math.round(dKm * 10) / 10, driveMin: Math.round(dKm / 40 * 60) };
}

/* 導航深層連結 */
function navLinks(lat, lng, name) {
  const q = encodeURIComponent(`${name} ${lat},${lng}`);
  return {
    apple: `https://maps.apple.com/?q=${q}&ll=${lat},${lng}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  };
}
