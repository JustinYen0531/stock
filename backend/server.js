/**
 * server.js - StockAI Node.js 後端 (ESM)
 * yahoo-finance2 + Express + 技術指標計算
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import yfCtor from "yahoo-finance2";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();
const yahooFinance = new yfCtor({ suppressNotices: ["yahooSurvey"] });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// 靜態前端
const frontendPath = path.join(__dirname, "..", "frontend");
app.use("/static", express.static(frontendPath));

const HOMEPAGE_THEME_DEFS = [
  {
    id: "ai-chip",
    icon: "🧠",
    title: "AI 晶片",
    desc: "聚焦算力、伺服器與 GPU 主線。",
  },
  {
    id: "us-tech",
    icon: "💻",
    title: "美股科技",
    desc: "先看最有話題性的美國科技龍頭。",
  },
  {
    id: "taiwan-core",
    icon: "🇹🇼",
    title: "台灣龍頭",
    desc: "優先觀察台股核心權值與 AI 供應鏈。",
  },
  {
    id: "high-income",
    icon: "💸",
    title: "高股息 / ETF",
    desc: "防守型資金通常會先回到這些標的。",
  },
  {
    id: "future-motion",
    icon: "⚡",
    title: "電動車",
    desc: "高波動題材，最能反映市場情緒起伏。",
  },
  {
    id: "global-pulse",
    icon: "🌐",
    title: "全球熱點",
    desc: "跨市場題材股，適合快速掃描風向。",
  },
];

const HOMEPAGE_RECOMMENDATION_UNIVERSE = [
  { symbol: "NVDA", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "AMD", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "AVGO", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "MSFT", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "GOOGL", themeIds: ["us-tech"] },
  { symbol: "META", themeIds: ["us-tech"] },
  { symbol: "AMZN", themeIds: ["us-tech"] },
  { symbol: "TSLA", themeIds: ["future-motion", "us-tech"] },
  { symbol: "RIVN", themeIds: ["future-motion"] },
  { symbol: "NIO", themeIds: ["future-motion", "global-pulse"] },
  { symbol: "2330.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "2454.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "2317.TW", themeIds: ["taiwan-core"] },
  { symbol: "2382.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "0050.TW", themeIds: ["high-income"] },
  { symbol: "0056.TW", themeIds: ["high-income"] },
  { symbol: "00878.TW", themeIds: ["high-income"] },
  { symbol: "00919.TW", themeIds: ["high-income"] },
  { symbol: "BABA", themeIds: ["global-pulse"] },
  { symbol: "PDD", themeIds: ["global-pulse"] },
  { symbol: "700.HK", themeIds: ["global-pulse"] },
];

const HOMEPAGE_RECOMMENDATION_CACHE_MS = 60 * 1000;
const homepageRecommendationCache = {
  timestamp: 0,
  payload: null,
  promise: null,
};

// ═══════════════════════════════════════════════
// 指標計算工具
// ═══════════════════════════════════════════════

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [];
  let prevEma = null;
  let count = 0;
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v === null || v === undefined || isNaN(v)) {
      ema.push(null);
      continue;
    }
    if (prevEma === null) {
      sum += v;
      count++;
      if (count === period) {
        prevEma = sum / period;
        ema.push(+prevEma.toFixed(4));
      } else {
        ema.push(null);
      }
    } else {
      prevEma = v * k + prevEma * (1 - k);
      ema.push(+prevEma.toFixed(4));
    }
  }
  return ema;
}

function calcMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const s = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    return +(s / period).toFixed(4);
  });
}

function calcRSI(closes, period = 14) {
  const rsi = [];
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  const alpha = 1 / period;
  let avgG = 0, avgL = 0, started = false;

  rsi.push(null);
  for (let i = 0; i < changes.length; i++) {
    const g = Math.max(0, changes[i]);
    const l = Math.max(0, -changes[i]);
    if (!started) {
      avgG += g; avgL += l;
      if (i === period - 1) {
        avgG /= period; avgL /= period;
        started = true;
        const rs = avgL === 0 ? Infinity : avgG / avgL;
        rsi.push(+(100 - 100 / (1 + rs)).toFixed(2));
      } else {
        rsi.push(null);
      }
    } else {
      avgG = avgG * (1 - alpha) + g * alpha;
      avgL = avgL * (1 - alpha) + l * alpha;
      const rs = avgL === 0 ? Infinity : avgG / avgL;
      rsi.push(+(100 - 100 / (1 + rs)).toFixed(2));
    }
  }
  return rsi;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaF = calcEMA(closes, fast);
  const emaS = calcEMA(closes, slow);
  const macd = emaF.map((v, i) =>
    v === null || emaS[i] === null ? null : +(v - emaS[i]).toFixed(4));
  const sig = calcEMA(macd.map(v => v), signal);
  const hist = macd.map((v, i) =>
    v === null || sig[i] === null ? null : +(v - sig[i]).toFixed(4));
  return { macd, signal: sig, histogram: hist };
}

function lastVal(arr) {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function pickBestSeries(series, count = 12) {
  return series.slice(-count).map((value) => +value.toFixed(2));
}

function summarizeReason(label) {
  return label
    .replace(/（.*?）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeatReason(snapshot) {
  if (snapshot.changePercent >= 2.2) return `單日走強 ${formatPct(snapshot.changePercent)}`;
  if (snapshot.changePercent <= -2.2) return `波動放大 ${formatPct(snapshot.changePercent)}`;
  if (snapshot.volumePulse >= 1.8) return `量能放大 ${snapshot.volumePulse.toFixed(1)}x`;
  if (snapshot.momentum5d >= 4) return `5 日動能 ${formatPct(snapshot.momentum5d)}`;
  if (snapshot.momentum5d <= -4) return `5 日震盪 ${formatPct(snapshot.momentum5d)}`;
  return `技術分數 ${snapshot.adviceScore >= 0 ? "+" : ""}${snapshot.adviceScore}`;
}

function dedupeStrings(items, maxCount = 3) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= maxCount) break;
  }
  return result;
}

function normalizeEducationSymbol(symbol) {
  return String(symbol || "").toUpperCase().replace("-", "_");
}

const EDUCATION_KNOWLEDGE = {
  NVDA: {
    name: "NVIDIA",
    origin: "NVIDIA 由 Jensen Huang、Chris Malachowsky 與 Curtis Priem 在 1993 年創立，早期以圖形處理器切入 PC 遊戲與專業視覺市場。",
    business: "公司核心是 GPU、AI 加速器、資料中心平台與軟體生態。近年資料中心與 AI 訓練需求成為市場解讀 NVIDIA 的主軸。",
    event: "代表事件包含 GeForce 遊戲 GPU、CUDA 生態、資料中心 GPU，以及 AI 伺服器需求推升市場關注。",
    focus: "玩家應注意 AI 需求、資料中心營收、供應鏈產能與高估值下的波動。",
    folders: [
      {
        title: "公司起源故事",
        summary: "從遊戲顯示晶片起家，最後變成 AI 算力時代的核心公司。",
        details: [
          "NVIDIA 早期主戰場是 PC 3D 圖形與遊戲 GPU，品牌心智建立在高效能視覺運算。",
          "CUDA 讓 GPU 不只服務遊戲畫面，也能做科學運算、資料處理與 AI 訓練。",
          "市場後來重新理解 NVIDIA：它不是單純賣顯卡，而是賣平行運算平台與生態系。",
        ],
      },
      {
        title: "主要產品",
        summary: "GPU、資料中心加速器、AI 軟硬體平台與網路設備。",
        details: [
          "GeForce 面向消費與遊戲市場，維持品牌能見度與高階硬體形象。",
          "資料中心 GPU 與 AI 加速器是近年估值敘事的核心，常與雲端巨頭資本支出連動。",
          "CUDA、AI Enterprise、Networking 等軟硬整合能力，使客戶轉換成本變高。",
        ],
      },
      {
        title: "代表事件",
        summary: "GeForce、CUDA、資料中心 GPU、生成式 AI 浪潮。",
        details: [
          "GeForce 讓 NVIDIA 在遊戲玩家與高效能圖形市場取得長期辨識度。",
          "CUDA 生態擴大 GPU 用途，是後來 AI 訓練需求爆發的重要基礎。",
          "生成式 AI 帶動資料中心 GPU 需求，讓市場把 NVIDIA 視為 AI 基礎設施代表股。",
        ],
      },
      {
        title: "觀察重點",
        summary: "AI 需求、資料中心營收、供應鏈產能與高估值下的波動。",
        details: [
          "如果雲端公司持續增加 AI 資本支出，市場通常會提高對 NVIDIA 的成長預期。",
          "供應鏈產能、先進封裝與交貨能力，會影響營收是否跟得上市場期待。",
          "估值很高時，任何需求放緩或毛利率疑慮都可能放大股價震盪。",
        ],
      },
    ],
  },
  TSLA: {
    name: "Tesla",
    origin: "Tesla 成立於 2003 年，後來由 Elon Musk 帶入更大規模的資金、產品與品牌敘事，讓電動車從小眾科技品變成大眾市場焦點。",
    business: "公司核心包含電動車、電池、能源儲存、充電網路與自動駕駛軟體。市場常同時用車廠與科技平台兩種角度看它。",
    event: "代表事件包含 Model S、Model 3 放量、全球超級充電網路、價格戰與自動駕駛功能迭代。",
    focus: "玩家應注意交車量、毛利率、降價策略、自動駕駛進展與市場對成長敘事的信心。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Tesla 把電動車從科技理想推向大眾市場，也把車廠估值敘事改寫成平台故事。",
        details: [
          "Tesla 最早不是傳統車廠，而是用高性能電動車證明電動車可以有速度、設計與品牌魅力。",
          "Elon Musk 加入後，Tesla 的敘事從單一車款擴大到能源、軟體、自動駕駛與製造效率。",
          "市場常把 Tesla 同時看成車廠、能源公司與科技平台，這也是它估值波動很大的原因。",
        ],
      },
      {
        title: "主要產品",
        summary: "電動車、電池、能源儲存、充電網路與自動駕駛軟體。",
        details: [
          "Model 3 / Model Y 是放量核心，交車量與毛利率通常直接影響市場情緒。",
          "Supercharger 充電網路強化使用者黏著度，也讓 Tesla 擁有基礎設施層面的優勢。",
          "FSD 與軟體收入代表市場對未來平台化的期待，但也伴隨監管與落地不確定性。",
        ],
      },
      {
        title: "代表事件",
        summary: "Model 3 量產、全球建廠、價格戰、自動駕駛功能迭代。",
        details: [
          "Model 3 量產是 Tesla 從高端品牌走向大眾市場的關鍵轉折。",
          "上海、柏林、德州等工廠讓 Tesla 從概念型公司變成全球製造公司。",
          "降價策略常被市場雙重解讀：一方面刺激需求，另一方面可能壓縮毛利率。",
        ],
      },
      {
        title: "觀察重點",
        summary: "交車量、毛利率、價格策略、自動駕駛進度與市場信心。",
        details: [
          "交車量如果低於預期，市場會懷疑需求；如果毛利率下滑，市場會懷疑價格戰代價。",
          "自動駕駛與機器人題材會拉高想像空間，但短期股價仍常被車輛銷售數據牽動。",
          "Tesla 波動大，是因為它同時承載基本面、科技敘事與領導人風險。",
        ],
      },
    ],
  },
  AAPL: {
    name: "Apple",
    origin: "Apple 由 Steve Jobs、Steve Wozniak 與 Ronald Wayne 在 1976 年創立，從個人電腦開始，逐步塑造出硬體、軟體與服務整合的消費科技品牌。",
    business: "公司核心是 iPhone、Mac、iPad、Wearables 與 Services。市場看 Apple 時，通常同時看硬體銷售週期、使用者黏著度與服務收入。",
    event: "代表事件包含 Macintosh、iPod、iPhone、App Store、Apple Watch，以及近年的服務收入與空間運算產品。",
    focus: "玩家應注意 iPhone 需求、服務毛利、供應鏈、地區銷售與新產品能否打開下一段成長。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Apple 從個人電腦起家，真正的核心是把科技做成大眾願意使用、願意付費的體驗。",
        details: [
          "早期 Apple 以 Apple II 與 Macintosh 建立個人電腦品牌，強調圖形介面與使用者體驗。",
          "Steve Jobs 回歸後，Apple 重新聚焦產品線，並用 iMac、iPod、iPhone 改寫消費電子市場。",
          "Apple 的長期優勢不是單一硬體，而是硬體、作業系統、晶片、服務與品牌信任的整合。",
        ],
      },
      {
        title: "主要產品",
        summary: "iPhone 是核心，Services 與穿戴裝置讓生態系更厚。",
        details: [
          "iPhone 仍是營收與市場注意力中心，換機週期會影響投資人對成長的看法。",
          "Services 包含 App Store、iCloud、Apple Music、Apple Pay 等，毛利結構通常優於硬體。",
          "Mac、iPad、Apple Watch、AirPods 擴大使用場景，讓使用者更難離開 Apple 生態系。",
        ],
      },
      {
        title: "代表事件",
        summary: "iPhone 發表、App Store、生態系擴張、自研晶片。",
        details: [
          "2007 年 iPhone 發表是 Apple 從電腦公司轉型成行動平台公司的關鍵。",
          "App Store 把硬體銷售延伸成軟體分發與服務抽成模式。",
          "Apple Silicon 讓 Mac 產品線在效能、續航與供應鏈控制上更有差異化。",
        ],
      },
      {
        title: "觀察重點",
        summary: "iPhone 需求、服務成長、毛利率、供應鏈與新產品週期。",
        details: [
          "如果 iPhone 銷售疲弱，市場會擔心硬體換機週期；如果 Services 強，則能部分抵銷硬體波動。",
          "Apple 的股價常受中國市場、供應鏈政策與高階機型需求影響。",
          "新產品如 Vision Pro 或 AI 功能，重點不是聲量，而是能否變成可持續的生態收入。",
        ],
      },
    ],
  },
  MSFT: {
    name: "Microsoft",
    origin: "Microsoft 由 Bill Gates 與 Paul Allen 在 1975 年創立，從個人電腦軟體出發，逐步成為企業軟體、雲端與 AI 平台公司。",
    business: "公司核心包含 Windows、Office/Microsoft 365、Azure、企業軟體、LinkedIn、Xbox 與 AI 服務。市場常把它視為企業數位化與雲端 AI 的代表。",
    event: "代表事件包含 MS-DOS、Windows、Office、Azure 雲端轉型、收購 LinkedIn 與 Activision Blizzard，以及 Copilot AI 產品化。",
    focus: "玩家應注意 Azure 成長率、企業軟體續約、AI Copilot 商業化、資本支出與雲端競爭。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Microsoft 從 PC 軟體標準建立霸主地位，後來靠雲端轉型重新成長。",
        details: [
          "Microsoft 早期靠作業系統與開發工具進入個人電腦浪潮，Windows 成為長期平台核心。",
          "Office 把文書、簡報、試算表變成企業日常工作標準，形成很強的續約與習慣黏著。",
          "Satya Nadella 時代的雲端轉型，讓 Microsoft 從授權軟體公司變成訂閱與雲端平台公司。",
        ],
      },
      {
        title: "主要產品",
        summary: "Windows、Microsoft 365、Azure、Teams、Copilot 與企業雲服務。",
        details: [
          "Microsoft 365 以訂閱模式服務企業與個人，收入穩定且可持續升級。",
          "Azure 是雲端成長核心，常被市場拿來和 AWS、Google Cloud 比較。",
          "Copilot 把 AI 嵌進 Office、Windows、GitHub 與企業流程，是 AI 商業化主軸。",
        ],
      },
      {
        title: "代表事件",
        summary: "Windows 普及、Office 標準化、Azure 轉型、AI Copilot 推進。",
        details: [
          "Windows 與 Office 的普及，讓 Microsoft 長期掌握企業端入口。",
          "Azure 成功轉型後，市場重新給 Microsoft 成長型平台公司的評價。",
          "OpenAI 合作與 Copilot 產品線，讓 Microsoft 成為 AI 應用落地的重要代表。",
        ],
      },
      {
        title: "觀察重點",
        summary: "Azure 成長、AI 變現、企業預算、資本支出與毛利率。",
        details: [
          "Azure 成長率如果放緩，市場會重新檢查雲端需求與競爭壓力。",
          "AI Copilot 的重點是付費採用率，而不只是產品發表數量。",
          "AI 基礎設施需要大量資本支出，投資人會看收入增量是否能支撐支出。",
        ],
      },
    ],
  },
  "2330_TW": {
    name: "台積電",
    origin: "台積電成立於 1987 年，是晶圓代工模式的代表公司，讓晶片設計公司可以不自建晶圓廠也能量產先進晶片。",
    business: "公司核心是先進製程、晶圓代工、封裝與全球半導體客戶服務。市場通常把它視為 AI、手機、HPC 與全球科技供應鏈的核心節點。",
    event: "代表事件包含純晶圓代工模式、先進製程領先、海外設廠，以及 AI/HPC 需求帶動高階製程產能。",
    focus: "玩家應注意先進製程需求、資本支出、匯率、地緣政治與大客戶訂單變化。",
    folders: [
      {
        title: "公司起源故事",
        summary: "台積電把晶圓代工變成全球半導體分工的關鍵模式。",
        details: [
          "台積電成立時主打純晶圓代工，讓晶片設計公司不必自己建廠也能生產晶片。",
          "這個模式降低了無晶圓廠設計公司的門檻，也讓全球半導體產業分工更細。",
          "市場看台積電，不只看單一公司，也是在看全球科技供應鏈的核心節點。",
        ],
      },
      {
        title: "主要產品",
        summary: "先進製程、成熟製程、晶圓代工與先進封裝。",
        details: [
          "先進製程常用於高效能運算、AI、手機晶片與高階處理器。",
          "成熟製程服務車用、工控、消費電子等長尾需求，讓營收結構更分散。",
          "先進封裝在 AI/HPC 時代變得更重要，因為高階晶片需要更複雜的整合能力。",
        ],
      },
      {
        title: "代表事件",
        summary: "晶圓代工模式、先進製程領先、海外設廠、AI/HPC 需求。",
        details: [
          "純晶圓代工模式讓台積電避免與客戶在晶片設計上直接競爭，建立信任基礎。",
          "先進製程節點的領先，是市場給予台積電高評價的重要原因。",
          "AI/HPC 需求推升高階製程與先進封裝的重要性，使台積電成為 AI 供應鏈核心。",
        ],
      },
      {
        title: "觀察重點",
        summary: "先進製程需求、資本支出、匯率、海外設廠與地緣政治。",
        details: [
          "如果 AI 與高效能運算需求延續，先進製程產能利用率通常會受到正面關注。",
          "資本支出代表公司對未來需求的判斷，也會影響折舊與自由現金流。",
          "台積電同時受全球客戶需求、匯率與地緣政治影響，所以股價常反映多重風險。",
        ],
      },
    ],
  },
};

function getEducationKnowledge(symbol, quote = {}) {
  const key = normalizeEducationSymbol(symbol);
  const known = EDUCATION_KNOWLEDGE[key];
  if (known) return known;

  const name = quote.longName || quote.shortName || symbol;
  return {
    name,
    origin: `${name} 的完整背景資料尚未放入本地知識庫，第一版會先用可取得的市場資料與通用公司分析框架帶玩家理解。`,
    business: `${name} 的商業模式可先從產品服務、營收來源、客戶族群與產業位置四個角度閱讀。`,
    event: "這檔股票的代表事件會在後續題庫擴充時補齊，現在先以價格、量能與技術面變化建立學習節點。",
    focus: "玩家應先觀察近期漲跌幅、成交量是否放大、技術指標是否同向，以及市場是否正在重新定價它的成長故事。",
  };
}

function buildEducationStats(quotes) {
  const clean = (quotes || []).filter((q) => q.close !== null && q.close !== undefined);
  const closes = clean.map((q) => +q.close);
  const volumes = clean.map((q) => q.volume || 0);
  const last = closes[closes.length - 1] || 0;
  const prev = closes[closes.length - 2] || last;
  const first = closes[0] || last || 1;
  const change = prev ? ((last - prev) / prev) * 100 : 0;
  const periodChange = first ? ((last - first) / first) * 100 : 0;
  const swings = closes.slice(1).map((value, index) => Math.abs((value - closes[index]) / Math.max(1, closes[index])));
  const volatility = average(swings) * 100;
  const avgVolume = average(volumes.slice(-20).filter((value) => value > 0));
  const volumePulse = avgVolume > 0 ? (volumes[volumes.length - 1] || 0) / avgVolume : 1;

  return {
    last,
    change,
    periodChange,
    volatility,
    volumePulse,
    directionLabel: periodChange >= 0 ? "上行" : "回落",
    changeLabel: formatPct(change),
    periodChangeLabel: formatPct(periodChange),
  };
}

async function fetchEducationNews(symbol, name) {
  try {
    const result = await yahooFinance.search(symbol, { newsCount: 4, quotesCount: 0 });
    const news = (result?.news || []).slice(0, 3).map((item) => ({
      title: item.title || "",
      publisher: item.publisher || "",
      link: item.link || "",
      publishedAt: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : null,
    })).filter((item) => item.title);

    if (!news.length) return null;

    const headlineText = news.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
    let summary = `${name} 最近新聞焦點包含：${news.map((item) => item.title).join("；")}。`;

    if (GEMINI_API_KEY) {
      const prompt = `請用繁體中文把以下 ${symbol} / ${name} 的近期新聞標題整理成一段 80 字以內的遊戲教學摘要，聚焦「可能造成股價震盪的原因」。不要給投資建議，不要誇大因果。\n\n${headlineText}`;
      try {
        summary = await generateGeminiText(prompt, { temperature: 0.35, maxOutputTokens: 180 });
      } catch (error) {
        console.error("[Education Gemini News]", error.message);
      }
    }

    return {
      summary: String(summary || "").trim(),
      headlines: news,
      generatedAt: new Date().toISOString(),
      sourceKind: GEMINI_API_KEY ? "live_news" : "fallback",
    };
  } catch (error) {
    console.error("[Education News]", error.message);
    return null;
  }
}

function buildEducationPayload({ symbol, period, quote, chart, advice }) {
  const knowledge = getEducationKnowledge(symbol, quote);
  const stats = buildEducationStats(chart?.quotes || []);
  const name = quote.longName || quote.shortName || knowledge.name || symbol;
  const signal = advice?.signal || "中性觀望";
  const reason = advice?.reasons?.[0]?.label || "近期技術面需要搭配價格與量能一起觀察";

  return {
    symbol,
    period,
    company: {
      name,
      exchange: quote.exchange || "",
      story: knowledge.origin,
      business: knowledge.business,
      keyEvent: knowledge.event,
      focus: knowledge.focus,
    },
    marketSnapshot: {
      lastClose: stats.last ? +stats.last.toFixed(2) : null,
      changePercent: +stats.change.toFixed(2),
      periodChangePercent: +stats.periodChange.toFixed(2),
      volatilityPercent: +stats.volatility.toFixed(2),
      volumePulse: +stats.volumePulse.toFixed(2),
      technicalSignal: signal,
      generatedAt: new Date().toISOString(),
    },
    preview: {
      headline: `${name} 纜車預習`,
      summary: `${knowledge.origin} 這趟滑雪會把公司背景、商業模式、近期震盪與技術面拆成 4 個停靠站。`,
      folders: knowledge.folders || [
        {
          title: "公司起源故事",
          summary: knowledge.origin,
          details: ["這檔股票尚未放入完整知識庫，第一版先用通用公司分析框架補足。"],
        },
        {
          title: "主要產品",
          summary: knowledge.business,
          details: ["可以從產品服務、營收來源、客戶族群與產業位置四個角度開始閱讀。"],
        },
        {
          title: "代表事件",
          summary: knowledge.event,
          details: ["後續可以把財報轉折、產品發表、產業事件與重大併購逐步補進題庫。"],
        },
        {
          title: "觀察重點",
          summary: knowledge.focus,
          details: ["先觀察近期漲跌幅、成交量是否放大、技術指標是否同向，以及市場是否正在重新定價成長故事。"],
        },
      ],
      learningPoints: [
        "這家公司從哪裡開始，市場為什麼認得它",
        "它主要靠什麼產品或服務賺錢",
        "近期價格震盪可能跟哪些新聞或市場情緒有關",
        "滑雪地形如何對應這段期間的技術面變化",
      ],
    },
    nodes: [
      {
        title: "第一站：公司起源",
        type: "history",
        summary: knowledge.origin,
        question: `${name} 的公司背景最適合先從哪個角度理解？`,
        choices: ["創立脈絡與代表定位", "今天的收盤價小數點", "滑雪角色的顏色"],
        answerIndex: 0,
        explanation: "公司起源能幫玩家建立長期敘事，不會只被一天漲跌牽著走。",
        sourceKind: EDUCATION_KNOWLEDGE[normalizeEducationSymbol(symbol)] ? "curated" : "fallback",
      },
      {
        title: "第二站：商業模式",
        type: "business",
        summary: knowledge.business,
        question: `理解 ${name} 的商業模式時，哪一項最重要？`,
        choices: ["它如何創造營收與市場地位", "股價線條是不是好看", "遊戲雪花多不多"],
        answerIndex: 0,
        explanation: "商業模式決定市場如何評價公司，也影響股價面對消息時的反應。",
        sourceKind: EDUCATION_KNOWLEDGE[normalizeEducationSymbol(symbol)] ? "curated" : "fallback",
      },
      {
        title: "第三站：近期震盪",
        type: "volatility",
        summary: `${name} 在目前區間呈現 ${stats.directionLabel}，區間變化 ${stats.periodChangeLabel}，最近一日變化 ${stats.changeLabel}，量能約為近 20 日均量的 ${stats.volumePulse.toFixed(1)}x。`,
        question: "如果一段行情突然震盪變大，第一步應該先看什麼？",
        choices: ["新聞、量能與價格是否同時變化", "只看顏色猜漲跌", "把所有波動都當成隨機"],
        answerIndex: 0,
        explanation: "震盪通常要同時看事件、成交量與價格位置，才不容易把雜訊當主因。",
        sourceKind: "market_data",
      },
      {
        title: "第四站：技術地形",
        type: "technical",
        summary: `目前技術面訊號為「${signal}」。地圖坡度會跟價格路徑連動，玩家滑過的起伏就是這段行情的形狀。`,
        question: "滑雪地形主要對應股票資料中的哪一種資訊？",
        choices: ["價格路徑與波動", "公司 Logo 的字體", "聊天室回覆速度"],
        answerIndex: 0,
        explanation: `這一關的技術重點是 ${reason}，滑雪時的上下起伏會幫你感覺這段行情的節奏。`,
        sourceKind: "market_data",
      },
    ],
    newsContext: null,
    sourceTime: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════
// 投資建議 Agent
// ═══════════════════════════════════════════════
function generateAdvice(closes, ind) {
  const { ma5, ma20, rsi, macd, signal, histogram } = ind;
  let score = 0;
  const reasons = [];

  const rsiVal = lastVal(rsi);
  if (rsiVal !== null) {
    if      (rsiVal < 30) { score += 2; reasons.push({ label: `RSI ${rsiVal.toFixed(1)} < 30（超賣）`, type: "bull" }); }
    else if (rsiVal < 40) { score += 1; reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（偏弱）`, type: "bull" }); }
    else if (rsiVal > 70) { score -= 2; reasons.push({ label: `RSI ${rsiVal.toFixed(1)} > 70（超買）`, type: "bear" }); }
    else if (rsiVal > 60) { score -= 1; reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（偏強）`, type: "bear" }); }
    else                  {             reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（中性）`, type: "neutral" }); }
  }

  const hfilt = (histogram || []).filter(v => v !== null);
  if (hfilt.length >= 2) {
    const now = hfilt[hfilt.length - 1];
    const prev = hfilt[hfilt.length - 2];
    if      (now > 0 && prev <= 0) { score += 2; reasons.push({ label: "MACD 黃金交叉（強買入）", type: "bull" }); }
    else if (now < 0 && prev >= 0) { score -= 2; reasons.push({ label: "MACD 死亡交叉（強賣出）", type: "bear" }); }
    else if ((lastVal(macd) ?? 0) > (lastVal(signal) ?? 0)) { score += 1; reasons.push({ label: "MACD 在 Signal 上方（多頭）", type: "bull" }); }
    else { score -= 1; reasons.push({ label: "MACD 在 Signal 下方（空頭）", type: "bear" }); }
  }

  const close = closes[closes.length - 1];
  const ma5v = lastVal(ma5), ma20v = lastVal(ma20);
  if (ma20v) {
    if (close > ma20v) { score += 1; reasons.push({ label: `收盤 ${close.toFixed(2)} 站上 MA20 ${ma20v.toFixed(2)}`, type: "bull" }); }
    else               { score -= 1; reasons.push({ label: `收盤 ${close.toFixed(2)} 跌破 MA20 ${ma20v.toFixed(2)}`, type: "bear" }); }
  }
  if (ma5v && ma20v) {
    if (ma5v > ma20v) { score += 1; reasons.push({ label: `MA5 ${ma5v.toFixed(2)} > MA20（多排）`, type: "bull" }); }
    else              { score -= 1; reasons.push({ label: `MA5 ${ma5v.toFixed(2)} < MA20（空排）`, type: "bear" }); }
  }

  let sig, stype, summary;
  if      (score >= 4)  { sig = "強烈買入"; stype = "strong_bull"; summary = "多項指標同時發出買入信號，短期具備上漲動能，可考慮分批布局。"; }
  else if (score >= 2)  { sig = "買入";     stype = "bull";        summary = "指標偏多，趨勢向上，適合積極型投資人考慮買入。"; }
  else if (score >= 1)  { sig = "偏多觀望"; stype = "weak_bull";   summary = "多空信號混雜但稍偏多，建議等待更明確突破再進場。"; }
  else if (score <= -4) { sig = "強烈賣出"; stype = "strong_bear"; summary = "多項指標同時發出賣出警訊，下行風險較高，建議減碼或觀望。"; }
  else if (score <= -2) { sig = "賣出";     stype = "bear";        summary = "指標偏空，趨勢走弱，建議謹慎持有或考慮賣出。"; }
  else if (score <= -1) { sig = "偏空觀望"; stype = "weak_bear";   summary = "指標略偏空，尚無明確大幅下行，建議暫時觀望。"; }
  else                  { sig = "中性觀望"; stype = "neutral";     summary = "多空信號相互抵消，方向不明，建議等待突破訊號。"; }

  return {
    signal: sig, signal_type: stype, score, reasons, summary,
    disclaimer: "⚠️ 本建議為技術面分析，僅供參考，不構成實際投資建議。投資有風險，請自行判斷。",
  };
}

async function fetchRecommendationSnapshot(candidate) {
  const [chart, quote] = await Promise.all([
    yahooFinance.chart(candidate.symbol, { period1: monthsAgo(1), interval: "1d" }),
    yahooFinance.quote(candidate.symbol),
  ]);

  if (!chart?.quotes?.length) return null;

  const quotes = chart.quotes.filter((q) => q.close !== null && q.close !== undefined);
  if (quotes.length < 8) return null;

  const closes = quotes.map((q) => +q.close.toFixed(4));
  const volumes = quotes.map((q) => q.volume || 0);
  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);
  const rsi = calcRSI(closes, 14);
  const { macd, signal, histogram } = calcMACD(closes);
  const indicators = { ma5, ma20, rsi, macd, signal, histogram };
  const advice = generateAdvice(closes, indicators);

  const lastClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2] || lastClose;
  const fiveDayBase = closes[Math.max(0, closes.length - 6)] || prevClose;
  const derivedChangePercent = prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0;
  const momentum5d = fiveDayBase ? ((lastClose - fiveDayBase) / fiveDayBase) * 100 : 0;
  const avgVolume20 = average(volumes.slice(-20).filter((value) => value > 0));
  const currentVolume = quote.regularMarketVolume || volumes[volumes.length - 1] || 0;
  const volumePulse = avgVolume20 > 0 ? currentVolume / avgVolume20 : 1;
  const changePercent = typeof quote.regularMarketChangePercent === "number"
    ? quote.regularMarketChangePercent
    : derivedChangePercent;
  const longName = quote.longName || quote.shortName || candidate.symbol;

  return {
    symbol: candidate.symbol,
    name: longName,
    exchange: quote.exchange || "",
    marketCap: quote.marketCap || 0,
    changePercent,
    currentVolume,
    avgVolume20,
    volumePulse,
    momentum5d,
    adviceScore: advice.score,
    adviceSignal: advice.signal,
    adviceSummary: advice.summary,
    adviceReasons: advice.reasons.map((reason) => summarizeReason(reason.label)),
    series: pickBestSeries(closes),
    themeIds: candidate.themeIds,
    lastClose,
  };
}

function scoreRecommendationSnapshots(snapshots) {
  const maxAbsChange = Math.max(1, ...snapshots.map((snapshot) => Math.abs(snapshot.changePercent)));
  const maxVolumePulse = Math.max(1, ...snapshots.map((snapshot) => snapshot.volumePulse));
  const maxAbsMomentum = Math.max(1, ...snapshots.map((snapshot) => Math.abs(snapshot.momentum5d)));
  const maxMarketCap = Math.max(1, ...snapshots.map((snapshot) => snapshot.marketCap || 0));
  const maxLogMarketCap = Math.log10(maxMarketCap + 1);

  return snapshots.map((snapshot) => {
    const changeScore = (Math.abs(snapshot.changePercent) / maxAbsChange) * 42;
    const volumeScore = (Math.min(snapshot.volumePulse, maxVolumePulse) / maxVolumePulse) * 22;
    const momentumScore = (Math.abs(snapshot.momentum5d) / maxAbsMomentum) * 14;
    const capScore = maxLogMarketCap > 0
      ? (Math.log10((snapshot.marketCap || 1) + 1) / maxLogMarketCap) * 8
      : 0;
    const technicalScore = ((snapshot.adviceScore + 6) / 12) * 14;
    const bullishBonus = snapshot.changePercent > 0 ? Math.min(snapshot.changePercent, 6) * 2 : 0;
    const downsidePenalty = snapshot.changePercent < 0 ? Math.min(Math.abs(snapshot.changePercent), 6) * 1.3 : 0;
    const heatScore = +(changeScore + volumeScore + momentumScore + capScore + technicalScore).toFixed(1);
    const featuredScore = +(heatScore + bullishBonus + Math.max(0, snapshot.adviceScore) * 3 - downsidePenalty).toFixed(1);

    return {
      ...snapshot,
      heatScore,
      featuredScore,
    };
  });
}

async function buildFeaturedGeminiReason(snapshot) {
  const fallbackMarkdown = `# 為什麼今天先看 ${snapshot.symbol}

${snapshot.name} 今天被放在首頁主推薦，不是因為單一消息面突然放大，而是它在 **市場熱度、技術結構、以及實際可分析性** 這三個面向同時有內容。對首頁來說，這種股票最適合被放在第一張，因為使用者一點進去就能立刻看出今天市場節奏到底在哪裡。

---

## 市場熱度
先從盤面熱度來看，${snapshot.name} 今天最直接的訊號就是 **${buildHeatReason(snapshot)}**。這代表它不是只有價格在移動，而是有資金與注意力同時往它身上集中，因此它更像是今天情緒的核心標的，而不是被動跟著指數起伏的陪跑股。

## 技術結構
再看技術面，現在最值得先留意的是 **${snapshot.adviceReasons.join("、")}**。當這些訊號同時出現時，通常表示走勢已經不只是短線雜訊，而是開始形成一個可以被追蹤、被驗證、也能被拆解的技術結構，所以它比一般熱門股更有分析價值。

## 現在點進去最值得看什麼
如果你現在打開分析頁，最應該先看的不是單一指標，而是 **RSI、MACD 與均線之間是否還維持同方向**。這會直接決定這個推薦是短線衝高後的噪音，還是仍然站在可延續的趨勢上，對使用者來說也最有立即判讀價值。

---

| 面向 | 目前重點 | 解讀 |
| --- | --- | --- |
| 市場熱度 | ${buildHeatReason(snapshot)} | 有注意力，也有資金流向 |
| 技術結構 | ${snapshot.adviceSignal} | 技術面不是空白，而是可追蹤 |
| 分析價值 | ${snapshot.adviceReasons[0] || "RSI / MACD / 均線"} | 點進去後可以立即驗證推薦是否站得住 |

## 結論
總結來說，${snapshot.name} 會被推薦，不只是因為今天看起來很熱，而是因為它在 **熱度、技術、以及可讀性** 三個層次都同時有畫面。這讓它成為最適合放在首頁第一張、也最值得先打開來看的股票。`;

  const isUsableFeaturedReason = (text) => {
    const normalized = String(text || "").trim();
    if (!normalized) return false;
    const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const paragraphCount = lines.filter((line) => !/^#{1,6}\s/.test(line) && line !== "---" && !/^\|.*\|$/.test(line)).length;
    const hasDivider = normalized.includes("---");
    const hasTable = /\|.+\|/.test(normalized);
    return lines.length >= 8 && paragraphCount >= 3 && hasDivider && hasTable;
  };

  if (!GEMINI_API_KEY) {
    return fallbackMarkdown;
  }

  const prompt = `你是一位股票首頁編輯，請用繁體中文為今天首頁推薦的 ${snapshot.symbol}${snapshot.name ? `（${snapshot.name}）` : ""} 撰寫一段完整推薦敘述，並且一定要使用 Markdown 格式。

請根據以下資料撰寫：
- 單日漲跌幅：${formatPct(snapshot.changePercent)}
- 5 日動能：${formatPct(snapshot.momentum5d)}
- 量能脈衝：${snapshot.volumePulse.toFixed(1)}x
- 技術面訊號：${snapshot.adviceSignal}
- 技術面理由：${snapshot.adviceReasons.join("、")}

限制：
1. 一定要有一個 H1 標題，直接替這篇推薦文命名。
2. 不要出現「過程一 / 過程二 / 過程三」這種字眼。
3. 內容必須用三個面向解釋為什麼是這一支股票，建議面向為：市場熱度、技術結構、現在點進去最值得看什麼。
4. 一定要有 --- 分隔線。
5. 一定要有一個 Markdown 表格，至少三列，摘要三個面向。
6. 一定要有 ## 結論 收尾。
7. 段落內請自然使用 **粗體** 強調重點，不要只有純文字。
8. 全文要像首頁推薦專欄，不要像聊天回覆，也不要加免責聲明。`;

  try {
    const generated = await generateGeminiText(prompt, { temperature: 0.6, maxOutputTokens: 520 });
    return isUsableFeaturedReason(generated) ? generated : fallbackMarkdown;
  } catch (error) {
    console.error("[Homepage Gemini Reason]", error.message);
    return fallbackMarkdown;
  }
}

async function buildFeaturedRecommendation(snapshot) {
  const primaryThemeId = snapshot.themeIds[0];
  const primaryTheme = HOMEPAGE_THEME_DEFS.find((theme) => theme.id === primaryThemeId);
  const changeLabel = snapshot.changePercent >= 0 ? `走勢轉強 ${formatPct(snapshot.changePercent)}` : `震盪擴大 ${formatPct(snapshot.changePercent)}`;
  const pulseLabel = snapshot.volumePulse >= 1.1 ? `量能 ${snapshot.volumePulse.toFixed(1)}x` : "量能穩定";
  const aiReason = await buildFeaturedGeminiReason(snapshot);

  return {
    symbol: snapshot.symbol,
    name: snapshot.name,
    exchange: snapshot.exchange,
    summary: `${snapshot.name} 今天 ${changeLabel}，${pulseLabel}，而且技術面目前落在「${snapshot.adviceSignal}」，是首頁最值得先點進去看的一檔。`,
    detail: `這張主卡會優先挑出熱度、量能與技術面一起靠前的標的。${snapshot.name} 目前 5 日動能 ${formatPct(snapshot.momentum5d)}，技術分數 ${snapshot.adviceScore >= 0 ? "+" : ""}${snapshot.adviceScore}，適合先看它怎麼帶動今天的盤面情緒。`,
    chips: [
      { label: "即時推薦", tone: "primary" },
      { label: primaryTheme?.title || "熱門主題", tone: "warning" },
      { label: pulseLabel, tone: snapshot.volumePulse >= 1.3 ? "success" : "primary" },
    ],
    reasons: dedupeStrings([
      buildHeatReason(snapshot),
      ...snapshot.adviceReasons,
      `熱度分數 ${snapshot.heatScore.toFixed(1)}`,
    ]),
    aiReason,
    series: snapshot.series,
  };
}

function buildHotRecommendations(snapshots) {
  return snapshots.slice(0, 3).map((snapshot) => ({
    symbol: snapshot.symbol,
    name: snapshot.name,
    blurb: `${snapshot.name} 今日熱度分數 ${snapshot.heatScore.toFixed(1)}，${snapshot.volumePulse >= 1.2 ? `量能約為近月均量 ${snapshot.volumePulse.toFixed(1)}x` : "成交維持活躍"}，適合先快速掃描。`,
    change: formatPct(snapshot.changePercent),
    trend: snapshot.changePercent >= 0 ? "up" : "down",
    reasons: dedupeStrings([
      buildHeatReason(snapshot),
      ...snapshot.adviceReasons,
      `技術面 ${snapshot.adviceSignal}`,
    ]),
    series: snapshot.series,
  }));
}

function buildThemeRecommendations(snapshots) {
  return HOMEPAGE_THEME_DEFS
    .map((theme) => {
      const picks = snapshots
        .filter((snapshot) => snapshot.themeIds.includes(theme.id))
        .sort((a, b) => b.heatScore - a.heatScore)
        .slice(0, 2);
      if (!picks.length) return null;

      const topNames = picks.map((pick) => pick.name).join("、");
      const topHeat = average(picks.map((pick) => pick.heatScore));

      return {
        id: theme.id,
        icon: theme.icon,
        title: theme.title,
        desc: `${theme.desc} 今日優先看 ${topNames}。`,
        topHeat,
        picks: picks.map((pick) => ({
          symbol: pick.symbol,
          name: pick.name,
        })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.topHeat - a.topHeat)
    .slice(0, 4)
    .map(({ topHeat, ...theme }) => theme);
}

async function buildHomepageRecommendations() {
  const settled = await Promise.allSettled(
    HOMEPAGE_RECOMMENDATION_UNIVERSE.map((candidate) => fetchRecommendationSnapshot(candidate))
  );

  const snapshots = scoreRecommendationSnapshots(
    settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value)
  );

  if (snapshots.length < 6) {
    throw new Error("可用推薦資料不足");
  }

  const featuredPool = [...snapshots].sort((a, b) => b.featuredScore - a.featuredScore);
  const hotPool = [...snapshots].sort((a, b) => b.heatScore - a.heatScore);
  const featured = await buildFeaturedRecommendation(featuredPool[0]);
  const hot = buildHotRecommendations(hotPool);
  const themes = buildThemeRecommendations(hotPool);

  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    methodology: "依單日波動、量能脈衝、近 5 日動能與技術面分數即時排序",
    featured,
    hot,
    themes,
  };
}

async function getHomepageRecommendations(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && homepageRecommendationCache.payload && now - homepageRecommendationCache.timestamp < HOMEPAGE_RECOMMENDATION_CACHE_MS) {
    return homepageRecommendationCache.payload;
  }
  if (!forceFresh && homepageRecommendationCache.promise) {
    return homepageRecommendationCache.promise;
  }

  homepageRecommendationCache.promise = buildHomepageRecommendations()
    .then((payload) => {
      homepageRecommendationCache.payload = payload;
      homepageRecommendationCache.timestamp = Date.now();
      homepageRecommendationCache.promise = null;
      return payload;
    })
    .catch((error) => {
      homepageRecommendationCache.promise = null;
      throw error;
    });

  return homepageRecommendationCache.promise;
}

// ═══════════════════════════════════════════════
// Gemini AI 聊天端點
// ═══════════════════════════════════════════════
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function generateGeminiText(prompt, { temperature = 0.7, maxOutputTokens = 8192 } = {}) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key 未設定");

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Gemini Error]", errText);
    throw new Error("Gemini API 錯誤");
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "（無回應）";
}

app.post("/chat", async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: "缺少 message" });

  // 將股票指標數據組成 system prompt
  let systemContext = `你是一位專業的股市技術面分析師，精通 RSI、MACD、移動平均線等技術指標。
請用繁體中文回答，語氣專業但親切，回答要具體且有根據。
回答時請注意：所有建議僅供參考，不構成實際投資建議。`;

  if (context && context.symbol) {
    systemContext += `

目前用戶正在查看的股票：【${context.symbol}】${context.name ? `（${context.name}）` : ""}
最新技術指標數據：
- 最新收盤價：${context.close ?? "N/A"}
- RSI(14)：${context.rsi ?? "N/A"}
- MACD：${context.macd ?? "N/A"}
- Signal：${context.signal ?? "N/A"}
- MA5：${context.ma5 ?? "N/A"}
- MA20：${context.ma20 ?? "N/A"}
- MA60：${context.ma60 ?? "N/A"}
- AI 系統建議：${context.advice ?? "N/A"}
- 評分：${context.score ?? "N/A"}（-6~+6，正值偏多，負值偏空）

請根據以上數據回答用戶的問題。`;
  }

  try {
    const text = await generateGeminiText(systemContext + "\n\n用戶問題：" + message);
    res.json({ reply: text });

  } catch (e) {
    console.error("[Chat Error]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

async function handleHomepageRecommendations(req, res) {
  try {
    const payload = await getHomepageRecommendations(req.query.fresh === "1");
    res.json(payload);
  } catch (e) {
    console.error("[HOMEPAGE ERR]", e.message);
    res.status(500).json({ detail: `首頁推薦抓取失敗：${e.message}` });
  }
}

app.get("/homepage-recommendations", handleHomepageRecommendations);
app.get("/api/homepage-recommendations", handleHomepageRecommendations);

async function handleEducation(req, res) {
  const symbol = req.params.symbol.toUpperCase();
  const periodParam = req.query.period || "3mo";
  const periodMap = {
    "1mo": monthsAgo(1), "3mo": monthsAgo(3),
    "6mo": monthsAgo(6), "1y": monthsAgo(12), "2y": monthsAgo(24),
  };
  const period1 = periodMap[periodParam] || periodMap["3mo"];

  try {
    const [chart, quote] = await Promise.all([
      yahooFinance.chart(symbol, { period1, interval: "1d" }),
      yahooFinance.quote(symbol).catch(() => ({ shortName: symbol, longName: symbol })),
    ]);

    if (!chart?.quotes?.length) {
      return res.status(404).json({ detail: `找不到教育資料：${symbol}` });
    }

    const quotes = chart.quotes.filter((q) => q.close !== null && q.close !== undefined);
    const closes = quotes.map((q) => +q.close.toFixed(4));
    const indicators = {
      ma5: calcMA(closes, 5),
      ma20: calcMA(closes, 20),
      ma60: calcMA(closes, 60),
      rsi: calcRSI(closes, 14),
      ...calcMACD(closes),
    };
    const advice = generateAdvice(closes, indicators);
    const payload = buildEducationPayload({ symbol, period: periodParam, quote, chart: { quotes }, advice });
    const newsContext = await fetchEducationNews(symbol, payload.company.name);

    if (newsContext?.summary) {
      payload.newsContext = newsContext;
      const volatilityNode = payload.nodes.find((node) => node.type === "volatility");
      if (volatilityNode) {
        volatilityNode.summary = `${newsContext.summary} 市場資料補充：區間變化 ${payload.marketSnapshot.periodChangePercent >= 0 ? "+" : ""}${payload.marketSnapshot.periodChangePercent}%、量能 ${payload.marketSnapshot.volumePulse}x。`;
        volatilityNode.sourceKind = newsContext.sourceKind;
      }
    }

    res.json(payload);
  } catch (e) {
    console.error("[Education ERR]", e.message);
    res.status(500).json({ detail: `教育資料抓取失敗：${e.message}` });
  }
}

app.get("/education/:symbol", handleEducation);
app.get("/api/education/:symbol", handleEducation);

app.get("/full/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const periodParam = req.query.period || "3mo";
  const periodMap = {
    "1mo": monthsAgo(1), "3mo": monthsAgo(3),
    "6mo": monthsAgo(6), "1y":  monthsAgo(12), "2y": monthsAgo(24),
  };
  const period1 = periodMap[periodParam] || periodMap["3mo"];

  try {
    const chart = await yahooFinance.chart(symbol, { period1, interval: "1d" });

    if (!chart?.quotes?.length) {
      return res.status(404).json({ detail: `找不到股票：${symbol}（台股需加 .TW）` });
    }

    const quotes = chart.quotes.filter(q => q.close !== null && q.close !== undefined);
    const dates  = quotes.map(q => q.date.toISOString().slice(0, 10));
    const closes = quotes.map(q => +q.close.toFixed(4));

    const ohlcv = quotes.map((q, i) => ({
      Date:   dates[i],
      Open:   q.open  ? +q.open.toFixed(2)  : null,
      High:   q.high  ? +q.high.toFixed(2)  : null,
      Low:    q.low   ? +q.low.toFixed(2)   : null,
      Close:  +q.close.toFixed(2),
      Volume: q.volume || 0,
    }));

    const ma5  = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);
    const ma60 = calcMA(closes, 60);
    const rsi  = calcRSI(closes, 14);
    const { macd, signal, histogram } = calcMACD(closes);
    const indicators = { ma5, ma20, ma60, rsi, macd, signal, histogram };

    const advice = generateAdvice(closes, indicators);

    let info = { name: symbol, currency: "", exchange: "" };
    try {
      const q = await yahooFinance.quote(symbol);
      info = {
        name:       q.longName || q.shortName || symbol,
        currency:   q.currency || "",
        exchange:   q.exchange || "",
        sector:     q.sector || "",
        market_cap: q.marketCap || null,
      };
    } catch (_) {}

    res.json({ symbol, info, dates, ohlcv, indicators, advice });

  } catch (e) {
    console.error("[ERR]", e.message);
    res.status(500).json({ detail: `抓取失敗：${e.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀 StockAI 後端啟動！`);
  console.log(`  📊 http://localhost:${PORT}\n`);
});

export default app;

