/* ═══════════════════════════════════════════════════════════════
   ski-game.js  —  Stock Ski Game
   玩法：股票收盤線橫穿畫面，角色 hitbox 必須保持在線上（上下都不能完全超過）
   控制：滑鼠滾輪上下移動角色
   ═══════════════════════════════════════════════════════════════ */

(function () {
  /* ── 常數 ───────────────────────────────────────── */
  const HITBOX_H       = 40;   // 一般模式 hitbox 高度 (px)
  const HITBOX_W       = 28;   // 角色 hitbox 寬度 (px)
  const SCROLL_SPEED   = 6.0;  // 基準速度
  const MIN_SPEED      = 3.0;  // 極限最低速
  const MAX_SPEED      = 11.0; // 極限最高速
  const SCROLL_SENS    = 18;   // 滾輪靈敏度
  const BOOST_MULTIPLIER = 2.8; // 按住中鍵時的滾輪增幅
  const SPEED_BOOST_MULT = 1.5; // 右鍵 / D 最快 1.5x
  const SPEED_BRAKE_MULT = 0.8; // 左鍵 / A 最慢 0.8x
  const CHAR_X_RATIO   = 0.3; // 基準鏡頭錨點：角色目標落在畫面左 30%
  const CHAR_Y_RATIO   = 0.7; // 角色初始落點仍在較下方
  const CAMERA_DEAD_ZONE_TOP_RATIO = 0.6; // 死區上緣
  const CAMERA_DEAD_ZONE_BOTTOM_RATIO = 0.78; // 死區下緣
  const CAMERA_FOLLOW_STRENGTH = 0.55; // 超出死區後，鏡頭只跟一部分
  const CAMERA_VERTICAL_DAMPING = 0.16; // 垂直鏡頭平滑度
  const CAMERA_FLOOR_MARGIN_RATIO = 0.28; // 鏡頭更早踩到底板，保留角色往下脫線的操作空間
  const PLAYER_MIN_HEIGHT_FROM_BOTTOM_RATIO = 0.3; // 角色碰到底部 30% 停線後，後續下拉改由鏡頭接手
  const BELOW_LINE_DANGER_MULTIPLIER = 0.45; // 在線下方時放慢 danger 累積，避免看起來像被卡住
  const LINE_Y_MID     = 0.55; // 地平線在畫面高度的比例
  const TIME_LIMIT_RATIO = 0.8; // 通關時間限制：正常基準時間的 80%
  const CAMERA_STATE_FREE = 'free';
  const CAMERA_STATE_LOCKED = 'locked';
  const CAMERA_STATE_DYNAMIC = 'dynamic';
  const CAMERA_FREE_LERP = 0.05;
  const CAMERA_LOCKED_LERP = 0.24;
  const CAMERA_DYNAMIC_LERP = 0.16;
  const CAMERA_FREE_ZOOM = 0.94;
  const CAMERA_LOCKED_ZOOM = 1.05;
  const CAMERA_DYNAMIC_ZOOM = 1.12;
  const THEME_BACKGROUND_BASE = '/static/assets/homepage-backgrounds';
  const PROP_SPRITE_BASE = '/static/assets/ski-props';
  const PERIOD_TUNING = {
    "1mo": { mapWidth: 3.2, heightScale: 1.45, slopeAccel: 0.095, dangerTolerance: 38 },
    "3mo": { mapWidth: 4.2, heightScale: 1.2, slopeAccel: 0.085, dangerTolerance: 42 },
    "6mo": { mapWidth: 5.0, heightScale: 1.0, slopeAccel: 0.075, dangerTolerance: 45 },
    "1y":  { mapWidth: 7.5, heightScale: 0.82, slopeAccel: 0.065, dangerTolerance: 50 },
    "2y":  { mapWidth: 10.5, heightScale: 0.68, slopeAccel: 0.055, dangerTolerance: 56 },
  };
  // 練習模式係數 (乘以一般值)
  const PRACTICE_HEIGHT_SCALE_MULT  = 0.55; // 地形高度縮減到 55% (更平緩)
  const PRACTICE_SLOPE_ACCEL_MULT   = 0.50; // 斜率加速只有 50% (更慢)
  const PRACTICE_DANGER_TOL_MULT    = 2.5;  // 容忍時間放大 2.5 倍
  const PRACTICE_HITBOX_H           = 72;   // 練習模式 hitbox 高度 (比一般大很多)
  const DANGER_LIMIT_MULTIPLIER     = 5.5;  // 累積容錯大幅提高，讓單次失誤不至於直接淘汰
  const THEME_MANIFEST_URL = `${THEME_BACKGROUND_BASE}/manifest.json`;
  const TERRAIN_THEME_PRESETS = {
    "數位冰原": { base: '#0d3455', mid: '#0b5876', glow: '#67e8f9', accent: '#22d3ee', shadow: '#06101a', snow: '#e0f2fe', pattern: 'circuit', edge: 'ice' },
    "雲端之巔": { base: '#16345c', mid: '#225b87', glow: '#bae6fd', accent: '#7dd3fc', shadow: '#081323', snow: '#f0f9ff', pattern: 'cloud', edge: 'soft' },
    "零售超市": { base: '#6a2a12', mid: '#b45309', glow: '#fdba74', accent: '#fb923c', shadow: '#1b0e0a', snow: '#fff7ed', pattern: 'retail', edge: 'tape' },
    "未來交通": { base: '#1f3348', mid: '#4b6b8f', glow: '#dbeafe', accent: '#93c5fd', shadow: '#091018', snow: '#f8fafc', pattern: 'transit', edge: 'sleek' },
    "摩天雪都": { base: '#28374d', mid: '#52647d', glow: '#fde68a', accent: '#facc15', shadow: '#0f1722', snow: '#f8fafc', pattern: 'finance', edge: 'temple' },
    "穩收金庫": { base: '#2c4058', mid: '#556f8d', glow: '#fde68a', accent: '#facc15', shadow: '#0d1521', snow: '#f8fafc', pattern: 'marble', edge: 'temple' },
    "綠能山脈": { base: '#164e3d', mid: '#1f7a59', glow: '#86efac', accent: '#4ade80', shadow: '#07110d', snow: '#ecfdf5', pattern: 'energy', edge: 'charged' },
    "鋼鐵峽谷": { base: '#3a424d', mid: '#5b6470', glow: '#fdba74', accent: '#f97316', shadow: '#12161b', snow: '#f3f4f6', pattern: 'industrial', edge: 'hard' },
    "霓虹傳媒": { base: '#34184e', mid: '#6b21a8', glow: '#f0abfc', accent: '#e879f9', shadow: '#130817', snow: '#faf5ff', pattern: 'neon', edge: 'glitch' },
    "default": { base: '#20405f', mid: '#305d85', glow: '#93c5fd', accent: '#60a5fa', shadow: '#08111b', snow: '#eff6ff', pattern: 'ice', edge: 'ice' },
  };
  const TSMC_HERO_PACK = [
    { prop: 'tsmc-wafer-gate', band: 0.22, depthRatio: 0.16, size: 184, anchor: 'hero' },
    { prop: 'tsmc-fab-spine', band: 0.76, depthRatio: 0.44, size: 176, anchor: 'hero' },
  ];
  const BABA_HERO_PACK = [
    { prop: 'baba-market-gate', band: 0.26, depthRatio: 0.18, size: 184, anchor: 'hero' },
    { prop: 'baba-lantern-cloud', band: 0.78, depthRatio: 0.48, size: 174, anchor: 'hero' },
  ];
  const RIVN_HERO_PACK = [
    { prop: 'rivn-adventure-frame', band: 0.24, depthRatio: 0.18, size: 178, anchor: 'hero' },
    { prop: 'rivn-rack-camp', band: 0.74, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const NIO_HERO_PACK = [
    { prop: 'nio-swap-core', band: 0.24, depthRatio: 0.18, size: 180, anchor: 'hero' },
    { prop: 'nio-wing-hub', band: 0.74, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const MEDIATEK_HERO_PACK = [
    { prop: 'mtk-signal-pagoda', band: 0.22, depthRatio: 0.16, size: 180, anchor: 'hero' },
    { prop: 'mtk-mobile-core', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const HONHAI_HERO_PACK = [
    { prop: 'honhai-factory-arc', band: 0.24, depthRatio: 0.18, size: 186, anchor: 'hero' },
    { prop: 'honhai-connector-yard', band: 0.76, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const PDD_HERO_PACK = [
    { prop: 'pdd-bargain-beacon', band: 0.24, depthRatio: 0.18, size: 178, anchor: 'hero' },
    { prop: 'pdd-parcel-kite', band: 0.76, depthRatio: 0.48, size: 172, anchor: 'hero' },
  ];
  const TENCENT_HERO_PACK = [
    { prop: 'tencent-super-app-tower', band: 0.22, depthRatio: 0.16, size: 182, anchor: 'hero' },
    { prop: 'tencent-orbit-plaza', band: 0.76, depthRatio: 0.46, size: 176, anchor: 'hero' },
  ];
  const QUANTA_HERO_PACK = [
    { prop: 'quanta-server-vault', band: 0.24, depthRatio: 0.18, size: 182, anchor: 'hero' },
    { prop: 'quanta-cloud-frame', band: 0.76, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const TW50_HERO_PACK = [
    { prop: 'tw50-benchmark-arch', band: 0.24, depthRatio: 0.18, size: 182, anchor: 'hero' },
    { prop: 'tw50-coin-spine', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const DIVIDEND56_HERO_PACK = [
    { prop: 'div56-coupon-vault', band: 0.24, depthRatio: 0.18, size: 180, anchor: 'hero' },
    { prop: 'div56-cash-ribbon', band: 0.76, depthRatio: 0.46, size: 170, anchor: 'hero' },
  ];
  const ESG878_HERO_PACK = [
    { prop: 'esg878-leaf-shield', band: 0.24, depthRatio: 0.18, size: 178, anchor: 'hero' },
    { prop: 'esg878-sustain-column', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const DIVIDEND919_HERO_PACK = [
    { prop: 'div919-medal-vault', band: 0.24, depthRatio: 0.18, size: 180, anchor: 'hero' },
    { prop: 'div919-income-column', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const NFLX_HERO_PACK = [
    { prop: 'nflx-screen-portal', band: 0.22, depthRatio: 0.16, size: 184, anchor: 'hero' },
    { prop: 'nflx-marquee-stack', band: 0.76, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const CRM_HERO_PACK = [
    { prop: 'crm-cloud-campus', band: 0.24, depthRatio: 0.18, size: 182, anchor: 'hero' },
    { prop: 'crm-data-loop', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const ORCL_HERO_PACK = [
    { prop: 'orcl-red-vault', band: 0.22, depthRatio: 0.16, size: 182, anchor: 'hero' },
    { prop: 'orcl-database-bridge', band: 0.76, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const QCOM_HERO_PACK = [
    { prop: 'qcom-signal-satellite', band: 0.24, depthRatio: 0.18, size: 180, anchor: 'hero' },
    { prop: 'qcom-mobile-wave', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const INTC_HERO_PACK = [
    { prop: 'intc-fab-fortress', band: 0.22, depthRatio: 0.16, size: 184, anchor: 'hero' },
    { prop: 'intc-silicon-arch', band: 0.76, depthRatio: 0.46, size: 174, anchor: 'hero' },
  ];
  const MU_HERO_PACK = [
    { prop: 'mu-memory-stack', band: 0.24, depthRatio: 0.18, size: 182, anchor: 'hero' },
    { prop: 'mu-data-lattice', band: 0.76, depthRatio: 0.46, size: 172, anchor: 'hero' },
  ];
  const AMAT_HERO_PACK = [
    { prop: 'amat-toolframe-gate', band: 0.22, depthRatio: 0.16, size: 184, anchor: 'hero' },
    { prop: 'amat-cleanroom-crane', band: 0.76, depthRatio: 0.48, size: 176, anchor: 'hero' },
  ];
  const STOCK_HERO_PACKS = {
    META: [
      { prop: 'meta-social-window', band: 0.18, depthRatio: 0.16, size: 184, anchor: 'hero' },
      { prop: 'meta-creator-portal', band: 0.74, depthRatio: 0.44, size: 168, anchor: 'hero' },
    ],
    AMZN: [
      { prop: 'amzn-box-wall', band: 0.34, depthRatio: 0.18, size: 182, anchor: 'hero' },
      { prop: 'amzn-fulfillment-hub', band: 0.82, depthRatio: 0.52, size: 178, anchor: 'hero' },
    ],
    NVDA: [
      { prop: 'nvda-chip-monolith', band: 0.22, depthRatio: 0.14, size: 188, anchor: 'hero' },
      { prop: 'nvda-neural-core', band: 0.72, depthRatio: 0.40, size: 172, anchor: 'hero' },
    ],
    TSLA: [
      { prop: 'tsla-cyber-body', band: 0.30, depthRatio: 0.20, size: 176, anchor: 'hero' },
      { prop: 'tsla-supercharger-bay', band: 0.76, depthRatio: 0.50, size: 186, anchor: 'hero' },
    ],
    MSFT: [
      { prop: 'msft-window-campus', band: 0.22, depthRatio: 0.18, size: 180, anchor: 'hero' },
      { prop: 'msft-copilot-bridge', band: 0.74, depthRatio: 0.42, size: 174, anchor: 'hero' },
    ],
    GOOGL: [
      { prop: 'googl-search-gateway', band: 0.2, depthRatio: 0.16, size: 178, anchor: 'hero' },
      { prop: 'googl-data-orbit', band: 0.76, depthRatio: 0.46, size: 176, anchor: 'hero' },
    ],
    JPM: [
      { prop: 'jpm-vault-facade', band: 0.24, depthRatio: 0.18, size: 186, anchor: 'hero' },
      { prop: 'jpm-column-crown', band: 0.72, depthRatio: 0.44, size: 170, anchor: 'hero' },
    ],
    AAPL: [
      { prop: 'aapl-vision-dome', band: 0.24, depthRatio: 0.18, size: 182, anchor: 'hero' },
      { prop: 'aapl-device-arch', band: 0.76, depthRatio: 0.44, size: 170, anchor: 'hero' },
    ],
    AMD: [
      { prop: 'amd-core-fabric', band: 0.22, depthRatio: 0.16, size: 180, anchor: 'hero' },
      { prop: 'amd-radeon-array', band: 0.72, depthRatio: 0.42, size: 174, anchor: 'hero' },
    ],
    AVGO: [
      { prop: 'avgo-signal-backbone', band: 0.24, depthRatio: 0.18, size: 184, anchor: 'hero' },
      { prop: 'avgo-switch-matrix', band: 0.76, depthRatio: 0.46, size: 176, anchor: 'hero' },
    ],
    BAC: [
      { prop: 'bac-ledger-tower', band: 0.22, depthRatio: 0.18, size: 180, anchor: 'hero' },
      { prop: 'bac-civic-shield', band: 0.72, depthRatio: 0.44, size: 172, anchor: 'hero' },
    ],
    '2330_TW': TSMC_HERO_PACK,
    '2330': TSMC_HERO_PACK,
    BABA: BABA_HERO_PACK,
    RIVN: RIVN_HERO_PACK,
    NIO: NIO_HERO_PACK,
    '2454_TW': MEDIATEK_HERO_PACK,
    '2454': MEDIATEK_HERO_PACK,
    '2317_TW': HONHAI_HERO_PACK,
    '2317': HONHAI_HERO_PACK,
    PDD: PDD_HERO_PACK,
    '700_HK': TENCENT_HERO_PACK,
    '2382_TW': QUANTA_HERO_PACK,
    '2382': QUANTA_HERO_PACK,
    '0050_TW': TW50_HERO_PACK,
    '0050': TW50_HERO_PACK,
    '0056_TW': DIVIDEND56_HERO_PACK,
    '0056': DIVIDEND56_HERO_PACK,
    '00878_TW': ESG878_HERO_PACK,
    '00878': ESG878_HERO_PACK,
    '00919_TW': DIVIDEND919_HERO_PACK,
    '00919': DIVIDEND919_HERO_PACK,
    '9988_HK': BABA_HERO_PACK,
    NFLX: NFLX_HERO_PACK,
    CRM: CRM_HERO_PACK,
    ORCL: ORCL_HERO_PACK,
    QCOM: QCOM_HERO_PACK,
    INTC: INTC_HERO_PACK,
    MU: MU_HERO_PACK,
    AMAT: AMAT_HERO_PACK,
  };
  const PROP_SPRITE_ALIASES = {
    gpu: 'chip-core',
    chip: 'chip-core',
    'network-chip': 'chip-core',
    'mobile-chip': 'chip-core',
    'ai-core': 'chip-core',
    wafer: 'wafer-disc',
    'leaf-grid': 'wafer-disc',
    server: 'tower-stack',
    'server-rack': 'tower-stack',
    'cleanroom-tower': 'tower-stack',
    factory: 'tower-stack',
    'beam-frame': 'tower-stack',
    'data-cube': 'tower-stack',
    'signal-beam': 'signal-array',
    'search-beam': 'signal-array',
    'fiber-tree': 'signal-array',
    'fiber-node': 'signal-array',
    connector: 'signal-array',
    megaphone: 'signal-array',
    'orbit-ring': 'orbital-ring',
    'portal-ring': 'orbital-ring',
    'wave-ring': 'orbital-ring',
    'cloud-block': 'cloud-block',
    'window-panel': 'window-panel',
    'copilot-orb': 'orbital-ring',
    'data-bridge': 'bridge-arch',
    'market-arch': 'bridge-arch',
    'data-prism': 'data-prism',
    'chat-bubble': 'chat-bubble',
    'pixel-stack': 'pixel-stack',
    visor: 'visor-mask',
    'game-pad': 'visor-mask',
    'neon-tower': 'pixel-stack',
    parcel: 'parcel-crate',
    cart: 'cart-basket',
    'arrow-arc': 'arrow-rush',
    'price-tag': 'ticket-tag',
    coupon: 'ticket-tag',
    tire: 'tire-runner',
    'speed-fin': 'arrow-rush',
    headlamp: 'signal-array',
    'trail-rack': 'tire-runner',
    'hover-engine': 'engine-core',
    'battery-pack': 'battery-module',
    'charge-pillar': 'charge-pillar',
    'swap-station': 'charge-pillar',
    'wing-light': 'signal-array',
    coin: 'coin-emblem',
    column: 'column-shard',
    vault: 'vault-core',
    shield: 'shield-badge',
    'cash-badge': 'shield-badge',
    medal: 'shield-badge',
    ribbon: 'shield-badge',
    lantern: 'shield-badge',
    'metal-bar': 'column-shard',
    turbine: 'turbine-array',
    'solar-panel': 'solar-panel',
    'oil-rig': 'oil-rig',
    container: 'container-stack',
    'meta-social-window': 'meta-social-window',
    'meta-creator-portal': 'meta-creator-portal',
    'amzn-box-wall': 'amzn-box-wall',
    'amzn-fulfillment-hub': 'amzn-fulfillment-hub',
    'nvda-chip-monolith': 'nvda-chip-monolith',
    'nvda-neural-core': 'nvda-neural-core',
    'tsla-cyber-body': 'tsla-cyber-body',
    'tsla-supercharger-bay': 'tsla-supercharger-bay',
    'msft-window-campus': 'msft-window-campus',
    'msft-copilot-bridge': 'msft-copilot-bridge',
    'googl-search-gateway': 'googl-search-gateway',
    'googl-data-orbit': 'googl-data-orbit',
    'jpm-vault-facade': 'jpm-vault-facade',
    'jpm-column-crown': 'jpm-column-crown',
    'aapl-vision-dome': 'aapl-vision-dome',
    'aapl-device-arch': 'aapl-device-arch',
    'amd-core-fabric': 'amd-core-fabric',
    'amd-radeon-array': 'amd-radeon-array',
    'avgo-signal-backbone': 'avgo-signal-backbone',
    'avgo-switch-matrix': 'avgo-switch-matrix',
    'bac-ledger-tower': 'bac-ledger-tower',
    'bac-civic-shield': 'bac-civic-shield',
    'tsmc-wafer-gate': 'tsmc-wafer-gate',
    'tsmc-fab-spine': 'tsmc-fab-spine',
    'baba-market-gate': 'baba-market-gate',
    'baba-lantern-cloud': 'baba-lantern-cloud',
    'rivn-adventure-frame': 'rivn-adventure-frame',
    'rivn-rack-camp': 'rivn-rack-camp',
    'nio-swap-core': 'nio-swap-core',
    'nio-wing-hub': 'nio-wing-hub',
    'mtk-signal-pagoda': 'mtk-signal-pagoda',
    'mtk-mobile-core': 'mtk-mobile-core',
    'honhai-factory-arc': 'honhai-factory-arc',
    'honhai-connector-yard': 'honhai-connector-yard',
    'pdd-bargain-beacon': 'pdd-bargain-beacon',
    'pdd-parcel-kite': 'pdd-parcel-kite',
    'tencent-super-app-tower': 'tencent-super-app-tower',
    'tencent-orbit-plaza': 'tencent-orbit-plaza',
    'quanta-server-vault': 'quanta-server-vault',
    'quanta-cloud-frame': 'quanta-cloud-frame',
    'tw50-benchmark-arch': 'tw50-benchmark-arch',
    'tw50-coin-spine': 'tw50-coin-spine',
    'div56-coupon-vault': 'div56-coupon-vault',
    'div56-cash-ribbon': 'div56-cash-ribbon',
    'esg878-leaf-shield': 'esg878-leaf-shield',
    'esg878-sustain-column': 'esg878-sustain-column',
    'div919-medal-vault': 'div919-medal-vault',
    'div919-income-column': 'div919-income-column',
    'nflx-screen-portal': 'nflx-screen-portal',
    'nflx-marquee-stack': 'nflx-marquee-stack',
    'crm-cloud-campus': 'crm-cloud-campus',
    'crm-data-loop': 'crm-data-loop',
    'orcl-red-vault': 'orcl-red-vault',
    'orcl-database-bridge': 'orcl-database-bridge',
    'qcom-signal-satellite': 'qcom-signal-satellite',
    'qcom-mobile-wave': 'qcom-mobile-wave',
    'intc-fab-fortress': 'intc-fab-fortress',
    'intc-silicon-arch': 'intc-silicon-arch',
    'mu-memory-stack': 'mu-memory-stack',
    'mu-data-lattice': 'mu-data-lattice',
    'amat-toolframe-gate': 'amat-toolframe-gate',
    'amat-cleanroom-crane': 'amat-cleanroom-crane',
  };

  /* ── 狀態 ───────────────────────────────────────── */
  let canvas, ctx;
  let animId;
  let gameState = 'idle'; // idle | countdown | playing | dead | complete
  let stockData = null;   // { symbol, closes, dates, period }
  let activeThemeBackground = null;
  let activeTerrainTheme = null;
  let practiceMode = false; // 練習模式開關
  let practiceOpts = { steepness: 40, hitboxSize: 60, startPct: 0, endPct: 100 }; // 從滑框傳入

  // ── 視覺細節狀態 ──
  let highDetailMode = false;
  let themeAssets = { vista: null, texture: null };
  let cachedPatterns = { terrain: null, detail: null, hd: null, hdSrc: null, themeSrc: null };
  const themeBackgroundCache = new Map();
  const terrainPatternCache = new Map();
  const terrainDetailCache = new Map();
  const propSpriteCache = new Map();
  let themeManifestMap = null;
  let themeManifestPromise = null;

  // 動態取得當前 hitbox 高度
  // hitboxSize 1√100 → 映射到 40√100px
  function getHitboxH() {
    if (!practiceMode) return HITBOX_H;
    const t = (practiceOpts.hitboxSize - 1) / 99; // 0~1
    return Math.round(HITBOX_H + t * (100 - HITBOX_H)); // 40~100px
  }

  function getPlayerWorldOffsetX() {
    return canvas ? canvas.width * CHAR_X_RATIO : 0;
  }

  function getCharX() {
    return getPlayerWorldOffsetX();
  }

  function getCharAnchorY() {
    return canvas ? canvas.height * CHAR_Y_RATIO : 200;
  }

  function getCharWorldX() {
    return terrainScrollX + getPlayerWorldOffsetX();
  }

  function getScreenLineYAt(worldX) {
    return getLineYAt(worldX) + terrainCameraOffsetY + verticalCameraOffsetY;
  }

  function getTerrainRenderOffsetY() {
    return terrainCameraOffsetY + verticalCameraOffsetY;
  }

  function getTerrainScreenAngleAt(worldX) {
    const slopeSample = 22;
    const slopeStartY = getScreenLineYAt(worldX - slopeSample);
    const slopeEndY = getScreenLineYAt(worldX + slopeSample);
    return clamp(
      Math.atan2(slopeEndY - slopeStartY, slopeSample * 2),
      -0.6,
      0.6,
    );
  }

  function getMaxCameraX() {
    if (!canvas || !terrainPoints.length) return 0;
    const lastX = terrainPoints[terrainPoints.length - 1]?.x || 0;
    return Math.max(0, lastX - canvas.width * 0.14);
  }

  // 地形
  let terrainPoints = []; // [{x, y}] 已映射到畫面座標
  let terrainScrollX = 0; // 目前已捲過多少 px
  let activeCloses = [];
  let activeDates = [];
  let priceMin = 0;
  let priceMax = 1;
  let terrainYMin = 0;
  let terrainYMax = 1;
  let leftKeyDown = false;
  let rightKeyDown = false;
  let leftMouseDown = false;
  let rightMouseDown = false;

  // 角色
  let charY = 200;        // 角色中心 Y
  let charTargetY = 200;  // 滾輪目標 Y（加平滑）
  let charVisualOffsetY = 0; // 保留角色視覺偏移欄位，預設收斂回 0
  let terrainCameraOffsetY = 0;
  let terrainCameraTargetOffsetY = 0;
  let verticalCameraOffsetY = 0;
  let verticalCameraTargetOffsetY = 0;
  let isVerticalCameraFollowing = false;
  let terrainCameraFloorOffsetY = -Infinity;
  let cameraX = 0;
  let cameraTargetX = 0;
  let cameraLerpFactor = CAMERA_FREE_LERP;
  let cameraZoom = CAMERA_FREE_ZOOM;
  let cameraTargetZoom = CAMERA_FREE_ZOOM;
  let cameraState = CAMERA_STATE_FREE;
  let cameraFocusStrength = 0;
  let cameraFocusWorldX = null;
  let isBoosting = false; // 滑鼠中鍵按住時提升上下移動幅度
  let spaceBoostDown = false;

  // 危險計時
  let dangerFrames = 0;
  let isDangerAbove = false;
  let isDangerBelow = false;

  // HUD
  let score = 0;
  let maxPossibleScore = 0; // 本關理論最高分
  let mouseOnlyRun = true;
  let surviveFrames = 0;
  let timeLimitSeconds = 0;
  let countdownVal = 3;
  let countdownTimer = 0;
  let perfectStreakDistance = 0;
  let bestPerfectStreakDistance = 0;
  let streakBonusScore = 0;
  let elapsedMs = 0;
  let lastFrameTs = 0;
  let earlyFinishBonus = 0;
  let scoreBandFrames = {
    perfect: 0,
    light: 0,
    mild: 0,
    medium: 0,
    heavy: 0,
  };
  let resultButtonRects = null;

  // 粒子
  let particles = [];

  // 速度
  let currentSpeed = SCROLL_SPEED;
  let playerSpeedMultiplier = 1;

  function getDangerLimit() {
    const config = getPeriodConfig();
    return Math.max(1, config.dangerTolerance * DANGER_LIMIT_MULTIPLIER);
  }

  function getDangerRatio() {
    return Math.min(1, dangerFrames / getDangerLimit());
  }

  function getAccuracyPct() {
    return Math.max(70, 100 - getDangerRatio() * 30);
  }

  function getAccuracyBarRatio() {
    return Math.max(0, Math.min(1, (getAccuracyPct() - 70) / 30));
  }

  function getScoreMultiplier() {
    return mouseOnlyRun ? 1.3 : 1;
  }

  function getFinalScore() {
    return Math.round((score + earlyFinishBonus) * getScoreMultiplier());
  }

  function getDangerBand(ratio) {
    if (ratio <= 0) return 'perfect';
    if (ratio <= 0.12) return 'light';
    if (ratio <= 0.28) return 'mild';
    if (ratio <= 0.5) return 'medium';
    return 'heavy';
  }

  function getBandScore(ratio) {
    const band = getDangerBand(ratio);
    if (band === 'perfect') {
      const totalDistance = Math.max(1, terrainPoints[terrainPoints.length - 1]?.x || 1);
      const streakPct = (perfectStreakDistance / totalDistance) * 100;
      if (streakPct >= 50) return 20;
      if (streakPct >= 40) return 18;
      if (streakPct >= 30) return 16;
      if (streakPct >= 20) return 14;
      if (streakPct >= 10) return 12;
      return 10;
    }
    if (band === 'light') return 7;
    if (band === 'mild') return 5;
    if (band === 'medium') return 3;
    return 1;
  }

  function getBandPct(key) {
    const total = Math.max(1, surviveFrames);
    return (scoreBandFrames[key] / total) * 100;
  }

  function getBestPerfectPct() {
    const totalDistance = Math.max(1, terrainPoints[terrainPoints.length - 1]?.x || 1);
    return (bestPerfectStreakDistance / totalDistance) * 100;
  }

  function getElapsedSeconds() {
    return elapsedMs / 1000;
  }

  function getQualifyingSeconds() {
    return timeLimitSeconds;
  }

  function normalizeThemeSymbol(symbol) {
    return String(symbol || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    const x = clamp(t, 0, 1);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function hashString(input) {
    let h = 2166136261;
    for (const ch of String(input || '')) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createRng(seed) {
    let state = hashString(seed) || 1;
    return function rng() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return { r: 255, g: 255, b: 255 };
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  function withAlpha(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const f = clamp(t, 0, 1);
    return `rgb(${Math.round(lerp(a.r, b.r, f))},${Math.round(lerp(a.g, b.g, f))},${Math.round(lerp(a.b, b.b, f))})`;
  }

  function ensureThemeBackground(symbol) {
    const key = normalizeThemeSymbol(symbol);
    if (!key) return null;
    let entry = themeBackgroundCache.get(key);
    if (!entry) {
      const img = new Image();
      entry = {
        key,
        src: `${THEME_BACKGROUND_BASE}/${key}.svg`,
        img,
        status: 'loading',
      };
      img.decoding = 'async';
      img.onload = () => { entry.status = 'ready'; };
      img.onerror = () => { entry.status = 'error'; };
      img.src = entry.src;
      themeBackgroundCache.set(key, entry);
    }
    return entry;
  }

  function getPropSpriteKey(kind) {
    return PROP_SPRITE_ALIASES[kind] || null;
  }

  function ensurePropSprite(kind) {
    const key = getPropSpriteKey(kind);
    if (!key) return null;
    let entry = propSpriteCache.get(key);
    if (!entry) {
      const img = new Image();
      entry = {
        key,
        src: `${PROP_SPRITE_BASE}/${key}.svg`,
        img,
        status: 'loading',
      };
      img.decoding = 'async';
      img.onload = () => { entry.status = 'ready'; };
      img.onerror = () => { entry.status = 'error'; };
      img.src = entry.src;
      propSpriteCache.set(key, entry);
    }
    return entry;
  }

  function ensureThemeManifest() {
    if (themeManifestMap || themeManifestPromise || typeof fetch !== 'function') return themeManifestPromise;
    themeManifestPromise = fetch(THEME_MANIFEST_URL, { cache: 'force-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        themeManifestMap = new Map();
        for (const item of payload?.stocks || []) {
          themeManifestMap.set(normalizeThemeSymbol(item.symbol), item);
        }
        activeTerrainTheme = buildActiveTerrainTheme(stockData?.symbol);
        return themeManifestMap;
      })
      .catch(() => null);
    return themeManifestPromise;
  }

  function getThemeManifestEntry(symbol) {
    return themeManifestMap?.get(normalizeThemeSymbol(symbol)) || null;
  }

  function getStockHeroPack(symbol) {
    return STOCK_HERO_PACKS[normalizeThemeSymbol(symbol)] || [];
  }

  function analyzeMarketShape(closes) {
    if (!Array.isArray(closes) || closes.length < 2) {
      return { trend: 0, volatility: 0.01, maxSwing: 0.015 };
    }
    let volatilitySum = 0;
    let maxSwing = 0;
    for (let i = 1; i < closes.length; i++) {
      const prev = Math.max(0.0001, Math.abs(closes[i - 1]));
      const move = (closes[i] - closes[i - 1]) / prev;
      const absMove = Math.abs(move);
      volatilitySum += absMove;
      maxSwing = Math.max(maxSwing, absMove);
    }
    const first = Math.max(0.0001, Math.abs(closes[0]));
    const trend = (closes[closes.length - 1] - closes[0]) / first;
    return {
      trend,
      volatility: volatilitySum / Math.max(1, closes.length - 1),
      maxSwing,
    };
  }

  function getThemeVariant(stats) {
    if (stats.trend <= -0.12) return 'crash';
    if (stats.trend <= -0.035) return 'bearish';
    if (stats.volatility >= 0.035 || stats.maxSwing >= 0.07) return 'volatile';
    if (stats.trend >= 0.1) return 'bullish';
    return 'normal';
  }

  function getTerrainFeatureAnchors(limit = 8) {
    if (terrainPoints.length < 5) return [];
    const totalX = terrainPoints[terrainPoints.length - 1]?.x || 1;
    const sampleStride = Math.max(1, Math.floor(terrainPoints.length / 18));
    const minGap = totalX * 0.08;
    const candidates = [];
    for (let i = sampleStride; i < terrainPoints.length - sampleStride; i += sampleStride) {
      const prev = terrainPoints[i - sampleStride];
      const curr = terrainPoints[i];
      const next = terrainPoints[i + sampleStride];
      const slopeIn = curr.y - prev.y;
      const slopeOut = next.y - curr.y;
      const bend = Math.abs(slopeOut - slopeIn);
      const isPivot = Math.sign(slopeIn) !== Math.sign(slopeOut);
      if (!isPivot && bend < 10) continue;
      const prominence = bend + Math.abs(slopeIn) * 0.7 + Math.abs(slopeOut) * 0.7;
      candidates.push({
        worldX: curr.x,
        ridgeY: curr.y,
        prominence,
      });
    }
    candidates.sort((a, b) => b.prominence - a.prominence);
    const picked = [];
    for (const candidate of candidates) {
      if (picked.every((item) => Math.abs(item.worldX - candidate.worldX) > minGap)) {
        picked.push(candidate);
      }
      if (picked.length >= limit) break;
    }
    return picked.sort((a, b) => a.worldX - b.worldX);
  }

  function buildPropPlacements(symbol, props, stats, heroSpecs = []) {
    if (!terrainPoints.length) return [];
    const rng = createRng(`${symbol}:${terrainPoints.length}:${stats.trend.toFixed(3)}:${stats.volatility.toFixed(3)}`);
    const totalX = terrainPoints[terrainPoints.length - 1]?.x || 1;
    const viewportH = canvas?.height || terrainYMax || 720;
    const mountainFloorY = Math.max(terrainYMax + 110, viewportH - 28);
    const baseProps = props.length ? props : ['signal-beam', 'chip', 'coin', 'parcel'];
    const anchors = getTerrainFeatureAnchors(Math.max(5, Math.min(8, baseProps.length + 4)));
    const count = clamp(Math.round((baseProps.length || 3) * (2.5 + stats.volatility * 22)), 12, 22);
    const placements = [];
    const anchorStrength = [...anchors].sort((a, b) => b.prominence - a.prominence);
    const heroAnchorSet = new Set(anchorStrength.slice(0, Math.min(3, Math.max(2, Math.round(baseProps.length / 2)))).map((item) => item.worldX));

    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i];
      const isHero = heroAnchorSet.has(anchor.worldX);
      const availableDepth = Math.max(80, mountainFloorY - anchor.ridgeY - 24);
      placements.push({
        prop: baseProps[i % baseProps.length],
        worldX: anchor.worldX,
        ridgeY: anchor.ridgeY,
        depth: isHero ? availableDepth * (0.14 + rng() * 0.14) : 0,
        size: isHero ? 128 + rng() * 54 : 70 + rng() * 30,
        anchor: isHero ? 'hero' : 'ridge',
        alpha: isHero ? 0.46 + rng() * 0.12 : 0.96,
      });

      const flankCount = isHero ? 3 : 2;
      for (let j = 0; j < flankCount; j++) {
        const direction = j % 2 === 0 ? -1 : 1;
        const offset = direction * (34 + rng() * 74) + (j > 1 ? direction * (46 + rng() * 54) : 0);
        const worldX = clamp(anchor.worldX + offset, totalX * 0.06, totalX * 0.95);
        const flankRidgeY = getLineYAt(worldX);
        const flankAvailableDepth = Math.max(76, mountainFloorY - flankRidgeY - 22);
        const depthRatio = j === 0 ? 0.22 + rng() * 0.18 : 0.46 + rng() * 0.24;
        placements.push({
          prop: baseProps[(i + j + 1) % baseProps.length],
          worldX,
          ridgeY: flankRidgeY,
          depth: flankAvailableDepth * depthRatio,
          size: j === 0 ? 56 + rng() * 28 : 50 + rng() * 26,
          anchor: j === 0 ? 'interior' : 'deep',
          alpha: j === 0 ? 0.84 + rng() * 0.12 : 0.58 + rng() * 0.16,
        });
      }
    }

    for (let i = 0; i < count; i++) {
      const band = (i + 1) / (count + 1);
      const anchor = anchors.length ? anchors[i % anchors.length] : null;
      const bandBase = anchor
        ? anchor.worldX / totalX + (rng() - 0.5) * 0.08
        : band + (rng() - 0.5) * 0.09;
      const worldX = totalX * clamp(bandBase, 0.08, 0.95);
      const ridgeY = getLineYAt(worldX);
      const availableDepth = Math.max(72, mountainFloorY - ridgeY - 24);
      let layerType = 'interior';
      const layerRoll = rng();
      if (i % 6 === 0) layerType = 'ridge';
      else if (layerRoll > 0.68) layerType = 'deep';
      else if (layerRoll > 0.36) layerType = 'mid';
      placements.push({
        prop: baseProps[i % baseProps.length],
        worldX,
        ridgeY,
        depth:
          layerType === 'ridge' ? 0
          : layerType === 'mid' ? availableDepth * (0.34 + rng() * 0.18)
          : layerType === 'deep' ? availableDepth * (0.56 + rng() * 0.22)
          : availableDepth * (0.16 + rng() * 0.18),
        size:
          layerType === 'ridge' ? 60 + rng() * 36
          : layerType === 'deep' ? 48 + rng() * 24
          : 46 + rng() * 30,
        anchor: layerType,
        alpha:
          layerType === 'ridge' ? 0.88 + rng() * 0.08
          : layerType === 'deep' ? 0.56 + rng() * 0.16
          : 0.72 + rng() * 0.16,
      });
    }

    const lowerBandCount = clamp(Math.round(baseProps.length * (1.6 + stats.volatility * 12)), 6, 12);
    for (let i = 0; i < lowerBandCount; i++) {
      const band = (i + 0.6) / (lowerBandCount + 0.4);
      const anchor = anchors.length ? anchors[(i * 2 + 1) % anchors.length] : null;
      const worldX = anchor
        ? clamp(anchor.worldX + (rng() - 0.5) * 96, totalX * 0.06, totalX * 0.95)
        : totalX * clamp(band + (rng() - 0.5) * 0.11, 0.06, 0.95);
      const ridgeY = getLineYAt(worldX);
      const availableDepth = Math.max(80, mountainFloorY - ridgeY - 18);
      const lowerRatio = 0.66 + rng() * 0.22;
      placements.push({
        prop: baseProps[(i + 2) % baseProps.length],
        worldX,
        ridgeY,
        depth: availableDepth * lowerRatio,
        size: 42 + rng() * 24,
        anchor: 'lower-band',
        alpha: 0.54 + rng() * 0.16,
      });
    }

    for (let i = 0; i < heroSpecs.length; i++) {
      const spec = heroSpecs[i];
      const worldX = totalX * clamp(spec.band + (rng() - 0.5) * 0.04, 0.08, 0.92);
      const ridgeY = getLineYAt(worldX);
      const availableDepth = Math.max(96, mountainFloorY - ridgeY - 20);
      placements.push({
        prop: spec.prop,
        worldX,
        ridgeY,
        depth: availableDepth * spec.depthRatio,
        size: spec.size * (0.92 + rng() * 0.12),
        anchor: spec.anchor || 'hero',
        alpha: 0.5 + rng() * 0.12,
      });
    }

    const heroCount = Math.min(3, Math.max(2, Math.round((baseProps.length || 2) / 2)));
    for (let i = 0; i < heroCount; i++) {
      const anchor = anchorStrength[i];
      const band = heroCount === 1 ? 0.58 : 0.2 + i * (0.56 / Math.max(1, heroCount - 1));
      const worldX = anchor
        ? clamp(anchor.worldX + (rng() - 0.5) * 36, totalX * 0.14, totalX * 0.9)
        : totalX * clamp(band + (rng() - 0.5) * 0.05, 0.14, 0.9);
      const ridgeY = getLineYAt(worldX);
      placements.push({
        prop: baseProps[(i * 2 + 1) % baseProps.length],
        worldX,
        ridgeY,
        depth: Math.max(72, mountainFloorY - ridgeY - 36) * (0.22 + rng() * 0.16),
        size: 138 + rng() * 56,
        anchor: 'hero',
        alpha: 0.4 + rng() * 0.12,
      });
    }
    return placements;
  }

  function buildActiveTerrainTheme(symbol) {
    const entry = getThemeManifestEntry(symbol);
    const preset = TERRAIN_THEME_PRESETS[entry?.environmentBiome] || TERRAIN_THEME_PRESETS.default;
    const stats = analyzeMarketShape(activeCloses);
    const variant = getThemeVariant(stats);
    const glowBase = stats.trend >= 0 ? mixHex(preset.glow, '#facc15', 0.32) : mixHex(preset.glow, '#fb7185', 0.75);
    const textureDensity = clamp(0.75 + stats.volatility * 12 + Math.abs(stats.trend) * 1.4, 0.7, 1.85);
    const heroProps = getStockHeroPack(symbol);
    return {
      key: normalizeThemeSymbol(symbol),
      symbol: symbol || '',
      name: entry?.name || symbol || '',
      industryClass: entry?.industryClass || 'Theme',
      environmentBiome: entry?.environmentBiome || '滑雪山體',
      props: entry?.companyProps || [],
      heroProps,
      mixerLogic: entry?.mixerLogic || '',
      palette: preset,
      pattern: preset.pattern,
      edgeStyle: preset.edge,
      variant,
      stats,
      glowColor: glowBase,
      textureDensity,
      spriteDensity: clamp(0.8 + stats.volatility * 11, 0.8, 1.8),
      placements: buildPropPlacements(symbol, entry?.companyProps || [], stats, heroProps),
    };
  }

  function refreshThemeAssets() {
    activeThemeBackground = ensureThemeBackground(stockData?.symbol);
    ensureThemeManifest();
    activeTerrainTheme = buildActiveTerrainTheme(stockData?.symbol);

    // 永遠嘗試載入主題資產（GOOGL/INTC 有資產的才會真的去抓圖）
    loadThemeAssets(stockData?.symbol);

    // 主題切換時清除 Pattern 快取
    cachedPatterns = { terrain: null, detail: null, hd: null, hdSrc: null, themeSrc: null };

    for (const prop of activeTerrainTheme?.props || []) ensurePropSprite(prop);
    for (const hero of activeTerrainTheme?.heroProps || []) ensurePropSprite(hero.prop);
    for (const placement of activeTerrainTheme?.placements || []) ensurePropSprite(placement.prop);
  }

  function getEarnedStars() {
    const starRatio = getFinalScore() / Math.max(1, maxPossibleScore);
    if (starRatio > 0.85) return 3;
    if (starRatio > 0.55) return 2;
    if (starRatio > 0.25) return 1;
    return 0;
  }

  function getExecutionRating() {
    const stars = getEarnedStars();
    if (stars >= 3) return { badge: 'AAA', summary: '風控紀律近乎零偏差' };
    if (stars === 2) return { badge: 'AA', summary: '策略執行穩健，收益與風險平衡' };
    if (stars === 1) return { badge: 'A', summary: '已完成建倉，仍可再壓低追蹤誤差' };
    return { badge: 'B', summary: '完成執行，但風險控制仍待優化' };
  }

  function unlockMedal(key) {
    try {
      const medals = JSON.parse(localStorage.getItem('skiMedals') || '{}');
      medals[key] = true;
      localStorage.setItem('skiMedals', JSON.stringify(medals));
      window.updateSkiMedals?.();
    } catch {
      // Ignore storage errors and keep gameplay uninterrupted.
    }
  }

  function getPeriodConfig() {
    const base = PERIOD_TUNING[stockData?.period] || PERIOD_TUNING["6mo"];
    if (!practiceMode) return base;
    // steepness 1~100 → 地形高度 0.08~1.0 倍，斜率加速 0.05~1.0 倍
    const t = (practiceOpts.steepness - 1) / 99; // 0~1
    const heightMult = 0.08 + t * 0.92;  // 0.08x (very flat) ~ 1.0x (normal)
    const slopeMult  = 0.05 + t * 0.95;  // 0.05x (very slow) ~ 1.0x (normal)
    return {
      mapWidth:        base.mapWidth,
      heightScale:     base.heightScale * heightMult,
      slopeAccel:      base.slopeAccel  * slopeMult,
      dangerTolerance: Math.round(base.dangerTolerance * PRACTICE_DANGER_TOL_MULT),
    };
  }

  /* ══════════════════════════════════════════════════
     公開 API — 從 app.js 呼叫
  ══════════════════════════════════════════════════ */
  window.SkiGame = {
    launch(data, options = {}) {
      stockData    = data; // { symbol, closes: [], dates: [], period }
      highDetailMode = !!options.highDetail;
      practiceMode   = !!options.practice;

      if (practiceMode) {
        practiceOpts = {
          steepness:  Math.max(1, Math.min(100, options.steepness  ?? 40)),
          hitboxSize: Math.max(1, Math.min(100, options.hitboxSize ?? 60)),
          startPct:   Math.max(0, Math.min(99,  options.startPct  ?? 0)),
          endPct:     Math.max(1, Math.min(100, options.endPct    ?? 100)),
        };
        if (practiceOpts.startPct >= practiceOpts.endPct) practiceOpts.endPct = Math.min(100, practiceOpts.startPct + 1);
      }

      refreshThemeAssets();
      openModal();
      initGame();
    },
    close: closeGame,
    toggleDetail() {
      highDetailMode = !highDetailMode;
      const btn = document.querySelector('.ski-detail-toggle');
      if (btn) {
        btn.classList.toggle('active', highDetailMode);
        btn.querySelector('.detail-label').textContent = highDetailMode ? '高細節模式：開啟' : '低細節模式';
      }
      refreshThemeAssets();
    }
  };

  window.render_game_to_text = function renderGameToText() {
    const playerX = getCharX();
    const worldX = getCharWorldX();
    const lineY = canvas && terrainPoints.length ? getScreenLineYAt(worldX) : null;
    const terrainAngle = canvas && terrainPoints.length ? getTerrainScreenAngleAt(worldX) : null;
    return JSON.stringify({
      coordinateSystem: { origin: 'top-left', x: 'right', y: 'down' },
      mode: gameState,
      symbol: stockData?.symbol || null,
      player: {
        x: Number(playerX.toFixed(1)),
        y: Number(charY.toFixed(1)),
        screenY: Number((charY + verticalCameraOffsetY).toFixed(1)),
        spriteY: Number((charY + verticalCameraOffsetY + charVisualOffsetY).toFixed(1)),
        visualOffsetY: Number(charVisualOffsetY.toFixed(1)),
        terrainAngle: terrainAngle == null ? null : Number(terrainAngle.toFixed(3)),
      },
      terrain: {
        scrollX: Number(terrainScrollX.toFixed(1)),
        lineY: lineY == null ? null : Number(lineY.toFixed(1)),
        cameraOffsetY: Number(terrainCameraOffsetY.toFixed(1)),
        cameraTargetOffsetY: Number(terrainCameraTargetOffsetY.toFixed(1)),
        verticalCameraOffsetY: Number(verticalCameraOffsetY.toFixed(1)),
        verticalCameraTargetOffsetY: Number(verticalCameraTargetOffsetY.toFixed(1)),
        verticalCameraFollowing: isVerticalCameraFollowing,
        cameraFloorOffsetY: Number(terrainCameraFloorOffsetY.toFixed(1)),
        points: terrainPoints.length,
      },
      theme: activeTerrainTheme ? {
        biome: activeTerrainTheme.environmentBiome,
        industry: activeTerrainTheme.industryClass,
        variant: activeTerrainTheme.variant,
        props: activeTerrainTheme.props.slice(0, 4),
      } : null,
      hud: {
        score: getFinalScore(),
        elapsedSeconds: Number(getElapsedSeconds().toFixed(2)),
        dangerRatio: Number(getDangerRatio().toFixed(3)),
      },
    });
  };

  window.advanceTime = function advanceTime(ms) {
    if (!canvas || !ctx) return;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) {
      update();
      if (gameState === 'playing') elapsedMs += 1000 / 60;
    }
    render();
  };

  ensureThemeManifest();

  /* ── Modal 開關 ─────────────────────────────────── */
  function openModal() {
    let modal = document.getElementById('skiGameModal');
    if (!modal) {
      modal = buildModalDOM();
      document.body.appendChild(modal);
    }
    modal.classList.remove('hidden');
    canvas = document.getElementById('skiCanvas');
    ctx    = canvas.getContext('2d');
    updateCursorVisibility();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function closeGame() {
    cancelAnimationFrame(animId);
    gameState = 'idle';
    particles = [];
    unbindInput();
    window.removeEventListener('resize', resizeCanvas);
    document.getElementById('skiGameModal')?.classList.add('hidden');
  }

  function buildModalDOM() {
    const modal = document.createElement('div');
    modal.id = 'skiGameModal';
    modal.className = 'ski-modal hidden';
    modal.innerHTML = `
      <canvas id="skiCanvas"></canvas>
      <button class="ski-close-btn" onclick="SkiGame.close()">✕ 離開</button>
      <button class="ski-detail-toggle ${highDetailMode ? 'active' : ''}" onclick="SkiGame.toggleDetail()">
        <span class="detail-label">${highDetailMode ? '高細節模式：開啟' : '低細節模式'}</span>
      </button>
      <div class="ski-hint">🖱️ 滾輪上下移動 &nbsp;·&nbsp; 同時按住 ←→ 或 A+D 往右衝刺 &nbsp;·&nbsp; 別被拖到最左邊</div>
    `;
    return modal;
  }

  // ── 主題資產加載 ──
  function loadThemeAssets(symbol) {
    const sym = (symbol || '').toUpperCase();
    // 直接用股票代號當目錄名，或特殊映射
    const dirMap = { 'INTC': 'intel' };
    const validSyms = ['GOOGL', 'AMZN', 'META', 'MSFT', 'NVDA', 'INTC'];
    if (!validSyms.includes(sym)) return;

    const themeDir = dirMap[sym] || sym; // INTC → intel，其餘直接用代號

    const vistaImg = new Image();
    vistaImg.src = `/static/assets/themes/${themeDir}/vista.png`;
    vistaImg.onload = () => { themeAssets.vista = vistaImg; };
    vistaImg.onerror = () => console.warn(`[theme] vista 載入失敗: ${vistaImg.src}`);

    const textureImg = new Image();
    textureImg.src = `/static/assets/themes/${themeDir}/texture.png`;
    textureImg.onload = () => { themeAssets.texture = textureImg; };
    textureImg.onerror = () => console.warn(`[theme] texture 載入失敗: ${textureImg.src}`);
  }


  function resizeCanvas() {
    if (!canvas) return;
    const previousAnchorY = charY;
    canvas.width  = canvas.parentElement.clientWidth  || window.innerWidth;
    canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
    buildTerrain(); // 重新映射地形
    if (gameState === 'countdown' || gameState === 'playing' || gameState === 'dead') {
      const nextAnchorY = getCharAnchorY();
      const anchorDelta = nextAnchorY - previousAnchorY;
      charY = nextAnchorY;
      charTargetY = nextAnchorY;
      terrainCameraOffsetY += anchorDelta;
      terrainCameraTargetOffsetY += anchorDelta;
      verticalCameraOffsetY = 0;
      verticalCameraTargetOffsetY = 0;
      isVerticalCameraFollowing = false;
    }
  }

  /* ── 地形建構 ────────────────────────────────────── */
  function buildTerrain() {
    if (!stockData || !canvas) return;
    const allCloses = stockData.closes;
    const allDates = stockData.dates || [];
    const allN = allCloses.length;

    // 練習模式：依百分比切片地形
    let closes = allCloses;
    let dates = allDates;
    if (practiceMode && (practiceOpts.startPct > 0 || practiceOpts.endPct < 100)) {
      const s = Math.floor(allN * practiceOpts.startPct / 100);
      const e = Math.min(allN, Math.ceil(allN * practiceOpts.endPct  / 100));
      closes = allCloses.slice(s, e);
      dates = allDates.slice(s, e);
    }

    activeCloses = closes;
    activeDates = dates;

    const N = closes.length;
    if (N < 2) return;

    const W = canvas.width;
    const H = canvas.height;

    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const range = maxP - minP || 1;
    const config = getPeriodConfig();
    const totalW = W * config.mapWidth;
    const segW   = totalW / (N - 1);
    const centerY = H * 0.5;
    const baseAmplitude = H * 0.35;
    const amplitude = Math.min(H * 0.42, baseAmplitude * config.heightScale);
    const yMin = centerY - amplitude;
    const yMax = centerY + amplitude;
    priceMin = minP;
    priceMax = maxP;
    terrainYMin = yMin;
    terrainYMax = yMax;
    terrainCameraFloorOffsetY = -(H * CAMERA_FLOOR_MARGIN_RATIO);

    terrainPoints = closes.map((c, i) => ({
      x: i * segW,
      y: yMax - ((c - minP) / range) * (yMax - yMin),
    }));
    activeTerrainTheme = buildActiveTerrainTheme(stockData?.symbol);
  }

  /* ── 初始化遊戲 ──────────────────────────────────── */
  function initGame() {
    cancelAnimationFrame(animId);
    unbindInput();
    terrainScrollX = 0;
    score          = 0;
    surviveFrames  = 0;
    dangerFrames   = 0;
    isDangerAbove  = false;
    isDangerBelow  = false;
    particles      = [];
    currentSpeed   = SCROLL_SPEED;
    playerSpeedMultiplier = 1;
    countdownVal   = 3;
    countdownTimer = 0;
    leftKeyDown    = false;
    rightKeyDown   = false;
    leftMouseDown  = false;
    rightMouseDown = false;
    mouseOnlyRun   = true;
    spaceBoostDown = false;
    perfectStreakDistance = 0;
    bestPerfectStreakDistance = 0;
    streakBonusScore = 0;
    elapsedMs = 0;
    lastFrameTs = 0;
    earlyFinishBonus = 0;
    scoreBandFrames = {
      perfect: 0,
      light: 0,
      mild: 0,
      medium: 0,
      heavy: 0,
    };
    resultButtonRects = null;
    charVisualOffsetY = 0;
    terrainCameraOffsetY = 0;
    terrainCameraTargetOffsetY = 0;
    verticalCameraOffsetY = 0;
    verticalCameraTargetOffsetY = 0;
    isVerticalCameraFollowing = false;
    terrainCameraFloorOffsetY = -Infinity;

    refreshThemeAssets();
    buildTerrain();

    // 計算理論最高分 (假設每幀都是完美狀態 x10)
    // 我們粗略估計：總距離 / 平均速度 = 總幀數 * 10
    const lastX = terrainPoints[terrainPoints.length - 1]?.x || 1;
    maxPossibleScore = Math.floor((lastX / SCROLL_SPEED) * 10);
    timeLimitSeconds = Math.max(0.1, (lastX / SCROLL_SPEED / 60) * TIME_LIMIT_RATIO);

    // 角色與橘線固定在較低的畫面錨點，山體則對齊到這條線
    const charX = getCharX();
    charY       = getCharAnchorY();
    charTargetY = charY;
    terrainCameraOffsetY = charY - getLineYAt(charX);
    terrainCameraTargetOffsetY = terrainCameraOffsetY;
    verticalCameraOffsetY = 0;
    verticalCameraTargetOffsetY = 0;
    isVerticalCameraFollowing = false;
    updateTerrainCameraOffset();
    updateVerticalCameraOffset();
    updateCharacterVisualOffset();

    gameState = 'countdown';
    bindInput();
    updateCursorVisibility();
    animId = requestAnimationFrame(loop);
  }

  /* ── 輸入綁定 ────────────────────────────────────── */
  function bindInput() {
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
  }

  function unbindInput() {
    canvas?.removeEventListener('wheel', onWheel);
    canvas?.removeEventListener('mousedown', onMouseDown);
    canvas?.removeEventListener('mouseup', onMouseUp);
    canvas?.removeEventListener('mouseleave', onMouseUp);
    canvas?.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  }

  function disableWheelInput() {
    canvas?.removeEventListener('wheel', onWheel);
    isBoosting = false;
  }

  function updateCursorVisibility() {
    if (!canvas) return;
    const showCursor = gameState === 'dead' || gameState === 'complete';
    canvas.classList.toggle('ski-canvas-show-cursor', showCursor);
  }

  function onWheel(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;
    const moveAmount = SCROLL_SENS * (isBoosting ? BOOST_MULTIPLIER : 1);
    charTargetY += e.deltaY > 0 ? moveAmount : -moveAmount;
    const topMargin = Math.max(40, canvas.height * 0.06);
    const bottomLimit = canvas.height * (1 - PLAYER_MIN_HEIGHT_FROM_BOTTOM_RATIO);
    if (charTargetY < topMargin) {
      const overflow = topMargin - charTargetY;
      charTargetY = topMargin;
      terrainCameraTargetOffsetY += overflow;
    } else if (charTargetY > bottomLimit) {
      const overflow = charTargetY - bottomLimit;
      charTargetY = bottomLimit;
      terrainCameraTargetOffsetY -= overflow;
    }
  }

  function onMouseDown(e) {
    if (e.button === 0 && (gameState === 'dead' || gameState === 'complete')) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const retryRect = resultButtonRects?.retry;
      const exitRect = resultButtonRects?.exit;
      if (retryRect && x >= retryRect.x && x <= retryRect.x + retryRect.w && y >= retryRect.y && y <= retryRect.y + retryRect.h) {
        initGame();
        return;
      }
      if (exitRect && x >= exitRect.x && x <= exitRect.x + exitRect.w && y >= exitRect.y && y <= exitRect.y + exitRect.h) {
        closeGame();
        return;
      }
    }
    if (e.button === 1) {
      e.preventDefault();
      isBoosting = true;
    } else if (e.button === 0) {
      leftMouseDown = true;
    } else if (e.button === 2) {
      e.preventDefault();
      rightMouseDown = true;
    }
  }

  function onMouseUp(e) {
    if (!e || e.button === 1) {
      isBoosting = spaceBoostDown;
    }
    if (!e || e.button === 0) leftMouseDown = false;
    if (!e || e.button === 2) rightMouseDown = false;
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  function onKey(e) {
    if (e.key === 'Escape') closeGame();
    if ((e.key === 'r' || e.key === 'R') && (gameState === 'dead' || gameState === 'complete')) {
      initGame();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftKeyDown = true;
      mouseOnlyRun = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightKeyDown = true;
      mouseOnlyRun = false;
    }
    if (e.code === 'Space' && !spaceBoostDown) {
      e.preventDefault();
      spaceBoostDown = true;
      isBoosting = true;
      mouseOnlyRun = false;
    }
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftKeyDown = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightKeyDown = false;
    if (e.code === 'Space') {
      spaceBoostDown = false;
      isBoosting = false;
    }
  }

  /* ── 主迴圈 ──────────────────────────────────────── */
  function loop() {
    const now = performance.now();
    if (!lastFrameTs) lastFrameTs = now;
    const deltaMs = Math.min(50, Math.max(0, now - lastFrameTs));
    lastFrameTs = now;
    update();
    if (gameState === 'playing') {
      elapsedMs += deltaMs;
    }
    render();
    if (gameState !== 'idle') {
      animId = requestAnimationFrame(loop);
    }
  }

  function update() {
    if (gameState === 'countdown') {
      countdownTimer++;
      if (countdownTimer >= 60) { // 每秒
        countdownTimer = 0;
        countdownVal--;
        if (countdownVal <= 0) gameState = 'playing';
      }
      updateTerrainCameraOffset();
      updateVerticalCameraOffset();
      updateCharacterVisualOffset();
      updateParticles();
      if (Math.random() < 0.3) {
        spawnSnowflake();
      }
      return;
    }

    if (gameState === 'complete') {
      updateTerrainCameraOffset();
      updateVerticalCameraOffset();
      updateCharacterVisualOffset();
      updateParticles();
      if (Math.random() < 0.45) {
        spawnFallingConfetti();
      }
      return;
    }

    if (gameState === 'dead') {
      updateTerrainCameraOffset();
      updateVerticalCameraOffset();
      updateCharacterVisualOffset();
      updateParticles();
      return;
    }

    if (gameState !== 'playing') return;

    surviveFrames++;
    const config = getPeriodConfig();
    const charX = getCharX();

    // 平滑移動角色
    charY += (charTargetY - charY) * 0.18;

    // 計算目前捲動位置對應的地形 Y
    const lineYBeforeScroll = getLineYAt(terrainScrollX + charX);

    // ── 持續式速度物理 ──
    const lookAhead = 25; // 地圖變長後，讀取更遠一點的點來反應斜率變化
    const nextLineY = getLineYAt(terrainScrollX + charX + lookAhead);
    const slope     = (nextLineY - lineYBeforeScroll) / lookAhead; // 正=下坡, 負=上坡

    // 根據斜率累加/減速度 (加速度模型)
    currentSpeed += slope * config.slopeAccel;

    // 空氣阻力：緩緩拉回基準速度 (讓速度不會永遠卡在最高或最低)
    const drag = 0.004;
    currentSpeed += (SCROLL_SPEED - currentSpeed) * drag;

    // 玩家自主速度倍率：只受左右鍵影響，與上下坡造成的實際速度分開
    const accelActive = (rightKeyDown || rightMouseDown) && !(leftKeyDown || leftMouseDown);
    const brakeActive = (leftKeyDown || leftMouseDown) && !(rightKeyDown || rightMouseDown);

    if (accelActive) {
      playerSpeedMultiplier = Math.min(SPEED_BOOST_MULT, playerSpeedMultiplier + 0.008);
    } else if (brakeActive) {
      playerSpeedMultiplier = Math.max(SPEED_BRAKE_MULT, playerSpeedMultiplier - 0.008);
    } else {
      const driftBack = playerSpeedMultiplier > 1 ? -0.005 : playerSpeedMultiplier < 1 ? 0.005 : 0;
      playerSpeedMultiplier = Math.max(SPEED_BRAKE_MULT, Math.min(SPEED_BOOST_MULT, playerSpeedMultiplier + driftBack));
    }

    // 玩家控制速度：右側輸入加速，左側輸入減速
    if (accelActive) {
      currentSpeed += 0.16;
    } else if (brakeActive) {
      currentSpeed -= 0.14;
    }

    // 限制極速與最低速
    const dynamicMinSpeed = Math.max(MIN_SPEED, SCROLL_SPEED * SPEED_BRAKE_MULT);
    const dynamicMaxSpeed = Math.min(MAX_SPEED, SCROLL_SPEED * SPEED_BOOST_MULT);
    currentSpeed = Math.max(dynamicMinSpeed, Math.min(dynamicMaxSpeed, currentSpeed));

    terrainScrollX += currentSpeed;
    const rawLineY = getLineYAt(terrainScrollX + charX);
    const topTriggerY = canvas.height * CAMERA_DEAD_ZONE_TOP_RATIO;
    let desiredCameraOffsetY = 0;
    if (charY < topTriggerY) {
      desiredCameraOffsetY = (topTriggerY - charY) * CAMERA_FOLLOW_STRENGTH;
    }
    const minFollowOffsetY = terrainCameraFloorOffsetY;
    verticalCameraTargetOffsetY = Math.max(minFollowOffsetY, desiredCameraOffsetY);
    verticalCameraTargetOffsetY = clamp(
      verticalCameraTargetOffsetY,
      minFollowOffsetY,
      canvas.height * 0.28,
    );
    isVerticalCameraFollowing = Math.abs(verticalCameraTargetOffsetY) > 0.01;
    updateTerrainCameraOffset();
    updateVerticalCameraOffset();
    updateCharacterVisualOffset();
    const lineY = rawLineY + terrainCameraOffsetY;

    if (getElapsedSeconds() > timeLimitSeconds) {
      triggerDeath(lineY);
      return;
    }

    // 判定：角色 hitbox 是否包住線
    const hh        = getHitboxH();
    const hitTop    = charY - hh / 2;
    const hitBottom = charY + hh / 2;
    const aboveLine = hitBottom < lineY; // hitbox 完全在線上方
    const belowLine = hitTop    > lineY; // hitbox 完全在線下方

    if (aboveLine || belowLine) {
      // 累積值會永久保留；偏得更遠只會增加得稍快，不會一下暴衝。
      // 這樣單次大失誤仍可挽回，但反覆的小失誤會慢慢把容錯吃光。
      const dist = aboveLine ? (lineY - hitBottom) : (hitTop - lineY);
      const distRatio = dist / Math.max(1, hh);
      const baseIncreaseRate = 0.12 + Math.pow(Math.max(0, distRatio), 0.85) * 0.55;
      const increaseRate = baseIncreaseRate * (belowLine ? BELOW_LINE_DANGER_MULTIPLIER : 1);
      
      dangerFrames += increaseRate;
      isDangerAbove = aboveLine;
      isDangerBelow = belowLine;
      
      if (dangerFrames >= getDangerLimit()) {
        triggerDeath(lineY);
        return;
      }
    } else {
      isDangerAbove  = false;
      isDangerBelow  = false;
    }

    // ── 動態計分系統 ──
    const postDangerRatio = getDangerRatio();
    const scoreBand = getDangerBand(postDangerRatio);
    scoreBandFrames[scoreBand]++;

    if (scoreBand === 'perfect') {
      perfectStreakDistance += currentSpeed;
      bestPerfectStreakDistance = Math.max(bestPerfectStreakDistance, perfectStreakDistance);
    } else {
      perfectStreakDistance = 0;
    }

    const frameScore = getBandScore(postDangerRatio);
    score += frameScore;
    if (scoreBand === 'perfect' && frameScore > 10) {
      streakBonusScore += frameScore - 10;
    }

    // 關卡完成：捲過地形最後一點
    const lastX = terrainPoints[terrainPoints.length - 1].x;
    if (terrainScrollX + charX >= lastX) {
      const secondsEarly = Math.max(0, getQualifyingSeconds() - getElapsedSeconds());
      earlyFinishBonus = Math.round(secondsEarly * 50);
      gameState = 'complete';
      disableWheelInput();
      updateCursorVisibility();
      unlockMedal(practiceMode ? 'practiceComplete' : 'normalComplete');
      if (getEarnedStars() >= 3) unlockMedal('threeStars');
      spawnPartyParticles();
    }

    // 粒子更新
    updateParticles();

    // 持續雪花
    if (Math.random() < 0.3) {
      spawnSnowflake();
    }
  }

  /* ── 取得地形 Y ──────────────────────────────────── */
  function getLineYAt(worldX) {
    if (!terrainPoints.length) return canvas.height * LINE_Y_MID;
    // 二分搜尋找區段
    const pts = terrainPoints;
    if (worldX <= pts[0].x)             return pts[0].y;
    if (worldX >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= worldX) lo = mid; else hi = mid;
    }
    const t = (worldX - pts[lo].x) / (pts[hi].x - pts[lo].x);
    return pts[lo].y + t * (pts[hi].y - pts[lo].y);
  }

  function getInterpolatedCloseAt(worldX) {
    if (!terrainPoints.length || !activeCloses.length) return null;
    const pts = terrainPoints;
    if (worldX <= pts[0].x) return activeCloses[0] ?? null;
    if (worldX >= pts[pts.length - 1].x) return activeCloses[activeCloses.length - 1] ?? null;

    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x <= worldX) lo = mid; else hi = mid;
    }

    const leftClose = activeCloses[lo];
    const rightClose = activeCloses[hi];
    if (leftClose == null || rightClose == null) return leftClose ?? rightClose ?? null;

    const t = (worldX - pts[lo].x) / (pts[hi].x - pts[lo].x);
    return leftClose + (rightClose - leftClose) * t;
  }

  function getCloseAtScreenY(screenY) {
    const clampedY = Math.max(terrainYMin, Math.min(terrainYMax, screenY - getTerrainRenderOffsetY()));
    const ratio = (terrainYMax - clampedY) / Math.max(1, terrainYMax - terrainYMin);
    return priceMin + ratio * (priceMax - priceMin);
  }

  function getScreenYForClose(close) {
    if (priceMax === priceMin) return (terrainYMin + terrainYMax) / 2;
    const ratio = (close - priceMin) / (priceMax - priceMin);
    return terrainYMax - ratio * (terrainYMax - terrainYMin) + getTerrainRenderOffsetY();
  }

  function updateTerrainCameraOffset() {
    terrainCameraOffsetY += (terrainCameraTargetOffsetY - terrainCameraOffsetY) * 0.18;
  }

  function updateVerticalCameraOffset() {
    verticalCameraOffsetY += (verticalCameraTargetOffsetY - verticalCameraOffsetY) * CAMERA_VERTICAL_DAMPING;
  }

  function updateCharacterVisualOffset() {
    charVisualOffsetY += (0 - charVisualOffsetY) * 0.25;
  }

  /* ── 死亡 ────────────────────────────────────────── */
  function triggerDeath(lineY) {
    gameState = 'dead';
    disableWheelInput();
    updateCursorVisibility();
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: getCharX(),
        y: charY + charVisualOffsetY,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.8) * 5,
        color: `hsl(${Math.random() * 30 + 0},80%,60%)`,
        size: Math.random() * 5 + 2,
        life: 60, maxLife: 60, alpha: 1
      });
    }
  }

  /* ── 粒子工廠 ────────────────────────────────────── */
  function spawnSnowflake() {
    particles.push({
      x: Math.random() * canvas.width,
      y: -5,
      vx: -currentSpeed * 0.5 + (Math.random() - 0.5),
      vy: Math.random() * 0.8 + 0.3,
      color: 'rgba(200,230,255,0.7)',
      size: Math.random() * 2 + 0.5,
      life: 200, maxLife: 200, alpha: 0.7,
      isSnow: true
    });
  }

  function spawnPartyParticles() {
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 2.2,
        vy: Math.random() * 2.8 + 1.8,
        color: `hsl(${Math.random() * 360},80%,60%)`,
        size: Math.random() * 6 + 2,
        life: 140, maxLife: 140, alpha: 1,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35
      });
    }
  }

  function spawnFallingConfetti() {
    particles.push({
      x: Math.random() * canvas.width,
      y: -12,
      vx: (Math.random() - 0.5) * 1.4,
      vy: Math.random() * 2.2 + 1.6,
      color: `hsl(${Math.random() * 360},85%,62%)`,
      size: Math.random() * 7 + 3,
      life: 150, maxLife: 150, alpha: 1,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4
    });
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.isSnow ? 0 : 0.04;
      p.life--;
      p.alpha = p.life / p.maxLife;
      if (!p.isSnow) {
        p.angle = (p.angle || 0) + (p.spin || 0);
      }
    });
  }

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  function render() {
    const W = canvas.width;
    const H = canvas.height;

    // ── 畫面震動計算 ──
    const dangerConfig = getPeriodConfig();
    const heatRatio = getDangerRatio();
    let shakeX = 0, shakeY = 0;
    if (heatRatio > 0.75 && gameState === 'playing') {
      const shakeAmp = (heatRatio - 0.75) * 15; // 震動幅度隨危險度增加
      shakeX = (Math.random() - 0.5) * shakeAmp;
      shakeY = (Math.random() - 0.5) * shakeAmp;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY); // 套用震動

    // 背景漸層（夜間雪山）
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#0a0f1e');
    bg.addColorStop(0.5, '#0d1829');
    bg.addColorStop(1,   '#111f35');
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40); 

    // ── 高細節：遠景 Vista (Parallax) ──
    const vistaDrawn = highDetailMode && !!themeAssets.vista;
    if (vistaDrawn) {
      const scrollRatioX = 0.35; // 提高水平視差速度讓動態更明顯
      const scrollRatioY = 0.15; // 新增垂直視差，跟隨地形起伏
      
      const scrollX = (terrainScrollX * scrollRatioX) % W;
      // 根據鏡頭垂直偏移量，產生背景的上下錯位立體感
      const vistaOffsetY = terrainCameraOffsetY * scrollRatioY;

      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.drawImage(themeAssets.vista, -scrollX, vistaOffsetY, W, H);
      ctx.drawImage(themeAssets.vista, W - scrollX, vistaOffsetY, W, H);
      
      // 底部漸層暗幕，優化與地形的融合
      const veil = ctx.createLinearGradient(0, H * 0.45, 0, H);
      veil.addColorStop(0, 'rgba(5,10,20,0)');
      veil.addColorStop(1, 'rgba(7,12,24,0.42)');
      ctx.fillStyle = veil;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Vista 已顯示時跳過 themeBackground、stars 與 mountains，避免遮擋
    if (!vistaDrawn) {
      const usedThemeBackground = drawThemeBackground(W, H);
      if (!usedThemeBackground) {
        drawStars(W, H);
        drawMountains(W, H);
      }
    }

    // 地形線
    drawTerrain(W, H);

    // 粒子（雪花在後）
    drawParticles(true);

    // 角色
    if (gameState === 'countdown' || gameState === 'playing' || gameState === 'dead') {
      drawCharacter(W);
    }

    // 危險警示光暈
    if (dangerFrames > 0 && gameState === 'playing') {
      drawDangerVignette(W, H);
    }

    // 粒子（碎片在前）
    drawParticles(false);
    
    ctx.restore(); // 結束震動影響範圍

    // HUD (不隨畫面震動，保持 UI 穩定)
    if (gameState === 'playing' || gameState === 'countdown') {
      drawHUD(W, H);
    }

    // 倒數
    if (gameState === 'countdown') {
      drawCountdown(W, H);
    }

    // 結果畫面
    if (gameState === 'dead')     drawDeadScreen(W, H);
    if (gameState === 'complete') drawCompleteScreen(W, H);
  }

  /* ── 繪製工具 ────────────────────────────────────── */
  // 用 seed 讓星星位置固定
  const starPositions = (() => {
    const arr = [];
    let s = 12345;
    function rnd() { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }
    for (let i = 0; i < 120; i++) arr.push({ x: rnd(), y: rnd() * 0.5, r: rnd() * 1.2 + 0.3 });
    return arr;
  })();

  function drawStars(W, H) {
    ctx.save();
    starPositions.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${0.4 + s.r * 0.3})`;
      ctx.fill();
    });
    ctx.restore();
  }

  function drawMountains(W, H) {
    // 遠山（深色）
    ctx.save();
    ctx.fillStyle = '#0f1e33';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    [0.05,0.15,0.28,0.4,0.52,0.65,0.78,0.9,1].forEach((rx, i) => {
      const ry = i % 2 === 0 ? 0.25 : 0.38;
      ctx.lineTo(rx * W, ry * H);
    });
    ctx.lineTo(W, H * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawThemeBackground(W, H) {
    const entry = activeThemeBackground;
    if (!entry || entry.status !== 'ready' || !entry.img?.naturalWidth || !entry.img?.naturalHeight) {
      return false;
    }

    const img = entry.img;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const scale = Math.max(W / naturalWidth, H / naturalHeight);
    const drawW = naturalWidth * scale;
    const drawH = naturalHeight * scale;
    const offsetY = (H - drawH) / 2;
    const drift = drawW > 0 ? ((terrainScrollX * 0.14) % drawW + drawW) % drawW : 0;
    const startX = -drift;

    ctx.save();
    ctx.globalAlpha = 0.92;
    for (let i = -1; i <= 1; i++) {
      ctx.drawImage(img, startX + i * drawW, offsetY, drawW, drawH);
      if (i < 1) {
        const seamX = startX + (i + 1) * drawW;
        const seamFade = ctx.createLinearGradient(seamX - 18, 0, seamX + 18, 0);
        seamFade.addColorStop(0, 'rgba(8,16,30,0)');
        seamFade.addColorStop(0.5, 'rgba(8,16,30,0.18)');
        seamFade.addColorStop(1, 'rgba(8,16,30,0)');
        ctx.fillStyle = seamFade;
        ctx.fillRect(seamX - 18, offsetY, 36, drawH);
      }
    }

    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, 'rgba(4, 9, 18, 0.10)');
    veil.addColorStop(0.55, 'rgba(5, 11, 20, 0.18)');
    veil.addColorStop(1, 'rgba(5, 10, 18, 0.40)');
    ctx.fillStyle = veil;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.1, W * 0.5, H * 0.55, H * 0.95);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(3,7,12,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.restore();
    return true;
  }

  function getVisibleTerrainPoints(W) {
    const points = [];
    let started = false;
    for (let i = 0; i < terrainPoints.length; i++) {
      const screenX = terrainPoints[i].x - terrainScrollX;
      if (!started && screenX < -80) continue;
      if (screenX > W + 80 && started) break;
      started = true;
      points.push({ x: screenX, y: terrainPoints[i].y + getTerrainRenderOffsetY() });
    }
    return points;
  }

  function buildTerrainPaths(points, H) {
    if (points.length < 2) return null;
    const ridgePath = new Path2D();
    ridgePath.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ridgePath.lineTo(points[i].x, points[i].y);
    }

    const fillPath = new Path2D(ridgePath);
    fillPath.lineTo(points[points.length - 1].x, H + 24);
    fillPath.lineTo(points[0].x, H + 24);
    fillPath.closePath();
    return {
      ridgePath,
      fillPath,
      firstX: points[0].x,
      lastX: points[points.length - 1].x,
    };
  }

  function getTerrainPatternTile(theme) {
    const palette = theme.palette;
    const cacheKey = [
      theme.pattern,
      palette.base,
      palette.mid,
      palette.accent,
      theme.variant,
    ].join(':');
    const cached = terrainPatternCache.get(cacheKey);
    if (cached) return cached;

    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const g = tile.getContext('2d');
    g.clearRect(0, 0, tile.width, tile.height);

    const faint = (hex, alpha) => withAlpha(hex, alpha);
    switch (theme.pattern) {
      case 'circuit':
        g.strokeStyle = faint(palette.glow, 0.24);
        g.lineWidth = 3;
        for (let i = 24; i < 240; i += 48) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i, 256);
          g.stroke();
          g.beginPath();
          g.moveTo(0, i);
          g.lineTo(256, i);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.28);
        for (let i = 20; i < 220; i += 48) {
          g.fillRect(i, 20, 14, 14);
          g.fillRect(i + 18, 110, 10, 10);
          g.fillRect(i - 10, 194, 16, 16);
        }
        break;
      case 'cloud':
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 2;
        for (let y = 28; y < 228; y += 44) {
          g.beginPath();
          g.roundRect(24, y, 208, 24, 10);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.16);
        for (let i = 0; i < 10; i++) {
          g.beginPath();
          g.arc(24 + i * 24, 38 + (i % 3) * 60, 8 + (i % 2) * 4, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'retail':
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 6;
        for (let x = -40; x < 280; x += 42) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + 92, 256);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.14);
        for (let x = 28; x < 228; x += 34) {
          const h = 20 + ((x / 34) % 4) * 12;
          g.fillRect(x, 158, 4, h);
          g.fillRect(x + 8, 164, 2, h - 6);
        }
        break;
      case 'finance':
      case 'marble':
        g.strokeStyle = faint(palette.snow, 0.12);
        g.lineWidth = 2;
        for (let i = -20; i < 260; i += 36) {
          g.beginPath();
          g.moveTo(i, 0);
          g.bezierCurveTo(i + 18, 60, i - 24, 140, i + 30, 256);
          g.stroke();
        }
        g.strokeStyle = faint(palette.glow, 0.14);
        for (let y = 24; y < 232; y += 28) {
          g.beginPath();
          g.moveTo(18, y);
          g.lineTo(238, y + ((y / 28) % 2 ? 4 : -4));
          g.stroke();
        }
        break;
      case 'energy':
        g.strokeStyle = faint(palette.glow, 0.2);
        g.lineWidth = 3;
        for (let i = 18; i < 240; i += 46) {
          g.beginPath();
          g.moveTo(i, 256);
          g.quadraticCurveTo(i + 26, 190, i + 14, 92);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.16);
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          g.ellipse(28 + i * 34, 70 + (i % 2) * 18, 9, 18, i * 0.2, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'industrial':
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 4;
        for (let x = 20; x < 240; x += 48) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, 256);
          g.stroke();
          g.beginPath();
          g.moveTo(x - 16, 0);
          g.lineTo(x + 16, 32);
          g.moveTo(x + 16, 32);
          g.lineTo(x - 16, 64);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.22);
        for (let y = 28; y < 228; y += 48) {
          g.beginPath();
          g.arc(42 + (y % 2) * 90, y, 5, 0, Math.PI * 2);
          g.arc(154 + (y % 2) * 30, y + 12, 5, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'transit':
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 3;
        for (let y = 30; y < 230; y += 34) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(256, y - 20);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.12);
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          g.ellipse(24 + i * 36, 170 - (i % 2) * 22, 16, 6, -0.3, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'neon':
        g.fillStyle = faint(palette.accent, 0.15);
        for (let i = 0; i < 32; i++) {
          const x = (i * 37) % 240;
          const y = (i * 61) % 220;
          g.fillRect(x, y, 12 + (i % 3) * 6, 12 + (i % 4) * 4);
        }
        g.strokeStyle = faint(palette.glow, 0.16);
        g.lineWidth = 2;
        for (let y = 12; y < 256; y += 22) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(256, y);
          g.stroke();
        }
        break;
      default:
        g.strokeStyle = faint(palette.glow, 0.16);
        g.lineWidth = 3;
        for (let i = -20; i < 260; i += 44) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 38, 74);
          g.lineTo(i - 20, 148);
          g.lineTo(i + 20, 256);
          g.stroke();
        }
        break;
    }

    terrainPatternCache.set(cacheKey, tile);
    return tile;
  }

  function getTerrainDetailTile(theme) {
    const palette = theme.palette;
    const cacheKey = [
      'detail',
      theme.pattern,
      palette.base,
      palette.mid,
      palette.accent,
      theme.variant,
    ].join(':');
    const cached = terrainDetailCache.get(cacheKey);
    if (cached) return cached;

    const tile = document.createElement('canvas');
    tile.width = 384;
    tile.height = 384;
    const g = tile.getContext('2d');
    const faint = (hex, alpha) => withAlpha(hex, alpha);
    g.clearRect(0, 0, tile.width, tile.height);

    switch (theme.pattern) {
      case 'circuit':
        g.strokeStyle = faint(palette.glow, 0.22);
        g.lineWidth = 2;
        for (let y = 26; y < 360; y += 72) {
          g.beginPath();
          g.moveTo(26, y);
          g.lineTo(132, y);
          g.lineTo(180, y - 24);
          g.lineTo(312, y - 24);
          g.stroke();
        }
        g.strokeStyle = faint(palette.accent, 0.16);
        for (let x = 54; x < 330; x += 64) {
          for (let y = 54; y < 330; y += 56) {
            g.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = Math.PI / 3 * i + Math.PI / 6;
              const px = x + Math.cos(angle) * 16;
              const py = y + Math.sin(angle) * 16;
              if (i === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.closePath();
            g.stroke();
          }
        }
        break;
      case 'retail':
        g.fillStyle = faint(palette.accent, 0.12);
        for (let y = 18; y < 360; y += 90) {
          g.fillRect(18, y, 348, 18);
        }
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 3;
        for (let x = 32; x < 344; x += 52) {
          g.beginPath();
          g.moveTo(x, 102);
          g.lineTo(x, 166);
          g.moveTo(x + 10, 102);
          g.lineTo(x + 10, 154);
          g.stroke();
        }
        g.strokeStyle = faint(palette.snow, 0.14);
        for (let i = 0; i < 5; i++) {
          g.strokeRect(40 + i * 62, 220 + (i % 2) * 14, 42, 30);
        }
        break;
      case 'finance':
      case 'marble':
        g.fillStyle = faint(palette.snow, 0.06);
        for (let x = 22; x < 340; x += 84) {
          g.fillRect(x, 28, 20, 312);
          g.fillRect(x - 8, 42, 36, 12);
        }
        g.strokeStyle = faint(palette.glow, 0.16);
        g.lineWidth = 2;
        for (let y = 54; y < 340; y += 52) {
          g.beginPath();
          g.moveTo(20, y);
          g.lineTo(364, y + ((y / 52) % 2 ? 8 : -8));
          g.stroke();
        }
        break;
      case 'energy':
        g.strokeStyle = faint(palette.accent, 0.18);
        g.lineWidth = 3;
        for (let x = 44; x < 340; x += 72) {
          g.beginPath();
          g.moveTo(x, 330);
          g.quadraticCurveTo(x + 34, 252, x + 12, 152);
          g.stroke();
        }
        g.strokeStyle = faint(palette.glow, 0.18);
        for (let x = 38; x < 344; x += 70) {
          g.strokeRect(x, 62, 32, 48);
          g.beginPath();
          g.moveTo(x + 10, 62);
          g.lineTo(x + 10, 48);
          g.stroke();
        }
        break;
      case 'industrial':
        g.strokeStyle = faint(palette.glow, 0.16);
        g.lineWidth = 3;
        for (let y = 52; y < 340; y += 76) {
          g.strokeRect(30, y, 76, 30);
          g.strokeRect(150, y - 18, 96, 38);
          g.strokeRect(278, y + 10, 54, 24);
        }
        g.fillStyle = faint(palette.accent, 0.14);
        for (let x = 54; x < 340; x += 58) {
          g.beginPath();
          g.arc(x, 42 + (x % 3) * 12, 7, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'transit':
        g.strokeStyle = faint(palette.glow, 0.16);
        g.lineWidth = 3;
        for (let y = 54; y < 334; y += 56) {
          g.beginPath();
          g.moveTo(18, y);
          g.lineTo(366, y - 26);
          g.stroke();
        }
        g.strokeStyle = faint(palette.accent, 0.14);
        for (let x = 40; x < 344; x += 68) {
          g.beginPath();
          g.arc(x, 290 - (x % 2) * 16, 18, Math.PI, 0);
          g.stroke();
        }
        break;
      case 'cloud':
        g.strokeStyle = faint(palette.snow, 0.16);
        g.lineWidth = 2;
        for (let y = 48; y < 320; y += 82) {
          g.beginPath();
          g.roundRect(42, y, 288, 28, 14);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.14);
        for (let i = 0; i < 8; i++) {
          g.fillRect(48 + i * 38, 126 + (i % 2) * 48, 18 + (i % 3) * 8, 18 + (i % 2) * 12);
        }
        break;
      case 'neon':
        g.strokeStyle = faint(palette.glow, 0.18);
        g.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.roundRect(34 + i * 62, 48 + (i % 2) * 28, 68, 44, 18);
          g.stroke();
        }
        g.fillStyle = faint(palette.accent, 0.12);
        for (let i = 0; i < 7; i++) {
          g.beginPath();
          g.arc(46 + i * 48, 238 - (i % 3) * 18, 18 + (i % 2) * 8, 0, Math.PI * 2);
          g.fill();
        }
        break;
      default:
        g.strokeStyle = faint(palette.snow, 0.16);
        g.lineWidth = 2;
        for (let i = -20; i < 420; i += 52) {
          g.beginPath();
          g.moveTo(i, 0);
          g.lineTo(i + 58, 112);
          g.lineTo(i - 12, 220);
          g.stroke();
        }
        break;
    }

    terrainDetailCache.set(cacheKey, tile);
    return tile;
  }

  function drawTerrainBackdrop(theme, fillPath, W, H) {
    ctx.save();
    ctx.translate(-W * 0.035, 28);
    ctx.scale(1, 0.96);
    const backdrop = ctx.createLinearGradient(0, terrainYMin - 40, 0, H);
    backdrop.addColorStop(0, withAlpha(theme.palette.shadow, 0.18));
    backdrop.addColorStop(1, withAlpha(theme.palette.shadow, 0.62));
    ctx.fillStyle = backdrop;
    ctx.fill(fillPath);
    ctx.restore();
  }

  function drawTerrainFill(theme, fillPath, W, H) {
    ctx.save();
    ctx.clip(fillPath);

    const baseGrad = ctx.createLinearGradient(0, terrainYMin - 30, 0, H);
    baseGrad.addColorStop(0, withAlpha(theme.palette.base, 0.94));
    baseGrad.addColorStop(0.58, withAlpha(theme.palette.mid, 0.82));
    baseGrad.addColorStop(1, withAlpha(theme.palette.shadow, 0.92));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(-60, terrainYMin - 80, W + 120, H - terrainYMin + 140);

    // ── Pattern 疊加（快取版，不再每幀重建 createPattern）──
    const themeSrcKey = activeTerrainTheme ? activeTerrainTheme.pattern + ':' + activeTerrainTheme.variant : null;
    if (cachedPatterns.themeSrc !== themeSrcKey) {
      const tTile = getTerrainPatternTile(theme);
      const dTile = getTerrainDetailTile(theme);
      cachedPatterns.terrain = tTile ? ctx.createPattern(tTile, 'repeat') : null;
      cachedPatterns.detail  = dTile ? ctx.createPattern(dTile, 'repeat') : null;
      cachedPatterns.themeSrc = themeSrcKey;
    }

    if (cachedPatterns.terrain) {
      ctx.save();
      ctx.translate(-((terrainScrollX * (0.22 + theme.stats.volatility * 5.5)) % 256), 0);
      ctx.globalAlpha = clamp(0.45 + (theme.textureDensity - 0.7) * 0.22, 0.45, 0.75);
      ctx.fillStyle = cachedPatterns.terrain;
      ctx.fillRect(-512, terrainYMin - 160, W + 1024, H - terrainYMin + 240);
      ctx.restore();
    }

    if (cachedPatterns.detail) {
      ctx.save();
      ctx.translate(-((terrainScrollX * (0.08 + theme.stats.volatility * 2.8)) % 384), -18);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = clamp(0.38 + (theme.textureDensity - 0.7) * 0.18, 0.38, 0.62);
      ctx.fillStyle = cachedPatterns.detail;
      ctx.fillRect(-768, terrainYMin - 180, W + 1536, H - terrainYMin + 320);
      ctx.restore();
    }

    if (theme.variant === 'volatile' || theme.variant === 'crash') {
      ctx.save();
      ctx.strokeStyle = withAlpha(theme.glowColor, theme.variant === 'crash' ? 0.16 : 0.1);
      ctx.lineWidth = theme.variant === 'crash' ? 3 : 2;
      for (let i = -80; i < W + 120; i += 42) {
        const jitter = Math.sin((i + terrainScrollX) * 0.06) * 16;
        ctx.beginPath();
        ctx.moveTo(i, terrainYMin + 40 + jitter);
        ctx.lineTo(i + 30, H - 30);
        ctx.stroke();
      }
      ctx.restore();
    }

    const depthMask = ctx.createLinearGradient(0, terrainYMin - 10, 0, H);
    depthMask.addColorStop(0, 'rgba(0,0,0,0)');
    depthMask.addColorStop(1, withAlpha(theme.palette.shadow, 0.46));
    ctx.fillStyle = depthMask;
    ctx.fillRect(-20, terrainYMin - 10, W + 40, H - terrainYMin + 40);

    const sheen = ctx.createLinearGradient(0, terrainYMin - 30, 0, H);
    sheen.addColorStop(0, withAlpha(theme.palette.snow, 0.18));
    sheen.addColorStop(0.24, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.66, withAlpha(theme.palette.glow, 0.08));
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sheen;
    ctx.fillRect(-20, terrainYMin - 30, W + 40, H - terrainYMin + 60);
    // ── 高細節：材質疊加模式 (Overlay Texture) ──
    if (highDetailMode && themeAssets.texture) {
      ctx.save();
      // hd Pattern 同樣只在圖片換掉時重建
      if (cachedPatterns.hdSrc !== themeAssets.texture) {
        cachedPatterns.hd = ctx.createPattern(themeAssets.texture, 'repeat');
        cachedPatterns.hdSrc = themeAssets.texture;
      }
      const xOffset = -((terrainScrollX * 0.3) % 512);
      ctx.translate(xOffset, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.46; // 調回適度的透明度，恢復六角形紋理細節
      ctx.fillStyle = cachedPatterns.hd;
      ctx.fillRect(-512, terrainYMin - 80, W + 1024, H - terrainYMin + 160);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawTerrainPropSprite(kind, x, y, size, theme, alphaScale = 1) {
    const fill = withAlpha(theme.palette.accent, 0.88 * alphaScale);
    const stroke = withAlpha(theme.palette.glow, 0.9 * alphaScale);
    const dark = withAlpha(theme.palette.shadow, 0.92 * alphaScale);
    const spriteEntry = ensurePropSprite(kind);
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const halo = ctx.createRadialGradient(0, 0, size * 0.06, 0, 0, size * 0.72);
    halo.addColorStop(0, withAlpha(theme.palette.glow, 0.26 * alphaScale));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = withAlpha(theme.palette.glow, 0.8 * alphaScale);
    ctx.shadowBlur = Math.max(6, size * 0.22);

    if (spriteEntry?.status === 'ready' && spriteEntry.img?.naturalWidth) {
      ctx.save();
      const wobble = ((x * 0.013 + y * 0.007) % 0.18) - 0.09;
      ctx.rotate(wobble);
      ctx.globalAlpha = clamp(alphaScale * 1.65, 0.46, 1);
      const pad = size * 0.58;
      ctx.fillStyle = withAlpha(theme.palette.shadow, 0.22 + alphaScale * 0.18);
      ctx.beginPath();
      ctx.roundRect(-pad * 0.72, -pad * 0.72, pad * 1.44, pad * 1.44, Math.max(10, size * 0.08));
      ctx.fill();
      ctx.drawImage(spriteEntry.img, -pad, -pad, pad * 2, pad * 2);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = withAlpha(theme.palette.accent, 0.24 + alphaScale * 0.12);
      ctx.fillRect(-pad, -pad, pad * 2, pad * 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(theme.palette.glow, 0.34 + alphaScale * 0.12);
      ctx.lineWidth = Math.max(2.5, size * 0.034);
      ctx.strokeRect(-pad * 0.82, -pad * 0.82, pad * 1.64, pad * 1.64);
      ctx.restore();
      ctx.restore();
      return;
    }

    switch (kind) {
      case 'gpu':
      case 'chip':
      case 'network-chip':
      case 'mobile-chip':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.36, -size * 0.36, size * 0.72, size * 0.72, size * 0.08);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.fillRect(-size * 0.15, -size * 0.15, size * 0.3, size * 0.3);
        for (let i = -2; i <= 2; i += 2) {
          ctx.fillRect(i * size * 0.08, -size * 0.5, size * 0.04, size * 0.1);
          ctx.fillRect(i * size * 0.08, size * 0.4, size * 0.04, size * 0.1);
        }
        break;
      case 'wafer':
      case 'leaf-grid':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * size * 0.1, -size * 0.26);
          ctx.lineTo(i * size * 0.1, size * 0.26);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-size * 0.26, i * size * 0.1);
          ctx.lineTo(size * 0.26, i * size * 0.1);
          ctx.stroke();
        }
        break;
      case 'ai-core':
      case 'copilot-orb':
      case 'orbit-ring':
      case 'wave-ring':
      case 'portal-ring':
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.34, size * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        break;
      case 'server':
      case 'server-rack':
      case 'cleanroom-tower':
      case 'neon-tower':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.18, -size * 0.42, size * 0.36, size * 0.84, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.fillRect(-size * 0.11, -size * 0.24, size * 0.22, size * 0.08);
        ctx.fillRect(-size * 0.11, -size * 0.04, size * 0.22, size * 0.08);
        ctx.fillRect(-size * 0.11, size * 0.16, size * 0.22, size * 0.08);
        break;
      case 'cloud-block':
      case 'window-panel':
      case 'data-cube':
      case 'data-prism':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.28, -size * 0.28, size * 0.56, size * 0.56, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-size * 0.12, 0);
        ctx.lineTo(size * 0.12, 0);
        ctx.moveTo(0, -size * 0.12);
        ctx.lineTo(0, size * 0.12);
        ctx.stroke();
        break;
      case 'data-bridge':
      case 'market-arch':
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-size * 0.34, size * 0.14);
        ctx.quadraticCurveTo(0, -size * 0.28, size * 0.34, size * 0.14);
        ctx.stroke();
        ctx.strokeStyle = fill;
        ctx.beginPath();
        ctx.moveTo(-size * 0.22, size * 0.14);
        ctx.lineTo(-size * 0.22, size * 0.38);
        ctx.moveTo(size * 0.22, size * 0.14);
        ctx.lineTo(size * 0.22, size * 0.38);
        ctx.stroke();
        break;
      case 'signal-beam':
      case 'search-beam':
      case 'megaphone':
      case 'fiber-tree':
      case 'fiber-node':
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, size * 0.38);
        ctx.lineTo(0, -size * 0.1);
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(0, -size * 0.16, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -size * 0.16, size * 0.3, -0.55, 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -size * 0.16, size * 0.42, -0.5, 0.5);
        ctx.stroke();
        break;
      case 'coin':
      case 'cash-badge':
      case 'medal':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = dark;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'column':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.12, -size * 0.38, size * 0.24, size * 0.76, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.fillRect(-size * 0.22, -size * 0.46, size * 0.44, size * 0.08);
        ctx.fillRect(-size * 0.22, size * 0.38, size * 0.44, size * 0.08);
        break;
      case 'vault':
      case 'shield':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        if (kind === 'vault') {
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = dark;
          ctx.beginPath();
          ctx.moveTo(-size * 0.14, 0);
          ctx.lineTo(size * 0.14, 0);
          ctx.moveTo(0, -size * 0.14);
          ctx.lineTo(0, size * 0.14);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.34);
          ctx.lineTo(size * 0.24, -size * 0.18);
          ctx.lineTo(size * 0.18, size * 0.18);
          ctx.quadraticCurveTo(0, size * 0.38, -size * 0.18, size * 0.18);
          ctx.lineTo(-size * 0.24, -size * 0.18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'parcel':
      case 'coupon':
      case 'price-tag':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.3, -size * 0.22, size * 0.6, size * 0.44, 8);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = dark;
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.22);
        ctx.lineTo(0, size * 0.22);
        ctx.stroke();
        break;
      case 'cart':
      case 'ribbon':
      case 'arrow-arc':
      case 'lantern':
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-size * 0.34, 0);
        ctx.quadraticCurveTo(-size * 0.06, -size * 0.26, size * 0.3, -size * 0.06);
        ctx.stroke();
        ctx.fillStyle = fill;
        if (kind === 'cart') {
          ctx.beginPath();
          ctx.roundRect(-size * 0.28, -size * 0.1, size * 0.42, size * 0.2, 6);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-size * 0.1, size * 0.2, size * 0.06, 0, Math.PI * 2);
          ctx.arc(size * 0.14, size * 0.2, size * 0.06, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'lantern') {
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(size * 0.18, -size * 0.1);
          ctx.lineTo(size * 0.34, -size * 0.02);
          ctx.lineTo(size * 0.2, size * 0.1);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 'battery-pack':
      case 'charge-pillar':
      case 'swap-station':
      case 'solar-panel':
      case 'turbine':
      case 'oil-rig':
      case 'metal-bar':
        ctx.strokeStyle = stroke;
        ctx.fillStyle = fill;
        ctx.lineWidth = 2;
        if (kind === 'turbine') {
          ctx.beginPath();
          ctx.moveTo(0, size * 0.36);
          ctx.lineTo(0, -size * 0.06);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, -size * 0.1, size * 0.06, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.1);
          ctx.lineTo(-size * 0.24, -size * 0.18);
          ctx.moveTo(0, -size * 0.1);
          ctx.lineTo(size * 0.18, -size * 0.26);
          ctx.moveTo(0, -size * 0.1);
          ctx.lineTo(size * 0.08, size * 0.18);
          ctx.stroke();
        } else if (kind === 'solar-panel') {
          ctx.beginPath();
          ctx.roundRect(-size * 0.28, -size * 0.16, size * 0.56, size * 0.32, 6);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = dark;
          ctx.beginPath();
          ctx.moveTo(-size * 0.16, size * 0.2);
          ctx.lineTo(0, size * 0.36);
          ctx.lineTo(size * 0.16, size * 0.2);
          ctx.stroke();
        } else if (kind === 'oil-rig') {
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.34);
          ctx.lineTo(-size * 0.22, size * 0.28);
          ctx.lineTo(size * 0.22, size * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (kind === 'metal-bar') {
          ctx.beginPath();
          ctx.moveTo(-size * 0.28, size * 0.08);
          ctx.lineTo(-size * 0.14, -size * 0.18);
          ctx.lineTo(size * 0.18, -size * 0.18);
          ctx.lineTo(size * 0.3, size * 0.08);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.roundRect(-size * 0.18, -size * 0.34, size * 0.36, size * 0.68, 8);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = dark;
          ctx.fillRect(-size * 0.08, -size * 0.16, size * 0.16, size * 0.24);
        }
        break;
      case 'factory':
      case 'beam-frame':
      case 'connector':
      case 'container':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-size * 0.34, size * 0.24);
        ctx.lineTo(-size * 0.34, -size * 0.06);
        ctx.lineTo(-size * 0.06, size * 0.08);
        ctx.lineTo(-size * 0.06, -size * 0.06);
        ctx.lineTo(size * 0.2, size * 0.08);
        ctx.lineTo(size * 0.2, -size * 0.22);
        ctx.lineTo(size * 0.34, -size * 0.22);
        ctx.lineTo(size * 0.34, size * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'tire':
      case 'headlamp':
      case 'wing-light':
      case 'hover-engine':
      case 'trail-rack':
      case 'speed-fin':
        ctx.strokeStyle = stroke;
        ctx.fillStyle = fill;
        ctx.lineWidth = 2.2;
        if (kind === 'tire') {
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.26, 0, Math.PI * 2);
          ctx.fillStyle = dark;
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.11, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.3, size * 0.14, -0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'chat-bubble':
      case 'game-pad':
      case 'visor':
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-size * 0.32, -size * 0.18, size * 0.64, size * 0.36, 10);
        ctx.fill();
        ctx.stroke();
        if (kind === 'chat-bubble') {
          ctx.beginPath();
          ctx.moveTo(-size * 0.06, size * 0.18);
          ctx.lineTo(-size * 0.16, size * 0.34);
          ctx.lineTo(size * 0.04, size * 0.22);
          ctx.closePath();
          ctx.fill();
        }
        break;
      default:
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    if (theme.variant === 'bearish' || theme.variant === 'crash') {
      ctx.strokeStyle = withAlpha(theme.palette.snow, theme.variant === 'crash' ? 0.45 : 0.24);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, -size * 0.16);
      ctx.lineTo(-size * 0.02, size * 0.04);
      ctx.lineTo(size * 0.16, -size * 0.12);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawTerrainProps(theme, fillPath, W, H) {
    if (!theme?.placements?.length) return;
    ctx.save();
    ctx.clip(fillPath);
    for (const placement of theme.placements) {
      if (placement.anchor === 'ridge') continue;
      const screenX = placement.worldX - terrainScrollX;
      if (screenX < -40 || screenX > W + 40) continue;
      const y = placement.ridgeY + placement.depth;
      if (y > H + 40) continue;
      const scale =
        placement.anchor === 'hero' ? 1
        : placement.anchor === 'lower-band' ? 0.88
        : placement.anchor === 'deep' ? 0.9
        : placement.anchor === 'mid' ? 0.96
        : 0.94;
      drawTerrainPropSprite(placement.prop, screenX, y, placement.size * scale, theme, placement.alpha);
    }
    ctx.restore();

    for (const placement of theme.placements) {
      if (placement.anchor !== 'ridge') continue;
      const screenX = placement.worldX - terrainScrollX;
      if (screenX < -40 || screenX > W + 40) continue;
      const y = placement.ridgeY - placement.size * 0.44;
      drawTerrainPropSprite(placement.prop, screenX, y, placement.size, theme, placement.alpha);
    }
  }

  function drawTerrainEdge(theme, ridgePath) {
    const dangerRatio = getDangerRatio();
    const warningColor = dangerRatio > 0
      ? `rgb(${Math.floor(96 + dangerRatio * 159)},${Math.floor(165 - dangerRatio * 165)},${Math.floor(250 - dangerRatio * 200)})`
      : theme.glowColor;

    ctx.save();
    ctx.lineJoin = (theme.edgeStyle === 'temple' || theme.edgeStyle === 'hard') ? 'miter' : 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = withAlpha(theme.palette.snow, 0.55);
    ctx.lineWidth = 13;
    ctx.shadowBlur = 0;
    ctx.stroke(ridgePath);

    if (theme.edgeStyle === 'tape') {
      ctx.setLineDash([14, 9]);
      ctx.strokeStyle = withAlpha(theme.palette.accent, 0.45);
      ctx.lineWidth = 5;
      ctx.stroke(ridgePath);
      ctx.setLineDash([]);
    } else if (theme.edgeStyle === 'glitch') {
      ctx.translate(0, -2);
      ctx.strokeStyle = withAlpha('#22d3ee', 0.38);
      ctx.lineWidth = 2;
      ctx.stroke(ridgePath);
      ctx.translate(0, 4);
      ctx.strokeStyle = withAlpha('#f472b6', 0.42);
      ctx.stroke(ridgePath);
      ctx.translate(0, -2);
    }

    ctx.strokeStyle = warningColor;
    ctx.lineWidth = 3.1;
    ctx.shadowColor = warningColor;
    ctx.shadowBlur = 16 + dangerRatio * 12;
    ctx.stroke(ridgePath);
    ctx.restore();
  }

  function drawTerrain(W, H) {
    if (!terrainPoints.length) return;

    const theme = activeTerrainTheme || buildActiveTerrainTheme(stockData?.symbol);
    const points = getVisibleTerrainPoints(W);
    const paths = buildTerrainPaths(points, H);
    if (!paths) return;
    drawReferenceGrid(W);
    drawTerrainBackdrop(theme, paths.fillPath, W, H);
    drawTerrainFill(theme, paths.fillPath, W, H);
    drawTerrainProps(theme, paths.fillPath, W, H);
    drawTerrainEdge(theme, paths.ridgePath);

    // 進度標記點（日期 dots）
    drawProgressDots(W, H);
    drawCurrentPriceGuide(W);
  }

  function drawProgressDots(W, H) {
    const N = terrainPoints.length;
    const step = Math.max(1, Math.floor(N / 8));
    ctx.save();
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < N; i += step) {
      const screenX = terrainPoints[i].x - terrainScrollX;
      if (screenX < 0 || screenX > W) continue;
      const sy = terrainPoints[i].y + getTerrainRenderOffsetY();
      ctx.beginPath();
      ctx.arc(screenX, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,180,255,0.6)';
      ctx.fill();
      if (activeDates[i]) {
        ctx.fillStyle = 'rgba(150,200,255,0.5)';
        ctx.fillText(activeDates[i].slice(5), screenX, sy - 8);
      }
    }
    ctx.restore();
  }

  function drawCurrentPriceGuide(W) {
    const guideY = Math.max(terrainYMin, Math.min(canvas.height, charY + verticalCameraOffsetY));
    const currentClose = getCloseAtScreenY(guideY);
    if (currentClose == null) return;

    const priceText = currentClose.toFixed(2);
    ctx.save();

    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, guideY);
    ctx.lineTo(W - 86, guideY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 12px JetBrains Mono, monospace';
    const textW = ctx.measureText(priceText).width;
    const labelW = Math.max(60, textW + 20);
    const labelH = 24;
    const labelX = W - labelW - 16;
    const labelY = Math.max(12, Math.min(canvas.height - labelH - 12, guideY - labelH / 2));

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, labelX + labelW / 2, labelY + labelH / 2 + 0.5);

    ctx.restore();
  }

  function drawReferenceGrid(W) {
    if (priceMax <= priceMin || terrainYMax <= terrainYMin) return;

    const gridCount = 4;
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.font = '600 10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < gridCount; i++) {
      const ratio = (i + 1) / (gridCount + 1);
      const close = priceMax - ratio * (priceMax - priceMin);
      const y = getScreenYForClose(close);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
      ctx.fillText(close.toFixed(2), W - 20, y);
    }

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════
     角色繪製 — 右向滑雪者，5 種姿態
  ══════════════════════════════════════════════════ */
  function drawCharacter(W) {
    const cx      = getCharX();
    const cy      = charY + verticalCameraOffsetY;
    const visualCy = cy + charVisualOffsetY;
    const worldX  = terrainScrollX + cx;
    const lineY   = getScreenLineYAt(worldX);
    const DR      = getDangerRatio(); // 0~1 危險程度
    const isOffTrack = isDangerAbove || isDangerBelow;
    const t       = Date.now() / 1000;

    /* ── hitbox 框（不隨姿態旋轉）─────────────────── */
    const hh = getHitboxH();
    ctx.save();
    const hitAlpha  = 0.12 + DR * 0.28;
    // 練習模式：hitbox 邊框帶橘色提示
    const hitBorder = isOffTrack
      ? `rgba(255,${Math.floor(Math.max(0, 100 - DR*100))},${Math.floor(Math.max(0, 100 - DR*100))},0.85)`
      : practiceMode ? 'rgba(251,191,36,0.55)' : 'rgba(96,165,250,0.45)';
    ctx.strokeStyle = hitBorder;
    ctx.fillStyle   = isOffTrack
      ? `rgba(255,80,80,${hitAlpha})`
      : practiceMode ? `rgba(251,191,36,${hitAlpha * 0.8})` : `rgba(96,165,250,${hitAlpha})`;
    ctx.lineWidth   = practiceMode ? 2.5 : 2;
    ctx.beginPath();
    ctx.roundRect(cx - HITBOX_W / 2, cy - hh / 2, HITBOX_W, hh, 6);
    ctx.fill();
    ctx.stroke();

    // 虛線：hitbox 邊緣到地形線
    const edgeY = lineY > cy ? cy + hh / 2 : cy - hh / 2;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(148,163,184,0.28)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(cx, edgeY);
    ctx.lineTo(cx, lineY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    /* ── 姿態計算 ────────────────────────────────── */
    // relPos: 0=線在hitbox中央, -1=線在頂端, +1=線在底端; 超出±1=出界
    const relPos = (lineY - cy) / (HITBOX_H / 2);
    const terrainAngle = getTerrainScreenAngleAt(worldX);

    // bodyAngle: 正=前傾(向右), 負=後仰(向左)
    let bodyAngle    = terrainAngle; // 基準角度先貼齊山坡
    let bounceY      = 0;     // 重心額外 Y 位移
    let crouchFactor = 0.45;  // 0=全站直, 1=全蹲伏
    let armAngle     = 0.05;  // 前臂向右延伸角度

    if (isDangerAbove) {
      // ★ 太高危險：強烈後仰，不斷往上彈，快要飛走！
      bodyAngle    = terrainAngle - 0.55 + Math.sin(t * 6) * 0.2;
      bounceY      = -Math.abs(Math.sin(t * 9)) * 11;
      crouchFactor = 0.08 + Math.abs(Math.sin(t * 7)) * 0.35;
      armAngle     = -0.65 + Math.sin(t * 8) * 0.45; // 手臂亂揮
    } else if (isDangerBelow) {
      // ★ 太低危險：極端前傾，快撲地，身體顫抖！
      bodyAngle    = terrainAngle + 0.88 + Math.sin(t * 12) * 0.13;
      bounceY      = Math.sin(t * 10) * 3.5;
      crouchFactor = 0.04;
      armAngle     = 0.95 + Math.sin(t * 11) * 0.2;
    } else if (relPos < -0.25) {
      // 略高：身體上揚、稍微後仰
      const a   = Math.min(1, (-relPos - 0.25) / 0.75);
      bodyAngle    = terrainAngle + 0.12 - a * 0.42;
      bounceY      = Math.sin(t * 5) * a * 4.5;
      crouchFactor = 0.45 - a * 0.22;
      armAngle     = 0.05 - a * 0.38;
    } else if (relPos > 0.25) {
      // 略低：重心下壓，急速蹲伏前傾
      const a   = Math.min(1, (relPos - 0.25) / 0.75);
      bodyAngle    = terrainAngle + 0.12 + a * 0.52;
      crouchFactor = 0.45 + a * 0.48;
      armAngle     = 0.05 + a * 0.52;
    } else {
      bodyAngle += 0.04;
    }

    /* ── 顏色 ──────────────────────────────────────── */
    const suitTop = DR > 0.55 ? '#ef4444' : '#3b82f6';
    const suitBot = DR > 0.55 ? '#dc2626' : '#1d4ed8';
    const helmCol = DR > 0.55 ? '#b91c1c' : '#1e3a8a';
    const skinCol = '#fde68a';
    const skiCol  = '#e2e8f0';
    const skiBack = '#94a3b8';
    const poleCol = '#64748b';

    /* ── 繪製右向滑雪者 ────────────────────────────── */
    ctx.save();
    ctx.translate(cx, visualCy + bounceY);
    ctx.rotate(bodyAngle);

    // 相對座標（以原點為角色腰部中心）
    const headY  = -19;
    const torsoT = -10;
    const torsoB =  5 + crouchFactor * 7;
    const hipY   = torsoB;
    const skiY   = hipY + 10 + crouchFactor * 9;

    // ── 後雪杖 ──
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, torsoT + 3); ctx.lineTo(-15, skiY); ctx.stroke();

    // ── 後腿 ──
    ctx.strokeStyle = suitBot; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-1, hipY);
    ctx.quadraticCurveTo(-2 - crouchFactor * 6, hipY + 5 + crouchFactor * 7, -7, skiY - 1);
    ctx.stroke();

    // ── 後 ski 板 ──
    ctx.strokeStyle = skiBack; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-17, skiY); ctx.lineTo(7, skiY); ctx.stroke();

    // ── 上半身 ──
    ctx.fillStyle = suitTop;
    ctx.beginPath();
    ctx.ellipse(0, (torsoT + torsoB) / 2, 6, Math.abs(torsoB - torsoT) / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 頭 ──
    ctx.fillStyle = skinCol;
    ctx.beginPath(); ctx.arc(2, headY, 7.5, 0, Math.PI * 2); ctx.fill();

    // ── 安全帽 ──
    ctx.fillStyle = helmCol;
    ctx.beginPath(); ctx.arc(2, headY - 2, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(-5, headY - 9, 16, 7);

    // ── 護目鏡（面向右，在右臉） ──
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.ellipse(8, headY + 0.5, 5, 3.2, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 0.8; ctx.stroke();
    // 鏡框高光
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(6.5, headY - 0.5, 2, -1.5, -0.5); ctx.stroke();

    // ── 前腿 ──
    ctx.strokeStyle = suitBot; ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(2, hipY);
    ctx.quadraticCurveTo(4 + crouchFactor * 7, hipY + 4 + crouchFactor * 8, 7, skiY - 1);
    ctx.stroke();

    // ── 前 ski 板 ──
    ctx.strokeStyle = skiCol; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-13, skiY); ctx.lineTo(15, skiY); ctx.stroke();
    // ski 翹頭
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(14, skiY); ctx.quadraticCurveTo(20, skiY - 1, 22, skiY - 7); ctx.stroke();

    // ── 前臂 ──
    const aex = 10 + Math.cos(armAngle) * 9;
    const aey = torsoT + 4 + Math.sin(armAngle) * 9;
    ctx.strokeStyle = suitTop; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(3, torsoT + 3); ctx.lineTo(aex, aey); ctx.stroke();

    // 手（小圓）
    ctx.fillStyle = skinCol;
    ctx.beginPath(); ctx.arc(aex, aey, 2.8, 0, Math.PI * 2); ctx.fill();

    // 前雪杖
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(aex, aey); ctx.lineTo(aex + 7, skiY); ctx.stroke();
    // 雪杖底端圓圈
    ctx.strokeStyle = poleCol; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(aex + 7, skiY, 2, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();
  }

  function drawDangerVignette(W, H) {
    const ratio = getDangerRatio();
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80);
    const alpha = ratio * 0.45 * pulse;

    const dir = isDangerAbove ? 'top' : 'bottom';
    const grad = ctx.createLinearGradient(
      0, dir === 'top' ? 0 : H,
      0, dir === 'top' ? H * 0.4 : H * 0.6
    );
    grad.addColorStop(0, `rgba(255,50,50,${alpha})`);
    grad.addColorStop(1, 'rgba(255,50,50,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 警告文字
    if (ratio > 0.5) {
      ctx.save();
      ctx.font = `bold ${14 + ratio * 4}px Inter, sans-serif`;
      ctx.fillStyle = `rgba(255,150,150,${ratio * pulse})`;
      ctx.textAlign = 'center';
      ctx.fillText(
        isDangerAbove ? '⬆ 風險權重過高，立即下修！' : '⬇ 部位曝險不足，立即上修！',
        W / 2,
        dir === 'top' ? 60 : H - 50
      );
      ctx.restore();
    }
  }

  function drawParticles(snowOnly) {
    particles.forEach(p => {
      if (snowOnly !== !!p.isSnow) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      if (p.isSnow) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    });
  }

  function drawHUD(W, H) {
    ctx.save();
    const dangerRatio = getDangerRatio();

    // 股票名稱 + 練習模式標示
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.textAlign = 'left';
    let modeLabel;
    if (practiceMode) {
      const s = practiceOpts.startPct, e = practiceOpts.endPct;
      modeLabel = (s === 0 && e === 100) ? '🟡 練習模式' : `🟡 練習 ${s}%～${e}%`;
    } else {
      modeLabel = '關卡';
    }
    ctx.fillText(`⛷️  ${stockData?.symbol || ''}  ${modeLabel}`, 16, 28);

    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(191,219,254,0.9)';
    ctx.fillText('PORTFOLIO ROI', 16, 42);

    ctx.font = '700 22px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.fillText(`${score.toString().padStart(6, '0')}`, 16, 62);

    // 風控等級
    const ratio = score / (maxPossibleScore * (surviveFrames / (surviveFrames || 1))); // 簡化評估
    let grade = 'C';
    let gradeCol = '#94a3b8';
    if (dangerFrames === 0) { grade = 'S'; gradeCol = '#fde68a'; }
    else if (dangerRatio < 0.18) { grade = 'A'; gradeCol = '#4ade80'; }
    else if (dangerRatio < 0.45) { grade = 'B'; gradeCol = '#3b82f6'; }

    ctx.font = '900 18px Inter, sans-serif';
    ctx.fillStyle = gradeCol;
    ctx.fillText(grade, 112, 58);
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillText('RISK CTRL', 112, 40);

    ctx.textAlign = 'center';
    ctx.font = '700 26px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.fillText(getElapsedSeconds().toFixed(2), W / 2, 34);
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.85)';
    ctx.fillText(`目標期限 ${getQualifyingSeconds().toFixed(2)}s`, W / 2, 52);

    const accelActive = (rightKeyDown || rightMouseDown) && !(leftKeyDown || leftMouseDown);
    const brakeActive = (leftKeyDown || leftMouseDown) && !(rightKeyDown || rightMouseDown);

    if (accelActive && gameState === 'playing') {
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('ACCEL', 150, 54);
    } else if (brakeActive && gameState === 'playing') {
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('BRAKE', 150, 54);
    }

    // 頂部進度群組
    const charWorldX = getCharWorldX();
    const totalW = terrainPoints[terrainPoints.length - 1]?.x || 1;
    const prog = Math.min(1, charWorldX / totalW);
    const topHudW = 420;
    const topHudX = W / 2 - topHudW / 2;
    const routeBarY = 74;
    const smallBarY = 112;
    const smallBarGap = 40;
    const routeBarH = 18;
    const smallBarW = 240;
    const smallBarH = 18;
    const barLabelGap = 12;
    const smallLabelW = 110;
    const smallValueW = 90;
    const smallRowX = W / 2 - (smallLabelW + barLabelGap + smallBarW + barLabelGap + smallValueW) / 2;
    const routeLabelW = 120;
    const routeValueW = 90;
    const routeRowX = W / 2 - (routeLabelW + barLabelGap + topHudW + barLabelGap + routeValueW) / 2;

    // ── 底部中央 HUD 群組 ──
    const panelCx = W / 2;
    const gaugeR = 72;
    const gx = panelCx;
    const gy = H - 122;

    // ── 準確率 / 時間條 ──
    const elapsedRatio = timeLimitSeconds > 0 ? Math.max(0, Math.min(1, getElapsedSeconds() / timeLimitSeconds)) : 0;
    const timeRatio = Math.max(0, 1 - elapsedRatio);
    const accuracyPct = getAccuracyPct();
    const accuracyBarRatio = getAccuracyBarRatio();
    
    // 進度條參數
    const hbx = smallRowX + smallLabelW + barLabelGap;
    const hbW = smallBarW;
    const hbH = smallBarH;
    const timeBarY = smallBarY;
    const hby = smallBarY + smallBarGap;

    // 路程條
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    const routeBarX = routeRowX + routeLabelW + barLabelGap;
    ctx.fillRect(routeBarX, routeBarY, topHudW, routeBarH);
    ctx.strokeRect(routeBarX, routeBarY, topHudW, routeBarH);

    const routeGrad = ctx.createLinearGradient(routeBarX, 0, routeBarX + topHudW, 0);
    routeGrad.addColorStop(0, '#38bdf8');
    routeGrad.addColorStop(1, '#22c55e');
    ctx.fillStyle = routeGrad;
    ctx.fillRect(routeBarX + 2, routeBarY + 2, (topHudW - 4) * prog, routeBarH - 4);

    ctx.textAlign = 'left';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText('路程進度', routeRowX, routeBarY + routeBarH / 2);

    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${Math.floor(prog * 100)}%`, routeBarX + topHudW + barLabelGap + routeValueW, routeBarY + routeBarH / 2);

    // 時間條底框
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.fillRect(hbx, timeBarY, hbW, hbH);
    ctx.strokeRect(hbx, timeBarY, hbW, hbH);

    let timeColor = '#4ade80';
    if (timeRatio <= 0.3) timeColor = '#f87171';
    else if (timeRatio <= 0.6) timeColor = '#fbbf24';

    if (timeRatio > 0.01) {
      ctx.fillStyle = timeColor;
      if (timeRatio <= 0.35) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = timeColor;
      }
      ctx.fillRect(hbx + 2, timeBarY + 2, (hbW - 4) * timeRatio, hbH - 4);
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = timeRatio <= 0.3 ? '#f87171' : '#f8fafc';
    ctx.fillText('時間值', smallRowX, timeBarY + hbH / 2);

    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = timeColor;
    ctx.fillText(`🕒 ${Math.floor(timeRatio * 100)}%`, hbx + hbW + barLabelGap + smallValueW, timeBarY + hbH / 2);

    // 準確率條底框
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.fillRect(hbx, hby, hbW, hbH);
    ctx.strokeRect(hbx, hby, hbW, hbH);

    // 準確率顏色判定 (綠 -> 黃 -> 紅)
    let heatColor = '#4ade80'; // 安全綠
    if (accuracyPct <= 78) heatColor = '#f87171';      // 紅
    else if (accuracyPct <= 88) heatColor = '#fbbf24'; // 黃

    // 準確率填充進度
    if (accuracyBarRatio > 0.01) {
      ctx.fillStyle = heatColor;
      
      // 危險時增加外發光特效 (WOW effect)
      if (accuracyPct <= 82) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = heatColor;
      }
      
      ctx.fillRect(hbx + 2, hby + 2, (hbW - 4) * accuracyBarRatio, hbH - 4);
      ctx.shadowBlur = 0; // 重置發光防止污染
    }

    // 準確率文字與百分比
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillStyle = accuracyPct <= 78 ? '#f87171' : '#f8fafc';
    ctx.fillText('準確值', smallRowX, hby + hbH / 2);
    
    ctx.textAlign = 'right';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillStyle = heatColor;
    ctx.fillText(`⚡ ${accuracyPct.toFixed(0)}%`, hbx + hbW + barLabelGap + smallValueW, hby + hbH / 2);

    if (isBoosting) {
      ctx.textAlign = 'center';
      ctx.font = '700 18px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(251,191,36,0.85)';
      ctx.fillText('滾輪靈敏模式', panelCx, gy - gaugeR - 18);
      ctx.shadowBlur = 0;
    }

    // 外圈半圓 (速度計)
    ctx.beginPath();
    ctx.arc(gx, gy, gaugeR, Math.PI, 0);
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'; // 弱化未使用的底圈
    ctx.stroke();

    // 速度分區顏色
    const drawArcZone = (start, end, color) => {
      ctx.beginPath();
      ctx.arc(gx, gy, gaugeR, Math.PI + start, Math.PI + end);
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      ctx.stroke();
    };
    drawArcZone(0, Math.PI * 0.35, '#4ade80');     // 減速區
    drawArcZone(Math.PI * 0.35, Math.PI * 0.65, '#3b82f6'); // 勻速區
    drawArcZone(Math.PI * 0.65, Math.PI, '#f87171');     // 加速區

    // 指針
    const speedRatio = (currentSpeed / SCROLL_SPEED);
    const normRatio = (currentSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    const needleAngle = Math.PI * Math.max(0, Math.min(1, normRatio));

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(needleAngle);
    ctx.beginPath();
    ctx.moveTo(-gaugeR + 10, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#fff';
    ctx.fill();
    ctx.restore();

    // 中央小點
    ctx.beginPath();
    ctx.arc(gx, gy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    // 速度文字
    ctx.font = '700 20px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.textAlign = 'center';
    const kmh = Math.floor(currentSpeed * 15);
    const speedMult = playerSpeedMultiplier.toFixed(2);
    ctx.fillText(`${kmh}`, gx, gy - 18);
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText('VELOCITY', gx, gy + 20);

    const speedMultColor = playerSpeedMultiplier > 1 ? '#fbbf24' : playerSpeedMultiplier < 1 ? '#fca5a5' : '#93c5fd';
    ctx.font = '800 54px JetBrains Mono, monospace';
    ctx.fillStyle = speedMultColor;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = speedMultColor;
    ctx.fillText(`${speedMult}x`, panelCx, H - 22);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawCountdown(W, H) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);

    const label = countdownVal > 0 ? String(countdownVal) : 'GO!';
    const size  = countdownVal > 0 ? 120 : 90;
    ctx.font      = `900 ${size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = countdownVal > 0 ? '#f8fafc' : '#4ade80';
    ctx.shadowColor = countdownVal > 0 ? '#60a5fa' : '#4ade80';
    ctx.shadowBlur  = 30;
    ctx.fillText(label, W / 2, H / 2);

    ctx.font = '500 18px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.shadowBlur = 0;
    ctx.fillText(`${stockData?.symbol} — 讓股票線穿過你的 hitbox！`, W / 2, H / 2 + 80);
    ctx.restore();
  }

  function drawResultTable(W, topY) {
    const tableScale = 1.2;
    const cardW = 520 * tableScale;
    const rowH = 34 * tableScale;
    const headerH = 60 * tableScale;
    const cardH = headerH + rowH * 4;
    const x = W / 2 - cardW / 2;
    const y = topY;
    const labelX = x + 24 * tableScale;
    const valueX = x + cardW - 24 * tableScale;
    const rows = [
      ['基準追蹤', `${getBandPct('perfect').toFixed(0)}% / ${getBandPct('light').toFixed(0)}% / ${getBandPct('mild').toFixed(0)}%`],
      ['偏離值', `${getBandPct('medium').toFixed(0)}% / ${getBandPct('heavy').toFixed(0)}%`],
      ['結算工期 / 目標期限 / 效率溢價', `${getElapsedSeconds().toFixed(2)}s / ${getQualifyingSeconds().toFixed(2)}s / +${earlyFinishBonus}`],
      ['連續獲利週 / 峰值紀律', `+${streakBonusScore} / ${getBestPerfectPct().toFixed(0)}%`],
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(9, 18, 34, 0.88)';
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.24)';
    ctx.lineWidth = 2 * tableScale;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, 18 * tableScale);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x + 2 * tableScale, y + 2 * tableScale, cardW - 4 * tableScale, headerH, 16 * tableScale);
    ctx.fill();

    ctx.font = '700 19px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('交易報告', labelX, y + headerH * 0.34);

    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(191, 219, 254, 0.9)';
    ctx.fillText('收益模型：追蹤 10/12/14/16/18/20，低偏離 7，偏離 5，高偏離 3，極端 1', labelX, y + headerH * 0.72);

    rows.forEach((row, index) => {
      const rowY = y + headerH + index * rowH;
      if (index > 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 16 * tableScale, rowY);
        ctx.lineTo(x + cardW - 16 * tableScale, rowY);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.font = '600 17px Inter, sans-serif';
      ctx.fillStyle = 'rgba(191, 219, 254, 0.95)';
      ctx.fillText(row[0], labelX, rowY + rowH / 2);

      ctx.textAlign = 'right';
      ctx.font = '700 18px JetBrains Mono, monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(row[1], valueX, rowY + rowH / 2);
    });
    ctx.restore();

    return y + cardH;
  }

  function drawResultButtons(W, y, retryLabel) {
    const btnW = 150;
    const btnH = 46;
    const gap = 18;
    const totalW = btnW * 2 + gap;
    const startX = W / 2 - totalW / 2;
    const labels = [
      { text: retryLabel, x: startX, colorA: '#1d4ed8', colorB: '#0891b2', border: 'rgba(147,197,253,0.7)' },
      { text: '獲利了結', x: startX + btnW + gap, colorA: '#1e293b', colorB: '#334155', border: 'rgba(148,163,184,0.45)' },
    ];
    resultButtonRects = {
      retry: { x: startX, y, w: btnW, h: btnH },
      exit: { x: startX + btnW + gap, y, w: btnW, h: btnH },
    };

    ctx.save();
    labels.forEach((btn) => {
      const grad = ctx.createLinearGradient(btn.x, y, btn.x + btnW, y + btnH);
      grad.addColorStop(0, btn.colorA);
      grad.addColorStop(1, btn.colorB);
      ctx.fillStyle = grad;
      ctx.strokeStyle = btn.border;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = btn.colorA;
      ctx.beginPath();
      ctx.roundRect(btn.x, y, btnW, btnH, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 18px Inter, sans-serif';
      ctx.fillText(btn.text, btn.x + btnW / 2, y + btnH / 2 + 1);
    });
    ctx.restore();
  }

  function drawDeadScreen(W, H) {
    resultButtonRects = null;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = H / 2 - 36;

    // 標題
    ctx.font      = '900 56px Inter, sans-serif';
    ctx.fillStyle = '#f87171';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur  = 20;
    ctx.fillText(getElapsedSeconds() > timeLimitSeconds ? '⏰ 錯失執行窗口！' : '💥 強制平倉！', W / 2, centerY - 52);

    // 績效
    ctx.font = '700 32px JetBrains Mono, monospace';
    ctx.fillStyle = '#e8f0fe';
    ctx.shadowBlur = 0;
    ctx.fillText(`投資收益：${getFinalScore()}`, W / 2, centerY + 18);

    if (mouseOnlyRun) {
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('非系統性風險溢酬 1.3x', W / 2, centerY + 50);
    }
    const tableBottom = drawResultTable(W, centerY + 82);

    // 方向提示
    const tip = getElapsedSeconds() > timeLimitSeconds
      ? '策略執行延遲，建議提高換手效率並把建倉壓回目標期限內'
      : isDangerAbove ? '操作過度槓桿，建議下調風險權重 🖱️↓' : '部位曝險不足，建議上調風險權重 🖱️↑';
    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(tip, W / 2, tableBottom + 30);
    drawResultButtons(W, tableBottom + 56, '重新建倉');

    ctx.restore();
  }

  function drawCompleteScreen(W, H) {
    resultButtonRects = null;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerY = H / 2 - 52;

    ctx.font      = '900 52px Inter, sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur  = 25;
    ctx.fillText('策略執行完成！', W / 2, centerY - 34);

    ctx.font = '700 32px JetBrains Mono, monospace';
    ctx.fillStyle = '#fde68a';
    ctx.shadowBlur = 0;
    ctx.fillText(`累計淨值：${getFinalScore()}`, W / 2, centerY + 34);

    if (mouseOnlyRun) {
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('非系統性風險溢酬 1.3x', W / 2, centerY + 66);
    }

    const rating = getExecutionRating();

    ctx.font = '40px Inter, sans-serif';
    ctx.fillText(rating.badge, W / 2, centerY + 102);

    ctx.font = '400 16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(`風控評級：${rating.summary}`, W / 2, centerY + 146);
    const tableBottom = drawResultTable(W, centerY + 178);
    drawResultButtons(W, tableBottom + 26, '重新建倉');

    ctx.restore();
  }

})();

