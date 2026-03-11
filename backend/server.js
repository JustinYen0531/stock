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
const yahooFinance = new yfCtor();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

// 靜態前端
const frontendPath = path.join(__dirname, "..", "frontend");
app.use("/static", express.static(frontendPath));

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

// ═══════════════════════════════════════════════
// Gemini AI 聊天端點
// ═══════════════════════════════════════════════
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemContext + "\n\n用戶問題：" + message }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Gemini Error]", errText);
      return res.status(500).json({ error: "Gemini API 錯誤" });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "（無回應）";
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

app.get("/full/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const periodParam = req.query.period || "3mo";

  function subMonths(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }
  const periodMap = {
    "1mo": subMonths(1), "3mo": subMonths(3),
    "6mo": subMonths(6), "1y":  subMonths(12), "2y": subMonths(24),
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

