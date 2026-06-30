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
    icon: "??",
    title: "中国核心",
    desc: "先看中国平台、消费、AI 与港股科技主线。",
  },
  {
    id: "us-tech",
    icon: "??",
    title: "美股科技",
    desc: "用美股科技龙头当海外对照与补充火力。",
  },
  {
    id: "taiwan-core",
    icon: "????",
    title: "台湾地区",
    desc: "最后回看台湾地区供应链与核心权值的呼应。",
  },
  {
    id: "ai-chip",
    icon: "??",
    title: "AI 芯片",
    desc: "把全球算力、服务器与 GPU 主线串成同一张地图。",
  },
  {
    id: "high-income",
    icon: "??",
    title: "高股息 / ETF",
    desc: "防守型资金通常会先回到这些标的。",
  },
  {
    id: "future-motion",
    icon: "?",
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
          "GeForce 面向消费与游戏市场，维持品牌能见度与高端硬件形象。",
          "数据中心 GPU 与 AI 加速器是近年估值叙事的核心，常与云端巨头资本支出连动。",
          "CUDA、AI Enterprise、Networking 等软硬整合能力，使客户转换成本变高。",
        ],
      },
      {
        title: "代表事件",
        summary: "GeForce、CUDA、数据中心 GPU、生成式 AI 浪潮。",
        details: [
          "GeForce 让 NVIDIA 在游戏玩家与高性能图形市场获取长期辨识度。",
          "CUDA 生态扩大 GPU 用途，是后来 AI 训练需求爆发的重要基础。",
          "生成式 AI 带动数据中心 GPU 需求，让市场把 NVIDIA 视为 AI 基础设施代表股。",
        ],
      },
      {
        title: "观察重点",
        summary: "AI 需求、数据中心营收、供应链产能与高估值下的波动。",
        details: [
          "如果云端公司持续增加 AI 资本支出，市场通常会提高对 NVIDIA 的成长预期。",
          "供应链产能、先进封装与交货能力，会影响营收是否跟得上市场期待。",
          "估值很高时，任何需求放缓或毛利率疑虑都可能放大股价震荡。",
        ],
      },
    ],
  },
  TSLA: {
    name: "Tesla",
    origin: "Tesla 成立于 2003 年，后来由 Elon Musk 带入更大规模的资金、产品与品牌叙事，让电动车从小众科技品变成大众市场焦点。",
    business: "公司核心包含电动车、电池、能源保存、充电网络与自动驾驶软件。市场常同时用车厂与科技平台两种角度看它。",
    event: "代表事件包含 Model S、Model 3 放量、全球超级充电网络、价格战与自动驾驶功能迭代。",
    focus: "玩家应注意交车量、毛利率、降价策略、自动驾驶进展与市场对成长叙事的信心。",
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
        summary: "电动车、电池、能源保存、充电网络与自动驾驶软件。",
        details: [
          "Model 3 / Model Y 是放量核心，交车量与毛利率通常直接影响市场情绪。",
          "Supercharger 充电网络强化用户黏着度，也让 Tesla 拥有基础设施层面的优势。",
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
    business: "公司核心是 iPhone、Mac、iPad、Wearables 与 Services。市场看 Apple 时，通常同时看硬件销售周期、用户黏着度与服务收入。",
    event: "代表事件包含 Macintosh、iPod、iPhone、App Store、Apple Watch，以及近年的服务收入与空间运算产品。",
    focus: "玩家应注意 iPhone 需求、服务毛利、供应链、地区销售与新产品能否打开下一段成长。",
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
          "iPhone 仍是营收与市场注意力中心，换机周期会影响投资人对成长的看法。",
          "Services 包含 App Store、iCloud、Apple Music、Apple Pay 等，毛利结构通常优于硬件。",
          "Mac、iPad、Apple Watch、AirPods 扩大使用场景，让用户更难离开 Apple 生态系统。",
        ],
      },
      {
        title: "代表事件",
        summary: "iPhone 发表、App Store、生态系统扩张、自研芯片。",
        details: [
          "2007 年 iPhone 发表是 Apple 从电脑公司转型成移动平台公司的关键。",
          "App Store 把硬件销售延伸成软件分发与服务抽成模式。",
          "Apple Silicon 让 Mac 产品线在性能、续航与供应链控制上更有差异化。",
        ],
      },
      {
        title: "观察重点",
        summary: "iPhone 需求、服务成长、毛利率、供应链与新产品周期。",
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
    business: "公司核心包含 Windows、Office/Microsoft 365、Azure、企业软件、LinkedIn、Xbox 与 AI 服务。市场常把它视为企业数位化与云端 AI 的代表。",
    event: "代表事件包含 MS-DOS、Windows、Office、Azure 云端转型、收购 LinkedIn 与 Activision Blizzard，以及 Copilot AI 产品化。",
    focus: "玩家应注意 Azure 成长率、企业软件续约、AI Copilot 商业化、资本支出与云端竞争。",
    folders: [
      {
        title: "公司起源故事",
        summary: "Microsoft 从 PC 软件标准创建霸主地位，后来靠云端转型重新成长。",
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
          "Azure 是云端成长核心，常被市场拿来和 AWS、Google Cloud 比较。",
          "Copilot 把 AI 嵌进 Office、Windows、GitHub 与企业流程，是 AI 商业化主轴。",
        ],
      },
      {
        title: "代表事件",
        summary: "Windows 普及、Office 标准化、Azure 转型、AI Copilot 推进。",
        details: [
          "Windows 与 Office 的普及，让 Microsoft 长期掌握企业端入口。",
          "Azure 成功转型后，市场重新给 Microsoft 成长型平台公司的评价。",
          "OpenAI 合作与 Copilot 产品线，让 Microsoft 成为 AI 应用落地的重要代表。",
        ],
      },
      {
        title: "观察重点",
        summary: "Azure 成长、AI 变现、企业预算、资本支出与毛利率。",
        details: [
          "Azure 成长率如果放缓，市场会重新检查云端需求与竞争压力。",
          "AI Copilot 的重点是付费采用率，而不只是产品发表数量。",
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
          "成熟制程服务车用、工控、消费电子等长尾需求，让营收结构更分散。",
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
    origin: "AMD 从 CPU 与图形芯片竞争切入市场，近年靠 Ryzen、EPYC 与 AI 加速器重新获取高性能运算的能见度。",
    business: "公司核心包含 PC 处理器、数据中心 CPU、GPU、嵌入式芯片与 AI 加速器，市场会把它放在半导体景气与 AI 服务器供应链一起看。",
    event: "代表事件包含 Ryzen 翻身、EPYC 进入数据中心、收购 Xilinx 扩大嵌入式布局，以及 AI 加速器产品线推进。",
    focus: "玩家应注意数据中心成长、AI 芯片出货、PC 需求循环、毛利率与和 NVIDIA、Intel 的竞争节奏。",
  },
  GOOGL: {
    name: "Alphabet",
    origin: "Alphabet 的核心来自 Google 搜索与广告平台，后来把云端、YouTube、Android 与 AI 研发纳入同一个大型科技生态。",
    business: "公司主要收入来自搜索广告、YouTube、Google Cloud、Android 生态与订阅服务，AI 能力会影响广告效率与云端竞争。",
    event: "代表事件包含 Google 搜索普及、Android 生态扩张、YouTube 成长、Google Cloud 追赶，以及 Gemini 等 AI 产品推进。",
    focus: "玩家应注意广告景气、搜索流量、云端成长率、AI 投入成本、监管风险与市场对 AI 搜索变化的反应。",
  },
  META: {
    name: "Meta",
    origin: "Meta 从 Facebook 社群平台起家，逐步扩张到 Instagram、WhatsApp、广告系统、短音视频与沉浸式运算布局。",
    business: "公司核心是社群流量与广告变现，Reels、AI 推荐系统、Messaging 与 Reality Labs 会影响成长叙事。",
    event: "代表事件包含 Facebook 全球化、Instagram 收购、广告机器学习系统升级、元宇宙投入与 AI 推荐效率改善。",
    focus: "玩家应注意广告需求、用户停留时间、AI 推荐带来的变现效率、Reality Labs 支出与隐私监管。",
  },
  AMZN: {
    name: "Amazon",
    origin: "Amazon 从线上书店起家，后来成为电商、云端基础设施、物流与会员生态的综合平台。",
    business: "公司核心包含电商 marketplace、Prime 会员、广告、物流服务与 AWS，市场常同时看零售效率与云端成长。",
    event: "代表事件包含 Marketplace 扩张、Prime 会员制、AWS 成为云端龙头、物流网络扩建与广告业务放大。",
    focus: "玩家应注意 AWS 成长率、零售毛利、广告收入、物流成本、消费景气与 AI 基础设施投资。",
  },
  NFLX: {
    name: "Netflix",
    origin: "Netflix 从 DVD 租借转型流媒体平台，再用原创内容与全球订阅制创建音视频娱乐品牌。",
    business: "公司核心是流媒体订阅、内容投资、广告方案与全球会员成长，市场会用会员数、ARPU 与内容效率评价它。",
    event: "代表事件包含流媒体转型、原创剧集成功、全球化扩张、打击共享账号与广告订阅方案推出。",
    focus: "玩家应注意会员成长、内容成本、广告方案渗透率、竞争平台压力与自由现金流。",
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
    focus: "玩家应注意 OCI 成长率、数据库续约、云端资本支出、AI 运算需求与企业软件竞争。",
  },
  QCOM: {
    name: "Qualcomm",
    origin: "Qualcomm 以无线通信技术与移动芯片创建地位，长期受手机周期与通信标准升级影响。",
    business: "公司核心包含 Snapdragon 移动平台、通信专利授权、车用芯片、IoT 与边缘 AI 芯片。",
    event: "代表事件包含 CDMA 技术商业化、4G/5G 标准推进、Snapdragon 品牌创建与车用芯片布局。",
    focus: "玩家应注意智慧手机需求、授权收入、车用设计案、AI PC / 边缘 AI 进展与中国手机品牌拉货。",
  },
  INTC: {
    name: "Intel",
    origin: "Intel 是 x86 处理器与 PC 时代的重要代表，近年同时面对制程追赶、数据中心竞争与晶圆代工转型。",
    business: "公司核心包含 PC CPU、服务器处理器、晶圆制造、代工服务、加速器与网络芯片。",
    event: "代表事件包含 x86 架构普及、数据中心 CPU 扩张、制程延迟压力与 IDM 2.0 代工策略。",
    focus: "玩家应注意制程节点进度、代工客户、PC 循环、数据中心市占、资本支出与补助政策。",
  },
  AVGO: {
    name: "Broadcom",
    origin: "Broadcom 由通信芯片与基础设施半导体创建市场地位，后来透过并购扩大到企业软件。",
    business: "公司核心包含网络芯片、交换器 ASIC、无线射频、保存连接、基础设施软件与大型企业客户。",
    event: "代表事件包含多次半导体并购、网络交换芯片需求、AI 丛集网络升级与 VMware 并购。",
    focus: "玩家应注意 AI 网络需求、企业软件整合、毛利率、客户集中度与数据中心资本支出。",
  },
  MU: {
    name: "Micron",
    origin: "Micron 是存储器与保存芯片公司，股价常跟 DRAM / NAND 景气循环一起起伏。",
    business: "公司核心包含 DRAM、NAND、数据中心存储器、行动与车用保存，AI 服务器会带动高频宽存储器需求。",
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
    origin: "蔚来是中国电动车品牌，以高端车型、用户社群与换电服务创建差异化。",
    business: "公司核心包含电动车销售、换电站、车主服务、软件功能与中国高端新能源车市场。",
    event: "代表事件包含量产车推出、换电网络扩张、子品牌布局与中国新能源车价格竞争。",
    focus: "玩家应注意交付量、毛利率、换电站成本、现金流、中国车市竞争与政策环境。",
  },
  ENPH: {
    name: "Enphase Energy",
    origin: "Enphase 以太阳能微型逆变器创建品牌，受住宅太阳能需求与利率环境影响明显。",
    business: "公司核心包含微型逆变器、储能电池、能源管理软件与住宅太阳能系统。",
    event: "代表事件包含微型逆变器普及、住宅太阳能成长、库存调整与利率变化拖累需求。",
    focus: "玩家应注意住宅太阳能安装量、渠道库存、利率、欧洲与美国需求、储能产品成长。",
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
    focus: "玩家应注意消费支出、跨境交易、汇率、监管费率、金融科技竞争与交易量成长。",
  },
  MA: {
    name: "Mastercard",
    origin: "Mastercard 是全球支付网络公司，与 Visa 类似受电子支付、跨境消费与交易量成长带动。",
    business: "公司核心包含支付处理、跨境交易、数据服务、资安与金融机构合作方案。",
    event: "代表事件包含无现金支付扩张、旅游复苏、数位钱包合作与实时支付竞争。",
    focus: "玩家应注意全球消费、跨境交易、监管费率、商户接受度、增值服务成长与竞争压力。",
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
    origin: "联发科从多媒体与手机芯片切入市场，后来成为全球行动 SoC 与通信芯片的重要供应商。",
    business: "公司核心包含手机芯片、智慧设备、Wi-Fi、车用与 ASIC，受手机需求与高端芯片竞争影响。",
    event: "代表事件包含手机芯片市占提升、Dimensity 品牌推进、5G 升级与非手机产品线扩张。",
    focus: "玩家应注意手机拉货、高端芯片渗透、毛利率、库存循环、AI 终端与中国手机品牌需求。",
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
    business: "公司核心是晶圆代工，服务通信、消费电子、车用、工控与电源管理等成熟制程需求。",
    event: "代表事件包含晶圆代工分工、成熟制程景气循环、产能扩张与特殊制程布局。",
    focus: "玩家应注意产能利用率、晶圆报价、成熟制程需求、车用工控订单与资本支出纪律。",
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
    business: "公司核心包含工业电脑、嵌入式板卡、边缘运算、智慧制造、交通与医疗场域解决方案。",
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
    focus: "玩家应注意油气价格、产量成长、开采成本、资本支出、自由现金流与回购股利。",
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
    origin: "Alibaba 从中国电商平台起家，扩张到云端、物流、本地生活、国际电商与数位服务。",
    business: "公司核心包含淘天电商、阿里云、国际电商、菜鸟物流与本地生活服务。",
    event: "代表事件包含电商平台成长、阿里云扩张、监管压力、组织拆分与国际电商竞争。",
    focus: "玩家应注意中国消费、平台竞争、云端成长、监管环境、回购与国际业务表现。",
  },
  PDD: {
    name: "PDD Holdings",
    origin: "PDD 以拼多多的社交电商与低价心智起家，后来透过 Temu 扩张海外电商市场。",
    business: "公司核心包含中国电商平台、广告与交易服务、Temu 跨境电商与供应链效率。",
    event: "代表事件包含拼团低价模式、农产品与下沉市场扩张、Temu 海外成长与补贴竞争。",
    focus: "玩家应注意中国消费、Temu 成长、行销费用、平台竞争、监管与利润率变化。",
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
    event: "代表事件包含搜索广告成长、AI 技术投入、Apollo 自动驾驶、生成式 AI 产品推出。",
    focus: "玩家应注意广告景气、AI 云端收入、大模型商业化、自动驾驶落地与中国科技监管。",
  },
  "9988_HK": {
    aliasOf: "BABA",
    name: "Alibaba HK",
  },
  "700_HK": {
    name: "Tencent",
    origin: "腾讯从实时通信与社群平台起家，成为中国游戏、社交、支付、广告与云服务的重要平台。",
    business: "公司核心包含微信生态、游戏、广告、金融科技、云服务与内容娱乐。",
    event: "代表事件包含微信普及、游戏业务成长、支付生态扩张、监管调整与视频号商业化。",
    focus: "玩家应注意游戏版号与流水、广告成长、微信生态变现、金融科技监管与云端竞争。",
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
    event: "这档股票的代表事件会在后续题库扩充时补齐，现在先以价格、量能与技术面变化创建学习节点。",
    focus: "玩家应先观察近期涨跌幅、成交量是否放大、技术指标是否同向，以及市场是否正在重新定价它的成长故事。",
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

function normalizeEducationFolders(knowledge, companyName) {
  const fallbackFolders = [
    {
      title: "公司起源故事",
      summary: knowledge.origin,
      details: ["这档股票尚未放入完整知识库，第一版先用通用公司分析框架补足。"],
    },
    {
      title: "主要产品",
      summary: knowledge.business,
      details: ["可以从产品服务、营收来源、客户族群与产业位置四个角度开始阅读。"],
    },
    {
      title: "代表事件",
      summary: knowledge.event,
      details: ["后续可以把财报转折、产品发表、产业事件与重大并购逐步补进题库。"],
    },
    {
      title: "观察重点",
      summary: knowledge.focus,
      details: ["先观察近期涨跌幅、成交量是否放大、技术指标是否同向，以及市场是否正在重新定价成长故事。"],
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
    if      (rsiVal >= 70) { reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（高档区）`, type: "high" }); }
    else if (rsiVal <= 30) { reasons.push({ label: `RSI ${rsiVal.toFixed(1)}（低档区）`, type: "low" }); }
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
打开分析页后，可以看到完整的 K 线、成交量、RSI 与 MACD 图表，以及 **RSI、MACD 与均线之间目前的相对位置**，方便自行检视这档股票的技术面数据。

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
2. 不要评价这档股票好或不好，只陈述数据变化大小与指标当前状态。
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
    summary: `${snapshot.name} 今天 ${changeLabel}，${pulseLabel}，本区间走势为「${snapshot.adviceSignal}」，是今日数据变化最大的一档。`,
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
      ? "RSI 高于 70，位于高档区。"
      : rsi <= 30
        ? "RSI 低于 30，位于低档区。"
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
5. 语气亲切但中立，只陈述事实，不替使用者做决定，且一律使用简体中文回答。`;

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
  console.log(`\n  ?? StockAI 后端启动！`);
  console.log(`  ?? http://localhost:${PORT}\n`);
});

export default app;

