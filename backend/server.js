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
  return String(symbol || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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

const FEATURED_STOCK_EDUCATION_PROFILES = {
  AMD: {
    name: "AMD",
    origin: "AMD 從 CPU 與繪圖晶片競爭切入市場，近年靠 Ryzen、EPYC 與 AI 加速器重新取得高效能運算的能見度。",
    business: "公司核心包含 PC 處理器、資料中心 CPU、GPU、嵌入式晶片與 AI 加速器，市場會把它放在半導體景氣與 AI 伺服器供應鏈一起看。",
    event: "代表事件包含 Ryzen 翻身、EPYC 進入資料中心、收購 Xilinx 擴大嵌入式布局，以及 AI 加速器產品線推進。",
    focus: "玩家應注意資料中心成長、AI 晶片出貨、PC 需求循環、毛利率與和 NVIDIA、Intel 的競爭節奏。",
  },
  GOOGL: {
    name: "Alphabet",
    origin: "Alphabet 的核心來自 Google 搜尋與廣告平台，後來把雲端、YouTube、Android 與 AI 研發納入同一個大型科技生態。",
    business: "公司主要收入來自搜尋廣告、YouTube、Google Cloud、Android 生態與訂閱服務，AI 能力會影響廣告效率與雲端競爭。",
    event: "代表事件包含 Google 搜尋普及、Android 生態擴張、YouTube 成長、Google Cloud 追趕，以及 Gemini 等 AI 產品推進。",
    focus: "玩家應注意廣告景氣、搜尋流量、雲端成長率、AI 投入成本、監管風險與市場對 AI 搜尋變化的反應。",
  },
  META: {
    name: "Meta",
    origin: "Meta 從 Facebook 社群平台起家，逐步擴張到 Instagram、WhatsApp、廣告系統、短影音與沉浸式運算布局。",
    business: "公司核心是社群流量與廣告變現，Reels、AI 推薦系統、Messaging 與 Reality Labs 會影響成長敘事。",
    event: "代表事件包含 Facebook 全球化、Instagram 收購、廣告機器學習系統升級、元宇宙投入與 AI 推薦效率改善。",
    focus: "玩家應注意廣告需求、使用者停留時間、AI 推薦帶來的變現效率、Reality Labs 支出與隱私監管。",
  },
  AMZN: {
    name: "Amazon",
    origin: "Amazon 從線上書店起家，後來成為電商、雲端基礎設施、物流與會員生態的綜合平台。",
    business: "公司核心包含電商 marketplace、Prime 會員、廣告、物流服務與 AWS，市場常同時看零售效率與雲端成長。",
    event: "代表事件包含 Marketplace 擴張、Prime 會員制、AWS 成為雲端龍頭、物流網路擴建與廣告業務放大。",
    focus: "玩家應注意 AWS 成長率、零售毛利、廣告收入、物流成本、消費景氣與 AI 基礎設施投資。",
  },
  NFLX: {
    name: "Netflix",
    origin: "Netflix 從 DVD 租借轉型串流平台，再用原創內容與全球訂閱制建立影音娛樂品牌。",
    business: "公司核心是串流訂閱、內容投資、廣告方案與全球會員成長，市場會用會員數、ARPU 與內容效率評價它。",
    event: "代表事件包含串流轉型、原創劇集成功、全球化擴張、打擊共享帳號與廣告訂閱方案推出。",
    focus: "玩家應注意會員成長、內容成本、廣告方案滲透率、競爭平台壓力與自由現金流。",
  },
  CRM: {
    name: "Salesforce",
    origin: "Salesforce 以雲端 CRM 起家，把企業銷售、客服、行銷與資料流程搬到訂閱式平台。",
    business: "公司核心是 CRM 軟體、Data Cloud、Slack、行銷自動化與 AI 助理服務，收入受企業軟體預算影響。",
    event: "代表事件包含 SaaS CRM 普及、AppExchange 生態、收購 Tableau 與 Slack，以及 Einstein AI 功能擴張。",
    focus: "玩家應注意訂閱續約率、企業 IT 預算、AI 功能變現、營業利益率與大型客戶採用速度。",
  },
  ORCL: {
    name: "Oracle",
    origin: "Oracle 從資料庫軟體建立企業級地位，後來延伸到雲端基礎設施、ERP 與產業應用。",
    business: "公司核心包含資料庫、雲端基礎設施 OCI、企業應用、Java 與產業解決方案，市場關注雲端轉型速度。",
    event: "代表事件包含關聯式資料庫普及、企業應用擴張、雲端基礎設施加速與大型 AI 訓練客戶需求。",
    focus: "玩家應注意 OCI 成長率、資料庫續約、雲端資本支出、AI 運算需求與企業軟體競爭。",
  },
  QCOM: {
    name: "Qualcomm",
    origin: "Qualcomm 以無線通訊技術與行動晶片建立地位，長期受手機週期與通訊標準升級影響。",
    business: "公司核心包含 Snapdragon 行動平台、通訊專利授權、車用晶片、IoT 與邊緣 AI 晶片。",
    event: "代表事件包含 CDMA 技術商業化、4G/5G 標準推進、Snapdragon 品牌建立與車用晶片布局。",
    focus: "玩家應注意智慧手機需求、授權收入、車用設計案、AI PC / 邊緣 AI 進展與中國手機品牌拉貨。",
  },
  INTC: {
    name: "Intel",
    origin: "Intel 是 x86 處理器與 PC 時代的重要代表，近年同時面對製程追趕、資料中心競爭與晶圓代工轉型。",
    business: "公司核心包含 PC CPU、伺服器處理器、晶圓製造、代工服務、加速器與網路晶片。",
    event: "代表事件包含 x86 架構普及、資料中心 CPU 擴張、製程延遲壓力與 IDM 2.0 代工策略。",
    focus: "玩家應注意製程節點進度、代工客戶、PC 循環、資料中心市占、資本支出與補助政策。",
  },
  AVGO: {
    name: "Broadcom",
    origin: "Broadcom 由通訊晶片與基礎設施半導體建立市場地位，後來透過併購擴大到企業軟體。",
    business: "公司核心包含網路晶片、交換器 ASIC、無線射頻、儲存連接、基礎設施軟體與大型企業客戶。",
    event: "代表事件包含多次半導體併購、網路交換晶片需求、AI 叢集網路升級與 VMware 併購。",
    focus: "玩家應注意 AI 網路需求、企業軟體整合、毛利率、客戶集中度與資料中心資本支出。",
  },
  MU: {
    name: "Micron",
    origin: "Micron 是記憶體與儲存晶片公司，股價常跟 DRAM / NAND 景氣循環一起起伏。",
    business: "公司核心包含 DRAM、NAND、資料中心記憶體、行動與車用儲存，AI 伺服器會帶動高頻寬記憶體需求。",
    event: "代表事件包含記憶體景氣循環、NAND 供需調整、HBM 需求升溫與資料中心產品比重提高。",
    focus: "玩家應注意記憶體報價、庫存水位、HBM 出貨、資本支出紀律與終端需求復甦。",
  },
  AMAT: {
    name: "Applied Materials",
    origin: "Applied Materials 是半導體設備龍頭之一，提供晶圓製造過程需要的材料工程與製程設備。",
    business: "公司核心是薄膜沉積、蝕刻、量測、顯示與服務，市場會把它視為晶圓廠資本支出的溫度計。",
    event: "代表事件包含先進製程投資、記憶體擴產循環、半導體設備需求波動與先進封裝設備機會。",
    focus: "玩家應注意晶圓廠資本支出、先進製程投資、出口管制、記憶體循環與服務收入穩定性。",
  },
  LRCX: {
    name: "Lam Research",
    origin: "Lam Research 是半導體設備公司，特別與蝕刻、沉積和記憶體製程投資密切相關。",
    business: "公司核心提供晶圓製程設備與服務，客戶多為邏輯與記憶體晶片製造商。",
    event: "代表事件包含記憶體景氣循環、先進製程設備需求、先進封裝與高深寬比製程挑戰。",
    focus: "玩家應注意晶圓廠擴產、記憶體資本支出、設備出貨節奏、出口限制與毛利率。",
  },
  RIVN: {
    name: "Rivian",
    origin: "Rivian 是美國電動車新創，品牌心智偏向電動皮卡、休旅與戶外生活場景。",
    business: "公司核心是電動車生產、商用電動貨車、軟體服務與製造效率改善，仍處於放量與降本階段。",
    event: "代表事件包含 R1T / R1S 推出、商用貨車合作、產能爬坡與新平台成本控制。",
    focus: "玩家應注意交車量、現金消耗、單車毛利、產能利用率、新車型時程與融資壓力。",
  },
  LCID: {
    name: "Lucid",
    origin: "Lucid 主打高端電動車與長續航技術，品牌定位更接近豪華性能電動車。",
    business: "公司核心是高端電動車銷售、電池與動力系統技術，營運重點在需求、產能與成本控制。",
    event: "代表事件包含 Lucid Air 推出、豪華電動車定位、產量調整與資金需求討論。",
    focus: "玩家應注意交車量、現金水位、毛利率、價格策略、豪華車需求與中東資金支持。",
  },
  NIO: {
    name: "NIO",
    origin: "蔚來是中國電動車品牌，以高端車型、用戶社群與換電服務建立差異化。",
    business: "公司核心包含電動車銷售、換電站、車主服務、軟體功能與中國高端新能源車市場。",
    event: "代表事件包含量產車推出、換電網路擴張、子品牌布局與中國新能源車價格競爭。",
    focus: "玩家應注意交付量、毛利率、換電站成本、現金流、中國車市競爭與政策環境。",
  },
  ENPH: {
    name: "Enphase Energy",
    origin: "Enphase 以太陽能微型逆變器建立品牌，受住宅太陽能需求與利率環境影響明顯。",
    business: "公司核心包含微型逆變器、儲能電池、能源管理軟體與住宅太陽能系統。",
    event: "代表事件包含微型逆變器普及、住宅太陽能成長、庫存調整與利率變化拖累需求。",
    focus: "玩家應注意住宅太陽能安裝量、渠道庫存、利率、歐洲與美國需求、儲能產品成長。",
  },
  PLUG: {
    name: "Plug Power",
    origin: "Plug Power 聚焦氫能與燃料電池，題材想像大，但營運常受成本、資金與商業化速度檢驗。",
    business: "公司核心包含燃料電池系統、氫氣供應、電解槽與物流用能源解決方案。",
    event: "代表事件包含燃料電池叉車應用、綠氫工廠規畫、補助政策期待與資金需求壓力。",
    focus: "玩家應注意現金流、氫氣成本、毛利率、政策補助、訂單落地與產能建置速度。",
  },
  JPM: {
    name: "JPMorgan Chase",
    origin: "JPMorgan Chase 是大型綜合金融機構，業務橫跨消費金融、商業銀行、投資銀行與資產管理。",
    business: "公司核心包含存放款、信用卡、投資銀行、交易業務、財富管理與機構金融服務。",
    event: "代表事件包含金融危機後整合、利率循環影響淨利息收入、併購承銷週期與銀行監管變化。",
    focus: "玩家應注意利率路徑、存款成本、信用風險、投行景氣、資本規範與壞帳提列。",
  },
  BAC: {
    name: "Bank of America",
    origin: "Bank of America 是美國大型銀行，消費金融與存款基礎讓它對利率循環很敏感。",
    business: "公司核心包含零售銀行、信用卡、商業貸款、財富管理與投資銀行服務。",
    event: "代表事件包含金融危機後重整、利率上升帶動淨利息收入、存款競爭與債券投資組合波動。",
    focus: "玩家應注意淨利息收入、存款流失、信用品質、未實現損益、消費貸款與監管資本。",
  },
  GS: {
    name: "Goldman Sachs",
    origin: "Goldman Sachs 是投資銀行與資本市場代表，收入更受交易、承銷與併購活動影響。",
    business: "公司核心包含投資銀行、交易業務、資產管理、財富管理與機構客戶服務。",
    event: "代表事件包含 IPO / 併購週期、交易收入波動、消費金融收縮與資產管理轉型。",
    focus: "玩家應注意資本市場熱度、併購與承銷案量、交易收入、費用控管與資產管理流入。",
  },
  V: {
    name: "Visa",
    origin: "Visa 是全球支付網路公司，核心價值在於交易清算網路、品牌信任與跨境支付規模。",
    business: "公司核心收入來自支付交易量、資料處理、跨境交易與增值服務，不直接承擔大部分信用風險。",
    event: "代表事件包含電子支付普及、跨境旅遊恢復、無現金化趨勢與金融科技競爭。",
    focus: "玩家應注意消費支出、跨境交易、匯率、監管費率、金融科技競爭與交易量成長。",
  },
  MA: {
    name: "Mastercard",
    origin: "Mastercard 是全球支付網路公司，與 Visa 類似受電子支付、跨境消費與交易量成長帶動。",
    business: "公司核心包含支付處理、跨境交易、資料服務、資安與金融機構合作方案。",
    event: "代表事件包含無現金支付擴張、旅遊復甦、數位錢包合作與即時支付競爭。",
    focus: "玩家應注意全球消費、跨境交易、監管費率、商戶接受度、增值服務成長與競爭壓力。",
  },
  BRK_B: {
    name: "Berkshire Hathaway",
    origin: "Berkshire Hathaway 是 Warren Buffett 長期經營的控股公司，核心特色是保險浮存金與多元資本配置。",
    business: "公司核心包含保險、鐵路、能源、公用事業、製造零售與大型上市股票投資組合。",
    event: "代表事件包含 Buffett 資本配置、保險浮存金運用、大型收購與現金部位變化。",
    focus: "玩家應注意保險承保獲利、投資組合表現、現金水位、接班議題與大型併購機會。",
  },
  "2454_TW": {
    name: "聯發科",
    origin: "聯發科從多媒體與手機晶片切入市場，後來成為全球行動 SoC 與通訊晶片的重要供應商。",
    business: "公司核心包含手機晶片、智慧裝置、Wi-Fi、車用與 ASIC，受手機需求與高階晶片競爭影響。",
    event: "代表事件包含手機晶片市占提升、Dimensity 品牌推進、5G 升級與非手機產品線擴張。",
    focus: "玩家應注意手機拉貨、高階晶片滲透、毛利率、庫存循環、AI 終端與中國手機品牌需求。",
  },
  "2317_TW": {
    name: "鴻海",
    origin: "鴻海是全球電子製造服務代表，從代工製造擴張到伺服器、電動車與供應鏈整合。",
    business: "公司核心包含消費電子代工、雲端伺服器、零組件、電動車平台與全球製造服務。",
    event: "代表事件包含 iPhone 供應鏈角色、全球產能布局、AI 伺服器需求與電動車平台策略。",
    focus: "玩家應注意客戶訂單、AI 伺服器出貨、毛利率、匯率、供應鏈轉移與電動車進展。",
  },
  "2303_TW": {
    name: "聯電",
    origin: "聯電是台灣晶圓代工公司，重點多落在成熟製程、特殊製程與穩定產能利用率。",
    business: "公司核心是晶圓代工，服務通訊、消費電子、車用、工控與電源管理等成熟製程需求。",
    event: "代表事件包含晶圓代工分工、成熟製程景氣循環、產能擴張與特殊製程布局。",
    focus: "玩家應注意產能利用率、晶圓報價、成熟製程需求、車用工控訂單與資本支出紀律。",
  },
  "2308_TW": {
    name: "台達電",
    origin: "台達電從電源管理起家，逐步擴張到散熱、工業自動化、資料中心與電動車能源系統。",
    business: "公司核心包含電源供應器、散熱、工業自動化、資料中心電力、電動車零組件與能源解決方案。",
    event: "代表事件包含電源效率升級、資料中心需求、電動車電源系統與節能自動化趨勢。",
    focus: "玩家應注意 AI 資料中心電力需求、電動車訂單、毛利率、匯率與工業自動化景氣。",
  },
  "3711_TW": {
    name: "日月光投控",
    origin: "日月光投控是封裝測試龍頭，位在晶片製造後段，受先進封裝與半導體循環影響。",
    business: "公司核心包含 IC 封裝、測試、電子製造服務與先進封裝，客戶涵蓋邏輯、通訊與消費晶片。",
    event: "代表事件包含封測產業整合、先進封裝需求升溫、SiP 應用擴張與半導體庫存循環。",
    focus: "玩家應注意先進封裝需求、產能利用率、半導體庫存、毛利率與 AI / HPC 後段製程機會。",
  },
  "2382_TW": {
    name: "廣達",
    origin: "廣達從筆電代工建立規模，近年因 AI 伺服器與雲端資料中心需求受到高度關注。",
    business: "公司核心包含筆電、伺服器、雲端資料中心設備、AI 伺服器與企業解決方案。",
    event: "代表事件包含筆電代工擴張、雲端客戶合作、AI 伺服器需求升溫與產品組合轉型。",
    focus: "玩家應注意 AI 伺服器出貨、毛利率、客戶資本支出、零組件供應與筆電需求循環。",
  },
  "2395_TW": {
    name: "研華",
    origin: "研華以工業電腦與嵌入式平台起家，是工業自動化、邊緣運算與 IoT 應用的重要供應商。",
    business: "公司核心包含工業電腦、嵌入式板卡、邊緣運算、智慧製造、交通與醫療場域解決方案。",
    event: "代表事件包含工業電腦普及、IoT 應用擴張、邊緣 AI 需求與工業景氣循環。",
    focus: "玩家應注意工業訂單、區域需求、邊緣 AI 商機、庫存調整與毛利率。",
  },
  "0050_TW": {
    name: "元大台灣50",
    origin: "元大台灣50 是追蹤台灣大型權值股的 ETF，常被視為台股核心部位與大盤代表。",
    business: "ETF 核心是分散持有台灣大型上市公司，報酬主要反映成分股價格、配息與指數權重變化。",
    event: "代表事件包含台灣50指數調整、權值股行情、台股資金流入與電子股景氣循環。",
    focus: "玩家應注意台股大盤趨勢、台積電權重、外資流向、配息、折溢價與成交量。",
  },
  "0056_TW": {
    name: "元大高股息",
    origin: "元大高股息是台灣高股息 ETF 代表之一，適合用來理解收益型 ETF 與成分股輪動。",
    business: "ETF 核心是依規則挑選具股息特性的台股，報酬由配息、成分股價格與換股規則共同影響。",
    event: "代表事件包含高股息策略普及、配息政策調整、成分股換股與收益型資金流入。",
    focus: "玩家應注意配息來源、成分股品質、殖利率、填息能力、折溢價與高股息題材熱度。",
  },
  "006208_TW": {
    name: "富邦台50",
    origin: "富邦台50 是追蹤台灣50指數的 ETF，與台股大型權值行情連動明顯。",
    business: "ETF 核心是持有台灣大型權值股，讓投資人用單一標的參與台股大盤核心表現。",
    event: "代表事件包含指數成分調整、台股權值行情、電子股循環與被動資金流入。",
    focus: "玩家應注意台股大盤、權值股走勢、追蹤誤差、費用率、折溢價與成交量。",
  },
  "00878_TW": {
    name: "國泰永續高股息",
    origin: "國泰永續高股息結合高股息與永續篩選概念，是台灣收益型 ETF 的熱門代表。",
    business: "ETF 核心是依指數規則挑選兼具股息與 ESG 條件的台股，報酬由配息與成分股價格共同影響。",
    event: "代表事件包含高股息 ETF 熱潮、配息制度受關注、成分股調整與收益型資金流入。",
    focus: "玩家應注意配息穩定性、成分股變化、折溢價、填息能力、ESG 篩選與資金流向。",
  },
  "00919_TW": {
    name: "群益台灣精選高息",
    origin: "群益台灣精選高息是台灣高股息 ETF，市場常用它觀察收益型資金與配息題材熱度。",
    business: "ETF 核心是依高息策略挑選台股成分，報酬受配息、成分股輪動與市場對高股息的偏好影響。",
    event: "代表事件包含月配息與高股息 ETF 受關注、成分股換股、除息與填息表現討論。",
    focus: "玩家應注意配息組成、收益平準金、成分股品質、折溢價、填息狀況與資金流入速度。",
  },
  "00929_TW": {
    name: "復華台灣科技優息",
    origin: "復華台灣科技優息把科技股與收益型 ETF 敘事結合，適合觀察科技題材和配息需求的交會。",
    business: "ETF 核心是挑選台灣科技產業中具收益特性的成分股，報酬受科技股行情與配息規則影響。",
    event: "代表事件包含科技型高股息 ETF 熱潮、月配息關注、成分股調整與電子股循環。",
    focus: "玩家應注意科技股景氣、配息來源、成分股集中度、折溢價、填息能力與資金流向。",
  },
  XOM: {
    name: "Exxon Mobil",
    origin: "Exxon Mobil 是全球大型油氣公司，核心來自上游開採、煉化、化工與能源供應鏈。",
    business: "公司核心包含原油與天然氣生產、煉油、化工、低碳技術與全球能源貿易。",
    event: "代表事件包含油價循環、頁岩油發展、煉化利差波動、大型併購與能源轉型投入。",
    focus: "玩家應注意油價、天然氣價格、煉油利差、資本支出、股東回饋與能源政策。",
  },
  CVX: {
    name: "Chevron",
    origin: "Chevron 是大型綜合能源公司，業務涵蓋上游油氣、煉化與全球能源資產配置。",
    business: "公司核心包含油氣開採、煉油、化工、天然氣與低碳能源投資。",
    event: "代表事件包含油價循環、上游資產投資、股東回饋、併購整合與能源轉型策略。",
    focus: "玩家應注意油價、產量、資本支出、自由現金流、股利回購與政策風險。",
  },
  COP: {
    name: "ConocoPhillips",
    origin: "ConocoPhillips 以油氣上游開採為主，股價對原油與天然氣價格變化敏感。",
    business: "公司核心是原油、天然氣與液化天然氣資產，重點在產量、成本與資本配置。",
    event: "代表事件包含頁岩油開發、油價循環、資產併購、產量調整與股東回饋。",
    focus: "玩家應注意油氣價格、產量成長、開採成本、資本支出、自由現金流與回購股利。",
  },
  GLD: {
    name: "SPDR Gold Shares",
    origin: "GLD 是追蹤黃金價格的 ETF，常被市場用來表達避險、通膨與美元利率預期。",
    business: "ETF 核心是持有黃金資產並追蹤金價，報酬主要受實質利率、美元、央行買盤與避險需求影響。",
    event: "代表事件包含通膨升溫、美元轉弱、利率預期變化、地緣風險與央行黃金需求。",
    focus: "玩家應注意實質利率、美元指數、通膨預期、避險情緒、ETF 資金流與金價技術面。",
  },
  SLV: {
    name: "iShares Silver Trust",
    origin: "SLV 是追蹤白銀價格的 ETF，白銀同時具有貴金屬避險與工業需求雙重屬性。",
    business: "ETF 核心是持有白銀並追蹤銀價，報酬受美元、利率、工業需求與貴金屬情緒影響。",
    event: "代表事件包含貴金屬行情、太陽能與工業需求、美元利率變化與投機資金波動。",
    focus: "玩家應注意美元、實質利率、黃金白銀比、工業需求、ETF 資金流與波動風險。",
  },
  BABA: {
    name: "Alibaba",
    origin: "Alibaba 從中國電商平台起家，擴張到雲端、物流、本地生活、國際電商與數位服務。",
    business: "公司核心包含淘天電商、阿里雲、國際電商、菜鳥物流與本地生活服務。",
    event: "代表事件包含電商平台成長、阿里雲擴張、監管壓力、組織拆分與國際電商競爭。",
    focus: "玩家應注意中國消費、平台競爭、雲端成長、監管環境、回購與國際業務表現。",
  },
  PDD: {
    name: "PDD Holdings",
    origin: "PDD 以拼多多的社交電商與低價心智起家，後來透過 Temu 擴張海外電商市場。",
    business: "公司核心包含中國電商平台、廣告與交易服務、Temu 跨境電商與供應鏈效率。",
    event: "代表事件包含拼團低價模式、農產品與下沉市場擴張、Temu 海外成長與補貼競爭。",
    focus: "玩家應注意中國消費、Temu 成長、行銷費用、平台競爭、監管與利潤率變化。",
  },
  JD: {
    name: "JD.com",
    origin: "京東以自營電商與物流能力建立差異化，重點在供應鏈效率與正品心智。",
    business: "公司核心包含自營電商、第三方平台、京東物流、供應鏈服務與零售科技。",
    event: "代表事件包含自建物流、家電 3C 品類優勢、平台低價競爭與物流子公司發展。",
    focus: "玩家應注意中國消費、平台競爭、物流成本、毛利率、補貼策略與家電 3C 需求。",
  },
  BIDU: {
    name: "Baidu",
    origin: "百度從中文搜尋引擎起家，後來延伸到 AI、雲端、自動駕駛與內容服務。",
    business: "公司核心包含搜尋廣告、AI Cloud、文心大模型、自動駕駛 Apollo 與內容生態。",
    event: "代表事件包含搜尋廣告成長、AI 技術投入、Apollo 自動駕駛、生成式 AI 產品推出。",
    focus: "玩家應注意廣告景氣、AI 雲端收入、大模型商業化、自動駕駛落地與中國科技監管。",
  },
  "9988_HK": {
    aliasOf: "BABA",
    name: "Alibaba HK",
  },
  "700_HK": {
    name: "Tencent",
    origin: "騰訊從即時通訊與社群平台起家，成為中國遊戲、社交、支付、廣告與雲服務的重要平台。",
    business: "公司核心包含微信生態、遊戲、廣告、金融科技、雲服務與內容娛樂。",
    event: "代表事件包含微信普及、遊戲業務成長、支付生態擴張、監管調整與視頻號商業化。",
    focus: "玩家應注意遊戲版號與流水、廣告成長、微信生態變現、金融科技監管與雲端競爭。",
  },
};

function buildCuratedEducationKnowledge(profile) {
  if (profile.aliasOf) {
    const source = FEATURED_STOCK_EDUCATION_PROFILES[profile.aliasOf] || EDUCATION_KNOWLEDGE[profile.aliasOf];
    return buildCuratedEducationKnowledge({ ...source, name: profile.name || source?.name });
  }

  const name = profile.name;
  return {
    name,
    origin: profile.origin,
    business: profile.business,
    event: profile.event,
    focus: profile.focus,
    folders: [
      {
        title: "公司起源故事",
        summary: profile.origin,
        details: [
          `${name} 的第一站先看它為什麼會被市場認得，這能幫玩家把股票代碼連回真實公司。`,
          "起源故事不是要背年份，而是理解它最初解決了什麼問題，以及那個問題如何變成現在的投資敘事。",
        ],
      },
      {
        title: "主要產品",
        summary: profile.business,
        details: [
          "這一站會把營收來源、產品服務與客戶族群串起來，避免只用股價顏色判斷公司。",
          "如果產品線越接近市場主題，股價通常越容易被同類題材一起帶動或一起修正。",
        ],
      },
      {
        title: "代表事件",
        summary: profile.event,
        details: [
          "代表事件是市場記憶點，常常會影響投資人之後怎麼解讀財報、新聞和股價反應。",
          "玩家可以把這些事件當成路標，判斷目前的價格波動是在延續舊故事，還是在改寫新故事。",
        ],
      },
      {
        title: "觀察重點",
        summary: profile.focus,
        details: [
          "最後一站把公司故事接回技術面：看價格、量能、RSI、MACD 與均線是否支持同一個方向。",
          "當基本面敘事和技術面不同步時，滑雪地形通常也會更顛簸，這正是需要放慢判讀的地方。",
        ],
      },
    ],
  };
}

function getEducationKnowledge(symbol, quote = {}) {
  const key = normalizeEducationSymbol(symbol);
  const known = EDUCATION_KNOWLEDGE[key];
  if (known) return known;
  const profile = FEATURED_STOCK_EDUCATION_PROFILES[key];
  if (profile) return buildCuratedEducationKnowledge(profile);

  const name = quote.longName || quote.shortName || symbol;
  return {
    name,
    origin: `${name} 的完整背景資料尚未放入本地知識庫，第一版會先用可取得的市場資料與通用公司分析框架帶玩家理解。`,
    business: `${name} 的商業模式可先從產品服務、營收來源、客戶族群與產業位置四個角度閱讀。`,
    event: "這檔股票的代表事件會在後續題庫擴充時補齊，現在先以價格、量能與技術面變化建立學習節點。",
    focus: "玩家應先觀察近期漲跌幅、成交量是否放大、技術指標是否同向，以及市場是否正在重新定價它的成長故事。",
  };
}

function buildFolderFullText(folder) {
  if (folder.fullText) return folder.fullText;
  const details = Array.isArray(folder.details) ? folder.details : [];
  return [folder.summary, ...details].filter(Boolean).join("\n\n");
}

function buildFolderQuizBank(folder, companyName) {
  if (Array.isArray(folder.quizBank) && folder.quizBank.length) return folder.quizBank;
  const details = Array.isArray(folder.details) ? folder.details : [];
  const primaryDetail = details[0] || folder.summary;
  const secondaryDetail = details[1] || folder.summary;
  return [
    {
      question: `讀完「${folder.title}」後，最應該記住 ${companyName} 的哪個重點？`,
      choices: [
        folder.summary,
        "只需要記住今天的股價顏色",
        "這段內容和公司理解沒有關係",
      ],
      answerIndex: 0,
      explanation: folder.summary,
    },
    {
      question: `下列哪個描述最符合「${folder.title}」的故事脈絡？`,
      choices: [
        primaryDetail,
        "公司價值只由單日漲跌決定",
        secondaryDetail,
      ],
      answerIndex: 0,
      explanation: primaryDetail,
    },
  ];
}

function normalizeEducationFolders(knowledge, companyName) {
  const fallbackFolders = [
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
  ];
  return (knowledge.folders || fallbackFolders).map((folder) => ({
    ...folder,
    fullText: buildFolderFullText(folder),
    quizBank: buildFolderQuizBank(folder, companyName),
  }));
}

function buildEducationNodesFromFolders(folders, companyName) {
  return folders.map((folder, index) => {
    const quiz = folder.quizBank?.[0] || buildFolderQuizBank(folder, companyName)[0];
    return {
      title: `第${index + 1}站：${folder.title}`,
      type: index === 0 ? "history" : index === 1 ? "business" : index === 2 ? "volatility" : "technical",
      summary: folder.summary,
      question: quiz.question,
      choices: quiz.choices,
      answerIndex: quiz.answerIndex,
      explanation: quiz.explanation,
      sourceKind: "curated",
    };
  });
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
  const folders = normalizeEducationFolders(knowledge, name);
  const nodes = buildEducationNodesFromFolders(folders, name);

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
      folders,
      learningPoints: [
        "這家公司從哪裡開始，市場為什麼認得它",
        "它主要靠什麼產品或服務賺錢",
        "近期價格震盪可能跟哪些新聞或市場情緒有關",
        "滑雪地形如何對應這段期間的技術面變化",
      ],
    },
    nodes,
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

