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
  const prompt = `你是一位股票首頁編輯，請用繁體中文為今天首頁推薦的 ${snapshot.symbol}${snapshot.name ? `（${snapshot.name}）` : ""} 撰寫一段完整推薦敘述，並且一定要使用 Markdown 格式。

請根據以下資料撰寫：
- 單日漲跌幅：${formatPct(snapshot.changePercent)}
- 5 日動能：${formatPct(snapshot.momentum5d)}
- 量能脈衝：${snapshot.volumePulse.toFixed(1)}x
- 技術面訊號：${snapshot.adviceSignal}
- 技術面理由：${snapshot.adviceReasons.join("、")}

限制：
1. 必須使用這 5 個二級標題：## 起始、## 過程一、## 過程二、## 過程三、## 結尾。
2. 每個標題下都至少寫 1 小段完整敘述，不能只有一句片語。
3. 內容要像首頁推薦文案，不要像研究報告，也不要條列。
4. 起始講為什麼今天先看它；三段過程分別講市場氣氛、技術面、使用者點進分析頁會看到什麼；結尾做收束。
5. 不要加免責聲明，不要輸出其他標題。`;

  try {
    return await generateGeminiText(prompt, { temperature: 0.6, maxOutputTokens: 520 });
  } catch (error) {
    console.error("[Homepage Gemini Reason]", error.message);
    return `## 起始
${snapshot.name} 今天同時具備 ${buildHeatReason(snapshot)} 與技術面「${snapshot.adviceSignal}」訊號，因此值得被放在首頁最前面。

## 過程一
從市場節奏來看，這檔股票不只是有波動，量能也沒有掉下去，代表它不是單純被動跟漲，而是真的有資金在看。

## 過程二
技術面上，目前最值得先看的是 ${snapshot.adviceReasons.join("、")}，這些訊號放在一起時，會讓今天的走勢判讀更清楚。

## 過程三
如果現在點進分析頁，最先要對照的是 RSI、MACD 和均線彼此是否仍然朝同一個方向，確認這個推薦是不是還站得住腳。

## 結尾
也就是說，這檔不是只有題材熱，而是熱度、量能與技術面同時有畫面，所以適合當成今天先看的第一檔。`;
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

