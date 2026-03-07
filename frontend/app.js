/* ═══════════════════════════════════════════════
   app.js - StockAI 互動邏輯 + Chart.js 圖表
   ═══════════════════════════════════════════════ */

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000"
  : ""; // 在 Vercel 上時使用相對路徑

// 當前圖表實例
let priceChart = null;
let volumeChart = null;
let rsiChart = null;
let macdChart = null;

// ── 工具函數 ─────────────────────────────────────
function $(id) { return document.getElementById(id); }

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(2);
}

function lastVal(arr) {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i];
  }
  return null;
}

// ── 快捷搜尋 ─────────────────────────────────────
function quickSearch(symbol) {
  $("symbolInput").value = symbol;
  loadStock();
}

// ── Enter 鍵觸發 ──────────────────────────────────
$("symbolInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadStock();
});

// ── Tab 切換 ──────────────────────────────────────
function switchTab(tab) {
  ["price", "rsi", "macd"].forEach(t => {
    $(`panel-${t}`).classList.toggle("hidden", t !== tab);
    $(`tab-${t}`).classList.toggle("active", t === tab);
  });
}

// ── 主載入函數 ────────────────────────────────────
async function loadStock() {
  const symbol = $("symbolInput").value.trim().toUpperCase();
  if (!symbol) return;

  const period = $("periodSelect").value;

  // UI 狀態
  setLoading(true);
  $("welcomePage").classList.add("hidden");
  $("dashboard").classList.add("hidden");
  $("errorBox").classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE}/full/${symbol}?period=${period}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "未知錯誤");
    }

    const data = await res.json();
    renderDashboard(data);
    $("dashboard").classList.remove("hidden");

  } catch (e) {
    $("errorMsg").textContent = `❌ ${e.message}`;
    $("errorBox").classList.remove("hidden");
    $("welcomePage").classList.remove("hidden");
    console.error(e);
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  $("searchBtn").disabled = loading;
  $("searchBtnText").textContent = loading ? "載入中..." : "分析";
  $("searchSpinner").classList.toggle("hidden", !loading);
}

// ── 渲染儀表板 ────────────────────────────────────
function renderDashboard(data) {
  const { symbol, info, dates, ohlcv, indicators, advice } = data;

  // 基本資訊
  $("stockName").textContent = info?.name || symbol;
  $("stockSymbol").textContent = symbol;
  $("stockExchange").textContent = info?.exchange || "";

  // 最新收盤
  const last = ohlcv[ohlcv.length - 1];
  const prev = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : null;
  const close = last.Close;
  const change = prev ? ((close - prev.Close) / prev.Close * 100) : 0;

  $("latestClose").textContent = close.toFixed(2) + " " + (info?.currency || "");
  $("priceChange").textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";
  $("priceChange").className = "stat-value " + (change >= 0 ? "up" : "down");
  $("latestVolume").textContent = formatNumber(last.Volume);

  // 指標數值
  const rsiVal = lastVal(indicators.rsi);
  const macdVal = lastVal(indicators.macd);
  const signalVal = lastVal(indicators.signal);
  const ma5Val = lastVal(indicators.ma5);
  const ma20Val = lastVal(indicators.ma20);
  const ma60Val = lastVal(indicators.ma60);

  $("stat-ma5").textContent  = ma5Val  ? ma5Val.toFixed(2)  : "—";
  $("stat-ma20").textContent = ma20Val ? ma20Val.toFixed(2) : "—";
  $("stat-ma60").textContent = ma60Val ? ma60Val.toFixed(2) : "—";
  $("stat-rsi").textContent  = rsiVal  ? rsiVal.toFixed(1)  : "—";
  $("stat-macd").textContent   = macdVal   ? macdVal.toFixed(4)   : "—";
  $("stat-signal").textContent = signalVal ? signalVal.toFixed(4) : "—";

  // RSI 顏色
  if (rsiVal) {
    const el = $("stat-rsi");
    if (rsiVal < 30) el.style.color = "var(--bull)";
    else if (rsiVal > 70) el.style.color = "var(--bear)";
    else el.style.color = "";
  }

  // 投資建議
  renderAdvice(advice);

  // 圖表
  renderPriceChart(dates, ohlcv, indicators);
  renderVolumeChart(dates, ohlcv);
  renderRSIChart(dates, indicators.rsi);
  renderMACDChart(dates, indicators);
}

