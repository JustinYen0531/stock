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
const HOMEPAGE_WATCHLIST_KEY = "homepageWatchlist";
const FALLBACK_HOMEPAGE_RECOMMENDATIONS = {
  featured: {
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    summary: "算力主線還在延續，價格結構與題材熱度仍是目前首頁最值得先看的代表股。",
    detail: "這張主卡刻意選一檔最適合直接點進分析的股票。NVIDIA 同時兼具 AI 題材、伺服器鏈熱度與高辨識度，能讓第一次進首頁的使用者快速理解這個推薦區的價值。",
    chips: [
      { label: "AI 推薦", tone: "primary" },
      { label: "半導體", tone: "warning" },
      { label: "量能放大", tone: "success" },
    ],
    reasons: ["RSI 回穩", "量價結構完整", "市場關注度高"],
    series: [22, 26, 25, 31, 35, 34, 38, 46, 44, 49, 54, 58],
  },
  hot: [
    {
      symbol: "AMD",
      name: "Advanced Micro Devices",
      blurb: "AI PC 與資料中心題材一起發酵，是首頁最容易被點進去的熱門股之一。",
      change: "+1.8%",
      trend: "up",
      reasons: ["伺服器鏈補漲", "熱門搜尋高", "價格結構轉強"],
      series: [16, 18, 19, 17, 21, 24, 23, 27, 26],
    },
    {
      symbol: "2330.TW",
      name: "台積電",
      blurb: "台灣龍頭代表股，穩定度高，也很適合當成題材與大盤情緒的觀察基準。",
      change: "+0.9%",
      trend: "up",
      reasons: ["台灣龍頭", "權值帶動", "基本面能見度高"],
      series: [24, 23, 25, 26, 28, 29, 28, 31, 33],
    },
    {
      symbol: "TSLA",
      name: "Tesla",
      blurb: "波動大、討論度高，適合放在熱門排行做快速掃描與題材判斷。",
      change: "-1.2%",
      trend: "down",
      reasons: ["討論熱度高", "波動擴大", "情緒指標股"],
      series: [31, 29, 28, 27, 25, 24, 23, 22, 20],
    },
  ],
  themes: [
    {
      id: "ai-chip",
      icon: "🧠",
      title: "AI 晶片",
      desc: "聚焦算力、伺服器與 GPU 主線。",
      picks: [
        { symbol: "NVDA", name: "NVIDIA" },
        { symbol: "AMD", name: "AMD" },
      ],
    },
    {
      id: "taiwan-core",
      icon: "🇹🇼",
      title: "台灣龍頭",
      desc: "優先看對指數影響力最高的核心權值。",
      picks: [
        { symbol: "2330.TW", name: "台積電" },
        { symbol: "2317.TW", name: "鴻海" },
      ],
    },
    {
      id: "steady-income",
      icon: "💸",
      title: "高股息",
      desc: "用 ETF 角度先建立防守型觀察名單。",
      picks: [
        { symbol: "0056.TW", name: "元大高股息" },
        { symbol: "00878.TW", name: "國泰永續高股息" },
      ],
    },
    {
      id: "future-motion",
      icon: "⚡",
      title: "電動車",
      desc: "適合觀察題材情緒與高波動反應。",
      picks: [
        { symbol: "TSLA", name: "Tesla" },
        { symbol: "RIVN", name: "Rivian" },
      ],
    },
  ],
};
const homepageRecommendationState = {
  featuredExpanded: false,
  hotExpanded: null,
  openThemes: new Set(),
  loading: false,
  error: "",
  statusText: "正在整理今日熱度與推薦...",
  source: "fallback",
  updatedAt: null,
};
let homepageRecommendationsInitialized = false;
let homepageRecommendationData = FALLBACK_HOMEPAGE_RECOMMENDATIONS;

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRecommendationUpdatedAt(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getHomepageWatchlist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOMEPAGE_WATCHLIST_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isHomepageWatched(symbol) {
  return getHomepageWatchlist().includes(symbol);
}

function toggleHomepageWatch(symbol) {
  const watchlist = new Set(getHomepageWatchlist());
  if (watchlist.has(symbol)) watchlist.delete(symbol);
  else watchlist.add(symbol);
  localStorage.setItem(HOMEPAGE_WATCHLIST_KEY, JSON.stringify(Array.from(watchlist)));
  renderHomepageRecommendations();
}

function buildSparklineSvg(series, color) {
  if (!Array.isArray(series) || series.length < 2) {
    return `
      <svg viewBox="0 0 420 110" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="55" x2="420" y2="55" stroke="${color}" stroke-width="3" stroke-dasharray="10 8" opacity="0.45"></line>
      </svg>
    `;
  }
  const width = 420;
  const height = 110;
  const fillId = `sparkFill-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(1, max - min);
  const points = series
    .map((value, index) => {
      const x = (index / Math.max(1, series.length - 1)) * width;
      const y = height - 18 - ((value - min) / range) * (height - 34);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32"></stop>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <polyline fill="url(#${fillId})" stroke="none" points="${areaPoints}"></polyline>
      <polyline fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
    </svg>
  `;
}

function getHomepageBackgroundFile(symbol) {
  return `/static/assets/homepage-backgrounds/${String(symbol || "").replace(/[^A-Za-z0-9]+/g, "_")}.svg`;
}

function getHomepageBackgroundStyle(symbol) {
  return `style="--stock-bg: url('${getHomepageBackgroundFile(symbol)}')"`;
}

function buildHomepageFeaturedCard() {
  const featured = homepageRecommendationData?.featured;
  if (!featured) {
    return `<div class="welcome-rec-feedback is-error">目前暫時沒有可用的主推薦，請稍後再試。</div>`;
  }
  const watched = isHomepageWatched(featured.symbol);
  return `
    <div class="welcome-rec-featured-shell homepage-stock-surface" ${getHomepageBackgroundStyle(featured.symbol)}>
      <div class="welcome-rec-featured-top">
        <div class="welcome-rec-symbol-group">
          <div class="welcome-rec-chip-row">
            ${featured.chips.map((chip) => `<span class="welcome-rec-chip${chip.tone === "warning" ? " is-warning" : chip.tone === "success" ? " is-success" : ""}">${escapeHtml(chip.label)}</span>`).join("")}
          </div>
          <div class="welcome-rec-symbol-row">
            <span class="welcome-rec-symbol">${escapeHtml(featured.symbol)}</span>
            <span class="welcome-rec-exchange">${escapeHtml(featured.exchange)}</span>
          </div>
          <div class="welcome-rec-name">${escapeHtml(featured.name)}</div>
        </div>
      </div>
      <div class="welcome-rec-headline">${escapeHtml(featured.summary)}</div>
      <div class="welcome-rec-reason-row">
        ${featured.reasons.map((reason) => `<span class="welcome-rec-reason">${escapeHtml(reason)}</span>`).join("")}
      </div>
      <div class="welcome-rec-sparkline">${buildSparklineSvg(featured.series, "#38BDF8")}</div>
      <div class="welcome-rec-featured-actions">
        <button class="welcome-rec-button is-primary" data-action="analyze" data-symbol="${escapeHtml(featured.symbol)}">立即分析</button>
        <button class="welcome-rec-button is-secondary" data-action="toggle-featured-detail">${homepageRecommendationState.featuredExpanded ? "收起理由" : "看理由"}</button>
        <button class="welcome-rec-button ${watched ? "is-watched" : "is-ghost"}" data-action="watch" data-symbol="${escapeHtml(featured.symbol)}">${watched ? "已加入觀察" : "加入觀察"}</button>
      </div>
      <div class="welcome-rec-featured-detail" ${homepageRecommendationState.featuredExpanded ? "" : "hidden"}>
        <p class="welcome-rec-detail-copy">${escapeHtml(featured.detail)}</p>
      </div>
    </div>
  `;
}

function buildHomepageHotRows() {
  const hotList = homepageRecommendationData?.hot || [];
  if (!hotList.length) {
    return `<div class="welcome-rec-feedback is-error">熱門排行暫時抓不到資料，先休息一下。</div>`;
  }
  return hotList
    .map((item, index) => {
      const watched = isHomepageWatched(item.symbol);
      const expanded = homepageRecommendationState.hotExpanded === index;
      return `
        <article class="welcome-rec-hot-row homepage-stock-surface" ${getHomepageBackgroundStyle(item.symbol)} data-action="analyze" data-symbol="${escapeHtml(item.symbol)}">
          <div class="welcome-rec-hot-top">
            <div class="welcome-rec-hot-main">
              <div class="welcome-rec-hot-meta">
                <span class="welcome-rec-rank">${index + 1}</span>
                <div>
                  <div class="welcome-rec-hot-symbol">${escapeHtml(item.symbol)}</div>
                  <div class="welcome-rec-hot-name">${escapeHtml(item.name)}</div>
                </div>
              </div>
              <p class="welcome-rec-hot-blurb">${escapeHtml(item.blurb)}</p>
            </div>
            <div class="welcome-rec-hot-change${item.trend === "down" ? " is-down" : ""}">${escapeHtml(item.change)}</div>
          </div>
          <div class="welcome-rec-row-actions">
            <button class="welcome-rec-inline-button" data-action="toggle-hot-detail" data-hot-index="${index}">${expanded ? "收起理由" : "看理由"}</button>
            <button class="welcome-rec-inline-button ${watched ? "is-watch-active" : ""}" data-action="watch" data-symbol="${escapeHtml(item.symbol)}">${watched ? "已觀察" : "加入觀察"}</button>
          </div>
          <div class="welcome-rec-hot-reasons" ${expanded ? "" : "hidden"}>
            <div class="welcome-rec-reason-row">
              ${item.reasons.map((reason) => `<span class="welcome-rec-reason">${escapeHtml(reason)}</span>`).join("")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildHomepageThemeCards() {
  const themes = homepageRecommendationData?.themes || [];
  if (!themes.length) {
    return `<div class="welcome-rec-feedback is-error">主題精選還沒準備好，等一下就會回來。</div>`;
  }
  return themes
    .map((theme) => {
      const expanded = homepageRecommendationState.openThemes.has(theme.id);
      const coverSymbol = theme.picks?.[0]?.symbol || "";
      return `
        <article class="welcome-rec-theme-card homepage-stock-surface" ${getHomepageBackgroundStyle(coverSymbol)}>
          <div class="welcome-rec-theme-top" data-action="toggle-theme-detail" data-theme-id="${escapeHtml(theme.id)}">
            <span class="welcome-rec-theme-icon">${escapeHtml(theme.icon)}</span>
            <div class="welcome-rec-theme-main">
              <div class="welcome-rec-theme-title">${escapeHtml(theme.title)}</div>
              <p class="welcome-rec-theme-desc">${escapeHtml(theme.desc)}</p>
            </div>
          </div>
          <div class="welcome-rec-theme-detail" ${expanded ? "" : "hidden"}>
            <div class="welcome-rec-theme-picks">
              ${theme.picks.map((pick) => {
                const watched = isHomepageWatched(pick.symbol);
                return `
                  <div class="welcome-rec-pick-chip homepage-stock-surface" ${getHomepageBackgroundStyle(pick.symbol)}>
                    <div>
                      <div class="welcome-rec-pick-symbol">${escapeHtml(pick.symbol)}</div>
                      <div class="welcome-rec-pick-name">${escapeHtml(pick.name)}</div>
                    </div>
                    <div class="welcome-rec-pick-actions">
                      <button class="welcome-rec-inline-button" data-action="analyze" data-symbol="${escapeHtml(pick.symbol)}">分析</button>
                      <button class="welcome-rec-inline-button ${watched ? "is-watch-active" : ""}" data-action="watch" data-symbol="${escapeHtml(pick.symbol)}">${watched ? "已觀察" : "加入觀察"}</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildHomepageLoadingState(copy) {
  return `<div class="welcome-rec-feedback is-loading">${escapeHtml(copy)}</div>`;
}

function updateHomepageRecommendationStatus() {
  const statusEl = $("homepageRecommendationStatus");
  if (!statusEl) return;
  statusEl.classList.remove("is-live", "is-error");
  if (homepageRecommendationState.error) statusEl.classList.add("is-error");
  else if (homepageRecommendationState.source === "live") statusEl.classList.add("is-live");
  statusEl.textContent = homepageRecommendationState.statusText;
}

function renderHomepageRecommendations() {
  if (homepageRecommendationState.loading && homepageRecommendationState.source !== "live") {
    $("homepageFeaturedRecommendation").innerHTML = buildHomepageLoadingState("正在抓取今日最值得先看的股票...");
    $("homepageHotRecommendations").innerHTML = buildHomepageLoadingState("正在同步市場熱度排行...");
    $("homepageThemeRecommendations").innerHTML = buildHomepageLoadingState("正在整理主題精選...");
  } else {
    $("homepageFeaturedRecommendation").innerHTML = buildHomepageFeaturedCard();
    $("homepageHotRecommendations").innerHTML = buildHomepageHotRows();
    $("homepageThemeRecommendations").innerHTML = buildHomepageThemeCards();
  }
  $("homepageWatchCount").textContent = String(getHomepageWatchlist().length);
  updateHomepageRecommendationStatus();
}

async function loadHomepageRecommendations() {
  homepageRecommendationState.loading = true;
  homepageRecommendationState.error = "";
  homepageRecommendationState.statusText = "正在同步今日熱度與技術面...";
  renderHomepageRecommendations();

  try {
    const res = await fetch(`${API_BASE}/homepage-recommendations`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "首頁推薦暫時抓取失敗");
    }

    const data = await res.json();
    if (!data?.featured || !Array.isArray(data.hot) || !Array.isArray(data.themes)) {
      throw new Error("首頁推薦資料格式不正確");
    }

    homepageRecommendationData = data;
    homepageRecommendationState.source = data.source || "live";
    homepageRecommendationState.updatedAt = data.generatedAt || null;
    homepageRecommendationState.statusText = data.generatedAt
      ? `已依 ${formatRecommendationUpdatedAt(data.generatedAt)} 的市場資料更新`
      : "已更新今日熱度與推薦";
  } catch (error) {
    homepageRecommendationState.error = error.message;
    homepageRecommendationState.source = "fallback";
    homepageRecommendationState.statusText = "即時推薦暫時不可用，先顯示預設名單";
    console.error("[Homepage Recommendations]", error);
  } finally {
    homepageRecommendationState.loading = false;
    renderHomepageRecommendations();
  }
}

function initHomepageRecommendations() {
  if (homepageRecommendationsInitialized) return;
  homepageRecommendationsInitialized = true;
  const container = $("welcomeRecommendations");
  if (!container) return;

  container.addEventListener("click", (event) => {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const symbol = actionEl.dataset.symbol;
    const themeId = actionEl.dataset.themeId;
    const hotIndex = actionEl.dataset.hotIndex;

    if (action !== "analyze") {
      event.preventDefault();
      event.stopPropagation();
    }

    if (action === "analyze" && symbol) {
      quickSearch(symbol);
      return;
    }
    if (action === "watch" && symbol) {
      toggleHomepageWatch(symbol);
      return;
    }
    if (action === "toggle-featured-detail") {
      homepageRecommendationState.featuredExpanded = !homepageRecommendationState.featuredExpanded;
      renderHomepageRecommendations();
      return;
    }
    if (action === "toggle-hot-detail" && hotIndex !== undefined) {
      const index = Number(hotIndex);
      homepageRecommendationState.hotExpanded = homepageRecommendationState.hotExpanded === index ? null : index;
      renderHomepageRecommendations();
      return;
    }
    if (action === "toggle-theme-detail" && themeId) {
      if (homepageRecommendationState.openThemes.has(themeId)) homepageRecommendationState.openThemes.delete(themeId);
      else homepageRecommendationState.openThemes.add(themeId);
      renderHomepageRecommendations();
    }
  });

  renderHomepageRecommendations();
  loadHomepageRecommendations();
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

  $("stat-ma5").textContent = ma5Val ? ma5Val.toFixed(2) : "—";
  $("stat-ma20").textContent = ma20Val ? ma20Val.toFixed(2) : "—";
  $("stat-ma60").textContent = ma60Val ? ma60Val.toFixed(2) : "—";
  $("stat-rsi").textContent = rsiVal ? rsiVal.toFixed(1) : "—";
  $("stat-macd").textContent = macdVal ? macdVal.toFixed(4) : "—";
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

  // 儲存給滑雪遊戲使用
  window.currentGameData = {
    symbol,
    dates,
    closes: ohlcv.map(d => d.Close),
    period: $("periodSelect").value,
  };
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
    return d.Close >= ohlcv[i - 1].Close
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
window.renderDashboard = function (data) {
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

// ── 滑雪遊戲啟動 ──────────────────────────────────
let lobbyHighDetailMode = false;

function toggleLobbyDetailMode() {
  lobbyHighDetailMode = !lobbyHighDetailMode;
  const btn = document.getElementById('lobbyDetailToggle');
  if (btn) {
    btn.classList.toggle('active', lobbyHighDetailMode);
    btn.querySelector('.detail-label').textContent = lobbyHighDetailMode ? '高細節：開啟' : '視覺細節';
  }
}

function launchSkiGame() {
  if (!window.currentGameData) {
    alert('請先載入一支股票再開始滑雪！');
    return;
  }
  if (window.SkiGame) {
    window.SkiGame.launch(window.currentGameData, { highDetail: lobbyHighDetailMode });
  }
}

function launchSkiGamePractice() {
  if (!window.currentGameData) {
    alert('請先載入一支股票再開始練習！');
    return;
  }
  const steepness  = parseInt(document.getElementById('steepnessSlider')?.value ?? 40);
  const hitboxSize = parseInt(document.getElementById('hitboxSlider')?.value ?? 60);
  let startPct = parseInt(document.getElementById('rangeStart')?.value ?? 0);
  let endPct   = parseInt(document.getElementById('rangeEnd')?.value ?? 100);
  // 防呆：確保 start < end 且在 0~100
  startPct = Math.max(0, Math.min(99, startPct));
  endPct   = Math.max(startPct + 1, Math.min(100, endPct));
  if (window.SkiGame) {
    window.SkiGame.launch(window.currentGameData, { 
      practice: true, 
      steepness, 
      hitboxSize, 
      startPct, 
      endPct,
      highDetail: lobbyHighDetailMode
    });
  }
}

function getSkiDifficultyState() {
  const steepness  = parseInt(document.getElementById('steepnessSlider')?.value ?? 100, 10);
  const hitboxSize = parseInt(document.getElementById('hitboxSlider')?.value ?? 1, 10);
  const startPct   = parseInt(document.getElementById('rangeStart')?.value ?? 0, 10);
  const endPct     = parseInt(document.getElementById('rangeEnd')?.value ?? 100, 10);
  const isNormal = steepness === 100 && hitboxSize === 1 && startPct === 0 && endPct === 100;
  return { steepness, hitboxSize, startPct, endPct, isNormal };
}

function updateSkiLaunchButton() {
  const button = document.getElementById('skiLaunchButton');
  const icon = document.getElementById('skiLaunchIcon');
  const text = document.getElementById('skiLaunchText');
  if (!button || !icon || !text) return;

  const state = getSkiDifficultyState();
  button.classList.toggle('ski-launch-practice', !state.isNormal);
  button.title = state.isNormal ? '把這支股票變成滑雪關卡！' : '使用目前滑桿設定進入練習模式';
  icon.textContent = state.isNormal ? '🎿' : '🟡';
  text.textContent = state.isNormal ? '開始！' : '練習模式';
}

function getSkiMedalState() {
  try {
    return JSON.parse(localStorage.getItem('skiMedals') || '{}');
  } catch {
    return {};
  }
}

function updateSkiMedals() {
  const medals = getSkiMedalState();
  document.getElementById('medalPractice')?.classList.toggle('is-earned', !!medals.practiceComplete);
  document.getElementById('medalNormal')?.classList.toggle('is-earned', !!medals.normalComplete);
  document.getElementById('medalStars')?.classList.toggle('is-earned', !!medals.threeStars);
}

function launchSkiGameAdaptive() {
  const state = getSkiDifficultyState();
  if (state.isNormal) {
    launchSkiGame();
    return;
  }
  launchSkiGamePractice();
}

// 快速設定練習區間
function setPracticeRange(start, end) {
  const s = document.getElementById('rangeStart');
  const e = document.getElementById('rangeEnd');
  if (s) s.value = start;
  if (e) e.value = end;
  updateSkiLaunchButton();
}

// 滑桿初始化：讓 CSS --val 變數追蹤滑桿進度（填色效果）
(function initSliders() {
  function syncSlider(el) {
    if (!el) return;
    el.style.setProperty('--val', el.value);
    el.addEventListener('input', () => {
      el.style.setProperty('--val', el.value);
      updateSkiLaunchButton();
    });
  }
  function bindRange(el) {
    if (!el) return;
    el.addEventListener('input', updateSkiLaunchButton);
    el.addEventListener('change', updateSkiLaunchButton);
  }
  // DOM 可能還沒 ready，等一下
  document.addEventListener('DOMContentLoaded', () => {
    setNormalPreset();
    syncSlider(document.getElementById('steepnessSlider'));
    syncSlider(document.getElementById('hitboxSlider'));
    bindRange(document.getElementById('rangeStart'));
    bindRange(document.getElementById('rangeEnd'));
    updateSkiLaunchButton();
    updateSkiMedals();
  });
  // 若已 ready 則立即執行
  if (document.readyState !== 'loading') {
    setNormalPreset();
    syncSlider(document.getElementById('steepnessSlider'));
    syncSlider(document.getElementById('hitboxSlider'));
    bindRange(document.getElementById('rangeStart'));
    bindRange(document.getElementById('rangeEnd'));
    updateSkiLaunchButton();
    updateSkiMedals();
  }
})();

(function initHomepageRecommendationSurface() {
  document.addEventListener("DOMContentLoaded", initHomepageRecommendations);
  if (document.readyState !== "loading") {
    initHomepageRecommendations();
  }
})();

// 預設：正常難度（陡峭=100, 碰撞=1）
function setNormalPreset() {
  const s = document.getElementById('steepnessSlider');
  const h = document.getElementById('hitboxSlider');
  if (s) { s.value = 100; s.style.setProperty('--val', 100); document.getElementById('steepnessVal').textContent = 100; }
  if (h) { h.value = 1;   h.style.setProperty('--val', 1);   document.getElementById('hitboxVal').textContent = 1; }
  const rs = document.getElementById('rangeStart');
  const re = document.getElementById('rangeEnd');
  if (rs) rs.value = 0;
  if (re) re.value = 100;
  updateSkiLaunchButton();
}

// ── 分類股票選股器 ─────────────────────────────────
let _pickerOpen = false;

function toggleStockPicker() {
  _pickerOpen = !_pickerOpen;
  const panel = $('stockPickerPanel');
  const toggle = $('stockPickerToggle');
  const arrow = $('pickerArrow');

  if (_pickerOpen) {
    panel.classList.remove('hidden');
    toggle.classList.add('active');
    arrow.classList.add('open');
    // Focus search box
    setTimeout(() => { const s = $('pickerSearchInput'); if(s) s.focus(); }, 80);
  } else {
    panel.classList.add('hidden');
    toggle.classList.remove('active');
    arrow.classList.remove('open');
    // Reset search
    const s = $('pickerSearchInput');
    if (s) { s.value = ''; filterPickerStocks(); }
  }
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (!_pickerOpen) return;
  const panel = $('stockPickerPanel');
  const inner = panel?.querySelector('.picker-panel-inner');
  const toggle = $('stockPickerToggle');
  if (inner && !inner.contains(e.target) && !toggle.contains(e.target)) {
    toggleStockPicker();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _pickerOpen) toggleStockPicker();
});

function pickStock(symbol) {
  toggleStockPicker();
  $('symbolInput').value = symbol;
  loadStock();
}

function filterPickerStocks() {
  const q = ($('pickerSearchInput').value || '').toLowerCase().trim();
  const categories = document.querySelectorAll('.picker-category');

  categories.forEach(cat => {
    const btns = cat.querySelectorAll('.picker-stock-btn');
    let anyVisible = false;
    btns.forEach(btn => {
      const sym = (btn.querySelector('.ps-sym')?.textContent || '').toLowerCase();
      const name = (btn.dataset.name || '').toLowerCase();
      const match = !q || sym.includes(q) || name.includes(q);
      btn.classList.toggle('hidden', !match);
      if (match) anyVisible = true;
    });
    cat.classList.toggle('all-hidden', !anyVisible);
  });
}
