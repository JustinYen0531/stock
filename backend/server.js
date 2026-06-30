/**
 * server.js - StockAI Node.js 后端 (ESM)
 * yahoo-finance2 + Express + 技术指标计算
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

// 静态前端
const frontendPath = path.join(__dirname, "..", "frontend");
app.use("/static", express.static(frontendPath));

const HOMEPAGE_THEME_DEFS = [
  {
    id: "china-core",
    icon: "🐉",
    title: "中国核心",
    desc: "先看中国平台、消费、AI 与港股科技主线。",
  },
  {
    id: "us-tech",
    icon: "💻",
    title: "美股科技",
    desc: "用美股科技龙头当海外对照与补充火力。",
  },
  {
    id: "taiwan-core",
    icon: "🇹🇼",
    title: "台湾地区",
    desc: "最后回看台湾地区供应链与核心权值的呼应。",
  },
  {
    id: "ai-chip",
    icon: "🧠",
    title: "AI 芯片",
    desc: "把全球算力、服务器与 GPU 主线串成同一张地图。",
  },
  {
    id: "high-income",
    icon: "💸",
    title: "高股息 / ETF",
    desc: "防守型资金通常会先回到这些标的。",
  },
  {
    id: "future-motion",
    icon: "⚡",
    title: "电动车",
    desc: "高波动题材，最能反映市场情绪起伏。",
  },
];

const HOMEPAGE_RECOMMENDATION_UNIVERSE = [
  { symbol: "BABA", themeIds: ["china-core"] },
  { symbol: "9988.HK", themeIds: ["china-core"] },
  { symbol: "PDD", themeIds: ["china-core"] },
  { symbol: "JD", themeIds: ["china-core"] },
  { symbol: "BIDU", themeIds: ["china-core"] },
  { symbol: "700.HK", themeIds: ["china-core"] },
  { symbol: "NIO", themeIds: ["future-motion", "china-core"] },
  { symbol: "NVDA", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "AMD", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "AVGO", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "MSFT", themeIds: ["ai-chip", "us-tech"] },
  { symbol: "GOOGL", themeIds: ["us-tech"] },
  { symbol: "META", themeIds: ["us-tech"] },
  { symbol: "AMZN", themeIds: ["us-tech"] },
  { symbol: "TSLA", themeIds: ["future-motion", "us-tech"] },
  { symbol: "RIVN", themeIds: ["future-motion"] },
  { symbol: "2330.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "2454.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "2317.TW", themeIds: ["taiwan-core"] },
  { symbol: "2382.TW", themeIds: ["taiwan-core", "ai-chip"] },
  { symbol: "0050.TW", themeIds: ["high-income"] },
  { symbol: "0056.TW", themeIds: ["high-income"] },
  { symbol: "00878.TW", themeIds: ["high-income"] },
  { symbol: "00919.TW", themeIds: ["high-income"] },
];

const HOMEPAGE_RECOMMENDATION_CACHE_MS = 60 * 1000;
const homepageRecommendationCache = {
  timestamp: 0,
  payload: null,
  promise: null,
};

// ═══════════════════════════════════════════════
// 指标计算工具
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
  if (snapshot.changePercent >= 2.2) return `单日走强 ${formatPct(snapshot.changePercent)}`;
  if (snapshot.changePercent <= -2.2) return `波动放大 ${formatPct(snapshot.changePercent)}`;
  if (snapshot.volumePulse >= 1.8) return `量能放大 ${snapshot.volumePulse.toFixed(1)}x`;
  if (snapshot.momentum5d >= 4) return `5 日动能 ${formatPct(snapshot.momentum5d)}`;
  if (snapshot.momentum5d <= -4) return `5 日震荡 ${formatPct(snapshot.momentum5d)}`;
  return `量能 ${snapshot.volumePulse.toFixed(1)}x`;
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
    origin: "NVIDIA 由 Jensen Huang、Chris Malachowsky 与 Curtis Priem 在 1993 年创立，早期以图形处理器切入 PC 游戏与专业视觉市场。",
    business: "公司核心是 GPU、AI 加速器、数据中心平台与软件生态。近年数据中心与 AI 训练需求成为市场解读 NVIDIA 的主轴。",
    event: "代表事件包含 GeForce 游戏 GPU、CUDA 生态、数据中心 GPU，以及 AI 服务器需求推升市场关注。",
    focus: "玩家应注意 AI 需求、数据中心营收、供应链产能与高估值下的波动。",
    folders: [
      {
        title: "公司起源故事",
        summary: "从游戏显示芯片起家，最后变成 AI 算力时代的核心公司。",
        details: [
          "NVIDIA 早期主战场是 PC 3D 图形与游戏 GPU，品牌心智创建在高性能视觉运算。",
          "CUDA 让 GPU 不只服务游戏画面，也能做科学运算、数据处理与 AI 训练。",
          "市场后来重新理解 NVIDIA：它不是单纯卖显卡，而是卖平行运算平台与生态系统。",
        ],
      },
      {
        title: "主要产品",
        summary: "GPU、数据中心加速器、AI 软硬件平台与网络设备。",
        details: [
          "GeForce 面向消费与游戏市场，维持品牌关注度与高端硬件形象。",
          "数据中心 GPU 与 AI 加速器是近年估值叙事的核心，常与云端巨头资本支出连动。",
          "CUDA、AI Enterprise、Networking 等软硬整合能力，使客户转换成本变高。",
        ],
      },
      {
        title: "代表事件",
        summary: "GeForce、CUDA、数据中心 GPU、生成式 AI 浪潮。",
        details: [
          "GeForce 让 NVIDIA 在游戏玩家与高性能图形市场获取长期识别度。",
          "CUDA 生态扩大 GPU 用途，是后来 AI 训练需求爆发的重要基础。",
          "生成式 AI 带动数据中心 GPU 需求，让市场把 NVIDIA 视为 AI 基础设施代表股。",
        ],
      },
      {
        title: "观察重点",
        summary: "AI 需求、数据中心营收、供应链产能与高估值下的波动。",
        details: [
          "如果云端公司持续增加 AI 资本支出，市场通常会提高对 NVIDIA 的增长预期。",
          "供应链产能、先进封装与交货能力，会影响营收是否跟得上市场期待。",
          "估值很高时，任何需求放缓或毛利率疑虑都可能放大股价震荡。",
        ],
      },
    ],
  },
  TSLA: {
    name: "Tesla",
    origin: "Tesla 成立于 2003 年，后来由 Elon Musk 带入更大规模的资金、产品与品牌叙事，让电动车从小众科技品变成大众市场焦点。",
    business: "公司核心包含电动车、电池、储能、充电网络与自动驾驶软件。市场常同时用车厂与科技平台两种角度看它。",
    event: "代表事件包含 Model S、Model 3 放量、全球超级充电网络、价格战与自动驾驶功能迭代。",
    focus: "玩家应注意交车量、毛利率、降价策略、自动驾驶进展与市场对增长叙事的信心。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Tesla 把电动车从科技理想推向大众市场，也把车厂估值叙事改写成平台故事。",
        details: [
          "Tesla 最早不是传统车厂，而是用高性能电动车证明电动车可以有速度、设计与品牌魅力。",
          "Elon Musk 加入后，Tesla 的叙事从单一车款扩大到能源、软件、自动驾驶与制造效率。",
          "市场常把 Tesla 同时看成车厂、能源公司与科技平台，这也是它估值波动很大的原因。",
        ],
      },
      {
        title: "主要产品",
        summary: "电动车、电池、储能、充电网络与自动驾驶软件。",
        details: [
          "Model 3 / Model Y 是放量核心，交车量与毛利率通常直接影响市场情绪。",
          "Supercharger 充电网络强化用户粘性，也让 Tesla 拥有基础设施层面的优势。",
          "FSD 与软件收入代表市场对未来平台化的期待，但也伴随监管与落地不确定性。",
        ],
      },
      {
        title: "代表事件",
        summary: "Model 3 量产、全球建厂、价格战、自动驾驶功能迭代。",
        details: [
          "Model 3 量产是 Tesla 从高端品牌走向大众市场的关键转折。",
          "上海、柏林、德州等工厂让 Tesla 从概念型公司变成全球制造公司。",
          "降价策略常被市场双重解读：一方面刺激需求，另一方面可能压缩毛利率。",
        ],
      },
      {
        title: "观察重点",
        summary: "交车量、毛利率、价格策略、自动驾驶进度与市场信心。",
        details: [
          "交车量如果低于预期，市场会怀疑需求；如果毛利率下滑，市场会怀疑价格战代价。",
          "自动驾驶与机器人题材会拉高想像空间，但短期股价仍常被车辆销售数据牵动。",
          "Tesla 波动大，是因为它同时承载基本面、科技叙事与领导人风险。",
        ],
      },
    ],
  },
  AAPL: {
    name: "Apple",
    origin: "Apple 由 Steve Jobs、Steve Wozniak 与 Ronald Wayne 在 1976 年创立，从个人电脑开始，逐步塑造出硬件、软件与服务整合的消费科技品牌。",
    business: "公司核心是 iPhone、Mac、iPad、Wearables 与 Services。市场看 Apple 时，通常同时看硬件销售周期、用户粘性与服务收入。",
    event: "代表事件包含 Macintosh、iPod、iPhone、App Store、Apple Watch，以及近年的服务收入与空间运算产品。",
    focus: "玩家应注意 iPhone 需求、服务毛利、供应链、地区销售与新产品能否打开下一段增长。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Apple 从个人电脑起家，真正的核心是把科技做成大众愿意使用、愿意付费的体验。",
        details: [
          "早期 Apple 以 Apple II 与 Macintosh 创建个人电脑品牌，强调图形界面与用户体验。",
          "Steve Jobs 回归后，Apple 重新聚焦产品线，并用 iMac、iPod、iPhone 改写消费电子市场。",
          "Apple 的长期优势不是单一硬件，而是硬件、操作系统、芯片、服务与品牌信任的整合。",
        ],
      },
      {
        title: "主要产品",
        summary: "iPhone 是核心，Services 与可穿戴设备让生态系统更厚。",
        details: [
          "iPhone 仍是营收与市场注意力中心，换机周期会影响投资人对增长的看法。",
          "Services 包含 App Store、iCloud、Apple Music、Apple Pay 等，毛利结构通常优于硬件。",
          "Mac、iPad、Apple Watch、AirPods 扩大使用场景，让用户更难离开 Apple 生态系统。",
        ],
      },
      {
        title: "代表事件",
        summary: "iPhone 发布、App Store、生态系统扩张、自研芯片。",
        details: [
          "2007 年 iPhone 发布是 Apple 从电脑公司转型成移动平台公司的关键。",
          "App Store 把硬件销售延伸成软件分发与服务抽成模式。",
          "Apple Silicon 让 Mac 产品线在性能、续航与供应链控制上更有差异化。",
        ],
      },
      {
        title: "观察重点",
        summary: "iPhone 需求、服务增长、毛利率、供应链与新产品周期。",
        details: [
          "如果 iPhone 销售疲弱，市场会担心硬件换机周期；如果 Services 强，则能部分抵销硬件波动。",
          "Apple 的股价常受中国市场、供应链政策与高端机型需求影响。",
          "新产品如 Vision Pro 或 AI 功能，重点不是声量，而是能否变成可持续的生态收入。",
        ],
      },
    ],
  },
  MSFT: {
    name: "Microsoft",
    origin: "Microsoft 由 Bill Gates 与 Paul Allen 在 1975 年创立，从个人电脑软件出发，逐步成为企业软件、云端与 AI 平台公司。",
    business: "公司核心包含 Windows、Office/Microsoft 365、Azure、企业软件、LinkedIn、Xbox 与 AI 服务。市场常把它视为企业数字化与云端 AI 的代表。",
    event: "代表事件包含 MS-DOS、Windows、Office、Azure 云端转型、收购 LinkedIn 与 Activision Blizzard，以及 Copilot AI 产品化。",
    focus: "玩家应注意 Azure 增长率、企业软件续约、AI Copilot 商业化、资本支出与云端竞争。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Microsoft 从 PC 软件标准创建霸主地位，后来靠云端转型重新增长。",
        details: [
          "Microsoft 早期靠操作系统与开发工具进入个人电脑浪潮，Windows 成为长期平台核心。",
          "Office 把文书、简报、试算表变成企业日常工作标准，形成很强的续约与习惯黏着。",
          "Satya Nadella 时代的云端转型，让 Microsoft 从授权软件公司变成订阅与云端平台公司。",
        ],
      },
      {
        title: "主要产品",
        summary: "Windows、Microsoft 365、Azure、Teams、Copilot 与企业云服务。",
        details: [
          "Microsoft 365 以订阅模式服务企业与个人，收入稳定且可持续升级。",
          "Azure 是云端增长核心，常被市场拿来和 AWS、Google Cloud 比较。",
          "Copilot 把 AI 嵌进 Office、Windows、GitHub 与企业流程，是 AI 商业化主轴。",
        ],
      },
      {
        title: "代表事件",
        summary: "Windows 普及、Office 标准化、Azure 转型、AI Copilot 推进。",
        details: [
          "Windows 与 Office 的普及，让 Microsoft 长期掌握企业端入口。",
          "Azure 成功转型后，市场重新给 Microsoft 增长型平台公司的评价。",
          "OpenAI 合作与 Copilot 产品线，让 Microsoft 成为 AI 应用落地的重要代表。",
        ],
      },
      {
        title: "观察重点",
        summary: "Azure 增长、AI 变现、企业预算、资本支出与毛利率。",
        details: [
          "Azure 增长率如果放缓，市场会重新检查云端需求与竞争压力。",
          "AI Copilot 的重点是付费采用率，而不只是产品发布数量。",
          "AI 基础设施需要大量资本支出，投资人会看收入增量是否能支撑支出。",
        ],
      },
    ],
  },
  "2330_TW": {
    name: "台积电",
    origin: "台积电成立于 1987 年，是晶圆代工模式的代表公司，让芯片设计公司可以不自建晶圆厂也能量产先进芯片。",
    business: "公司核心是先进制程、晶圆代工、封装与全球半导体客户服务。市场通常把它视为 AI、手机、HPC 与全球科技供应链的核心节点。",
    event: "代表事件包含纯晶圆代工模式、先进制程领先、海外设厂，以及 AI/HPC 需求带动高端制程产能。",
    focus: "玩家应注意先进制程需求、资本支出、汇率、地缘政治与大客户订单变化。",
    folders: [
      {
        title: "公司起源故事",
        summary: "台积电把晶圆代工变成全球半导体分工的关键模式。",
        details: [
          "台积电成立时主打纯晶圆代工，让芯片设计公司不必自己建厂也能生产芯片。",
          "这个模式降低了无晶圆厂设计公司的门槛，也让全球半导体产业分工更细。",
          "市场看台积电，不只看单一公司，也是在看全球科技供应链的核心节点。",
        ],
      },
      {
        title: "主要产品",
        summary: "先进制程、成熟制程、晶圆代工与先进封装。",
        details: [
          "先进制程常用于高性能运算、AI、手机芯片与高端处理器。",
          "成熟制程服务车载、工控、消费电子等长尾需求，让营收结构更分散。",
          "先进封装在 AI/HPC 时代变得更重要，因为高端芯片需要更复杂的整合能力。",
        ],
      },
      {
        title: "代表事件",
        summary: "晶圆代工模式、先进制程领先、海外设厂、AI/HPC 需求。",
        details: [
          "纯晶圆代工模式让台积电避免与客户在芯片设计上直接竞争，创建信任基础。",
          "先进制程节点的领先，是市场给予台积电高评价的重要原因。",
          "AI/HPC 需求推升高端制程与先进封装的重要性，使台积电成为 AI 供应链核心。",
        ],
      },
      {
        title: "观察重点",
        summary: "先进制程需求、资本支出、汇率、海外设厂与地缘政治。",
        details: [
          "如果 AI 与高性能运算需求延续，先进制程产能利用率通常会受到正面关注。",
          "资本支出代表公司对未来需求的判断，也会影响折旧与自由现金流。",
          "台积电同时受全球客户需求、汇率与地缘政治影响，所以股价常反映多重风险。",
        ],
      },
    ],
  },
};

const FEATURED_STOCK_EDUCATION_PROFILES = {
  AMD: {
    name: "AMD",
    origin: "AMD 从 CPU 与图形芯片竞争切入市场，近年靠 Ryzen、EPYC 与 AI 加速器重新获取高性能运算的关注度。",
    business: "公司核心包含 PC 处理器、数据中心 CPU、GPU、嵌入式芯片与 AI 加速器，市场会把它放在半导体景气与 AI 服务器供应链一起看。",
    event: "代表事件包含 Ryzen 翻身、EPYC 进入数据中心、收购 Xilinx 扩大嵌入式布局，以及 AI 加速器产品线推进。",
    focus: "玩家应注意数据中心增长、AI 芯片出货、PC 需求循环、毛利率与和 NVIDIA、Intel 的竞争节奏。",
  },
  GOOGL: {
    name: "Alphabet",
    origin: "Alphabet 的核心来自 Google 搜索与广告平台，后来把云端、YouTube、Android 与 AI 研发纳入同一个大型科技生态。",
    business: "公司主要收入来自搜索广告、YouTube、Google Cloud、Android 生态与订阅服务，AI 能力会影响广告效率与云端竞争。",
    event: "代表事件包含 Google 搜索普及、Android 生态扩张、YouTube 增长、Google Cloud 追赶，以及 Gemini 等 AI 产品推进。",
    focus: "玩家应注意广告景气、搜索流量、云端增长率、AI 投入成本、监管风险与市场对 AI 搜索变化的反应。",
  },
  META: {
    name: "Meta",
    origin: "Meta 从 Facebook 社交平台起家，逐步扩张到 Instagram、WhatsApp、广告系统、短音视频与沉浸式运算布局。",
    business: "公司核心是社交流量与广告变现，Reels、AI 推荐系统、Messaging 与 Reality Labs 会影响增长叙事。",
    event: "代表事件包含 Facebook 全球化、Instagram 收购、广告机器学习系统升级、元宇宙投入与 AI 推荐效率改善。",
    focus: "玩家应注意广告需求、用户停留时间、AI 推荐带来的变现效率、Reality Labs 支出与隐私监管。",
  },
  AMZN: {
    name: "Amazon",
    origin: "Amazon 从线上书店起家，后来成为电商、云端基础设施、物流与会员生态的综合平台。",
    business: "公司核心包含电商 marketplace、Prime 会员、广告、物流服务与 AWS，市场常同时看零售效率与云端增长。",
    event: "代表事件包含 Marketplace 扩张、Prime 会员制、AWS 成为云端龙头、物流网络扩建与广告业务放大。",
    focus: "玩家应注意 AWS 增长率、零售毛利、广告收入、物流成本、消费景气与 AI 基础设施投资。",
  },
  NFLX: {
    name: "Netflix",
    origin: "Netflix 从 DVD 租借转型流媒体平台，再用原创内容与全球订阅制创建音视频娱乐品牌。",
    business: "公司核心是流媒体订阅、内容投资、广告方案与全球会员增长，市场会用会员数、ARPU 与内容效率评价它。",
    event: "代表事件包含流媒体转型、原创剧集成功、全球化扩张、打击共享账号与广告订阅方案推出。",
    focus: "玩家应注意会员增长、内容成本、广告方案渗透率、竞争平台压力与自由现金流。",
  },
  CRM: {
    name: "Salesforce",
    origin: "Salesforce 以云端 CRM 起家，把企业销售、客服、行销与数据流程搬到订阅式平台。",
    business: "公司核心是 CRM 软件、Data Cloud、Slack、行销自动化与 AI 助理服务，收入受企业软件预算影响。",
    event: "代表事件包含 SaaS CRM 普及、AppExchange 生态、收购 Tableau 与 Slack，以及 Einstein AI 功能扩张。",
    focus: "玩家应注意订阅续约率、企业 IT 预算、AI 功能变现、营业利益率与大型客户采用速度。",
  },
  ORCL: {
    name: "Oracle",
    origin: "Oracle 从数据库软件创建企业级地位，后来延伸到云端基础设施、ERP 与产业应用。",
    business: "公司核心包含数据库、云端基础设施 OCI、企业应用、Java 与产业解决方案，市场关注云端转型速度。",
    event: "代表事件包含关联式数据库普及、企业应用扩张、云端基础设施加速与大型 AI 训练客户需求。",
    focus: "玩家应注意 OCI 增长率、数据库续约、云端资本支出、AI 运算需求与企业软件竞争。",
  },
  QCOM: {
    name: "Qualcomm",
    origin: "Qualcomm 以无线通信技术与移动芯片创建地位，长期受手机周期与通信标准升级影响。",
    business: "公司核心包含 Snapdragon 移动平台、通信专利授权、车载芯片、IoT 与边缘 AI 芯片。",
    event: "代表事件包含 CDMA 技术商业化、4G/5G 标准推进、Snapdragon 品牌创建与车载芯片布局。",
    focus: "玩家应注意智能手机需求、授权收入、车载设计案、AI PC / 边缘 AI 进展与中国手机品牌备货。",
  },
  INTC: {
    name: "Intel",
    origin: "Intel 是 x86 处理器与 PC 时代的重要代表，近年同时面对制程追赶、数据中心竞争与晶圆代工转型。",
    business: "公司核心包含 PC CPU、服务器处理器、晶圆制造、代工服务、加速器与网络芯片。",
    event: "代表事件包含 x86 架构普及、数据中心 CPU 扩张、制程延迟压力与 IDM 2.0 代工策略。",
    focus: "玩家应注意制程节点进度、代工客户、PC 循环、数据中心市场份额、资本支出与补助政策。",
  },
  AVGO: {
    name: "Broadcom",
    origin: "Broadcom 由通信芯片与基础设施半导体创建市场地位，后来透过并购扩大到企业软件。",
    business: "公司核心包含网络芯片、交换器 ASIC、无线射频、存储连接、基础设施软件与大型企业客户。",
    event: "代表事件包含多次半导体并购、网络交换芯片需求、AI 丛集网络升级与 VMware 并购。",
    focus: "玩家应注意 AI 网络需求、企业软件整合、毛利率、客户集中度与数据中心资本支出。",
  },
  MU: {
    name: "Micron",
    origin: "Micron 是存储器与存储芯片公司，股价常跟 DRAM / NAND 景气循环一起起伏。",
    business: "公司核心包含 DRAM、NAND、数据中心存储器、移动与车载存储，AI 服务器会带动高频宽存储器需求。",
    event: "代表事件包含存储器景气循环、NAND 供需调整、HBM 需求升温与数据中心产品比重提高。",
    focus: "玩家应注意存储器报价、库存水位、HBM 出货、资本支出纪律与终端需求复苏。",
  },
  AMAT: {
    name: "Applied Materials",
    origin: "Applied Materials 是半导体设备龙头之一，提供晶圆制造过程需要的材料工程与制程设备。",
    business: "公司核心是薄膜沉积、蚀刻、量测、显示与服务，市场会把它视为晶圆厂资本支出的温度计。",
    event: "代表事件包含先进制程投资、存储器扩产循环、半导体设备需求波动与先进封装设备机会。",
    focus: "玩家应注意晶圆厂资本支出、先进制程投资、出口管制、存储器循环与服务收入稳定性。",
  },
  LRCX: {
    name: "Lam Research",
    origin: "Lam Research 是半导体设备公司，特别与蚀刻、沉积和存储器制程投资密切相关。",
    business: "公司核心提供晶圆制程设备与服务，客户多为逻辑与存储器芯片制造商。",
    event: "代表事件包含存储器景气循环、先进制程设备需求、先进封装与高深宽比制程挑战。",
    focus: "玩家应注意晶圆厂扩产、存储器资本支出、设备出货节奏、出口限制与毛利率。",
  },
  RIVN: {
    name: "Rivian",
    origin: "Rivian 是美国电动车新创，品牌心智偏向电动皮卡、休旅与户外生活场景。",
    business: "公司核心是电动车生产、商用电动货车、软件服务与制造效率改善，仍处于放量与降本阶段。",
    event: "代表事件包含 R1T / R1S 推出、商用货车合作、产能爬坡与新平台成本控制。",
    focus: "玩家应注意交车量、现金消耗、单车毛利、产能利用率、新车型时程与融资压力。",
  },
  LCID: {
    name: "Lucid",
    origin: "Lucid 主打高端电动车与长续航技术，品牌定位更接近豪华性能电动车。",
    business: "公司核心是高端电动车销售、电池与动力系统技术，营运重点在需求、产能与成本控制。",
    event: "代表事件包含 Lucid Air 推出、豪华电动车定位、产量调整与资金需求讨论。",
    focus: "玩家应注意交车量、现金水位、毛利率、价格策略、豪华车需求与中东资金支持。",
  },
  NIO: {
    name: "NIO",
    origin: "蔚来是中国电动车品牌，以高端车型、用户社区与换电服务创建差异化。",
    business: "公司核心包含电动车销售、换电站、车主服务、软件功能与中国高端新能源车市场。",
    event: "代表事件包含量产车推出、换电网络扩张、子品牌布局与中国新能源车价格竞争。",
    focus: "玩家应注意交付量、毛利率、换电站成本、现金流、中国车市竞争与政策环境。",
  },
  ENPH: {
    name: "Enphase Energy",
    origin: "Enphase 以太阳能微型逆变器创建品牌，受住宅太阳能需求与利率环境影响明显。",
    business: "公司核心包含微型逆变器、储能电池、能源管理软件与住宅太阳能系统。",
    event: "代表事件包含微型逆变器普及、住宅太阳能增长、库存调整与利率变化拖累需求。",
    focus: "玩家应注意住宅太阳能安装量、渠道库存、利率、欧洲与美国需求、储能产品增长。",
  },
  PLUG: {
    name: "Plug Power",
    origin: "Plug Power 聚焦氢能与燃料电池，题材想像大，但营运常受成本、资金与商业化速度检验。",
    business: "公司核心包含燃料电池系统、氢气供应、电解槽与物流用能源解决方案。",
    event: "代表事件包含燃料电池叉车应用、绿氢工厂规画、补助政策期待与资金需求压力。",
    focus: "玩家应注意现金流、氢气成本、毛利率、政策补助、订单落地与产能建置速度。",
  },
  JPM: {
    name: "JPMorgan Chase",
    origin: "JPMorgan Chase 是大型综合金融机构，业务横跨消费金融、商业银行、投资银行与资产管理。",
    business: "公司核心包含存放款、信用卡、投资银行、交易业务、财富管理与机构金融服务。",
    event: "代表事件包含金融危机后整合、利率循环影响净利息收入、并购承销周期与银行监管变化。",
    focus: "玩家应注意利率路径、存款成本、信用风险、投行景气、资本规范与坯帐提列。",
  },
  BAC: {
    name: "Bank of America",
    origin: "Bank of America 是美国大型银行，消费金融与存款基础让它对利率循环很敏感。",
    business: "公司核心包含零售银行、信用卡、商业贷款、财富管理与投资银行服务。",
    event: "代表事件包含金融危机后重整、利率上升带动净利息收入、存款竞争与债券投资组合波动。",
    focus: "玩家应注意净利息收入、存款流失、信用品质、未实现损益、消费贷款与监管资本。",
  },
  GS: {
    name: "Goldman Sachs",
    origin: "Goldman Sachs 是投资银行与资本市场代表，收入更受交易、承销与并购活动影响。",
    business: "公司核心包含投资银行、交易业务、资产管理、财富管理与机构客户服务。",
    event: "代表事件包含 IPO / 并购周期、交易收入波动、消费金融收缩与资产管理转型。",
    focus: "玩家应注意资本市场热度、并购与承销案量、交易收入、费用控管与资产管理流入。",
  },
  V: {
    name: "Visa",
    origin: "Visa 是全球支付网络公司，核心价值在于交易清算网络、品牌信任与跨境支付规模。",
    business: "公司核心收入来自支付交易量、数据处理、跨境交易与增值服务，不直接承担大部分信用风险。",
    event: "代表事件包含电子支付普及、跨境旅游恢复、无现金化趋势与金融科技竞争。",
    focus: "玩家应注意消费支出、跨境交易、汇率、监管费率、金融科技竞争与交易量增长。",
  },
  MA: {
    name: "Mastercard",
    origin: "Mastercard 是全球支付网络公司，与 Visa 类似受电子支付、跨境消费与交易量增长带动。",
    business: "公司核心包含支付处理、跨境交易、数据服务、资安与金融机构合作方案。",
    event: "代表事件包含无现金支付扩张、旅游复苏、数字钱包合作与实时支付竞争。",
    focus: "玩家应注意全球消费、跨境交易、监管费率、商户接受度、增值服务增长与竞争压力。",
  },
  BRK_B: {
    name: "Berkshire Hathaway",
    origin: "Berkshire Hathaway 是 Warren Buffett 长期经营的控股公司，核心特色是保险浮存金与多元资本配置。",
    business: "公司核心包含保险、铁路、能源、公用事业、制造零售与大型上市股票投资组合。",
    event: "代表事件包含 Buffett 资本配置、保险浮存金运用、大型收购与现金部位变化。",
    focus: "玩家应注意保险承保获利、投资组合表现、现金水位、接班议题与大型并购机会。",
  },
  "2454_TW": {
    name: "联发科",
    origin: "联发科从多媒体与手机芯片切入市场，后来成为全球移动 SoC 与通信芯片的重要供应商。",
    business: "公司核心包含手机芯片、智能设备、Wi-Fi、车载与 ASIC，受手机需求与高端芯片竞争影响。",
    event: "代表事件包含手机芯片市场份额提升、Dimensity 品牌推进、5G 升级与非手机产品线扩张。",
    focus: "玩家应注意手机备货、高端芯片渗透、毛利率、库存循环、AI 终端与中国手机品牌需求。",
  },
  "2317_TW": {
    name: "鸿海",
    origin: "鸿海是全球电子制造服务代表，从代工制造扩张到服务器、电动车与供应链整合。",
    business: "公司核心包含消费电子代工、云端服务器、零组件、电动车平台与全球制造服务。",
    event: "代表事件包含 iPhone 供应链角色、全球产能布局、AI 服务器需求与电动车平台策略。",
    focus: "玩家应注意客户订单、AI 服务器出货、毛利率、汇率、供应链转移与电动车进展。",
  },
  "2303_TW": {
    name: "联电",
    origin: "联电是台湾晶圆代工公司，重点多落在成熟制程、特殊制程与稳定产能利用率。",
    business: "公司核心是晶圆代工，服务通信、消费电子、车载、工控与电源管理等成熟制程需求。",
    event: "代表事件包含晶圆代工分工、成熟制程景气循环、产能扩张与特殊制程布局。",
    focus: "玩家应注意产能利用率、晶圆报价、成熟制程需求、车载工控订单与资本支出纪律。",
  },
  "2308_TW": {
    name: "台达电",
    origin: "台达电从电源管理起家，逐步扩张到散热、工业自动化、数据中心与电动车能源系统。",
    business: "公司核心包含电源供应器、散热、工业自动化、数据中心电力、电动车零组件与能源解决方案。",
    event: "代表事件包含电源效率升级、数据中心需求、电动车电源系统与节能自动化趋势。",
    focus: "玩家应注意 AI 数据中心电力需求、电动车订单、毛利率、汇率与工业自动化景气。",
  },
  "3711_TW": {
    name: "日月光投控",
    origin: "日月光投控是封装测试龙头，位在芯片制造后段，受先进封装与半导体循环影响。",
    business: "公司核心包含 IC 封装、测试、电子制造服务与先进封装，客户涵盖逻辑、通信与消费芯片。",
    event: "代表事件包含封测产业整合、先进封装需求升温、SiP 应用扩张与半导体库存循环。",
    focus: "玩家应注意先进封装需求、产能利用率、半导体库存、毛利率与 AI / HPC 后段制程机会。",
  },
  "2382_TW": {
    name: "广达",
    origin: "广达从笔记本电脑代工创建规模，近年因 AI 服务器与云端数据中心需求受到高度关注。",
    business: "公司核心包含笔记本电脑、服务器、云端数据中心设备、AI 服务器与企业解决方案。",
    event: "代表事件包含笔记本电脑代工扩张、云端客户合作、AI 服务器需求升温与产品组合转型。",
    focus: "玩家应注意 AI 服务器出货、毛利率、客户资本支出、零组件供应与笔记本电脑需求循环。",
  },
  "2395_TW": {
    name: "研华",
    origin: "研华以工业电脑与嵌入式平台起家，是工业自动化、边缘运算与 IoT 应用的重要供应商。",
    business: "公司核心包含工业电脑、嵌入式板卡、边缘运算、智能制造、交通与医疗场域解决方案。",
    event: "代表事件包含工业电脑普及、IoT 应用扩张、边缘 AI 需求与工业景气循环。",
    focus: "玩家应注意工业订单、区域需求、边缘 AI 商机、库存调整与毛利率。",
  },
  "0050_TW": {
    name: "元大台湾50",
    origin: "元大台湾50 是追踪台湾大型权值股的 ETF，常被视为台股核心部位与大盘代表。",
    business: "ETF 核心是分散持有台湾大型上市公司，报酬主要反映成分股价格、配息与指数权重变化。",
    event: "代表事件包含台湾50指数调整、权值股行情、台股资金流入与电子股景气循环。",
    focus: "玩家应注意台股大盘趋势、台积电权重、外资流向、配息、折溢价与成交量。",
  },
  "0056_TW": {
    name: "元大高股息",
    origin: "元大高股息是台湾高股息 ETF 代表之一，适合用来理解收益型 ETF 与成分股轮动。",
    business: "ETF 核心是依规则挑选具股息特性的台股，报酬由配息、成分股价格与换股规则共同影响。",
    event: "代表事件包含高股息策略普及、配息政策调整、成分股换股与收益型资金流入。",
    focus: "玩家应注意配息来源、成分股品质、殖利率、填息能力、折溢价与高股息题材热度。",
  },
  "006208_TW": {
    name: "富邦台50",
    origin: "富邦台50 是追踪台湾50指数的 ETF，与台股大型权值行情连动明显。",
    business: "ETF 核心是持有台湾大型权值股，让投资人用单一标的参与台股大盘核心表现。",
    event: "代表事件包含指数成分调整、台股权值行情、电子股循环与被动资金流入。",
    focus: "玩家应注意台股大盘、权值股走势、追踪误差、费用率、折溢价与成交量。",
  },
  "00878_TW": {
    name: "国泰永续高股息",
    origin: "国泰永续高股息结合高股息与永续筛选概念，是台湾收益型 ETF 的热门代表。",
    business: "ETF 核心是依指数规则挑选兼具股息与 ESG 条件的台股，报酬由配息与成分股价格共同影响。",
    event: "代表事件包含高股息 ETF 热潮、配息制度受关注、成分股调整与收益型资金流入。",
    focus: "玩家应注意配息稳定性、成分股变化、折溢价、填息能力、ESG 筛选与资金流向。",
  },
  "00919_TW": {
    name: "群益台湾精选高息",
    origin: "群益台湾精选高息是台湾高股息 ETF，市场常用它观察收益型资金与配息题材热度。",
    business: "ETF 核心是依高息策略挑选台股成分，报酬受配息、成分股轮动与市场对高股息的偏好影响。",
    event: "代表事件包含月配息与高股息 ETF 受关注、成分股换股、除息与填息表现讨论。",
    focus: "玩家应注意配息组成、收益平准金、成分股品质、折溢价、填息状况与资金流入速度。",
  },
  "00929_TW": {
    name: "复华台湾科技优息",
    origin: "复华台湾科技优息把科技股与收益型 ETF 叙事结合，适合观察科技题材和配息需求的交会。",
    business: "ETF 核心是挑选台湾科技产业中具收益特性的成分股，报酬受科技股行情与配息规则影响。",
    event: "代表事件包含科技型高股息 ETF 热潮、月配息关注、成分股调整与电子股循环。",
    focus: "玩家应注意科技股景气、配息来源、成分股集中度、折溢价、填息能力与资金流向。",
  },
  XOM: {
    name: "Exxon Mobil",
    origin: "Exxon Mobil 是全球大型油气公司，核心来自上游开采、炼化、化工与能源供应链。",
    business: "公司核心包含原油与天然气生产、炼油、化工、低碳技术与全球能源贸易。",
    event: "代表事件包含油价循环、页岩油发展、炼化利差波动、大型并购与能源转型投入。",
    focus: "玩家应注意油价、天然气价格、炼油利差、资本支出、股东回馈与能源政策。",
  },
  CVX: {
    name: "Chevron",
    origin: "Chevron 是大型综合能源公司，业务涵盖上游油气、炼化与全球能源资产配置。",
    business: "公司核心包含油气开采、炼油、化工、天然气与低碳能源投资。",
    event: "代表事件包含油价循环、上游资产投资、股东回馈、并购整合与能源转型策略。",
    focus: "玩家应注意油价、产量、资本支出、自由现金流、股利回购与政策风险。",
  },
  COP: {
    name: "ConocoPhillips",
    origin: "ConocoPhillips 以油气上游开采为主，股价对原油与天然气价格变化敏感。",
    business: "公司核心是原油、天然气与液化天然气资产，重点在产量、成本与资本配置。",
    event: "代表事件包含页岩油开发、油价循环、资产并购、产量调整与股东回馈。",
    focus: "玩家应注意油气价格、产量增长、开采成本、资本支出、自由现金流与回购股利。",
  },
  GLD: {
    name: "SPDR Gold Shares",
    origin: "GLD 是追踪黄金价格的 ETF，常被市场用来表达避险、通膨与美元利率预期。",
    business: "ETF 核心是持有黄金资产并追踪金价，报酬主要受实质利率、美元、央行买盘与避险需求影响。",
    event: "代表事件包含通膨升温、美元转弱、利率预期变化、地缘风险与央行黄金需求。",
    focus: "玩家应注意实质利率、美元指数、通膨预期、避险情绪、ETF 资金流与金价技术面。",
  },
  SLV: {
    name: "iShares Silver Trust",
    origin: "SLV 是追踪白银价格的 ETF，白银同时具有贵金属避险与工业需求双重属性。",
    business: "ETF 核心是持有白银并追踪银价，报酬受美元、利率、工业需求与贵金属情绪影响。",
    event: "代表事件包含贵金属行情、太阳能与工业需求、美元利率变化与投机资金波动。",
    focus: "玩家应注意美元、实质利率、黄金白银比、工业需求、ETF 资金流与波动风险。",
  },
  BABA: {
    name: "Alibaba",
    origin: "Alibaba 从中国电商平台起家，扩张到云端、物流、本地生活、国际电商与数字服务。",
    business: "公司核心包含淘天电商、阿里云、国际电商、菜鸟物流与本地生活服务。",
    event: "代表事件包含电商平台增长、阿里云扩张、监管压力、组织拆分与国际电商竞争。",
    focus: "玩家应注意中国消费、平台竞争、云端增长、监管环境、回购与国际业务表现。",
  },
  PDD: {
    name: "PDD Holdings",
    origin: "PDD 以拼多多的社交电商与低价心智起家，后来透过 Temu 扩张海外电商市场。",
    business: "公司核心包含中国电商平台、广告与交易服务、Temu 跨境电商与供应链效率。",
    event: "代表事件包含拼团低价模式、农产品与下沉市场扩张、Temu 海外增长与补贴竞争。",
    focus: "玩家应注意中国消费、Temu 增长、行销费用、平台竞争、监管与利润率变化。",
  },
  JD: {
    name: "JD.com",
    origin: "京东以自营电商与物流能力创建差异化，重点在供应链效率与正品心智。",
    business: "公司核心包含自营电商、第三方平台、京东物流、供应链服务与零售科技。",
    event: "代表事件包含自建物流、家电 3C 品类优势、平台低价竞争与物流子公司发展。",
    focus: "玩家应注意中国消费、平台竞争、物流成本、毛利率、补贴策略与家电 3C 需求。",
  },
  BIDU: {
    name: "Baidu",
    origin: "百度从中文搜索引擎起家，后来延伸到 AI、云端、自动驾驶与内容服务。",
    business: "公司核心包含搜索广告、AI Cloud、文心大模型、自动驾驶 Apollo 与内容生态。",
    event: "代表事件包含搜索广告增长、AI 技术投入、Apollo 自动驾驶、生成式 AI 产品推出。",
    focus: "玩家应注意广告景气、AI 云端收入、大模型商业化、自动驾驶落地与中国科技监管。",
  },
  "9988_HK": {
    aliasOf: "BABA",
    name: "Alibaba HK",
  },
  "700_HK": {
    name: "Tencent",
    origin: "腾讯从实时通信与社交平台起家，成为中国游戏、社交、支付、广告与云服务的重要平台。",
    business: "公司核心包含微信生态、游戏、广告、金融科技、云服务与内容娱乐。",
    event: "代表事件包含微信普及、游戏业务增长、支付生态扩张、监管调整与视频号商业化。",
    focus: "玩家应注意游戏版号与流水、广告增长、微信生态变现、金融科技监管与云端竞争。",
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
          `${name} 的第一站先看它为什么会被市场认得，这能帮玩家把股票代码连回真实公司。`,
          "起源故事不是要背年份，而是理解它最初解决了什么问题，以及那个问题如何变成现在的投资叙事。",
        ],
      },
      {
        title: "主要产品",
        summary: profile.business,
        details: [
          "这一站会把营收来源、产品服务与客户族群串起来，避免只用股价颜色判断公司。",
          "如果产品线越接近市场主题，股价通常越容易被同类题材一起带动或一起修正。",
        ],
      },
      {
        title: "代表事件",
        summary: profile.event,
        details: [
          "代表事件是市场记忆点，常常会影响投资人之后怎么解读财报、新闻和股价反应。",
          "玩家可以把这些事件当成路标，判断目前的价格波动是在延续旧故事，还是在改写新故事。",
        ],
      },
      {
        title: "观察重点",
        summary: profile.focus,
        details: [
          "最后一站把公司故事接回技术面：看价格、量能、RSI、MACD 与均线是否支持同一个方向。",
          "当基本面叙事和技术面不同步时，滑雪地形通常也会更颠簸，这正是需要放慢判读的地方。",
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
    origin: `${name} 的完整背景数据尚未放入本地知识库，第一版会先用可获取的市场数据与通用公司分析框架带玩家理解。`,
    business: `${name} 的商业模式可先从产品服务、营收来源、客户族群与产业位置四个角度阅读。`,
    event: "这只股票的代表事件会在后续题库扩充时补齐，现在先以价格、量能与技术面变化创建学习节点。",
    focus: "玩家应先观察近期涨跌幅、成交量是否放大、技术指标是否同向，以及市场是否正在重新定价它的增长故事。",
  };
}

function buildFolderFullText(folder) {
  if (folder.fullText) return folder.fullText;
  const details = Array.isArray(folder.details) ? folder.details : [];
  return [folder.summary, ...details].filter(Boolean).join("\n\n");
}

function buildFolderQuizBank(folder, companyName, explicitQuiz) {
  if (Array.isArray(folder.quizBank) && folder.quizBank.length) return folder.quizBank;
  if (explicitQuiz) {
    return [{
      question: explicitQuiz.q,
      choices: explicitQuiz.choices,
      answerIndex: explicitQuiz.a,
      explanation: explicitQuiz.explain,
    }];
  }
  const details = Array.isArray(folder.details) ? folder.details : [];
  const primaryDetail = details[0] || folder.summary;
  return [
    {
      question: `读完「${folder.title}」后，最应该记住 ${companyName} 的哪个重点？`,
      choices: [
        folder.summary,
        "先把单日涨跌当成主因，再用故事回头解释价格",
        "只看市场热门关键字，暂时不检查产品、客户或产业位置",
        "把技术指标当成唯一答案，等到结果出来再补公司脉络",
      ],
      answerIndex: 0,
      explanation: folder.summary,
    },
    {
      question: `下列哪个描述最符合「${folder.title}」的故事脉络？`,
      choices: [
        primaryDetail,
        "这段内容比较像短线进出提示，不需要连回公司的长期叙事",
        "只要题材热度还在，就可以先忽略营收来源与竞争变化",
        "价格图形已经包含所有信息，所以不用再看事件与产品脉络",
      ],
      answerIndex: 0,
      explanation: primaryDetail,
    },
  ];
}

// EDUCATION_QUIZ_BANK：每支股票 4 题，依序对应「公司起源故事／主要产品／代表事件／观察重点」
// 四个学习站点。题目要求是可验证的具体事实（产品、数字、事件、商业模式），
// 不是「你有没有读完」这种空泛的自我感觉题。
const EDUCATION_QUIZ_BANK = {
  NVDA: [
    {
      q: "NVIDIA 在 1993 年创立时，最早切入的市场是什么？",
      choices: ["个人电脑游戏与专业视觉用的图形处理器（GPU）", "智能手机芯片", "云端服务器 CPU", "汽车自动驾驶芯片"],
      a: 0,
      explain: "NVIDIA 早期以 GPU 切入 PC 游戏与专业视觉市场，这是后来发展出 CUDA 与 AI 运算平台的基础。",
    },
    {
      q: "NVIDIA 的 CUDA 平台主要的作用是什么？",
      choices: ["让 GPU 除了渲染画面外，也能做平行运算与 AI 训练等通用计算", "一种用来玩游戏的画面特效滤镜", "NVIDIA 自家的操作系统", "专门用于挖矿的加密货币协议"],
      a: 0,
      explain: "CUDA 让 GPU 从单纯的绘图加速器，变成可用于科学运算、数据处理与 AI 训练的通用平行运算平台，是 NVIDIA 转型成 AI 基础设施公司的关键。",
    },
    {
      q: "近几年市场重新调高对 NVIDIA 估值预期，最主要的驱动因素是什么？",
      choices: ["生成式 AI 浪潮带动云端厂商大举采购资料中心 GPU／AI 加速器", "NVIDIA 推出了新款游戏主机", "NVIDIA 并购了一家手机品牌", "NVIDIA 转型成为银行"],
      a: 0,
      explain: "生成式 AI 的训练与推论需求，让云端巨头大举扩张资料中心 GPU 采购，是 NVIDIA 近年营收与估值重新定价的核心叙事。",
    },
    {
      q: "关注 NVIDIA 基本面时，下列哪一组最贴近实际会影响营收与毛利的关键变量？",
      choices: ["云端厂商资本支出、资料中心 GPU 需求、先进封装与产能", "当月手机出货量", "黄金与白银的价格", "全球航空业载客率"],
      a: 0,
      explain: "NVIDIA 的营收高度集中在资料中心 GPU／AI 加速器，云端资本支出与供应链产能是观察重点，与消费性电子或大宗商品关联性低。",
    },
  ],
  TSLA: [
    {
      q: "下列关于 Tesla 历史的叙述，哪一个正确？",
      choices: ["Tesla 成立于 2003 年，Elon Musk 后来以投资人身份加入并主导公司方向，而非公司最初的创始人", "Tesla 是由 Elon Musk 在车库独立创立的", "Tesla 原本是一家传统燃油车厂，后来才转型做电动车", "Tesla 最早的产品是太阳能板，后来才开始做车"],
      a: 0,
      explain: "Tesla 成立于 2003 年，Elon Musk 是后来加入并主导公司方向与融资的关键人物，而非公司最初创始人，这是一个常见的认知误区。",
    },
    {
      q: "除了电动车销售外，下列哪一项也是 Tesla 长期被关注的业务线？",
      choices: ["Supercharger 充电网络与 FSD 自动驾驶软件订阅", "智能手机制造", "传统燃油引擎研发", "航空客运服务"],
      a: 0,
      explain: "Tesla 除了整车销售，Supercharger 充电网络强化生态黏着度，FSD 等软件订阅收入则代表市场对其平台化转型的期待。",
    },
    {
      q: "Model 3 量产对 Tesla 公司发展的关键意义是什么？",
      choices: ["让 Tesla 从高端小众品牌，走向大众市场放量阶段", "是 Tesla 第一款电动车", "让 Tesla 第一次开始获利", "让 Tesla 转型成为 SUV 专门厂"],
      a: 0,
      explain: "在 Model 3 之前，Tesla 的 Roadster 与 Model S/X 定位偏高端小众；Model 3 量产是 Tesla 真正进入大众市场放量阶段的关键转折。",
    },
    {
      q: "分析 Tesla 营运表现时，下列哪一组指标最直接反映其核心车辆业务的健康度？",
      choices: ["交车量与单车毛利率", "黄金价格走势", "美国十年期公债殖利率", "原油库存周报"],
      a: 0,
      explain: "交车量代表需求与产能爬坡，单车毛利率反映降价策略与成本控制的拉扯，是 Tesla 车辆业务最核心的两个观察指标。",
    },
  ],
  AAPL: [
    {
      q: "Apple 公司由哪三人在 1976 年共同创立？",
      choices: ["Steve Jobs、Steve Wozniak、Ronald Wayne", "Steve Jobs、Bill Gates、Tim Cook", "Steve Wozniak、Elon Musk、Larry Page", "Tim Cook、Jony Ive、Steve Jobs"],
      a: 0,
      explain: "Apple 由 Steve Jobs、Steve Wozniak 与 Ronald Wayne 在 1976 年共同创立，最早以 Apple II 等个人电脑打开市场。",
    },
    {
      q: "下列关于 Apple Services 业务的叙述，哪一个正确？",
      choices: ["包含 App Store、iCloud、Apple Music 等，毛利率通常优于硬件销售", "Services 业务专指 Apple 的售后维修服务，营收占比极低", "Services 的毛利率比 iPhone 硬件低很多", "Services 只包含 Apple Pay，与 App Store 无关"],
      a: 0,
      explain: "Apple Services 涵盖 App Store 抽成、iCloud、Apple Music、Apple Pay 等订阅与生态服务，毛利结构通常优于硬件，是市场关注的成长动能之一。",
    },
    {
      q: "2007 年 iPhone 发表对 Apple 公司转型的意义是什么？",
      choices: ["让 Apple 从个人电脑公司转型成行动平台公司", "是 Apple 第一款搭载触控屏幕的产品", "让 Apple 首次进入消费电子市场", "标志着 Apple 退出个人电脑市场"],
      a: 0,
      explain: "2007 年 iPhone 发表是 Apple 从电脑公司转型为行动平台公司的关键转折，后续 App Store 更把硬件销售延伸成软件生态收入。",
    },
    {
      q: "分析 Apple 营运表现时，下列哪一组最贴近市场实际关注的核心变量？",
      choices: ["iPhone 换机周期、Services 成长率、中国市场销售", "黄金期货价格", "全球小麦产量", "美国住房开工率"],
      a: 0,
      explain: "iPhone 仍是 Apple 营收主力，换机周期影响硬件成长；Services 成长率代表生态变现能力；中国市场则是销售与供应链的重要变量。",
    },
  ],
  MSFT: [
    {
      q: "Microsoft 由 Bill Gates 与谁在 1975 年共同创立？",
      choices: ["Paul Allen", "Steve Ballmer", "Satya Nadella", "Paul Otellini"],
      a: 0,
      explain: "Microsoft 由 Bill Gates 与 Paul Allen 在 1975 年共同创立，最早以个人电脑软件与开发工具切入市场。",
    },
    {
      q: "Azure 在 Microsoft 近年营收叙事中扮演什么角色？",
      choices: ["云端运算平台，是 Microsoft 从授权软件公司转型为订阅云端平台公司的成长核心", "Microsoft 的游戏主机品牌", "Microsoft 内部专用的财务系统，不对外销售", "一款消费级智能手机"],
      a: 0,
      explain: "Azure 是 Microsoft 的云端运算平台，常与 AWS、Google Cloud 相比较，是 Satya Nadella 任内云端转型故事的核心。",
    },
    {
      q: "Microsoft 与 OpenAI 的合作，以及 Copilot 产品线，主要代表什么趋势？",
      choices: ["把生成式 AI 能力嵌入 Office、Windows、GitHub 等产品，是 AI 应用落地与商业化的重要案例", "Microsoft 借此转型成为芯片制造商", "Microsoft 借此退出云端市场，专注做软件授权", "Microsoft 借此并购了 OpenAI 成为子公司"],
      a: 0,
      explain: "Microsoft 与 OpenAI 合作并把 AI 能力透过 Copilot 产品线嵌入既有软件生态，市场关注的是 AI 付费采用率而非单纯产品发表数量。",
    },
    {
      q: "分析 Microsoft 营运表现时，下列哪一组最贴近实际会影响营收与利润率的关键变量？",
      choices: ["Azure 云端成长率、企业软件订阅续约率、AI 资本支出与变现", "全球原油价格", "美国非农就业数据", "比特币价格走势"],
      a: 0,
      explain: "Azure 成长率反映云端竞争力，企业订阅续约率反映黏着度，AI 相关资本支出能否换来收入增量，是市场评估 Microsoft 的核心变量。",
    },
  ],
  "2330_TW": [
    {
      q: "台积电成立时所采用的「纯晶圆代工」商业模式，最大的特点是什么？",
      choices: ["专注帮其他设计公司制造芯片，自己不从事芯片设计，避免与客户竞争", "台积电既设计芯片也自己卖成品手机", "台积电只生产 memory 存储芯片", "台积电主要业务是封装测试，不做晶圆制造"],
      a: 0,
      explain: "台积电开创纯晶圆代工模式，专注制造、不涉入芯片设计，让无晶圆厂（Fabless）设计公司可以安心把订单交给台积电，不必担心技术外流或竞争。",
    },
    {
      q: "下列关于台积电产品组合的叙述，哪一个正确？",
      choices: ["先进制程多用于 AI、HPC 与高阶手机芯片，成熟制程则服务车用、工控等长尾需求", "台积电只生产单一种制程节点的芯片", "台积电的客户主要是消费者个人，而非芯片设计公司", "台积电不提供先进封装服务"],
      a: 0,
      explain: "台积电的产品组合涵盖先进制程（用于 AI／HPC／高阶手机）到成熟制程（车用、工控等），先进封装在 AI／HPC 时代也越来越关键。",
    },
    {
      q: "近年市场对台积电估值与营收预期的最主要驱动来自什么趋势？",
      choices: ["AI／HPC 需求带动先进制程与先进封装产能利用率提升", "台积电转型卖手机品牌", "台积电退出先进制程竞赛", "台积电主要营收来自零售业务"],
      a: 0,
      explain: "AI／HPC 需求推升对高阶制程与先进封装的需求，使台积电成为 AI 供应链中的核心节点，是近年股价叙事的主要驱动力。",
    },
    {
      q: "分析台积电营运表现时，下列哪一组最贴近实际会影响营收与利润率的关键变量？",
      choices: ["先进制程产能利用率、资本支出计划、地缘政治与海外设厂进度", "全球航运运费指数", "美国房屋销售数据", "黄金 ETF 资金流向"],
      a: 0,
      explain: "先进制程产能利用率反映需求强弱，资本支出代表对未来需求的判断，地缘政治与海外设厂（如美国、日本）则牵动长期成本结构与客户信心。",
    },
  ],
  BABA: [
    {
      q: "阿里巴巴最早是以什么业务模式打开市场？",
      choices: ["帮助中小企业进行 B2B 电子商务对接的平台", "智能手机制造商", "云端服务器代工厂", "短视频社交平台"],
      a: 0,
      explain: "阿里巴巴最早以 B2B 电商平台起家，帮助中小企业进行国际贸易对接，后来才扩张到淘宝／天猫等电商，以及云端、物流等业务。",
    },
    {
      q: "下列哪一组业务最准确描述阿里巴巴目前的核心版图？",
      choices: ["淘天电商、阿里云、菜鸟物流与国际电商", "阿里巴巴只经营搜索引擎广告业务", "阿里巴巴主要业务是手机硬件制造", "阿里巴巴专注于短视频内容创作"],
      a: 0,
      explain: "阿里巴巴的核心版图包含淘天电商（淘宝+天猫）、阿里云、菜鸟物流、国际电商与本地生活服务等。",
    },
    {
      q: "近年阿里巴巴在公司治理上做了什么重大调整？",
      choices: ["进行组织拆分，将不同业务群组拆分为相对独立的事业群", "把所有业务合并成单一事业部", "退出中国市场", "转型成为纯软件授权公司"],
      a: 0,
      explain: "阿里巴巴近年推动组织拆分，将电商、云端等业务拆分为相对独立的事业群，目的是提升各业务的经营弹性与透明度。",
    },
    {
      q: "分析阿里巴巴营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["中国消费复苏力道、平台竞争格局、阿里云成长与股票回购力度", "美国非农就业数据", "全球航运运费指数", "黄金价格走势"],
      a: 0,
      explain: "中国消费力道直接影响电商 GMV，平台竞争（如拼多多、抖音电商）影响市占，阿里云成长代表第二曲线，回购则反映公司对现金运用的态度。",
    },
  ],
  PDD: [
    {
      q: "拼多多最早是靠什么商业模式在中国电商市场打开差异化？",
      choices: ["「拼团」社交裂变低价模式，主打下沉市场与农产品", "高端奢侈品垂直电商", "B2B 工业品采购平台", "二手商品拍卖平台"],
      a: 0,
      explain: "拼多多以社交裂变的「拼团」低价模式切入，早期聚焦农产品与下沉市场，与淘宝／京东形成差异化定位。",
    },
    {
      q: "PDD Holdings 旗下除了中国市场的拼多多，还有哪个重要的跨境电商平台？",
      choices: ["Temu", "Shopee", "Lazada", "Wish"],
      a: 0,
      explain: "Temu 是 PDD Holdings 推出的跨境电商平台，主打海外市场低价商品，是近年带动公司海外营收成长的重要业务线。",
    },
    {
      q: "Temu 在海外市场的扩张策略，市场最常关注的风险与机会点是什么？",
      choices: ["高额行销补贴换取用户成长，但也压缩短期利润率", "Temu 完全不做任何行销，靠口碑自然成长", "Temu 只在中国境内销售，不涉及跨境业务", "Temu 主要销售奢侈品"],
      a: 0,
      explain: "Temu 透过高额行销与补贴快速获取海外用户，市场关注的是这种打法能否转化为长期黏着度，以及对公司整体利润率的压缩程度。",
    },
    {
      q: "分析 PDD Holdings 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["中国消费力道、Temu 海外成长与补贴力度、平台竞争与监管环境", "全球原油库存", "美国十年期公债殖利率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "中国消费影响拼多多本地业务，Temu 补贴力度牵动海外成长速度与利润率，平台竞争与监管环境则是中国电商股共通的风险变量。",
    },
  ],
  JD: [
    {
      q: "京东相较于淘宝／天猫，最早建立差异化的核心能力是什么？",
      choices: ["自营电商搭配自建物流，强调正品与配送速度", "纯第三方平台模式，自己不卖货也不做物流", "专注于二手商品交易", "只做线下实体零售，不做电商"],
      a: 0,
      explain: "京东以自营电商搭配自建物流（京东物流）建立差异化，强调正品保证与配送速度，与阿里巴巴的平台模式形成对比。",
    },
    {
      q: "下列关于京东业务结构的叙述，哪一个正确？",
      choices: ["家电 3C 是传统优势品类，京东物流是独立对外服务的子公司", "京东只销售生鲜食品，不涉及 3C 家电", "京东物流只服务京东自己，不对外接单", "京东完全没有第三方平台业务"],
      a: 0,
      explain: "京东的家电 3C 品类长期是优势领域，京东物流也已发展成独立对外接单的物流子公司，同时也保留第三方平台业务作为补充。",
    },
    {
      q: "近年京东在电商市场面临的主要竞争压力，最主要来自什么？",
      choices: ["拼多多与抖音电商等低价／内容电商带来的价格与流量竞争", "京东退出了中国市场", "京东转型为纯线下零售商", "京东被禁止销售 3C 家电产品"],
      a: 0,
      explain: "拼多多的低价模式与抖音等内容电商的崛起，对京东的流量与价格竞争力构成压力，是京东近年策略调整的重要背景。",
    },
    {
      q: "分析京东营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["中国消费力道、物流成本控制、平台竞争与家电 3C 需求", "全球半导体库存周期", "美国房屋开工率", "国际油价走势"],
      a: 0,
      explain: "中国消费力道直接影响 GMV，物流成本控制影响毛利率，平台竞争（尤其低价电商）与家电 3C 需求则是京东核心品类的观察重点。",
    },
  ],
  BIDU: [
    {
      q: "百度最早是靠什么业务在中国市场建立领先地位？",
      choices: ["中文搜索引擎", "短视频社交平台", "电动车制造", "跨境电商平台"],
      a: 0,
      explain: "百度以中文搜索引擎起家，凭借搜索广告业务建立早期的市场领先地位，后续才延伸到 AI、云端、自动驾驶等领域。",
    },
    {
      q: "下列哪一项是百度近年在生成式 AI 领域的代表性产品？",
      choices: ["文心一言（文心大模型）", "ChatGPT", "Gemini", "Llama"],
      a: 0,
      explain: "文心一言是百度自主研发的生成式 AI 大模型产品，是百度近年 AI 转型叙事的核心代表作之一。",
    },
    {
      q: "百度在自动驾驶领域的代表性业务／品牌是什么？",
      choices: ["Apollo 自动驾驶平台", "Waymo", "Cruise", "FSD"],
      a: 0,
      explain: "Apollo 是百度自动驾驶相关业务的代表品牌，包含自动驾驶技术研发与 Robotaxi 等商业化尝试（Waymo、Cruise、FSD 分别属于 Alphabet、GM、Tesla）。",
    },
    {
      q: "分析百度营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["搜索广告景气、AI 云端收入与大模型商业化进度、自动驾驶落地速度", "全球航运运价", "美国零售销售数据", "黄金期货价格"],
      a: 0,
      explain: "搜索广告仍是百度核心现金流来源，AI 云端与大模型商业化代表新成长曲线，自动驾驶（Apollo）落地速度则牵动长期想象空间。",
    },
  ],
  NIO: [
    {
      q: "蔚来在中国电动车市场最早建立差异化的核心策略是什么？",
      choices: ["高端车型定位，搭配车主社群经营与换电服务", "主打全球最低价电动车，靠低价走量", "只生产电动巴士，不做乘用车", "完全不做任何售后服务"],
      a: 0,
      explain: "蔚来以高端车型定位切入市场，搭配独特的车主社群经营与换电站服务，与走量品牌形成差异化。",
    },
    {
      q: "蔚来的「换电」服务模式，与一般电动车「充电」相比的主要特点是什么？",
      choices: ["车主可在换电站直接更换已充满电的电池组，省去等待充电的时间", "换电站只能为蔚来以外的品牌车辆服务", "换电是免费且无限次使用的服务，不计入营运成本", "换电技术与电池无关，只是软件升级"],
      a: 0,
      explain: "换电模式让车主能在数分钟内更换满电电池组，省去传统充电等待时间，但换电站的建设与营运成本也是蔚来财务上的重要负担。",
    },
    {
      q: "近年中国新能源车市场的价格竞争，对蔚来这类高端品牌带来什么压力？",
      choices: ["价格战压力可能迫使蔚来在维持高端定位与争取市占之间做取舍", "价格战让蔚来完全不受影响，因为蔚来不参与中国市场", "价格战只影响燃油车，与电动车品牌无关", "蔚来因为价格战反而大幅提高了售价"],
      a: 0,
      explain: "中国新能源车市场的价格竞争激烈，对蔚来这类高端定位、且仍在追求规模与现金流平衡的品牌而言，构成明显的策略与财务压力。",
    },
    {
      q: "分析蔚来营运表现时，下列哪一组最贴近实际影响公司前景的关键变量？",
      choices: ["交付量、毛利率、换电站建置成本与现金流状况", "全球原油库存周报", "美国十年期公债殖利率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "交付量代表市场需求，毛利率反映价格战下的获利能力，换电站建置是重要的资本支出项目，现金流状况则决定公司能否持续扩张。",
    },
  ],
  "700_HK": [
    {
      q: "腾讯最早是靠什么产品在中国市场建立用户基础？",
      choices: ["QQ 即时通讯软件", "微信支付", "王者荣耀手机游戏", "腾讯云服务器"],
      a: 0,
      explain: "腾讯最早以 QQ 即时通讯软件建立庞大的用户基础，后续才发展出微信、游戏、广告、金融科技与云服务等多元业务。",
    },
    {
      q: "下列哪一组业务最准确描述腾讯目前的核心版图？",
      choices: ["微信生态、游戏、广告、金融科技（微信支付）与云服务", "腾讯只经营搜索引擎业务", "腾讯主要业务是智能手机制造", "腾讯专注于电动车生产"],
      a: 0,
      explain: "腾讯的核心版图涵盖微信／QQ 社交生态、游戏（如王者荣耀）、广告、金融科技（微信支付）与云服务等多元业务。",
    },
    {
      q: "微信视频号近年对腾讯的商业化策略有什么意义？",
      choices: ["透过短视频内容与广告变现，成为腾讯广告业务新的成长来源", "视频号是腾讯用来取代 QQ 的全新独立产品", "视频号只对企业开放，个人用户无法使用", "视频号完全不涉及广告变现"],
      a: 0,
      explain: "微信视频号让腾讯在既有社交生态基础上拓展短视频内容与广告变现空间，是近年广告业务成长的重要来源之一。",
    },
    {
      q: "分析腾讯营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["游戏版号与流水表现、广告成长、微信生态变现效率与监管环境", "全球航空业载客率", "美国房屋开工率", "国际原油价格"],
      a: 0,
      explain: "游戏版号与流水直接影响游戏业务营收，广告成长反映微信／视频号变现效率，监管环境（如游戏版号审批）则是中国互联网股共通的重要变量。",
    },
  ],
  GOOGL: [
    {
      q: "Alphabet（Google）的核心营收来源最早是靠什么业务建立起来的？",
      choices: ["搜索引擎的关键字广告业务", "云端服务器代工", "智能手机硬件销售", "短视频内容订阅"],
      a: 0,
      explain: "Google 以搜索引擎起家，核心获利模式是关键字搜索广告，后续才扩张到 YouTube、Android、云端等业务。",
    },
    {
      q: "下列哪一组业务最准确描述 Alphabet 目前的核心版图？",
      choices: ["搜索广告、YouTube、Google Cloud 与 Android 生态", "Alphabet 只经营智能手机硬件制造", "Alphabet 主要业务是电动车整车销售", "Alphabet 专注于线下零售门市"],
      a: 0,
      explain: "Alphabet 的核心版图包含搜索广告、YouTube、Google Cloud 云端业务与 Android 生态系，AI（如 Gemini）则影响这些业务的效率与竞争力。",
    },
    {
      q: "Gemini 等 AI 产品对 Alphabet 的搜索广告业务带来什么样的市场讨论？",
      choices: ["AI 生成式搜索答案可能改变用户搜索行为，市场关注其对既有广告模式的影响", "Gemini 与搜索广告业务完全无关", "Gemini 让 Alphabet 退出了广告市场", "Gemini 只用于内部员工培训，不对外开放"],
      a: 0,
      explain: "生成式 AI 搜索体验（如 AI Overview）可能改变用户与搜索结果互动的方式，市场关心这会如何影响传统搜索广告的点击与变现模式。",
    },
    {
      q: "分析 Alphabet 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["广告景气与搜索流量、Google Cloud 成长率、AI 投入成本与监管风险", "全球航运运费指数", "美国房屋开工率", "黄金期货价格"],
      a: 0,
      explain: "广告景气直接影响核心营收，Google Cloud 成长率代表第二曲线，AI 投入成本牵动资本支出与利润率，反垄断等监管风险也是长期变量。",
    },
  ],
  META: [
    {
      q: "Meta（旧称 Facebook）最早是以什么产品建立用户基础？",
      choices: ["Facebook 社群网络平台", "Instagram 图片分享 App", "WhatsApp 即时通讯软件", "Oculus 虚拟现实头盔"],
      a: 0,
      explain: "公司最早以 Facebook 社群平台起家，后续才透过收购或自建方式扩张到 Instagram、WhatsApp 与 Reality Labs 等业务。",
    },
    {
      q: "Meta 目前最主要的营收来源是什么？",
      choices: ["社群与 Instagram 平台上的广告变现", "硬件设备（VR 头盔）的销售收入", "向用户收取的会员订阅费", "电商平台的商品交易抽成"],
      a: 0,
      explain: "Meta 的营收主要来自 Facebook 与 Instagram 等平台的广告业务，Reality Labs（VR/AR 硬件）目前仍是长期投入、尚未成为主要营收来源的业务线。",
    },
    {
      q: "下列哪一项最准确描述 Reels 与 AI 推荐系统对 Meta 近年营运的意义？",
      choices: ["透过提升内容推荐与广告投放效率，改善广告主投资回报率（ROI）", "Reels 与 AI 推荐系统跟广告业务完全无关", "Reels 是 Meta 用来取代 Facebook 的全新独立公司", "AI 推荐系统只用于过滤垃圾讯息，不涉及内容推荐"],
      a: 0,
      explain: "Reels 短影音与 AI 推荐系统的改善，能提升用户停留时间与广告精准投放效率，是近年 Meta 广告变现效率提升的重要因素。",
    },
    {
      q: "分析 Meta 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["广告需求景气、用户使用时长与 AI 推荐效率、Reality Labs 支出与隐私监管", "全球小麦产量", "美国十年期公债殖利率", "国际油价走势"],
      a: 0,
      explain: "广告需求景气直接影响核心营收，AI 推荐效率影响广告变现效率，Reality Labs 长期投入是利润率的压力来源，隐私监管则牵动广告精准度。",
    },
  ],
  AMZN: [
    {
      q: "Amazon 最早是以什么业务起家？",
      choices: ["线上书店", "云端运算服务（AWS）", "实体连锁超市", "智能音箱硬件"],
      a: 0,
      explain: "Amazon 由 Jeff Bezos 创立时最早是经营线上书店，后续才逐步扩张成综合电商、物流、会员服务与云端基础设施（AWS）平台。",
    },
    {
      q: "下列关于 AWS 在 Amazon 业务结构中角色的叙述，哪一个正确？",
      choices: ["AWS 是云端运算业务，毛利率通常高于零售电商业务，是公司获利的重要支柱", "AWS 是 Amazon 的实体仓储物流子公司，与云端运算无关", "AWS 只服务 Amazon 自己的电商网站，不对外销售云端服务", "AWS 是 Amazon 旗下的智能家居硬件品牌"],
      a: 0,
      explain: "AWS 是 Amazon 的云端运算平台，对外销售运算、存储等基础设施服务，其毛利率结构通常优于零售电商业务，是公司获利的重要支柱。",
    },
    {
      q: "Prime 会员制度对 Amazon 商业模式的意义是什么？",
      choices: ["透过订阅会员绑定用户，提升购物频率与平台黏着度", "Prime 只是单纯的影音串流服务，与电商购物无关", "Prime 会员制度已经被 Amazon 取消", "Prime 只服务企业客户，个人用户无法加入"],
      a: 0,
      explain: "Prime 会员制度透过免运、快速到货、影音内容等权益绑定用户，提升购物频率与平台黏着度，是 Amazon 零售业务的核心策略之一。",
    },
    {
      q: "分析 Amazon 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["AWS 成长率、零售毛利率、广告收入与物流成本", "全球航空业载客率", "黄金与白银价格走势", "美国非农就业数据"],
      a: 0,
      explain: "AWS 成长率代表云端业务动能，零售毛利率反映电商效率，广告收入是近年新增的高毛利业务，物流成本则直接影响整体获利能力。",
    },
  ],
  NFLX: [
    {
      q: "Netflix 最早是以什么业务模式起家？",
      choices: ["DVD 邮寄租借服务", "线上串流影音平台", "电影院线经营", "有线电视频道代理"],
      a: 0,
      explain: "Netflix 最早以 DVD 邮寄租借服务起家，后来才转型为线上串流平台，并进一步投入原创内容制作。",
    },
    {
      q: "Netflix 转型投入原创内容（如自制剧集）的主要策略目的是什么？",
      choices: ["降低对外部片商授权内容的依赖，建立差异化内容与品牌黏着度", "原创内容只是为了获得电影奖项，与订阅增长无关", "原创内容完全外包给其他串流平台制作", "Netflix 从未投入原创内容制作"],
      a: 0,
      explain: "Netflix 投入原创内容是为了降低对授权内容（成本可能上涨或被收回）的依赖，并透过独家内容建立差异化与用户黏着度。",
    },
    {
      q: "Netflix 近年推出的广告订阅方案与打击共享账号措施，主要目的是什么？",
      choices: ["开拓广告营收来源，并把共享账号的实际使用者转化为付费会员，提升整体营收与会员数", "这些措施会导致 Netflix 完全停止营运广告业务", "打击共享账号是为了减少平台总用户数，与营收无关", "广告订阅方案只在中国市场推出"],
      a: 0,
      explain: "广告订阅方案为 Netflix 开拓了新的广告营收来源，打击账号共享则是把原本「蹭看」的使用者转化为付费用户，两者都是近年会员增长与营收成长的重要策略。",
    },
    {
      q: "分析 Netflix 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["付费会员成长、每会员平均营收（ARPU）、内容投资成本与竞争平台压力", "全球原油库存周报", "美国房屋开工率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "付费会员成长与 ARPU 直接决定营收规模，内容投资成本是最大的支出项目之一，Disney+、Amazon Prime Video 等竞争平台压力也牵动用户增长与定价策略。",
    },
  ],
  AMD: [
    {
      q: "AMD 长期以来在处理器市场最主要的竞争对手是谁？",
      choices: ["Intel（CPU）与 NVIDIA（GPU）", "Tesla", "Netflix", "JPMorgan"],
      a: 0,
      explain: "AMD 长期在 CPU 市场与 Intel 竞争，在 GPU／AI 加速器市场则与 NVIDIA 竞争，是半导体行业最具代表性的竞争关系之一。",
    },
    {
      q: "下列哪一项是 AMD 近年透过收购扩大布局的领域？",
      choices: ["收购 Xilinx，扩大 FPGA 与嵌入式芯片布局", "收购一家汽车制造商，跨足整车生产", "收购一家银行，跨足金融服务", "收购一家航空公司，跨足客运业务"],
      a: 0,
      explain: "AMD 收购 Xilinx 是为了扩大在 FPGA（可编程逻辑芯片）与嵌入式系统领域的布局，强化数据中心与多元终端市场的产品组合。",
    },
    {
      q: "Ryzen 与 EPYC 产品线分别代表 AMD 在哪些市场的布局？",
      choices: ["Ryzen 主攻消费级 PC 处理器，EPYC 主攻资料中心服务器处理器", "Ryzen 与 EPYC 都只用于游戏主机", "Ryzen 是 GPU 产品线，EPYC 是 CPU 产品线", "Ryzen 与 EPYC 都是 AMD 的 AI 加速器品牌"],
      a: 0,
      explain: "Ryzen 是 AMD 面向消费级 PC 市场的处理器品牌，EPYC 则是面向资料中心服务器市场的处理器品牌，两者分别是 AMD 翻身的关键产品线。",
    },
    {
      q: "分析 AMD 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["资料中心成长、AI 芯片出货、PC 需求循环与毛利率", "全球航运运费指数", "美国房屋销售数据", "黄金期货价格"],
      a: 0,
      explain: "资料中心与 AI 芯片出货代表 AMD 在高成长市场的份额变化，PC 需求循环影响传统业务，毛利率则反映产品组合与竞争定价压力。",
    },
  ],
  CRM: [
    {
      q: "Salesforce 最早是以什么产品类型打开市场？",
      choices: ["以云端订阅模式提供的客户关系管理（CRM）软件", "实体伺服器硬件设备", "智能手机操作系统", "电动车车载系统"],
      a: 0,
      explain: "Salesforce 是云端 CRM（客户关系管理）软件的早期代表公司，把传统需要自建机房安装的企业软件，改成以订阅制透过云端提供。",
    },
    {
      q: "下列哪一项是 Salesforce 透过收购扩大产品线的代表案例？",
      choices: ["收购 Slack，扩大企业沟通协作工具的布局", "收购一家航空公司，跨足客运业务", "收购一家银行，跨足金融服务", "收购一家电动车厂，跨足整车制造"],
      a: 0,
      explain: "Salesforce 收购 Slack 是为了扩大企业内部沟通与协作工具的布局，强化与既有 CRM、Data Cloud 等产品的整合。",
    },
    {
      q: "Einstein 是 Salesforce 旗下哪一类产品的品牌名称？",
      choices: ["内嵌在 CRM 等产品中的 AI 助理／AI 功能", "Salesforce 自制的智能手机品牌", "Salesforce 的云端服务器硬件品牌", "Salesforce 的电动车充电网络品牌"],
      a: 0,
      explain: "Einstein 是 Salesforce 把 AI 能力嵌入 CRM、Data Cloud 等产品的品牌名称，代表公司将生成式 AI 商业化的策略方向。",
    },
    {
      q: "分析 Salesforce 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["订阅续约率、企业 IT 预算、AI 功能变现与营业利益率", "全球原油库存周报", "黄金与白银价格走势", "美国房屋开工率"],
      a: 0,
      explain: "订阅续约率反映客户黏着度，企业 IT 预算影响新客户拓展速度，AI 功能能否变现与营业利益率则是市场评估获利能力的核心指标。",
    },
  ],
  ORCL: [
    {
      q: "Oracle 最早是靠什么产品在企业软件市场建立地位？",
      choices: ["关联式数据库管理系统（Database）", "智能手机操作系统", "电动车整车制造", "社群媒体广告平台"],
      a: 0,
      explain: "Oracle 以关联式数据库软件起家，是企业级数据库市场的早期代表公司，后续才扩张到企业应用软件与云端基础设施。",
    },
    {
      q: "OCI（Oracle Cloud Infrastructure）在 Oracle 业务结构中扮演什么角色？",
      choices: ["Oracle 的云端基础设施服务，是公司近年云端转型策略的核心", "OCI 是 Oracle 旗下的实体零售门市品牌", "OCI 是 Oracle 的电动车充电网络品牌", "OCI 与 Oracle 的数据库业务完全无关"],
      a: 0,
      explain: "OCI 是 Oracle 的云端基础设施服务，近年因承接大型 AI 训练客户的运算需求而受到市场关注，是 Oracle 云端转型叙事的核心。",
    },
    {
      q: "下列哪一项最准确描述近年 Oracle 云端业务受到市场关注的原因？",
      choices: ["大型 AI 训练客户对运算资源的需求，带动 OCI 营收与资本支出双双成长", "Oracle 宣布完全退出云端市场", "Oracle 的数据库产品被市场淘汰", "Oracle 转型成为纯硬件制造商"],
      a: 0,
      explain: "AI 训练所需的大规模运算资源，带动部分客户向 Oracle 的 OCI 采购云端算力，使其云端业务营收与资本支出都明显成长。",
    },
    {
      q: "分析 Oracle 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["OCI 成长率、数据库续约率、云端资本支出与企业软件竞争", "全球航空业载客率", "美国非农就业数据", "黄金 ETF 资金流向"],
      a: 0,
      explain: "OCI 成长率代表云端转型进度，数据库续约率反映既有客户黏着度，云端资本支出影响利润率，企业软件市场竞争则牵动长期成长空间。",
    },
  ],
  QCOM: [
    {
      q: "Qualcomm 在通讯产业最早建立地位的关键技术是什么？",
      choices: ["CDMA 无线通讯技术的商业化", "锂电池储能技术", "云端服务器虚拟化技术", "卫星电视广播技术"],
      a: 0,
      explain: "Qualcomm 凭借 CDMA 无线通讯技术的商业化，在 3G／4G 时代建立了通讯专利与芯片市场的领先地位。",
    },
    {
      q: "Snapdragon 是 Qualcomm 旗下哪一类产品的品牌名称？",
      choices: ["智能手机等行动装置使用的系统单芯片（SoC）平台", "Qualcomm 的云端服务器品牌", "Qualcomm 的电动车整车品牌", "Qualcomm 的卫星通讯地面站设备"],
      a: 0,
      explain: "Snapdragon 是 Qualcomm 面向智能手机等行动装置的系统单芯片（SoC）平台品牌，是公司最具知名度的产品线。",
    },
    {
      q: "下列关于 Qualcomm 营收结构的叙述，哪一个正确？",
      choices: ["除了芯片销售，通讯专利授权收入也是公司重要的获利来源", "Qualcomm 完全不涉及专利授权业务，只靠芯片销售获利", "Qualcomm 的营收主要来自电动车整车销售", "Qualcomm 已经完全退出智能手机芯片市场"],
      a: 0,
      explain: "Qualcomm 除了销售 Snapdragon 等芯片，通讯标准（如 CDMA、4G／5G）相关的专利授权收入也是公司重要且毛利较高的获利来源。",
    },
    {
      q: "分析 Qualcomm 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["智能手机需求、专利授权收入、车用芯片设计案与边缘 AI 进展", "全球航运运费指数", "美国房屋开工率", "国际原油价格"],
      a: 0,
      explain: "智能手机需求直接影响芯片出货，专利授权收入是稳定的高毛利来源，车用芯片与边缘 AI（如 AI PC）则代表公司分散手机依赖的新成长方向。",
    },
  ],
  INTC: [
    {
      q: "Intel 长期在个人电脑时代建立领先地位的核心产品架构是什么？",
      choices: ["x86 处理器架构", "ARM 处理器架构", "RISC-V 开源指令集架构", "GPU 图形处理器架构"],
      a: 0,
      explain: "Intel 凭借 x86 处理器架构在个人电脑与服务器市场长期建立领先地位，是 PC 时代最具代表性的芯片公司之一。",
    },
    {
      q: "Intel 提出的「IDM 2.0」策略，主要内容是什么？",
      choices: ["在维持自家芯片设计与制造的同时，也对外开放晶圆代工服务", "Intel 完全放弃芯片设计，只做晶圆代工", "Intel 退出半导体产业，转型为软件公司", "IDM 2.0 是 Intel 一款新的消费级处理器名称"],
      a: 0,
      explain: "IDM 2.0 策略让 Intel 在维持自家设计与制造（IDM，整合元件制造商模式）的同时，也对外提供晶圆代工服务，与台积电等代工厂竞争客户订单。",
    },
    {
      q: "下列哪一项是近年 Intel 面临的主要竞争压力？",
      choices: ["先进制程进度落后竞争对手，加上资料中心市场被 AMD 等对手侵蚀份额", "Intel 完全没有任何竞争对手", "Intel 已经退出所有芯片市场", "Intel 的压力完全来自电动车产业"],
      a: 0,
      explain: "近年 Intel 在先进制程节点的进度上面临压力，加上资料中心 CPU 市场份额被 AMD 等对手侵蚀，是公司转型与投资人关注的核心议题。",
    },
    {
      q: "分析 Intel 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["制程节点进度、晶圆代工客户拓展、PC 循环与资料中心市占", "全球航空业载客率", "黄金与白银价格走势", "美国十年期公债殖利率"],
      a: 0,
      explain: "制程节点进度决定产品竞争力，代工客户拓展关系到 IDM 2.0 策略是否成功，PC 需求循环与资料中心市占则直接影响核心营收。",
    },
  ],
  AVGO: [
    {
      q: "Broadcom 最早是靠什么类型的产品建立市场地位？",
      choices: ["通讯芯片与基础设施半导体（如网络芯片、射频元件）", "智能手机整机品牌", "电动车电池模组", "云端企业级数据库软件"],
      a: 0,
      explain: "Broadcom 最早以通讯芯片与基础设施半导体（如网络交换芯片、无线射频元件）建立市场地位，后续才透过并购扩大到企业软件领域。",
    },
    {
      q: "下列哪一项是 Broadcom 近年透过并购扩大软件业务版图的代表案例？",
      choices: ["并购 VMware，跨足企业虚拟化与云端基础设施软件", "并购一家航空公司，跨足客运业务", "并购一家电动车厂，跨足整车制造", "并购一家银行，跨足金融服务"],
      a: 0,
      explain: "Broadcom 并购 VMware 是公司近年最大型的并购案之一，目的是扩大企业虚拟化与基础设施软件业务，与既有半导体业务形成互补。",
    },
    {
      q: "AI 数据中心的网络需求，对 Broadcom 哪一类产品带来明显的成长机会？",
      choices: ["数据中心交换器用的网络 ASIC 芯片", "智能手机用的射频前端元件", "汽车用的安全气囊控制芯片", "家用路由器用的入门级芯片"],
      a: 0,
      explain: "AI 大型集群对服务器之间高速网络连接的需求大增，带动 Broadcom 数据中心交换器用的网络 ASIC 芯片需求明显成长。",
    },
    {
      q: "分析 Broadcom 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["AI 网络需求、企业软件（VMware）整合进度、客户集中度与资料中心资本支出", "全球航运运费指数", "美国房屋销售数据", "国际原油价格"],
      a: 0,
      explain: "AI 网络需求带动半导体业务成长，VMware 整合进度影响软件业务综效，客户集中度（少数大客户占比高）是风险因子，资料中心资本支出则牵动整体景气。",
    },
  ],
  MU: [
    {
      q: "Micron 主要生产的两大类存储芯片产品是什么？",
      choices: ["DRAM（动态随机存取记忆体）与 NAND（闪存）", "CPU 与 GPU", "FPGA 与 ASIC", "传感器与电源管理芯片"],
      a: 0,
      explain: "Micron 是记忆体与储存芯片公司，主要产品为 DRAM（用于运算时的暂存记忆体）与 NAND（用于长期数据储存的闪存）。",
    },
    {
      q: "下列关于记忆体产业景气循环的叙述，哪一个正确？",
      choices: ["记忆体报价容易受供需失衡影响，呈现明显的产业景气循环", "记忆体价格长期只涨不跌，不存在景气循环", "记忆体产业完全不受全球终端需求影响", "Micron 的获利与记忆体报价无关"],
      a: 0,
      explain: "记忆体产业容易因为产能扩张与终端需求变化造成供需失衡，使报价呈现明显的景气循环，直接牵动 Micron 等记忆体厂商的获利表现。",
    },
    {
      q: "HBM（高频宽记忆体）需求升温，主要与下列哪个趋势有关？",
      choices: ["AI 伺服器需要更高频宽的记忆体来配合 GPU／AI 加速器运算", "HBM 主要用于智能手机的入门款机型", "HBM 与 AI 运算完全无关，只用于游戏主机", "HBM 是一种用于汽车安全气囊的传感器"],
      a: 0,
      explain: "AI 伺服器在训练与推论时需要极高的数据传输频宽来配合 GPU／AI 加速器运算，带动 HBM（高频宽记忆体）需求快速升温。",
    },
    {
      q: "分析 Micron 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["记忆体报价、库存水位、HBM 出货与终端需求复苏", "全球航空业载客率", "美国十年期公债殖利率", "黄金期货价格"],
      a: 0,
      explain: "记忆体报价与库存水位直接反映产业景气，HBM 出货代表 AI 题材的新成长动能，终端需求（PC、手机、数据中心）复苏程度则牵动整体出货量。",
    },
  ],
  AMAT: [
    {
      q: "Applied Materials 在半导体产业链中主要扮演什么角色？",
      choices: ["提供晶圆制造所需的薄膜沉积、蚀刻等半导体设备", "设计与销售消费级智能手机芯片", "经营晶圆代工厂，直接生产芯片", "提供企业级云端运算服务"],
      a: 0,
      explain: "Applied Materials 是半导体设备龙头之一，提供晶圆制造过程中薄膜沉积、蚀刻、量测等关键设备，而非直接设计或生产芯片。",
    },
    {
      q: "为什么市场常把半导体设备公司（如 Applied Materials）的订单，视为晶圆厂资本支出的「温度计」？",
      choices: ["晶圆厂要扩产或升级制程，通常需要先采购设备公司的生产设备", "设备公司的订单与晶圆厂的资本支出完全无关", "晶圆厂资本支出只反映在建筑工程上，与设备采购无关", "半导体设备订单只反映消费者的购买力"],
      a: 0,
      explain: "晶圆厂在扩产或升级制程节点之前，通常需要先向 Applied Materials 等设备公司采购生产设备，因此设备订单常被视为晶圆厂资本支出意愿的领先指标。",
    },
    {
      q: "下列哪一项是近年带动半导体设备需求的重要趋势之一？",
      choices: ["先进制程与先进封装的投资需求增加", "全球晶圆厂数量大幅减少", "半导体产业完全停止扩产", "记忆体厂商完全退出市场"],
      a: 0,
      explain: "先进制程（如 AI、HPC 芯片）与先进封装的投资需求增加，是近年带动 Applied Materials 等半导体设备公司订单成长的重要趋势。",
    },
    {
      q: "分析 Applied Materials 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["晶圆厂资本支出、先进制程投资、出口管制与记忆体景气循环", "全球航运运费指数", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "晶圆厂资本支出与先进制程投资直接决定设备订单量，出口管制（如对中国销售限制）影响可服务市场范围，记忆体景气循环则牵动相关设备需求。",
    },
  ],
  LRCX: [
    {
      q: "Lam Research 在半导体设备市场最主要专精的制程领域是什么？",
      choices: ["蚀刻（Etch）与薄膜沉积设备", "晶圆代工服务", "芯片封装测试服务", "消费级电子产品组装"],
      a: 0,
      explain: "Lam Research 是半导体设备公司，特别专精于蚀刻与沉积相关的制程设备，是晶圆制造过程中的关键设备供应商之一。",
    },
    {
      q: "Lam Research 的主要客户类型是什么？",
      choices: ["从事逻辑芯片与记忆体芯片制造的晶圆厂", "一般消费者", "汽车经销商", "银行与保险公司"],
      a: 0,
      explain: "Lam Research 的设备主要销售给从事逻辑芯片与记忆体芯片制造的晶圆厂客户，而非直接面向一般消费者。",
    },
    {
      q: "下列哪一项是近年推升 Lam Research 等设备公司订单的技术趋势之一？",
      choices: ["先进封装与高深宽比（High Aspect Ratio）制程的技术挑战，需要更精密的蚀刻与沉积设备", "全球半导体产业完全停止制程升级", "消费性电子需求是唯一影响订单的因素", "记忆体厂商不再需要任何制程设备"],
      a: 0,
      explain: "随着芯片结构愈趋复杂，先进封装与高深宽比制程对蚀刻、沉积设备的精密度要求提高，是推升 Lam Research 等设备公司订单的技术趋势之一。",
    },
    {
      q: "分析 Lam Research 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["晶圆厂扩产计划、记忆体资本支出、设备出货节奏与出口限制", "全球航空业载客率", "美国非农就业数据", "国际原油价格"],
      a: 0,
      explain: "晶圆厂扩产计划与记忆体资本支出直接决定设备需求，设备出货节奏反映在手订单转化速度，出口限制（如对中国销售管制）则影响可服务市场范围。",
    },
  ],
  RIVN: [
    {
      q: "Rivian 在美国电动车市场最早建立的品牌定位是什么？",
      choices: ["电动皮卡、休旅车与户外生活场景", "全球最低价的入门级城市代步车", "纯商用大型巴士制造商", "二手电动车交易平台"],
      a: 0,
      explain: "Rivian 是美国电动车新创，品牌定位偏向电动皮卡（如 R1T）与休旅车（如 R1S），强调户外生活与探险场景。",
    },
    {
      q: "下列哪一项是 Rivian 除了消费级电动车外的重要业务线？",
      choices: ["与企业客户合作的商用电动货车", "传统燃油卡车零件代工", "石油钻探设备制造", "智能手机芯片设计"],
      a: 0,
      explain: "Rivian 除了 R1T／R1S 等消费级车型，也发展商用电动货车业务（例如与亚马逊等企业客户的合作），是公司业务版图的重要一环。",
    },
    {
      q: "Rivian 这类新创电动车厂在产能爬坡阶段，最常面临的财务挑战是什么？",
      choices: ["量产初期单车成本高、现金消耗快，需要持续融资支撑营运", "新创电动车厂完全不需要任何资本支出", "产能爬坡阶段通常立刻就能获利", "新创电动车厂不需要考虑供应链成本"],
      a: 0,
      explain: "电动车新创在产能爬坡阶段，通常因规模效应尚未发挥而单车成本偏高，加上工厂与研发的资本支出庞大，容易面临现金消耗快、需要持续融资的挑战。",
    },
    {
      q: "分析 Rivian 营运表现时，下列哪一组最贴近实际影响公司前景的关键变量？",
      choices: ["交车量、现金消耗速度、单车毛利与产能利用率", "全球航运运费指数", "美国十年期公债殖利率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "交车量反映市场需求与产能爬坡进度，现金消耗速度决定公司还能撑多久，单车毛利与产能利用率则是观察公司能否走向获利的关键指标。",
    },
  ],
  LCID: [
    {
      q: "Lucid 在电动车市场的品牌定位最接近下列哪一项？",
      choices: ["高端豪华性能电动车，强调长续航与精品工艺", "主打全球最低价的入门级代步车", "专注电动巴士与商用车队", "二手车回收拍卖平台"],
      a: 0,
      explain: "Lucid 主打高端电动车与长续航技术，品牌定位接近豪华性能电动车，与走量入门款的电动车品牌形成区隔。",
    },
    {
      q: "Lucid Air 这款车型最常被市场提及的产品特色是什么？",
      choices: ["长续航里程与豪华内装配置", "全球最低的销售价格", "专为商用货运设计的载重能力", "不需要充电即可行驶的技术"],
      a: 0,
      explain: "Lucid Air 是 Lucid 的代表车型，市场常关注其长续航里程表现与豪华内装配置，对应公司高端电动车的品牌定位。",
    },
    {
      q: "下列关于 Lucid 资金来源的叙述，哪一个正确？",
      choices: ["中东主权基金（如沙特公共投资基金）是 Lucid 重要的资金支持来源之一", "Lucid 完全靠车辆销售利润支撑营运，不需要外部融资", "Lucid 的资金完全来自美国政府补贴", "Lucid 从未进行过任何形式的对外募资"],
      a: 0,
      explain: "中东主权基金（尤其是沙特公共投资基金）是 Lucid 重要的资金支持来源之一，市场也常关注公司在销量爬坡阶段对外部资金的依赖程度。",
    },
    {
      q: "分析 Lucid 营运表现时，下列哪一组最贴近实际影响公司前景的关键变量？",
      choices: ["交车量、现金水位、毛利率与豪华车市场需求", "全球航空业载客率", "美国非农就业数据", "国际原油价格"],
      a: 0,
      explain: "交车量代表需求与产能进度，现金水位决定公司能否撑到规模化获利，毛利率与豪华车市场需求则反映高端定位下的获利与销售压力。",
    },
  ],
  ENPH: [
    {
      q: "Enphase Energy 最早是以什么产品建立市场地位？",
      choices: ["太阳能微型逆变器（Microinverter）", "锂电池整车动力系统", "风力发电机组", "电动车充电桩网络"],
      a: 0,
      explain: "Enphase 以太阳能微型逆变器（安装在每片太阳能板上、个别转换直流电为交流电的设备）建立品牌，是住宅太阳能系统的重要供应商。",
    },
    {
      q: "微型逆变器（Microinverter）相较于传统集中式逆变器的主要特点是什么？",
      choices: ["个别安装在每片太阳能板上，单片板故障不影响整体系统发电", "微型逆变器完全不需要安装在太阳能板附近", "微型逆变器只能用于商用大型电站，不适用住宅", "微型逆变器与太阳能发电系统无关"],
      a: 0,
      explain: "微型逆变器个别安装在每片太阳能板上，当某片板因遮荫或故障发电下降时，不会影响整体系统的其他板，是其相较集中式逆变器的特点之一。",
    },
    {
      q: "下列哪一项是近年影响 Enphase 住宅太阳能需求的重要总经变量？",
      choices: ["利率水平，因为住宅太阳能安装常透过贷款融资", "国际原油库存周报", "全球航运运费指数", "黄金期货价格"],
      a: 0,
      explain: "住宅太阳能系统安装常透过贷款或租赁融资，因此利率水平的变化会直接影响消费者安装意愿，是近年市场关注 Enphase 需求的重要总经变量。",
    },
    {
      q: "分析 Enphase 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["住宅太阳能安装量、渠道库存水位、利率环境与储能产品成长", "全球小麦产量", "美国十年期公债殖利率以外的农产品指数", "黄金与白银价格走势"],
      a: 0,
      explain: "住宅太阳能安装量直接反映终端需求，渠道库存水位影响出货节奏，利率环境牵动融资意愿，储能产品成长则代表公司业务多元化的新动能。",
    },
  ],
  PLUG: [
    {
      q: "Plug Power 主要聚焦的能源技术领域是什么？",
      choices: ["氢能与燃料电池系统", "锂电池电动车整车制造", "太阳能板生产", "天然气发电厂营运"],
      a: 0,
      explain: "Plug Power 聚焦氢能与燃料电池技术，提供燃料电池系统、氢气供应与电解槽等相关解决方案，与锂电池路线的电动车厂走不同的能源技术路径。",
    },
    {
      q: "下列哪一项是 Plug Power 燃料电池技术较早期商业化的应用场景？",
      choices: ["仓储物流用的燃料电池叉车", "长途客运飞机的动力系统", "智能手机的备用电源", "个人电脑的主机电源"],
      a: 0,
      explain: "燃料电池叉车是 Plug Power 燃料电池技术较早期、相对成熟的商业化应用场景，常见于仓储物流中心的搬运设备。",
    },
    {
      q: "氢能产业（包含 Plug Power 这类公司）目前商业化进程中，市场最常关注的挑战是什么？",
      choices: ["绿氢生产成本偏高、基础设施尚未成熟，商业化速度与现金流压力是关注焦点", "氢能技术已经完全成熟，不存在任何成本或商业化挑战", "氢能产业完全不需要任何资本支出", "氢能产业的需求与政策补助完全无关"],
      a: 0,
      explain: "绿氢（透过再生能源电解水产生的氢气）生产成本偏高，加上加氢站等基础设施尚未成熟，使氢能产业的商业化速度与公司现金流压力成为市场关注焦点。",
    },
    {
      q: "分析 Plug Power 营运表现时，下列哪一组最贴近实际影响公司前景的关键变量？",
      choices: ["现金流状况、氢气生产成本、政策补助与订单落地速度", "全球航运运费指数", "美国房屋开工率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "现金流状况决定公司能否撑到规模化获利，氢气生产成本影响毛利率，政策补助（如美国相关法案的氢能补贴）与订单落地速度则牵动营收成长节奏。",
    },
  ],
  JPM: [
    {
      q: "JPMorgan Chase 的业务范围最准确的描述是什么？",
      choices: ["横跨消费金融、商业银行、投资银行与资产管理的大型综合金融机构", "只经营消费者信用卡业务，不涉及其他金融服务", "专注于电动车融资租赁的专业银行", "只对企业客户提供服务，不接受个人存款"],
      a: 0,
      explain: "JPMorgan Chase 是大型综合金融机构，业务横跨消费金融、商业银行、投资银行、交易业务与资产管理，是美国最大的银行之一。",
    },
    {
      q: "利率变化对 JPMorgan Chase 这类大型银行的营收影响，最主要透过什么管道？",
      choices: ["净利息收入（存放款利差）", "黄金期货交易部位", "电动车贷款的违约率", "海外房地产开发利润"],
      a: 0,
      explain: "利率变化会影响银行存款与放款之间的利差，进而影响净利息收入，是利率环境对银行获利最直接的传导管道之一。",
    },
    {
      q: "下列哪一项最贴近投资银行业务（如并购承销）对 JPMorgan 营收的影响？",
      choices: ["资本市场热度（IPO、并购案量）景气循环会直接影响投行手续费收入", "投资银行业务与资本市场景气完全无关", "投资银行业务只发生在年底，与全年景气无关", "并购承销业务已被法规完全禁止"],
      a: 0,
      explain: "投资银行业务的手续费收入（如 IPO 承销、并购顾问费）高度受资本市场热度影响，景气好时案量增加，景气差时案量明显萎缩。",
    },
    {
      q: "分析 JPMorgan Chase 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["利率路径、存款成本、信用风险与投行景气", "全球航运运费指数", "美国房屋开工率以外的农产品价格", "黄金与白银价格走势"],
      a: 0,
      explain: "利率路径与存款成本共同决定净利息收入，信用风险牵动坏帐提列，投行景气则影响手续费收入，是分析大型银行获利的核心变量组合。",
    },
  ],
  BAC: [
    {
      q: "Bank of America 的业务结构最准确的描述是什么？",
      choices: ["以零售银行与消费金融为基础，并涵盖商业贷款、财富管理与投资银行服务", "只经营海外汇款业务，不涉及国内存放款", "专注于加密货币交易平台业务", "只服务大型企业客户，不接受个人存款"],
      a: 0,
      explain: "Bank of America 是美国大型银行，以广泛的零售银行与消费金融业务为基础，同时也涵盖商业贷款、财富管理与投资银行等业务线。",
    },
    {
      q: "为什么 Bank of America 这类拥有庞大消费金融基础的银行，对利率变化特别敏感？",
      choices: ["庞大的存款基础使净利息收入对利率走势的变化高度敏感", "消费金融业务完全不受利率影响", "Bank of America 没有任何存款业务", "利率只影响投资银行业务，不影响零售银行"],
      a: 0,
      explain: "Bank of America 拥有庞大的存款基础，存款成本与放款利率之间的利差（净利息收入）会随利率环境变化而明显波动，是其获利对利率敏感的原因。",
    },
    {
      q: "下列哪一项是分析银行股时常被提及的「未实现损益」风险？",
      choices: ["银行持有的债券投资组合，在利率上升时可能产生帐面未实现亏损", "未实现损益专指银行尚未发放的员工奖金", "未实现损益与银行持有的债券投资组合完全无关", "未实现损益只会在银行倒闭时才会发生"],
      a: 0,
      explain: "银行通常持有大量债券作为投资组合，当市场利率上升时，既有债券的市价会下跌，形成帐面上的未实现亏损，是分析银行股资产负债表时的重要风险点。",
    },
    {
      q: "分析 Bank of America 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["净利息收入、存款流失、信用品质与消费贷款表现", "全球航空业载客率", "国际原油价格走势", "黄金期货价格"],
      a: 0,
      explain: "净利息收入反映存放款利差，存款流失牵动资金成本，信用品质（坏帐率）与消费贷款表现则直接影响获利与风险水平。",
    },
  ],
  GS: [
    {
      q: "Goldman Sachs 的业务特性与一般零售银行相比，最主要的差异是什么？",
      choices: ["收入更受投资银行、交易业务与资产管理活动影响，零售存放款业务占比相对小", "Goldman Sachs 完全不涉及任何投资银行业务", "Goldman Sachs 是美国最大的零售消费银行", "Goldman Sachs 的收入完全不受资本市场景气影响"],
      a: 0,
      explain: "Goldman Sachs 是投资银行与资本市场代表公司，收入结构更受投资银行（承销、并购顾问）、交易业务与资产管理活动影响，相对一般零售银行的存放款占比低。",
    },
    {
      q: "下列哪一项最准确描述 IPO 与并购热度对 Goldman Sachs 营收的影响？",
      choices: ["IPO 与并购案量增加时，承销与顾问手续费收入通常随之提升", "IPO 与并购热度与 Goldman Sachs 的获利完全无关", "Goldman Sachs 不参与任何 IPO 承销业务", "并购案量与公司营收呈现完全相反的走势"],
      a: 0,
      explain: "Goldman Sachs 的投资银行业务收入（承销费、并购顾问费）高度受资本市场热度影响，IPO 与并购案量增加通常带动手续费收入提升。",
    },
    {
      q: "近年 Goldman Sachs 在消费金融业务上的策略调整，最准确的描述是什么？",
      choices: ["曾尝试扩大消费金融业务，但后续因获利表现不如预期而调整收缩规模", "Goldman Sachs 从创立以来就专注于大型零售消费银行业务", "Goldman Sachs 完全没有尝试过消费金融业务", "消费金融业务一直是 Goldman Sachs 营收占比最高的部门"],
      a: 0,
      explain: "Goldman Sachs 近年曾尝试扩大消费金融业务（如 Marcus），但后续因获利表现与策略定位调整而收缩相关业务规模，回归以投行与资产管理为核心。",
    },
    {
      q: "分析 Goldman Sachs 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["资本市场热度、并购与承销案量、交易收入与资产管理资金流入", "全球航运运费指数", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "资本市场热度与并购承销案量直接影响投行手续费收入，交易收入受市场波动度影响，资产管理资金流入则反映客户对其资管能力的信任度。",
    },
  ],
  V: [
    {
      q: "Visa 的商业模式最准确的描述是什么？",
      choices: ["经营全球支付清算网络，向银行与商户收取交易相关费用，本身不直接承担消费者的信用风险", "Visa 直接对消费者发行信用卡并承担全部信用风险", "Visa 是一家专门发放消费贷款的银行", "Visa 的主要收入来自销售实体信用卡卡片"],
      a: 0,
      explain: "Visa 是全球支付清算网络公司，核心收入来自交易处理相关费用，实际发卡与承担信用风险的通常是与 Visa 合作的银行，而非 Visa 本身。",
    },
    {
      q: "下列哪一项最准确描述跨境交易对 Visa 营收的意义？",
      choices: ["跨境交易（如海外旅游消费）的手续费率通常较高，是 Visa 重要的高毛利收入来源", "Visa 完全不处理跨境交易，只处理境内交易", "跨境交易与 Visa 的营收完全无关", "Visa 对跨境交易完全免收任何费用"],
      a: 0,
      explain: "跨境交易（如海外旅游消费、跨境网购）的手续费率通常高于境内交易，是 Visa 重要的高毛利收入来源，因此全球旅游复苏程度常被市场关注。",
    },
    {
      q: "无现金支付与数字钱包的普及，对 Visa 的商业模式带来什么影响？",
      choices: ["扩大电子支付交易量，但也带来金融科技公司的竞争压力", "无现金支付完全不影响 Visa 的交易量", "数字钱包的出现让 Visa 完全退出支付市场", "无现金化趋势只对实体零售商有影响，与 Visa 无关"],
      a: 0,
      explain: "无现金化与数字钱包普及扩大了电子支付的整体交易量，对 Visa 有利，但同时也带来 PayPal、Apple Pay 等金融科技公司在支付入口上的竞争压力。",
    },
    {
      q: "分析 Visa 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["全球消费支出、跨境交易量、监管费率与金融科技竞争", "全球小麦产量", "美国十年期公债殖利率以外的农产品指数", "黄金期货价格"],
      a: 0,
      explain: "全球消费支出直接反映交易量，跨境交易量影响高毛利收入占比，监管费率（如各国对刷卡手续费的限制）与金融科技竞争则是长期风险变量。",
    },
  ],
  MA: [
    {
      q: "Mastercard 的商业模式与 Visa 相比，最准确的描述是什么？",
      choices: ["同样经营全球支付清算网络，收入结构与商业逻辑高度相似", "Mastercard 是直接对消费者发卡放款的银行", "Mastercard 主要业务是制造实体信用卡硬件", "Mastercard 与 Visa 的商业模式完全没有相似之处"],
      a: 0,
      explain: "Mastercard 与 Visa 同样经营全球支付清算网络，收入来自交易处理相关费用，两者的商业模式与营收驱动因素高度相似，常被市场放在一起比较。",
    },
    {
      q: "下列哪一项是 Mastercard 近年积极发展的业务方向？",
      choices: ["与金融机构合作推动数字钱包及加值服务（如数据分析、资安）", "Mastercard 已经完全退出全球支付市场", "Mastercard 转型成为石油贸易公司", "Mastercard 主要业务改为销售实体零售商品"],
      a: 0,
      explain: "Mastercard 近年除核心支付清算业务外，也积极发展与金融机构合作的数字钱包整合，以及数据分析、资安等加值服务，扩大营收来源。",
    },
    {
      q: "全球旅游复苏对 Mastercard 营收的意义是什么？",
      choices: ["带动跨境交易量回升，有利于其高毛利的跨境手续费收入", "旅游复苏与 Mastercard 的营收完全无关", "旅游复苏只会降低 Mastercard 的交易量", "Mastercard 完全不处理与旅游相关的交易"],
      a: 0,
      explain: "旅游复苏会带动消费者在海外的刷卡消费（跨境交易），而跨境交易费率通常较高，因此是 Mastercard 营收成长的重要驱动因素之一。",
    },
    {
      q: "分析 Mastercard 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["全球消费支出、跨境交易、监管费率与商户接受度", "全球航运运费指数", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "全球消费支出与跨境交易量直接影响交易处理收入，监管费率（手续费上限规范）与商户接受度（是否愿意支持该支付网络）则牵动长期成长空间。",
    },
  ],
  BRK_B: [
    {
      q: "Berkshire Hathaway 是由谁长期主导经营的大型控股公司？",
      choices: ["Warren Buffett", "Elon Musk", "Jeff Bezos", "Jamie Dimon"],
      a: 0,
      explain: "Berkshire Hathaway 是 Warren Buffett 长期经营的大型控股公司，以保险业务为核心、并搭配多元化的资本配置策略闻名。",
    },
    {
      q: "「保险浮存金」（Float）在 Berkshire Hathaway 商业模式中的作用是什么？",
      choices: ["保险业务先收保费、后赔付的时间差资金，可被用来投资股票与其他资产", "保险浮存金是指公司尚未发放的员工薪资", "保险浮存金与公司的投资活动完全无关", "保险浮存金是 Berkshire 用来偿还银行贷款的专户"],
      a: 0,
      explain: "保险公司通常会先收取保费，之后才需要支付理赔款，这中间产生的资金（浮存金）可被 Berkshire Hathaway 用来进行长期股票与企业投资，是其独特商业模式的核心。",
    },
    {
      q: "下列关于 Berkshire Hathaway 业务结构的叙述，哪一个正确？",
      choices: ["除了保险，公司还持有铁路、能源、公用事业、制造零售等多元业务，以及大型上市公司股票投资组合", "Berkshire Hathaway 只经营保险业务，不涉及任何其他产业", "Berkshire Hathaway 完全不持有任何上市公司股票", "Berkshire Hathaway 主要业务是软件订阅服务"],
      a: 0,
      explain: "Berkshire Hathaway 的业务版图横跨保险、铁路（如 BNSF）、能源、公用事业、制造零售等多元产业，同时也持有大型上市公司（如 Apple）的股票投资组合。",
    },
    {
      q: "分析 Berkshire Hathaway 营运表现时，下列哪一组最贴近实际影响公司价值的关键变量？",
      choices: ["保险承保获利、投资组合表现、现金水位与接班议题", "全球航运运费指数", "美国非农就业数据", "国际原油价格走势"],
      a: 0,
      explain: "保险承保获利反映核心业务体质，投资组合表现牵动帐面价值，现金水位反映资本配置弹性，接班议题（Buffett 高龄）则是市场长期关注的治理变量。",
    },
  ],
  "2317_TW": [
    {
      q: "鸿海最早是以什么业务模式建立全球地位？",
      choices: ["电子代工制造服务（EMS），为品牌客户代工生产消费电子产品", "自有品牌智能手机销售", "晶圆代工服务", "电动车整车自有品牌销售"],
      a: 0,
      explain: "鸿海是全球电子代工制造服务（EMS）代表公司，长期为国际品牌客户（如苹果）代工生产消费电子产品，而非以自有品牌销售产品为主。",
    },
    {
      q: "下列哪一项是近年鸿海积极拓展的新业务方向？",
      choices: ["AI 伺服器代工与电动车平台（如 MIH 联盟）", "鸿海完全退出电子代工本业，转型为银行", "鸿海转型成为纯软件公司，不再涉及硬件制造", "鸿海转型为石油开采公司"],
      a: 0,
      explain: "鸿海近年除既有消费电子代工本业外，积极拓展 AI 伺服器代工业务，并透过 MIH 联盟等方式布局电动车平台，是公司多元化的重要方向。",
    },
    {
      q: "iPhone 供应链角色对鸿海营收结构的意义是什么？",
      choices: ["苹果长期是鸿海最大的客户之一，iPhone 组装订单对营收占比有重要影响", "鸿海与苹果完全没有任何业务往来", "iPhone 订单只占鸿海营收的极小比例，几乎可忽略", "鸿海已经完全停止为苹果代工生产"],
      a: 0,
      explain: "苹果长期是鸿海最重要的客户之一，iPhone 等产品的组装订单对鸿海营收占比有重要影响，因此苹果的销售与拉货状况常被市场视为观察鸿海的重要指标。",
    },
    {
      q: "分析鸿海营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["客户订单（尤其苹果）、AI 伺服器出货、毛利率与匯率变化", "全球航空业载客率", "美国房屋开工率", "黄金期货价格"],
      a: 0,
      explain: "客户订单（尤其苹果拉货状况）直接影响代工营收，AI 伺服器出货代表新成长动能，毛利率反映代工业务的议价能力，匯率变化则牵动出口型公司的获利换算。",
    },
  ],
  "2454_TW": [
    {
      q: "联发科最早是以什么类型的芯片切入市场？",
      choices: ["多媒体与手机芯片", "云端服务器 CPU", "晶圆代工服务", "电动车电池模组"],
      a: 0,
      explain: "联发科从多媒体与手机芯片切入市场，后来逐步成为全球行动 SoC（系统单芯片）与通讯芯片的重要供应商。",
    },
    {
      q: "Dimensity 是联发科旗下哪一类产品的品牌名称？",
      choices: ["智能手机使用的系统单芯片（SoC）平台", "联发科的晶圆代工服务品牌", "联发科的云端服务器品牌", "联发科的电动车芯片品牌"],
      a: 0,
      explain: "Dimensity（天玑）是联发科推出的智能手机系统单芯片（SoC）品牌，是公司在中高阶手机芯片市场建立品牌辨识度的重要产品线。",
    },
    {
      q: "下列哪一项是联发科近年积极拓展、降低对手机芯片单一依赖的业务方向？",
      choices: ["Wi-Fi 芯片、车用芯片与 ASIC（特殊应用芯片）", "联发科完全退出芯片设计业务，转型为银行", "联发科转型成为纯电商平台", "联发科转型为石油贸易公司"],
      a: 0,
      explain: "联发科近年积极拓展 Wi-Fi 芯片、车用芯片与 ASIC（客制化特殊应用芯片）等非手机产品线，目的是分散对单一手机芯片市场的依赖。",
    },
    {
      q: "分析联发科营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["手机拉货力道、高阶芯片渗透率、库存循环与中国手机品牌需求", "全球航运运费指数", "美国十年期公债殖利率", "黄金与白银价格走势"],
      a: 0,
      explain: "手机拉货力道直接影响出货量，高阶芯片渗透率反映产品组合与毛利率，库存循环与中国手机品牌（联发科重要客户群）的需求则是观察营收波动的关键。",
    },
  ],
  "2303_TW": [
    {
      q: "联电在半导体产业链中主要扮演什么角色？",
      choices: ["晶圆代工，专注成熟制程与特殊制程", "芯片设计公司，自有品牌芯片销售", "半导体设备制造商", "记忆体芯片制造商"],
      a: 0,
      explain: "联电是台湾晶圆代工公司，重点多落在成熟制程与特殊制程，与台积电在先进制程的定位有所区隔。",
    },
    {
      q: "联电的主要客户类型涵盖哪些产业？",
      choices: ["通讯、消费电子、车用、工控与电源管理等成熟制程需求客户", "联电只服务智能手机品牌客户", "联电的客户只包含政府机构", "联电不服务任何外部客户，只生产自用芯片"],
      a: 0,
      explain: "联电的晶圆代工服务客户涵盖通讯、消费电子、车用、工控与电源管理等多元领域，以成熟制程需求为主，客户结构相对分散。",
    },
    {
      q: "下列关于成熟制程晶圆代工景气循环的叙述，哪一个正确？",
      choices: ["成熟制程产能利用率会随终端需求（如车用、工控）景气波动而变化", "成熟制程产能利用率永远维持满载，不存在景气循环", "成熟制程晶圆代工完全不受终端需求影响", "联电的获利与产能利用率完全无关"],
      a: 0,
      explain: "成熟制程晶圆代工的产能利用率会随车用、工控、消费电子等终端需求景气波动，是影响联电等成熟制程代工厂获利的核心变量。",
    },
    {
      q: "分析联电营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["产能利用率、晶圆报价、车用工控订单与资本支出纪律", "全球航空业载客率", "美国房屋销售数据", "黄金 ETF 资金流向"],
      a: 0,
      explain: "产能利用率与晶圆报价直接反映景气强弱，车用工控订单代表需求结构，资本支出纪律则牵动公司在景气循环中的财务弹性。",
    },
  ],
  "2308_TW": [
    {
      q: "台达电最早是以什么业务起家？",
      choices: ["电源管理（电源供应器）相关产品", "晶圆代工服务", "智能手机整机制造", "石油化工产品"],
      a: 0,
      explain: "台达电从电源管理（如电源供应器）起家，逐步扩张到散热、工业自动化、资料中心电力与电动车能源系统等领域。",
    },
    {
      q: "下列哪一项是台达电近年受市场关注的新成长动能？",
      choices: ["AI 资料中心所需的高效率电源与散热解决方案", "台达电完全退出电源相关业务，转型为银行", "台达电转型成为纯零售通路商", "台达电转型为石油开采公司"],
      a: 0,
      explain: "AI 资料中心对高功率、高效率电源与散热的需求快速成长，是台达电近年受市场关注的重要新成长动能之一。",
    },
    {
      q: "台达电的产品线如何与电动车产业产生关联？",
      choices: ["提供电动车充电系统与车用电源零组件", "台达电直接制造并销售自有品牌电动车整车", "台达电与电动车产业完全无关", "台达电只生产传统燃油车零件"],
      a: 0,
      explain: "台达电提供电动车充电系统与车用电源零组件等解决方案，是公司能源转型相关业务的一环，而非直接生产整车。",
    },
    {
      q: "分析台达电营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["AI 资料中心电力需求、电动车订单、毛利率与匯率", "全球航运运费指数", "美国十年期公债殖利率", "黄金期货价格"],
      a: 0,
      explain: "AI 资料中心电力需求与电动车订单代表新成长动能，毛利率反映产品组合与议价能力，匯率变化则牵动出口型公司的获利换算。",
    },
  ],
  "3711_TW": [
    {
      q: "日月光投控在半导体产业链中主要专精的环节是什么？",
      choices: ["IC 封装与测试", "晶圆代工", "芯片设计", "半导体设备制造"],
      a: 0,
      explain: "日月光投控是封装测试龙头，位于晶片制造后段，主要业务是 IC 封装与测试，而非晶圆代工或芯片设计。",
    },
    {
      q: "下列哪一项是近年带动日月光等封测厂订单成长的重要技术趋势？",
      choices: ["先进封装需求升温，尤其与 AI、HPC 芯片相关的封装需求", "全球半导体产业完全停止生产", "封装测试业务已被市场淘汰", "先进封装与 AI 芯片完全无关"],
      a: 0,
      explain: "AI 与 HPC 芯片对先进封装（如把多颗芯片整合在同一封装内）的需求大幅升温，是近年带动日月光等封测厂订单成长的重要技术趋势。",
    },
    {
      q: "SiP（系统级封装）技术对日月光业务的意义是什么？",
      choices: ["让多个芯片与元件整合在单一封装内，扩大封测厂的应用场景与附加价值", "SiP 技术与封装测试业务完全无关", "SiP 技术只能用于晶圆制造的前段工艺", "SiP 技术已经被市场完全淘汰"],
      a: 0,
      explain: "SiP（System in Package，系统级封装）技术让多个芯片与被动元件整合在单一封装内，扩大了封测厂在终端产品（如穿戴装置）应用上的角色与附加价值。",
    },
    {
      q: "分析日月光投控营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["先进封装需求、产能利用率、半导体库存循环与毛利率", "全球航空业载客率", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "先进封装需求代表 AI／HPC 相关的新成长动能，产能利用率与半导体库存循环反映景气强弱，毛利率则牵动获利能力。",
    },
  ],
  "2382_TW": [
    {
      q: "广达最早是以什么业务建立规模？",
      choices: ["笔记本电脑代工", "晶圆代工服务", "智能手机自有品牌销售", "石油化工产品制造"],
      a: 0,
      explain: "广达从笔记本电脑代工建立规模，是全球重要的 PC／笔电代工厂之一，近年也因 AI 伺服器代工而受到高度关注。",
    },
    {
      q: "下列哪一项是近年广达受市场高度关注的新业务成长动能？",
      choices: ["AI 伺服器与云端资料中心设备代工", "广达完全退出笔电代工本业，转型为银行", "广达转型为纯零售通路商", "广达转型为石油贸易公司"],
      a: 0,
      explain: "AI 伺服器与云端资料中心设备代工是近年广达受市场高度关注的新业务成长动能，与既有笔电代工业务形成互补的产品组合。",
    },
    {
      q: "广达与云端服务巨头的合作关系，对公司业务结构有什么意义？",
      choices: ["云端客户的资本支出与订单需求，直接牵动广达 AI 伺服器代工业务的营收表现", "广达与云端服务巨头完全没有任何业务往来", "云端客户的资本支出与广达营收完全无关", "广达只服务一般消费者，不涉及企业级客户"],
      a: 0,
      explain: "广达与多家云端服务巨头有代工合作关系，这些客户的资本支出计划与订单需求，会直接牵动广达 AI 伺服器等资料中心设备代工业务的营收表现。",
    },
    {
      q: "分析广达营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["AI 伺服器出货、客户资本支出、零组件供应与笔电需求循环", "全球航运运费指数", "美国十年期公债殖利率", "黄金期货价格"],
      a: 0,
      explain: "AI 伺服器出货与客户资本支出代表新成长动能，零组件供应（如先进芯片）影响出货顺畅度，笔电需求循环则反映既有本业的景气状况。",
    },
  ],
  "2395_TW": [
    {
      q: "研华最早是以什么类型的产品建立市场地位？",
      choices: ["工业电脑与嵌入式平台", "智能手机整机制造", "晶圆代工服务", "石油化工产品"],
      a: 0,
      explain: "研华以工业电脑与嵌入式平台起家，是工业自动化、边缘运算与 IoT（物联网）应用的重要供应商。",
    },
    {
      q: "下列哪一项最准确描述研华产品的主要应用场景？",
      choices: ["智慧制造、交通运输与医疗等工业与场域应用", "研华的产品只销售给一般消费者作为家用电脑", "研华只生产智能手机配件", "研华的产品完全不涉及任何工业应用"],
      a: 0,
      explain: "研华的工业电脑与嵌入式板卡产品广泛应用于智慧制造、交通运输、医疗等场域，与一般消费级电脑的应用场景明显不同。",
    },
    {
      q: "边缘运算（Edge Computing）与 IoT 应用的成长，对研华业务的意义是什么？",
      choices: ["扩大对工业电脑与嵌入式设备的需求，是公司近年关注的成长方向之一", "边缘运算与 IoT 应用和研华的业务完全无关", "研华因边缘运算趋势而完全退出工业电脑市场", "IoT 应用只会减少研华的订单量"],
      a: 0,
      explain: "随着边缘 AI 与 IoT 应用普及，对能在场域端处理数据的工业电脑与嵌入式设备需求增加，是研华近年关注的重要成长方向。",
    },
    {
      q: "分析研华营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["工业订单景气、区域需求、边缘 AI 商机与库存调整", "全球航空业载客率", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "工业订单景气与区域需求反映传统工控本业的表现，边缘 AI 商机代表新成长动能，库存调整周期则影响短期营收波动。",
    },
  ],
  "0050_TW": [
    {
      q: "元大台湾50（0050）这档 ETF 追踪的指数是什么？",
      choices: ["台湾 50 指数，由台湾市值最大的约 50 家上市公司组成", "美国标普 500 指数", "台湾高股息精选指数", "全球黄金现货价格指数"],
      a: 0,
      explain: "0050 追踪「台湾 50 指数」，成分股是台湾股市中市值排名最大的约 50 家上市公司，常被视为台股核心权值的代表。",
    },
    {
      q: "0050 这类市值型 ETF 的报酬，主要受下列哪个因素影响最直接？",
      choices: ["成分股的价格涨跌与权重分配（如台积电占比通常最高）", "ETF 报酬与成分股价格完全无关", "0050 的报酬只取决于发行公司的获利", "0050 的报酬固定不变，不受市场波动影响"],
      a: 0,
      explain: "0050 是被动追踪指数的 ETF，报酬主要反映成分股的价格涨跌，而成分股权重（尤其权值最大的台积电）对整体指数表现影响最为显著。",
    },
    {
      q: "下列关于 ETF「折溢价」的叙述，哪一个正确？",
      choices: ["当 ETF 市价偏离其净值（淨資產價值）时，就会出现折价或溢价的现象", "折溢价是指 ETF 每年固定收取的管理费用", "ETF 永远不会出现折溢价，市价与净值完全相同", "折溢价只发生在股票，与 ETF 无关"],
      a: 0,
      explain: "ETF 在集中市场交易的价格（市价）有时会偏离其实际持有资产计算出的净值，这种价差就称为折价（市价低于净值）或溢价（市价高于净值）。",
    },
    {
      q: "观察 0050 这类市值型 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["台股大盘趋势、权值股（如台积电）走势、追踪误差与成交量", "全球航空业载客率", "美国房屋开工率", "国际原油库存周报"],
      a: 0,
      explain: "0050 与台股大盘高度连动，权值股走势主导指数表现，追踪误差反映基金管理品质，成交量则影响买卖的流动性与价差。",
    },
  ],
  "0056_TW": [
    {
      q: "元大高股息（0056）这档 ETF 的选股逻辑是什么？",
      choices: ["依规则挑选预期未来股息率较高的台股成分股", "完全依市值排名挑选成分股，与股息无关", "只挑选半导体产业的公司", "完全追踪美国股市的高股息公司"],
      a: 0,
      explain: "0056 是台湾高股息 ETF 代表之一，依特定规则挑选「预期未来股息率」相对较高的台股作为成分股，与单纯依市值排名的 0050 选股逻辑不同。",
    },
    {
      q: "高股息 ETF 的配息来源，可能包含下列哪些项目？",
      choices: ["成分股发放的股利收入，部分高股息 ETF 也可能涉及收益平准金的运用", "配息只能来自 ETF 发行公司自己的口袋，与成分股无关", "高股息 ETF 完全不会配息", "配息金额永远等于成分股价格的涨幅"],
      a: 0,
      explain: "高股息 ETF 的配息主要来自成分股发放的股利，部分基金也会运用「收益平准金」机制来平滑各期配息金额，是评估配息品质时常被提及的概念。",
    },
    {
      q: "「填息」这个概念在分析高股息 ETF 时代表什么？",
      choices: ["除息后股价／淨值回升到除息前水平的过程", "填息是指 ETF 公司补足管理费的缺口", "填息与股息发放完全无关", "填息是保证一定会发生、且时间固定的现象"],
      a: 0,
      explain: "除息会让股价（或 ETF 净值）依配息金额相应下降，「填息」是指之后价格／净值逐渐回升到除息前水平的过程，是否填息、填息速度并不是保证或固定的。",
    },
    {
      q: "观察 0056 这类高股息 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["成分股股息品质、殖利率、填息状况与成分股调整", "全球航运运费指数", "美国十年期公债殖利率以外的农产品价格", "黄金期货价格"],
      a: 0,
      explain: "成分股的股息品质与殖利率直接影响配息表现，填息状况反映价格回补速度，成分股调整（换股）则会改变整体组合的产业结构与风险特性。",
    },
  ],
  "006208_TW": [
    {
      q: "富邦台50（006208）这档 ETF 追踪的指数与 0050 有什么关系？",
      choices: ["两者都追踪台湾 50 指数，由不同发行公司（富邦投信、元大投信）分别发行", "006208 追踪的是美股科技指数，与台湾 50 指数无关", "006208 是主动选股型基金，不追踪任何指数", "006208 只持有单一一档股票"],
      a: 0,
      explain: "006208（富邦台50）与 0050（元大台湾50）都追踪相同的「台湾 50 指数」，差别在于由不同的投信公司（富邦投信、元大投信）分别发行与管理。",
    },
    {
      q: "投资人在比较 006208 与 0050 这类追踪相同指数的 ETF 时，常关注的差异点是什么？",
      choices: ["费用率（管理费、保管费）与追踪误差等管理细节的差异", "两者追踪的指数完全不同，无法比较", "006208 与 0050 的成分股完全不重叠", "追踪相同指数的 ETF 之间不存在任何差异"],
      a: 0,
      explain: "由于追踪相同指数，006208 与 0050 的成分股组成高度相似，投资人比较时常关注的是费用率与追踪误差等基金管理面的细节差异。",
    },
    {
      q: "下列关于「追踪误差」的叙述，哪一个正确？",
      choices: ["指 ETF 实际报酬与其追踪指数报酬之间的落差，误差越小代表追踪效果越好", "追踪误差是指 ETF 公司刻意操纵价格的行为", "追踪误差与 ETF 的管理品质完全无关", "追踪误差永远为零，不会因基金管理而有差异"],
      a: 0,
      explain: "追踪误差衡量 ETF 实际报酬与其所追踪指数报酬之间的落差，误差越小代表 ETF 复制指数表现的效果越好，是评估被动型 ETF 管理品质的重要指标。",
    },
    {
      q: "观察 006208 这类市值型 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["台股大盘走势、权值股表现、追踪误差与费用率", "全球航空业载客率", "美国房屋销售数据", "黄金与白银价格走势"],
      a: 0,
      explain: "006208 与台股大盘及权值股走势高度连动，追踪误差与费用率则反映基金本身的管理效率，是与同类型 ETF 比较时的重要参考。",
    },
  ],
  "00878_TW": [
    {
      q: "国泰永续高股息（00878）这档 ETF 的选股逻辑结合了哪两个概念？",
      choices: ["高股息特性与 ESG（环境、社会、公司治理）永续篩選条件", "纯粹依市值大小排名，不考虑股息或 ESG", "只挑选半导体产业公司，不考虑其他条件", "完全依公司创立年份挑选成分股"],
      a: 0,
      explain: "00878 结合高股息与 ESG（环境、社会、公司治理）永续篩選概念，挑选兼具股息特性与永续经营条件的台股作为成分股。",
    },
    {
      q: "00878 采用季配息（每季配息）机制，对投资人现金流规划的意义是什么？",
      choices: ["相较年配息 ETF，季配息能让投资人更频繁地收到配息现金流", "季配息代表总配息金额一定比年配息更多", "季配息与年配息在现金流频率上完全没有差异", "季配息机制已被法规完全禁止"],
      a: 0,
      explain: "00878 采用季配息机制，让投资人能以更高频率收到配息现金流，但配息频率本身不代表总配息金额会比年配息型 ETF 更高，两者是不同的概念。",
    },
    {
      q: "下列关于 ESG 篩選对 00878 成分股组成的影响，哪一个正确？",
      choices: ["ESG 条件会排除部分单纯股息率高、但 ESG 表现不佳的公司，影响最终成分股名单", "ESG 篩選完全不影响成分股名单，只是行销名称", "ESG 篩選会让所有台股公司都被排除在外", "ESG 与高股息策略完全互斥，无法同时存在于同一档 ETF"],
      a: 0,
      explain: "00878 的选股规则会先以 ESG 条件进行篩選，排除部分 ESG 表现不佳但股息率高的公司，再依股息相关指标排序，因此与纯股息率排序的 ETF 成分股会有差异。",
    },
    {
      q: "观察 00878 这类高股息 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["配息稳定性、成分股变化、折溢价与填息能力", "全球航运运费指数", "美国十年期公债殖利率以外的农产品价格", "国际原油库存周报"],
      a: 0,
      explain: "配息稳定性反映成分股股息品质，成分股变化（换股）会改变组合的产业结构，折溢价与填息能力则是评估市价是否合理、配息后价格能否回补的重要指标。",
    },
  ],
  "00919_TW": [
    {
      q: "群益台湾精选高息（00919）这档 ETF 最常被市场提及的配息特色是什么？",
      choices: ["采用月配息机制，让投资人能以月为单位收到配息", "00919 完全不进行任何配息", "00919 只能在除权息当天买卖", "00919 的配息金额永远固定不变"],
      a: 0,
      explain: "00919 采用月配息机制，是台湾高股息 ETF 中较早推出月配息设计的产品之一，因配息频率高而受到市场关注与讨论。",
    },
    {
      q: "下列关于「收益平准金」机制的叙述，哪一个正确？",
      choices: ["是部分 ETF 用来平滑各期配息金额、避免配息忽高忽低的会计处理机制", "收益平准金是指 ETF 公司额外收取的手续费", "收益平准金与配息金额的计算完全无关", "所有 ETF 都强制采用收益平准金机制，没有例外"],
      a: 0,
      explain: "收益平准金是部分高股息 ETF（包含规模成长快的新基金）用来平滑各期配息金额的会计处理机制，让配息不会因新资金大量流入而被过度稀释或波动。",
    },
    {
      q: "高股息 ETF 的成分股换股，对投资人理解配息组成有什么意义？",
      choices: ["成分股换股可能改变未来配息来源的产业结构与稳定性", "成分股换股与未来配息表现完全无关", "高股息 ETF 一旦选定成分股后永远不会更换", "成分股换股只会发生在指数型 ETF，与高股息 ETF 无关"],
      a: 0,
      explain: "高股息 ETF 通常会依规则定期审核并更换成分股，换股结果会改变未来配息来源的产业结构，是理解配息稳定性时需要留意的变量。",
    },
    {
      q: "观察 00919 这类月配息高股息 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["配息组成、收益平准金占比、成分股品质与折溢价", "全球航空业载客率", "美国房屋开工率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "配息组成与收益平准金占比能反映配息的真实来源是否稳健，成分股品质牵动长期股息表现，折溢价则反映市价是否合理。",
    },
  ],
  "00929_TW": [
    {
      q: "复华台湾科技优息（00929）这档 ETF 的选股范围聚焦在哪个产业？",
      choices: ["台湾科技产业中具备收益（股息）特性的成分股", "台湾传统产业中市值最大的公司，与科技股无关", "完全聚焦于金融保险产业", "完全聚焦于能源与原物料产业"],
      a: 0,
      explain: "00929 把选股范围聚焦在台湾科技产业，并从中挑选具备收益（股息）特性的成分股，是把科技股成长性与高股息收益概念结合的 ETF 产品。",
    },
    {
      q: "聚焦单一产业（如科技业）的高股息 ETF，相较于跨产业的高股息 ETF，主要的特性差异是什么？",
      choices: ["产业集中度较高，报酬与风险可能更受该产业景气循环影响", "聚焦单一产业完全不会影响 ETF 的风险特性", "聚焦科技业的 ETF 报酬永远高于跨产业 ETF", "产业集中度与配息稳定性完全无关"],
      a: 0,
      explain: "聚焦单一产业的 ETF（如 00929 聚焦科技业），成分股的产业集中度较高，报酬表现与风险特性会更受该产业景气循环影响，与跨产业分散的高股息 ETF 性质不同。",
    },
    {
      q: "00929 采用月配息机制，这与其聚焦科技股的选股策略之间，市场常讨论的关注点是什么？",
      choices: ["科技股价格波动通常较大，市场关注配息来源是否主要依赖资本利得而非单纯股息收入", "月配息机制与科技股选股策略完全无关，没有任何讨论空间", "科技股完全不会有价格波动，因此与配息无关", "00929 的配息金额与科技股表现完全无关"],
      a: 0,
      explain: "科技股价格波动通常较传统高股息股（如金融、传产）更大，市场常关注这类 ETF 的配息来源结构，是否有相当比例依赖资本利得而非单纯的股息收入。",
    },
    {
      q: "观察 00929 这类科技型高股息 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["科技股景气、配息来源结构、成分股集中度与折溢价", "全球航运运费指数", "美国十年期公债殖利率以外的农产品价格", "黄金期货价格"],
      a: 0,
      explain: "科技股景气直接影响成分股价格表现，配息来源结构反映配息的稳健程度，成分股集中度牵动风险分散程度，折溢价则反映市价是否合理。",
    },
  ],
  XOM: [
    {
      q: "Exxon Mobil 的核心业务最准确的描述是什么？",
      choices: ["上游原油与天然气开采，加上下游炼油与化工业务的综合能源公司", "Exxon Mobil 只经营加油站零售业务，不涉及开采或炼制", "Exxon Mobil 是一家专注于太阳能板制造的公司", "Exxon Mobil 完全不涉及化工产品业务"],
      a: 0,
      explain: "Exxon Mobil 是全球大型综合能源公司，业务涵盖上游原油与天然气开采、下游炼油与化工，是「综合石油公司」（Integrated Oil）的代表案例。",
    },
    {
      q: "「炼油利差」（Refining Margin）这个概念，对 Exxon Mobil 这类综合能源公司的意义是什么？",
      choices: ["反映原油原料成本与精炼后石油产品售价之间的价差，直接影响下游炼油业务获利", "炼油利差与公司获利完全无关", "炼油利差是指公司每年固定支付的政府税金", "炼油利差只影响公司的人事成本"],
      a: 0,
      explain: "炼油利差反映买入原油原料的成本，与精炼成汽油、柴油等产品后售价之间的价差，是下游炼油业务获利能力的核心指标，与单纯油价高低是不同的概念。",
    },
    {
      q: "下列关于页岩油（Shale Oil）开发对美国能源公司意义的叙述，哪一个正确？",
      choices: ["页岩油开发技术的进步，让美国大幅提升了原油与天然气的自产能力", "页岩油开发与 Exxon Mobil 等公司的业务完全无关", "页岩油是一种太阳能发电技术，与石油无关", "页岩油开发已经被全面禁止，不再具有商业意义"],
      a: 0,
      explain: "页岩油（透过水力压裂等技术开采的非传统原油）开发技术的进步，大幅提升了美国本土的原油与天然气自产能力，是近年北美能源产业的重要变化之一。",
    },
    {
      q: "分析 Exxon Mobil 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["油价与天然气价格、炼化利差、资本支出与股东回馈政策", "全球航空业载客率", "美国房屋开工率", "黄金 ETF 资金流向"],
      a: 0,
      explain: "油价与天然气价格直接影响上游开采业务获利，炼化利差牵动下游业务表现，资本支出反映长期产能规划，股东回馈（股利、回购）则是市场评估现金运用的重要指标。",
    },
  ],
  CVX: [
    {
      q: "Chevron 的业务范围最准确的描述是什么？",
      choices: ["涵盖上游油气开采、下游炼油化工，以及天然气与低碳能源投资的综合能源公司", "Chevron 只经营加油站零售业务", "Chevron 是一家专注于风力发电机组制造的公司", "Chevron 完全不涉及任何海外资产投资"],
      a: 0,
      explain: "Chevron 是大型综合能源公司，业务涵盖上游油气开采、下游炼油化工，近年也扩大对天然气与低碳能源（如氢能、碳捕捉）的投资布局。",
    },
    {
      q: "下列关于油价波动对 Chevron 这类上游开采业务公司影响的叙述，哪一个正确？",
      choices: ["油价上涨通常有利于上游开采业务的获利，油价下跌则会压缩获利空间", "油价波动与 Chevron 的获利完全无关", "油价上涨反而会让 Chevron 的开采业务亏损", "Chevron 的获利完全不受原油市场供需影响"],
      a: 0,
      explain: "Chevron 的上游业务以开采原油与天然气为主，油价上涨通常有利于这部分业务的获利表现，油价下跌则会压缩开采业务的利润空间，是能源股的典型特性。",
    },
    {
      q: "Chevron 近年透过并购扩大上游资产规模，这类策略最主要的目的是什么？",
      choices: ["扩大原油与天然气的探勘与生产资源储备，强化长期产量基础", "并购的唯一目的是减少公司员工人数", "并购与公司的长期产量规划完全无关", "Chevron 透过并购完全退出了石油开采业务"],
      a: 0,
      explain: "能源公司透过并购扩大上游资产，主要目的是取得更多原油与天然气的探勘与生产资源，强化公司长期的产量基础与储量水平。",
    },
    {
      q: "分析 Chevron 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["油价、产量、资本支出与自由现金流", "全球航运运费指数", "美国十年期公债殖利率以外的农产品价格", "黄金期货价格"],
      a: 0,
      explain: "油价与产量直接决定上游业务营收规模，资本支出反映长期产能投资力度，自由现金流则是评估公司能否持续支撑股利与回购的关键指标。",
    },
  ],
  COP: [
    {
      q: "ConocoPhillips 的业务重心与 Exxon Mobil、Chevron 这类综合能源公司相比，最主要的差异是什么？",
      choices: ["ConocoPhillips 以上游原油、天然气开采为主，相对较少涉及下游炼油化工业务", "ConocoPhillips 完全不涉及任何原油开采业务", "ConocoPhillips 只经营下游炼油业务，不涉及开采", "ConocoPhillips 是一家纯软件服务公司"],
      a: 0,
      explain: "ConocoPhillips 的业务重心以原油、天然气与液化天然气的上游开采为主，相对 Exxon Mobil、Chevron 这类涵盖完整上下游的综合能源公司，较少涉及下游炼油化工业务。",
    },
    {
      q: "下列关于页岩油开发对 ConocoPhillips 营运意义的叙述，哪一个正确？",
      choices: ["页岩油开发是公司近年扩大美国本土原油与天然气产量的重要技术与资产来源", "页岩油开发与 ConocoPhillips 的业务完全无关", "ConocoPhillips 完全不在美国本土进行任何开采活动", "页岩油是一种用来发电的太阳能技术"],
      a: 0,
      explain: "页岩油开发技术让 ConocoPhillips 等专注上游开采的能源公司，能在美国本土大幅扩大原油与天然气的产量基础，是公司近年成长的重要资产来源。",
    },
    {
      q: "对纯上游开采型能源公司（如 ConocoPhillips）而言，油价下跌对公司获利的影响相较综合能源公司有什么特性？",
      choices: ["因缺乏下游炼化业务对冲，获利波动通常更直接反映油价涨跌", "纯上游公司完全不受油价波动影响", "油价下跌反而对纯上游公司更有利", "纯上游公司的获利与油价完全无关，只受汇率影响"],
      a: 0,
      explain: "综合能源公司因同时拥有下游炼化业务，在油价下跌时炼化利差有时能部分对冲上游获利下滑；而 ConocoPhillips 这类纯上游开采型公司缺乏这种对冲，获利波动通常更直接反映油价涨跌。",
    },
    {
      q: "分析 ConocoPhillips 营运表现时，下列哪一组最贴近实际影响营收与获利的关键变量？",
      choices: ["油气价格、产量成长、开采成本与自由现金流", "全球航空业载客率", "美国房屋开工率", "黄金与白银价格走势"],
      a: 0,
      explain: "油气价格与产量成长直接决定营收规模，开采成本反映获利空间，自由现金流则是评估公司能否支撑股东回馈（股利、回购）的核心指标。",
    },
  ],
  GLD: [
    {
      q: "SPDR Gold Shares（GLD）这档 ETF 的运作方式最准确的描述是什么？",
      choices: ["持有实体黄金资产，并追踪黄金现货价格表现的 ETF", "GLD 是一档完全不持有任何黄金资产的纯衍生性商品基金", "GLD 追踪的是全球股市指数，与黄金价格无关", "GLD 是直接投资金矿开采公司股票的基金"],
      a: 0,
      explain: "GLD 是持有实体黄金资产、并追踪黄金现货价格表现的 ETF，与直接投资金矿公司股票（如经营风险、营运成本）的基金性质不同。",
    },
    {
      q: "下列哪一项因素，通常被市场认为与金价走势有较明显的关联性？",
      choices: ["美元走势与实质利率（名目利率减去通膨预期）", "全球航空业的载客率", "某一国家的足球联赛胜负", "特定单一公司的财报表现"],
      a: 0,
      explain: "金价走势通常与美元强弱、实质利率水平（因黄金不生息，实质利率上升会提高持有黄金的机会成本）有较明显的关联性，是分析黄金价格常被提及的总经变量。",
    },
    {
      q: "「避险需求」这个概念，在分析黄金价格时通常指什么？",
      choices: ["在地缘政治紧张或市场不确定性升高时，部分资金转向黄金等资产寻求保值", "避险需求是指投资人完全不持有任何资产", "避险需求与黄金价格走势完全无关", "避险需求只发生在黄金期货市场关闭期间"],
      a: 0,
      explain: "黄金长期被视为具有保值与避险特性的资产，在地缘政治风险升高或市场不确定性加大时，市场常观察是否有资金转向黄金等避险资产，这种现象被称为避险需求。",
    },
    {
      q: "观察 GLD 这类黄金 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["实质利率、美元指数、通膨预期与央行购金动向", "全球航运运费指数", "美国房屋开工率以外的农产品价格", "特定企业的单季财报"],
      a: 0,
      explain: "实质利率与美元指数是分析金价的核心总经变量，通膨预期影响黄金的保值需求，各国央行的购金动向也是近年市场关注金价供需的重要因素。",
    },
  ],
  SLV: [
    {
      q: "iShares Silver Trust（SLV）这档 ETF 的运作方式最准确的描述是什么？",
      choices: ["持有实体白银资产，并追踪白银价格表现的 ETF", "SLV 是一档专门投资银行股票的基金，与白银无关", "SLV 追踪的是全球债券指数", "SLV 是直接投资矿业设备制造商的基金"],
      a: 0,
      explain: "SLV 是持有实体白银资产、并追踪白银价格表现的 ETF，与黄金 ETF（如 GLD）的运作机制类似，但追踪的标的资产是白银。",
    },
    {
      q: "白银相较于黄金，在用途上最主要的差异特性是什么？",
      choices: ["白银同时具有贵金属保值属性与工业用途（如电子、太阳能产业），黄金的工业用途占比相对较低", "白银完全没有任何工业用途，性质与黄金完全相同", "黄金的工业用途远大于白银", "白银与黄金在用途上完全没有任何差异"],
      a: 0,
      explain: "白银除了具有贵金属的保值与避险属性外，也大量用于电子产业、太阳能板等工业用途，这是白银与黄金在需求结构上的主要差异之一。",
    },
    {
      q: "「金银比」（Gold-Silver Ratio）这个概念，在分析贵金属市场时通常用来做什么？",
      choices: ["比较黄金与白银的相对价格水平，作为评估两者相对估值的参考指标", "金银比是指黄金矿与银矿的产量比例，与价格无关", "金银比是一种用来计算公司财报的会计准则", "金银比与贵金属市场完全无关"],
      a: 0,
      explain: "金银比是用黄金价格除以白银价格计算出的比值，市场常用它来观察两种贵金属的相对价格水平，作为评估两者相对估值或资金轮动的参考指标之一。",
    },
    {
      q: "观察 SLV 这类白银 ETF 时，下列哪一组数据最贴近实际有用的观察重点？",
      choices: ["美元与实质利率、工业需求（如太阳能产业）、金银比与避险情绪", "全球航空业载客率", "美国房屋开工率以外的农产品价格", "特定单一企业的财报表现"],
      a: 0,
      explain: "美元与实质利率是贵金属共通的总经变量，工业需求（尤其太阳能产业用银量）是白银特有的需求来源，金银比与避险情绪则是市场分析白银相对价值的常见参考指标。",
    },
  ],
  // __EDUCATION_QUIZ_BANK_END__
};
EDUCATION_QUIZ_BANK["9988_HK"] = EDUCATION_QUIZ_BANK.BABA;

function normalizeEducationFolders(knowledge, companyName, symbolKey) {
  const fallbackFolders = [
    {
      title: "公司起源故事",
      summary: knowledge.origin,
      details: ["这只股票尚未放入完整知识库，第一版先用通用公司分析框架补足。"],
    },
    {
      title: "主要产品",
      summary: knowledge.business,
      details: ["可以从产品服务、营收来源、客户族群与产业位置四个角度开始阅读。"],
    },
    {
      title: "代表事件",
      summary: knowledge.event,
      details: ["后续可以把财报转折、产品发布、产业事件与重大并购逐步补进题库。"],
    },
    {
      title: "观察重点",
      summary: knowledge.focus,
      details: ["先观察近期涨跌幅、成交量是否放大、技术指标是否同向，以及市场是否正在重新定价增长故事。"],
    },
  ];
  const quizSet = EDUCATION_QUIZ_BANK[symbolKey];
  return (knowledge.folders || fallbackFolders).map((folder, idx) => ({
    ...folder,
    fullText: buildFolderFullText(folder),
    quizBank: buildFolderQuizBank(folder, companyName, quizSet?.[idx]),
  }));
}

function buildEducationNodesFromFolders(folders, companyName) {
  return folders.map((folder, index) => {
    const quiz = folder.quizBank?.[0] || buildFolderQuizBank(folder, companyName)[0];
    const bullets = dedupeStrings([
      folder.summary,
      ...(Array.isArray(folder.details) ? folder.details : []),
    ], 4);
    return {
      title: `第${index + 1}站：${folder.title}`,
      type: index === 0 ? "history" : index === 1 ? "business" : index === 2 ? "volatility" : "technical",
      summary: folder.summary,
      bullets,
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
    let summary = `${name} 最近新闻焦点包含：${news.map((item) => item.title).join("；")}。`;

    if (GEMINI_API_KEY) {
      const prompt = `请用简体中文把以下 ${symbol} / ${name} 的近期新闻标题整理成一段 80 字以内的游戏教学摘要，聚焦「可能造成股价震荡的原因」。不要给投资建议，不要夸大因果。\n\n${headlineText}`;
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
  const signal = advice?.signal || "区间持平";
  const folders = normalizeEducationFolders(knowledge, name, normalizeEducationSymbol(symbol));
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
      headline: `${name} 缆车预习`,
      summary: `${knowledge.origin} 这趟滑雪会把公司背景、商业模式、近期震荡与技术面拆成 4 个停靠站。`,
      folders,
      learningPoints: [
        "这家公司从哪里开始，市场为什么认得它",
        "它主要靠什么产品或服务赚钱",
        "近期价格震荡可能跟哪些新闻或市场情绪有关",
        "滑雪地形如何对应这段期间的技术面变化",
      ],
    },
    nodes,
    newsContext: null,
    sourceTime: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════
// 技术指标摘要（纯数据呈现，不含任何买卖或推荐判断）
// ═══════════════════════════════════════════════
function generateAdvice(closes, ind) {
  const { ma5, ma20, rsi, macd, signal } = ind;
  const reasons = [];

  const rsiVal = lastVal(rsi);
  if (rsiVal !== null) {
    if      (rsiVal >= 70) { reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（高位区）`, type: "high" }); }
    else if (rsiVal <= 30) { reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（低位区）`, type: "low" }); }
    else                   { reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（中性区间）`, type: "neutral" }); }
  }

  const macdV = lastVal(macd), sigV = lastVal(signal);
  if (macdV !== null && sigV !== null) {
    if (macdV >= sigV) { reasons.push({ label: `MACD ${macdV.toFixed(2)} 高于信号线`, type: "up" }); }
    else               { reasons.push({ label: `MACD ${macdV.toFixed(2)} 低于信号线`, type: "down" }); }
  }

  const close = closes[closes.length - 1];
  const ma5v = lastVal(ma5), ma20v = lastVal(ma20);
  if (ma20v) {
    if (close >= ma20v) { reasons.push({ label: `收盘 ${close.toFixed(2)} 高于 MA20 ${ma20v.toFixed(2)}`, type: "up" }); }
    else                { reasons.push({ label: `收盘 ${close.toFixed(2)} 低于 MA20 ${ma20v.toFixed(2)}`, type: "down" }); }
  }
  if (ma5v && ma20v) {
    if (ma5v >= ma20v) { reasons.push({ label: `MA5 ${ma5v.toFixed(2)} 高于 MA20`, type: "up" }); }
    else               { reasons.push({ label: `MA5 ${ma5v.toFixed(2)} 低于 MA20`, type: "down" }); }
  }

  const first = closes[0];
  const periodChange = first ? ((close - first) / first) * 100 : 0;
  const signalLabel = periodChange >= 0 ? "区间上行" : "区间回落";
  const signalType = periodChange >= 0 ? "up" : "down";
  const summary = `本区间收盘${periodChange >= 0 ? "上涨" : "下跌"} ${Math.abs(periodChange).toFixed(1)}%。以下仅列出 RSI、MACD 与均线等技术指标的当前数值与状态。`;

  return {
    signal: signalLabel, signal_type: signalType, reasons, summary,
    disclaimer: "本卡仅呈现技术指标的客观数值与状态，纯为数据可视化，不含任何投资建议。",
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
    // 纯依市场活跃度排序：单日波动幅度、量能脉冲、近 5 日动能与市值规模，
    // 不含任何方向性（看多/看空）加权，仅反映「今天哪些股票数据变化最大」。
    const changeScore = (Math.abs(snapshot.changePercent) / maxAbsChange) * 48;
    const volumeScore = (Math.min(snapshot.volumePulse, maxVolumePulse) / maxVolumePulse) * 28;
    const momentumScore = (Math.abs(snapshot.momentum5d) / maxAbsMomentum) * 16;
    const capScore = maxLogMarketCap > 0
      ? (Math.log10((snapshot.marketCap || 1) + 1) / maxLogMarketCap) * 8
      : 0;
    const heatScore = +(changeScore + volumeScore + momentumScore + capScore).toFixed(1);

    return {
      ...snapshot,
      heatScore,
      featuredScore: heatScore,
    };
  });
}

async function buildFeaturedGeminiReason(snapshot) {
  const fallbackMarkdown = `# ${snapshot.symbol} 今日数据摘要

${snapshot.name} 今天进入首页热度榜首，是因为它在 **单日波动、量能与近期动能** 这几项市场数据上的变化幅度，相对其他追踪标的最为明显。以下内容只整理客观数据，不含任何买卖或推荐判断。

---

## 市场热度
从盘面数据来看，${snapshot.name} 今天最明显的变化是 **${buildHeatReason(snapshot)}**。这代表它的成交量与价格波动相对活跃，因此在今日的数据排序中被排在前面，纯粹反映「数据变化大小」，不代表任何方向看法。

## 技术指标状态
目前的技术指标数值为 **${snapshot.adviceReasons.join("、")}**。这些只是 RSI、MACD 与均线的当前读数，用来描述目前状态，并非进出场信号。

## 点进去可以看到什么
打开分析页后，可以看到完整的 K 线、成交量、RSI 与 MACD 图表，以及 **RSI、MACD 与均线之间目前的相对位置**，方便自行查看这只股票的技术面数据。

---

| 面向 | 目前数据 | 说明 |
| --- | --- | --- |
| 市场热度 | ${buildHeatReason(snapshot)} | 反映今日成交量与波动大小 |
| 区间走势 | ${snapshot.adviceSignal} | 描述本区间收盘的涨跌方向 |
| 指标状态 | ${snapshot.adviceReasons[0] || "RSI / MACD / 均线"} | 技术指标的当前读数 |

## 结论
总结来说，${snapshot.name} 会出现在首页第一张，只是因为它今天的 **波动、量能与动能数据** 变化最大。本卡仅作数据可视化，不构成任何投资建议。`;

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

  const prompt = `你是一个股票数据仪表板的文字产生器，请用繁体中文为 ${snapshot.symbol}${snapshot.name ? `（${snapshot.name}）` : ""} 撰写一段「今日数据摘要」，使用 Markdown 格式。

请只根据以下客观数据撰写：
- 单日涨跌幅：${formatPct(snapshot.changePercent)}
- 5 日动能：${formatPct(snapshot.momentum5d)}
- 量能脉冲：${snapshot.volumePulse.toFixed(1)}x
- 区间走势：${snapshot.adviceSignal}
- 技术指标读数：${snapshot.adviceReasons.join("、")}

严格限制（非常重要）：
1. 全文只能客观描述数据，严禁出现任何投资建议、买进、卖出、加码、减码、推荐、值得买、看好、看坯、目标价、进场、出场等字眼或暗示。
2. 不要评价这只股票好或不好，只陈述数据变化大小与指标当前状态。
3. 一定要有一个 H1 标题，命名为「今日数据摘要」相关。
4. 不要出现「过程一 / 过程二 / 过程三」这种字眼。
5. 内容用三个面向描述：市场热度（量能与波动）、技术指标状态、点进去能看到哪些图表数据。
6. 一定要有 --- 分隔线。
7. 一定要有一个 Markdown 表格，至少三列。
8. 一定要有 ## 结论 收尾，并在结论注明本卡仅作数据可视化、不构成投资建议。
9. 段落内可自然使用 **粗体** 强调数据重点。`;

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
  const changeLabel = snapshot.changePercent >= 0 ? `走势转强 ${formatPct(snapshot.changePercent)}` : `震荡扩大 ${formatPct(snapshot.changePercent)}`;
  const pulseLabel = snapshot.volumePulse >= 1.1 ? `量能 ${snapshot.volumePulse.toFixed(1)}x` : "量能稳定";
  const aiReason = await buildFeaturedGeminiReason(snapshot);

  return {
    symbol: snapshot.symbol,
    name: snapshot.name,
    exchange: snapshot.exchange,
    summary: `${snapshot.name} 今天 ${changeLabel}，${pulseLabel}，本区间走势为「${snapshot.adviceSignal}」，是今日数据变化最大的一只。`,
    detail: `这张主卡会优先挑出单日波动、量能与近期动能数据最大的标的。${snapshot.name} 目前 5 日动能 ${formatPct(snapshot.momentum5d)}，热度分数 ${snapshot.heatScore.toFixed(1)}，可先看它今天的盘面数据变化。`,
    chips: [
      { label: "实时热度", tone: "primary" },
      { label: primaryTheme?.title || "热门主题", tone: "warning" },
      { label: pulseLabel, tone: snapshot.volumePulse >= 1.3 ? "success" : "primary" },
    ],
    reasons: dedupeStrings([
      buildHeatReason(snapshot),
      ...snapshot.adviceReasons,
      `热度分数 ${snapshot.heatScore.toFixed(1)}`,
    ]),
    aiReason,
    series: snapshot.series,
  };
}

function buildHotRecommendations(snapshots) {
  return snapshots.slice(0, 3).map((snapshot) => ({
    symbol: snapshot.symbol,
    name: snapshot.name,
    blurb: `${snapshot.name} 今日热度分数 ${snapshot.heatScore.toFixed(1)}，${snapshot.volumePulse >= 1.2 ? `量能约为近月均量 ${snapshot.volumePulse.toFixed(1)}x` : "成交维持活跃"}。`,
    change: formatPct(snapshot.changePercent),
    trend: snapshot.changePercent >= 0 ? "up" : "down",
    reasons: dedupeStrings([
      buildHeatReason(snapshot),
      ...snapshot.adviceReasons,
      `区间走势 ${snapshot.adviceSignal}`,
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
        desc: `${theme.desc} 今日数据变化较大的是 ${topNames}。`,
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
    throw new Error("可用热度数据不足");
  }

  const featuredPool = [...snapshots].sort((a, b) => b.featuredScore - a.featuredScore);
  const hotPool = [...snapshots].sort((a, b) => b.heatScore - a.heatScore);
  const featured = await buildFeaturedRecommendation(featuredPool[0]);
  const hot = buildHotRecommendations(hotPool);
  const themes = buildThemeRecommendations(hotPool);

  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    methodology: "依单日波动、量能脉冲与近 5 日动能实时排序",
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
// Gemini AI 聊天端点
// ═══════════════════════════════════════════════
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];

async function generateGeminiText(prompt, { temperature = 0.7, maxOutputTokens = 8192 } = {}) {
  if (!GEMINI_API_KEY) throw new Error("Gemini API key 未设定");

  let lastError = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
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

    if (response.ok) {
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "（无回复）";
    }

    lastError = await response.text();
    console.error(`[Gemini Error:${model}]`, lastError);
  }

  throw new Error(`Gemini API 错误：${lastError.slice(0, 180)}`);
}

function buildLocalChatFallback(message, context = {}) {
  if (!context?.symbol) {
    return "Gemini 目前请求量太高，我先用本机备用说明回复：你可以先选一支股票，系统会列出 K 线、RSI、MACD 与均线等技术指标的数值。这是展示用备援，仅说明指标数据，不提供任何投资建议。";
  }

  const macd = Number(context.macd);
  const signal = Number(context.signal);
  const rsi = Number(context.rsi);
  const close = context.close ?? "N/A";
  const ma20 = context.ma20 ?? "N/A";
  const macdText = Number.isFinite(macd) && Number.isFinite(signal)
    ? macd >= signal
      ? "MACD 目前高于信号线。"
      : "MACD 目前低于信号线。"
    : "MACD 数据暂时不足。";
  const rsiText = Number.isFinite(rsi)
    ? rsi >= 70
      ? "RSI 高于 70，位于高位区。"
      : rsi <= 30
        ? "RSI 低于 30，位于低位区。"
        : "RSI 位于 30–70 的中性区间。"
    : "RSI 数据暂时不足。";

  return `Gemini 目前请求量太高，我先启用本机备用说明。\n\n${context.symbol} 最新收盘价约 ${close}，MA20 约 ${ma20}。${macdText}${rsiText}\n\n说明一下这些指标的定义：MACD 比较长短期均线的收敛发散，RSI 衡量近期涨跌力道落在 0–100 的哪个区间，均线则是一段期间的平均收盘价。以上仅为技术指标的数据说明，不含任何投资建议。`;
}

app.post("/chat", async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: "缺少 message" });

  // 将股票指标数据组成 system prompt
  let systemContext = `你是一个股市技术指标的「数据解读助手」，只负责用简体中文客观说明 RSI、MACD、移动平均线等技术指标的定义与当前数值。

严格规则（非常重要，务必遵守）：
1. 只能解释指标的意义与目前的数据状态，绝对不可以提供任何投资建议。
2. 严禁出现买进、卖出、加码、减码、进场、出场、停利、停损、推荐、值得买、适合买、看好、看坯、目标价等字眼或任何暗示。
3. 如果用户问「现在适不适合买 / 该不该卖 / 会涨还是会跌 / 帮我推荐」这类问题，请礼貌说明本工具只呈现与解读数据、不提供投资建议，并改为客观说明相关指标目前的数值与定义。
4. 【绝对严禁谈论政治与敏感话题】：如果用户询问任何地缘政治、国家主权、历史事件、政治人物、宗教、色情或任何与股市/本游戏无关的敏感话题，你必须礼貌地拒绝回答，一律回答：“我是滑雪游戏的数据助手，仅能提供客观的技术指标科普与游戏关卡说明，无法回答其他话题。”。
5. 语气亲切但中立，只陈述事实，不替用户做决定，且一律使用简体中文回答。`;

  if (context && context.symbol) {
    systemContext += `

目前用户正在查看的股票：【${context.symbol}】${context.name ? `（${context.name}）` : ""}
最新技术指标数据（仅供客观说明，不要据此给建议）：
- 最新收盘价：${context.close ?? "N/A"}
- RSI(14)：${context.rsi ?? "N/A"}
- MACD：${context.macd ?? "N/A"}
- 信号线 Signal：${context.signal ?? "N/A"}
- MA5：${context.ma5 ?? "N/A"}
- MA20：${context.ma20 ?? "N/A"}
- MA60：${context.ma60 ?? "N/A"}
- 本区间走势：${context.advice ?? "N/A"}

请只根据以上数据，客观说明用户询问的指标代表什么、目前数值落在什么状态，不要给任何买卖或推荐判断。`;
  }

  try {
    const text = await generateGeminiText(systemContext + "\n\n用户问题：" + message);
    res.json({ reply: text });

  } catch (e) {
    console.error("[Chat Error]", e.message);
    res.json({ reply: buildLocalChatFallback(message, context), fallback: true });
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
    res.status(500).json({ detail: `首页热度抓取失败：${e.message}` });
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
      return res.status(404).json({ detail: `找不到教育数据：${symbol}` });
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
    res.status(500).json({ detail: `教育数据抓取失败：${e.message}` });
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
    res.status(500).json({ detail: `抓取失败：${e.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🚀 StockAI 后端启动！`);
  console.log(`  📊 http://localhost:${PORT}\n`);
});

export default app;