// ── 投資建議渲染 ──────────────────────────────────
function renderAdvice(advice) {
  $("signalBadge").textContent = advice.signal;
  $("signalBadge").className = "signal-badge " + advice.signal_type;
  $("adviceSummary").textContent = advice.summary;
  $("adviceDisclaimer").textContent = advice.disclaimer;

  const reasonsEl = $("adviceReasons");
  reasonsEl.innerHTML = "";
  (advice.reasons || []).forEach(r => {
    const tag = document.createElement("span");
    tag.className = `reason-tag ${r.type}`;
    tag.textContent = r.label;
    reasonsEl.appendChild(tag);
  });
}

// ── Chart.js 設定 ─────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      labels: { color: "#7b9cc4", font: { size: 11 }, boxWidth: 16 }
    },
    tooltip: {
      backgroundColor: "rgba(9,14,26,0.95)",
      borderColor: "#1e2d45",
      borderWidth: 1,
      titleColor: "#e8f0fe",
      bodyColor: "#7b9cc4",
      padding: 10,
    }
  },
  scales: {
    x: {
      grid: { color: "rgba(30,45,69,0.6)" },
      ticks: { color: "#3d5a80", maxRotation: 0, maxTicksLimit: 8, font: { size: 10 } }
    },
    y: {
      grid: { color: "rgba(30,45,69,0.6)" },
      ticks: { color: "#3d5a80", font: { size: 10 } }
    }
  }
};

function destroyChart(chart) { if (chart) { chart.destroy(); } return null; }

// ── K線圖 + MA ────────────────────────────────────
function renderPriceChart(dates, ohlcv, indicators) {
  priceChart = destroyChart(priceChart);
  const closes = ohlcv.map(d => d.Close);

  // 蠟燭圖資料用 OHLC 顏色模擬（用 bar chart 做視覺）
  // 實作：用 Close 折線圖代替（避免需要外部插件）
  const ctx = $("priceChart").getContext("2d");
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "收盤價",
          data: closes,
          borderColor: "#60a5fa",
          backgroundColor: "rgba(96,165,250,0.08)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: "MA5",
          data: indicators.ma5,
          borderColor: "#f59e0b",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: "MA20",
          data: indicators.ma20,
          borderColor: "#a855f7",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: "MA60",
          data: indicators.ma60,
          borderColor: "#f43f5e",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
      ]
    },
    options: { ...CHART_DEFAULTS }
  });
}

// ── 成交量 ────────────────────────────────────────
function renderVolumeChart(dates, ohlcv) {
  volumeChart = destroyChart(volumeChart);
  const volumes = ohlcv.map(d => d.Volume);
  const colors = ohlcv.map((d, i) => {
    if (i === 0) return "rgba(96,165,250,0.5)";
    return d.Close >= ohlcv[i-1].Close
      ? "rgba(34,197,94,0.5)"
      : "rgba(239,68,68,0.5)";
  });

  const ctx = $("volumeChart").getContext("2d");
  volumeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dates,
      datasets: [{
        label: "成交量",
        data: volumes,
        backgroundColor: colors,
        borderWidth: 0,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false }
      },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, display: false },
        y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => formatNumber(v) } }
      }
    }
  });
}

// ── RSI ───────────────────────────────────────────
function renderRSIChart(dates, rsiData) {
  rsiChart = destroyChart(rsiChart);
  const ctx = $("rsiChart").getContext("2d");

  rsiChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "RSI(14)",
          data: rsiData,
          borderColor: "#a78bfa",
          backgroundColor: "rgba(167,139,250,0.08)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        },
        {
          label: "超買線 70",
          data: new Array(dates.length).fill(70),
          borderColor: "rgba(239,68,68,0.6)",
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: "超賣線 30",
          data: new Array(dates.length).fill(30),
          borderColor: "rgba(34,197,94,0.6)",
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: CHART_DEFAULTS.scales.x,
        y: {
          ...CHART_DEFAULTS.scales.y,
          min: 0,
          max: 100,
          ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 10 }
        }
      }
    }
  });
}

// ── MACD ──────────────────────────────────────────
function renderMACDChart(dates, indicators) {
  macdChart = destroyChart(macdChart);
  const { macd, signal, histogram } = indicators;
  const histColors = (histogram || []).map(v =>
    v >= 0 ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)"
  );

  const ctx = $("macdChart").getContext("2d");
  macdChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dates,
      datasets: [
        {
          type: "bar",
          label: "Histogram",
          data: histogram,
          backgroundColor: histColors,
          borderWidth: 0,
          order: 3,
        },
        {
          type: "line",
          label: "MACD",
          data: macd,
          borderColor: "#60a5fa",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          order: 1,
        },
        {
          type: "line",
          label: "Signal",
          data: signal,
          borderColor: "#f87171",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          order: 2,
        },
      ]
    },
    options: { ...CHART_DEFAULTS }
  });
}

// ═══════════════════════════════════════════════
// AI 聊天功能
// ═══════════════════════════════════════════════
let currentStockContext = null;

const _origRenderDashboard = renderDashboard;
window.renderDashboard = function(data) {
  _origRenderDashboard(data);
  const { symbol, info, ohlcv, indicators, advice } = data;
  const close = ohlcv[ohlcv.length - 1]?.Close;
  currentStockContext = {
    symbol,
    name: info?.name || symbol,
    close: close?.toFixed(2),
    rsi: lastVal(indicators.rsi)?.toFixed(1),
    macd: lastVal(indicators.macd)?.toFixed(4),
    signal: lastVal(indicators.signal)?.toFixed(4),
    ma5: lastVal(indicators.ma5)?.toFixed(2),
    ma20: lastVal(indicators.ma20)?.toFixed(2),
    ma60: lastVal(indicators.ma60)?.toFixed(2),
    advice: advice?.signal,
    score: advice?.score,
  };
  const sub = document.getElementById("chatSubtitle");
  if (sub) sub.textContent = `正在分析：${info?.name || symbol}`;
};

function toggleChat() {
  const panel = document.getElementById("chatPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    setTimeout(() => document.getElementById("chatInput")?.focus(), 100);
  }
}

function sendHint(el) {
  const text = el.textContent.replace(/「|」/g, "").trim();
  document.getElementById("chatInput").value = text;
  sendChat();
}

function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  appendMessage("user", msg);
  setChatLoading(true);
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, context: currentStockContext }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    appendMessage("ai", data.reply);
  } catch (e) {
    appendMessage("ai", `⚠️ 發生錯誤：${e.message}`);
  } finally {
    setChatLoading(false);
  }
}

function appendMessage(role, text) {
  const messages = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = simpleMarkdown(text);
  div.appendChild(bubble);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function simpleMarkdown(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

function setChatLoading(loading) {
  const sendBtn = document.getElementById("chatSendBtn");
  const sendIcon = document.getElementById("chatSendIcon");
  const sendSpinner = document.getElementById("chatSendSpinner");
  sendBtn.disabled = loading;
  sendIcon.classList.toggle("hidden", loading);
  sendSpinner.classList.toggle("hidden", !loading);
  if (loading) {
    const messages = document.getElementById("chatMessages");
    const typing = document.createElement("div");
    typing.className = "chat-msg ai";
    typing.id = "typingIndicator";
    typing.innerHTML = `<div class="chat-bubble typing-dots"><span></span><span></span><span></span></div>`;
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
  } else {
    document.getElementById("typingIndicator")?.remove();
  }
}
// ── 科普小教室 互動邏輯 ──────────────────────────────
function expandKnowledge(index) {
  const container = $("welcomeKnowledge");
  const grid = $("knowledgeGrid");
  const backBtn = $("knowledgeBackBtn");
  const title = $("knowledgeTitle");
  
  // 先滾動到科普區
  container.scrollIntoView({ behavior: "smooth", block: "start" });
  
  // 設置 Grid 狀態
  grid.classList.add("expanded");
  backBtn.classList.remove("hidden");
  title.classList.add("hidden");
  
  // 處理各個項目
  for (let i = 0; i < 4; i++) {
    const item = $(`k-item-${i}`);
    if (i === index) {
      item.classList.add("expanded");
      item.classList.remove("hidden");
      item.querySelector(".k-detail").classList.remove("hidden");
    } else {
      item.classList.add("hidden");
      item.classList.remove("expanded");
    }
  }
}

function resetKnowledge() {
  const grid = $("knowledgeGrid");
  const backBtn = $("knowledgeBackBtn");
  const title = $("knowledgeTitle");
  
  grid.classList.remove("expanded");
  backBtn.classList.add("hidden");
  title.classList.remove("hidden");
  
  for (let i = 0; i < 4; i++) {
    const item = $(`k-item-${i}`);
    item.classList.remove("expanded", "hidden");
    item.querySelector(".k-detail").classList.add("hidden");
  }
}
