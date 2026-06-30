/* ═══════════════════════════════════════════════
   app.js - StockAI 互动逻辑 + Chart.js 图表
   ═══════════════════════════════════════════════ */

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:8000"
  : ""; // 在 Vercel 上时使用相对路径

// 当前图表实例
let priceChart = null;
let volumeChart = null;
let rsiChart = null;
let macdChart = null;
let currentEducationData = null;
const HOMEPAGE_WATCHLIST_KEY = "homepageWatchlist";
const FALLBACK_HOMEPAGE_RECOMMENDATIONS = {
  featured: {
    symbol: "BABA",
    name: "Alibaba",
    exchange: "NYSE",
    summary: "中国消费、平台效率与云端叙事重新回到画面中央，现在最适合先打开来看的是 Alibaba。",
    detail: "这张主卡先把中国市场放在最前面。Alibaba 同时连着中国消费复苏、平台竞争、国际电商与云端业务，能让首页一进来就先抓住中国主线，再往美股与台股延伸。",
    chips: [
      { label: "中国主线", tone: "primary" },
      { label: "平台经济", tone: "warning" },
      { label: "云端叙事", tone: "success" },
    ],
    reasons: ["中国消费观察窗", "平台现金流稳", "港中美连动高"],
    series: [18, 20, 22, 24, 23, 27, 29, 31, 30, 34, 36, 39],
  },
  hot: [
    {
      symbol: "PDD",
      name: "PDD Holdings",
      blurb: "中国电商与 Temu 出海叙事还很有张力，放在热门区很适合快速看资金是否续抱。",
      change: "+2.1%",
      trend: "up",
      reasons: ["中国消费热度", "跨境电商叙事", "增长股弹性高"],
      series: [15, 17, 19, 18, 21, 25, 24, 28, 30],
    },
    {
      symbol: "NVDA",
      name: "NVIDIA",
      blurb: "美股这边就用算力总指挥做辅助观察，看看海外风险偏好有没有继续帮中国题材抬轿。",
      change: "+1.4%",
      trend: "up",
      reasons: ["AI 指标股", "海外风险偏好", "量价延续"],
      series: [22, 24, 23, 27, 31, 30, 34, 38, 41],
    },
    {
      symbol: "2330.TW",
      name: "台积电",
      blurb: "台股这边保留最核心的供应链观测点，拿来确认中国与美股 AI 主线有没有同步返回到制造端。",
      change: "+0.7%",
      trend: "up",
      reasons: ["供应链验证点", "权值代表股", "制造端温度计"],
      series: [24, 24, 25, 27, 28, 29, 29, 31, 32],
    },
  ],
  themes: [
    {
      id: "china-core",
      icon: "🐉",
      title: "中国核心",
      desc: "先看中国平台、消费、AI 与港股科技主线。",
      picks: [
        { symbol: "BABA", name: "Alibaba" },
        { symbol: "700.HK", name: "Tencent" },
      ],
    },
    {
      id: "us-tech",
      icon: "💻",
      title: "美股科技",
      desc: "用美股科技做海外对照与补充。",
      picks: [
        { symbol: "NVDA", name: "NVIDIA" },
        { symbol: "MSFT", name: "Microsoft" },
      ],
    },
    {
      id: "taiwan-core",
      icon: "🇹🇼",
      title: "台湾地区",
      desc: "最后回看台湾地区供应链与核心权值。",
      picks: [
        { symbol: "2330.TW", name: "台积电" },
        { symbol: "2317.TW", name: "鸿海" },
      ],
    },
    {
      id: "ai-chip",
      icon: "🧠",
      title: "AI 芯片",
      desc: "把全球算力链放在同一张图上看。",
      picks: [
        { symbol: "NVDA", name: "NVIDIA" },
        { symbol: "AMD", name: "AMD" },
      ],
    },
    {
      id: "future-motion",
      icon: "⚡",
      title: "电动车",
      desc: "适合观察题材情绪与高波动反应。",
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
  statusText: "正在整理今日市场热度...",
  source: "fallback",
  updatedAt: null,
};
let homepageRecommendationsInitialized = false;
let homepageRecommendationData = FALLBACK_HOMEPAGE_RECOMMENDATIONS;

// ── 工具函数 ─────────────────────────────────────
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
  return new Intl.DateTimeFormat("zh-CN", {
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
  const s = String(symbol || "").toUpperCase();
  // 已优化的主流股优先使用高细节 VISTA
  if (['NVDA', 'AMZN', 'META', 'MSFT', 'GOOGL', 'GOOG', 'INTC'].includes(s)) {
    let themeDir = s;
    if (s === 'GOOG' || s === 'GOOGL') themeDir = 'GOOGL';
    if (s === 'INTC') themeDir = 'intel';
    return `/static/assets/themes/${themeDir}/vista.png`;
  }
  return `/static/assets/homepage-backgrounds/${s.replace(/[^A-Za-z0-9]+/g, "_")}.svg`;
}

function getHomepageBackgroundStyle(symbol) {
  return `style="--stock-bg: url('${getHomepageBackgroundFile(symbol)}')"`;
}

function getHomepageBackgroundVideoFile(symbol) {
  const s = String(symbol || "").toUpperCase();
  if (s === "GOOGL" || s === "GOOG") {
    return "/static/assets/themes/GOOGL/Subtle_breathing_motion,_extremely_slow_movement,_cinemagraph_style,_high_temporal_consistency._Loop_seed3953574263.mp4";
  }
  return "";
}

function renderHomepageBackgroundMedia(symbol) {
  const videoSrc = getHomepageBackgroundVideoFile(symbol);
  if (!videoSrc) return "";
  const poster = getHomepageBackgroundFile(symbol);
  return `
    <span class="homepage-stock-video-wrap" aria-hidden="true">
      <video class="homepage-stock-video" autoplay muted loop playsinline preload="auto" poster="${escapeHtml(poster)}">
        <source src="${escapeHtml(videoSrc)}" type="video/mp4">
      </video>
    </span>
  `;
}

function buildHomepageQuickEntries() {
  const picks = [];
  const seen = new Set();

  const pushPick = (symbol, name) => {
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    picks.push({ symbol, name: name || symbol });
  };

  pushPick(homepageRecommendationData?.featured?.symbol, homepageRecommendationData?.featured?.name);
  (homepageRecommendationData?.hot || []).forEach((item) => pushPick(item.symbol, item.name));
  (homepageRecommendationData?.themes || []).forEach((theme) => {
    (theme.picks || []).forEach((pick) => pushPick(pick.symbol, pick.name));
  });

  return picks
    .slice(0, 10)
    .map((item) => `
      <button class="welcome-rec-quick-button homepage-stock-surface" ${getHomepageBackgroundStyle(item.symbol)} data-action="analyze" data-symbol="${escapeHtml(item.symbol)}">
        ${renderHomepageBackgroundMedia(item.symbol)}
        <span class="welcome-rec-quick-symbol">${escapeHtml(item.symbol)}</span>
        <span class="welcome-rec-quick-name">${escapeHtml(item.name)}</span>
      </button>
    `)
    .join("");
}

function buildHomepageFeaturedCard() {
  const featured = homepageRecommendationData?.featured;
  if (!featured) {
    return `<div class="welcome-rec-feedback is-error">目前暂时没有可用的热度数据，请稍后再试。</div>`;
  }
  const watched = isHomepageWatched(featured.symbol);

  return `
    <div class="welcome-rec-featured-shell homepage-stock-surface" ${getHomepageBackgroundStyle(featured.symbol)}>
      ${renderHomepageBackgroundMedia(featured.symbol)}
      <div class="welcome-rec-featured-top">
        <div class="welcome-rec-symbol-group">
          <div class="welcome-rec-chip-row">
            ${(featured.chips || [{ label: "热度焦点" }]).map((chip) => `<span class="welcome-rec-chip">${escapeHtml(chip.label)}</span>`).join("")}
          </div>
          <div class="welcome-rec-symbol-row">
            <span class="welcome-rec-symbol">${escapeHtml(featured.symbol)}</span>
            <span class="welcome-rec-exchange">${escapeHtml(featured.exchange || "")}</span>
          </div>
          <div class="welcome-rec-name">${escapeHtml(featured.name)}</div>
        </div>
      </div>
      <div class="welcome-rec-headline">${escapeHtml(featured.summary || "")}</div>
      <div class="welcome-rec-reason-row">
        ${(featured.reasons || []).map((reason) => `<span class="welcome-rec-reason">${escapeHtml(reason)}</span>`).join("")}
      </div>
      <div class="welcome-rec-sparkline">${buildSparklineSvg(featured.series || [], "#38BDF8")}</div>
      <div class="welcome-rec-featured-actions">
        <button class="welcome-rec-button is-primary" data-action="analyze" data-symbol="${escapeHtml(featured.symbol)}">立即分析</button>
        <button class="welcome-rec-button ${watched ? "is-watched" : "is-ghost"}" data-action="watch" data-symbol="${escapeHtml(featured.symbol)}">${watched ? "已加入观察" : "加入观察"}</button>
      </div>
      <div class="welcome-rec-ai-rationale">
        <div class="welcome-rec-ai-kicker">Gemini 今日数据摘要</div>
        <div class="welcome-rec-ai-copy">${renderHomepageRecommendationMarkdown(featured.aiReason || featured.detail || "")}</div>
      </div>
    </div>
  `;
}

function buildHomepageHotRows() {
  const hotList = homepageRecommendationData?.hot || [];
  if (!hotList.length) {
    return `<div class="welcome-rec-feedback is-error">热门排行暂时抓不到数据，先休息一下。</div>`;
  }
  return hotList
    .map((item, index) => {
      const watched = isHomepageWatched(item.symbol);
      const expanded = homepageRecommendationState.hotExpanded === index;
      return `
        <article class="welcome-rec-hot-row homepage-stock-surface" ${getHomepageBackgroundStyle(item.symbol)} data-action="analyze" data-symbol="${escapeHtml(item.symbol)}">
          ${renderHomepageBackgroundMedia(item.symbol)}
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
            <button class="welcome-rec-inline-button ${watched ? "is-watch-active" : ""}" data-action="watch" data-symbol="${escapeHtml(item.symbol)}">${watched ? "已观察" : "加入观察"}</button>
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
    return `<div class="welcome-rec-feedback is-error">主题精选还没准备好，等一下就会回来。</div>`;
  }
  return themes
    .map((theme) => {
      const expanded = homepageRecommendationState.openThemes.has(theme.id);
      const coverSymbol = theme.picks?.[0]?.symbol || "";
      return `
        <article class="welcome-rec-theme-card homepage-stock-surface" ${getHomepageBackgroundStyle(coverSymbol)}>
          ${renderHomepageBackgroundMedia(coverSymbol)}
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
                    ${renderHomepageBackgroundMedia(pick.symbol)}
                    <div>
                      <div class="welcome-rec-pick-symbol">${escapeHtml(pick.symbol)}</div>
                      <div class="welcome-rec-pick-name">${escapeHtml(pick.name)}</div>
                    </div>
                    <div class="welcome-rec-pick-actions">
                      <button class="welcome-rec-inline-button" data-action="analyze" data-symbol="${escapeHtml(pick.symbol)}">分析</button>
                      <button class="welcome-rec-inline-button ${watched ? "is-watch-active" : ""}" data-action="watch" data-symbol="${escapeHtml(pick.symbol)}">${watched ? "已观察" : "加入观察"}</button>
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
    $("homepageFeaturedRecommendation").innerHTML = buildHomepageLoadingState("正在抓取今日市场热度...");
    $("homepageHotRecommendations").innerHTML = buildHomepageLoadingState("正在同步市场热度排行...");
    $("homepageThemeRecommendations").innerHTML = buildHomepageLoadingState("正在整理主题精选...");
  } else {
    $("homepageFeaturedRecommendation").innerHTML = buildHomepageFeaturedCard();
    $("homepageHotRecommendations").innerHTML = buildHomepageHotRows();
    $("homepageThemeRecommendations").innerHTML = buildHomepageThemeCards();
  }
  $("homepageQuickEntries").innerHTML = buildHomepageQuickEntries();
  $("homepageWatchCount").textContent = String(getHomepageWatchlist().length);
  updateHomepageRecommendationStatus();
}

async function loadHomepageRecommendations() {
  homepageRecommendationState.loading = true;
  homepageRecommendationState.error = "";
  homepageRecommendationState.statusText = "正在同步今日热度与技术面...";
  renderHomepageRecommendations();

  try {
    const res = await fetch(`${API_BASE}/api/homepage-recommendations`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "首页热度暂时抓取失败");
    }

    const data = await res.json();
    if (!data?.featured || !Array.isArray(data.hot) || !Array.isArray(data.themes)) {
      throw new Error("首页热度数据格式不正确");
    }

    homepageRecommendationData = data;
    homepageRecommendationState.source = data.source || "live";
    homepageRecommendationState.updatedAt = data.generatedAt || null;
    homepageRecommendationState.statusText = data.generatedAt
      ? `已依 ${formatRecommendationUpdatedAt(data.generatedAt)} 的市场数据更新`
      : "已更新今日市场热度";
  } catch (error) {
    homepageRecommendationState.error = error.message;
    homepageRecommendationState.source = "fallback";
    homepageRecommendationState.statusText = "实时热度暂时不可用，先显示预设名单";
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

// ── 快捷搜索 ─────────────────────────────────────
function quickSearch(symbol) {
  $("symbolInput").value = symbol;
  closeStockPicker();
  loadStock();
}

// ── Enter 键触发 ──────────────────────────────────
$("symbolInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    closeStockPicker();
    loadStock();
  }
});

// ── Tab 切换 ──────────────────────────────────────
function switchTab(tab) {
  ["price", "rsi", "macd"].forEach(t => {
    $(`panel-${t}`).classList.toggle("hidden", t !== tab);
    $(`tab-${t}`).classList.toggle("active", t === tab);
  });
}

// ── 主加载函数 ────────────────────────────────────
async function loadStock() {
  const symbol = $("symbolInput").value.trim().toUpperCase();
  if (!symbol) return;

  const period = $("periodSelect").value;

  // UI 状态
  setLoading(true);
  $("welcomePage").classList.add("hidden");
  $("dashboard").classList.add("hidden");
  $("errorBox").classList.add("hidden");

  try {
    const res = await fetch(`${API_BASE}/full/${symbol}?period=${period}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "未知错误");
    }

    const data = await res.json();
    renderEducationPreview(null, "loading");
    const education = await loadEducation(symbol, period);
    renderDashboard(data, education);
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

async function loadEducation(symbol, period) {
  currentEducationData = null;
  try {
    const res = await fetch(`${API_BASE}/education/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error("education unavailable");
    currentEducationData = await res.json();
    renderEducationPreview(currentEducationData, "ready");
    return currentEducationData;
  } catch (error) {
    console.warn("[Education]", error.message);
    renderEducationPreview(null, "fallback");
    return null;
  }
}

function setLoading(loading) {
  $("searchBtn").disabled = loading;
  $("searchBtnText").textContent = loading ? "加载中..." : "分析";
  $("searchSpinner").classList.toggle("hidden", !loading);
}

// ── 渲染仪表板 ────────────────────────────────────
function renderDashboard(data, education = currentEducationData) {
  const { symbol, info, dates, ohlcv, indicators, advice } = data;
  setParkDashboardThumbFromSeries(symbol, dates, ohlcv.map(d => d.Close));

  // 基本信息
  $("stockName").textContent = info?.name || symbol;
  $("stockSymbol").textContent = symbol;
  $("stockExchange").textContent = info?.exchange || "";

  // 最新收盘
  const last = ohlcv[ohlcv.length - 1];
  const prev = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : null;
  const close = last.Close;
  const change = prev ? ((close - prev.Close) / prev.Close * 100) : 0;

  $("latestClose").textContent = close.toFixed(2) + " " + (info?.currency || "");
  $("priceChange").textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";
  $("priceChange").className = "stat-value " + (change >= 0 ? "up" : "down");
  $("latestVolume").textContent = formatNumber(last.Volume);

  // 指标数值
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

  // RSI 颜色
  if (rsiVal) {
    const el = $("stat-rsi");
    if (rsiVal < 30) el.style.color = "var(--bull)";
    else if (rsiVal > 70) el.style.color = "var(--bear)";
    else el.style.color = "";
  }

  // 技术指标摘要
  renderAdvice(advice);

  // 图表
  renderPriceChart(dates, ohlcv, indicators);
  renderVolumeChart(dates, ohlcv);
  renderRSIChart(dates, indicators.rsi);
  renderMACDChart(dates, indicators);

  // 保存给滑雪游戏使用
  window.currentGameData = {
    symbol,
    dates,
    closes: ohlcv.map(d => d.Close),
    period: $("periodSelect").value,
    education,
  };
  syncLobbyDetailModeForStock(symbol);
  updateSkiMedals();
  renderSkiDifficultyPreview();
}

function setParkDashboardThumb(imageUrl) {
  const symbol = window.currentGameData?.symbol || $("symbolInput")?.value || "AMD";
  const thumbUrl = imageUrl || getHomepageBackgroundFile(symbol);
  const thumbImage = thumbUrl ? `url("${thumbUrl}")` : "";
  const dash = $("dashboard");
  const thumb = $("parkDashThumb");
  const actionCard = document.querySelector(".stock-action-card");
  const headerCard = document.querySelector(".stock-header-card");
  if (dash && thumbImage) dash.style.setProperty("--park-quest-thumb", thumbImage);
  if (actionCard && thumbImage) actionCard.style.setProperty("--park-quest-thumb", thumbImage);
  if (headerCard && thumbImage) headerCard.style.setProperty("--park-quest-thumb", thumbImage);
  if (thumb) {
    thumb.style.backgroundImage = thumbImage;
    thumb.classList.toggle("thumb-loaded", Boolean(thumbImage));
  }
}

function setParkDashboardThumbFromSeries(symbol, dates, closes) {
  setParkDashboardThumb("");
}

function renderEducationPreview(education, state = "ready") {
  const card = $("educationPreviewCard");
  if (!card) return;
  const title = $("educationPreviewTitle");
  const badge = $("educationPreviewBadge");
  const summary = $("educationPreviewSummary");
  const points = $("educationLearningPoints");
  card.dataset.state = state;

  if (state === "loading") {
    title.textContent = "正在整理公司故事...";
    badge.textContent = "准备中";
    summary.textContent = "进入滑雪前，这里会先帮你抓出公司背景、近期震荡与等一下会问的重点。";
    points.innerHTML = "";
    return;
  }

  if (!education) {
    title.textContent = "教育缆车暂时离线";
    badge.textContent = "备用模式";
    summary.textContent = "等等仍然可以正常滑雪；教育题库会使用游戏内的通用备用节点。";
    points.innerHTML = ["公司故事稍后补上", "先看价格与技术面", "滑雪分数不受教育题影响"]
      .map((item) => `<span class="education-point-chip">${escapeHtml(item)}</span>`)
      .join("");
    return;
  }

  title.textContent = education.preview?.headline || `${education.symbol} 缆车预习`;
  badge.textContent = education.newsContext?.sourceKind === "live_news" ? "含近期新闻" : "知识库";
  summary.textContent = education.preview?.summary || education.company?.story || "已准备好教育节点。";
  points.innerHTML = buildEducationFolderMarkup(education);
}

function buildEducationFolderMarkup(education) {
  const folders = education.preview?.folders || [];
  if (!folders.length) {
    return (education.preview?.learningPoints || [])
      .slice(0, 5)
      .map((item) => `<span class="education-point-chip">${escapeHtml(item)}</span>`)
      .join("");
  }

  return `<div class="education-folder-list">
    ${folders.map((folder, index) => `
      <details class="education-folder" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="education-folder-icon">${index + 1}</span>
          <span class="education-folder-title">${escapeHtml(folder.title)}</span>
          <span class="education-folder-summary">${escapeHtml(folder.summary || "")}</span>
        </summary>
        <div class="education-folder-body">
          <div class="education-folder-fulltext">
            <div class="education-folder-section-label">阅读全文</div>
            ${formatEducationParagraphs(folder.fullText || [folder.summary, ...(folder.details || [])].join("\n\n"))}
          </div>
        </div>
      </details>
    `).join("")}
  </div>`;
}

function formatEducationParagraphs(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

// ── 技术指标摘要渲染（纯数据，无买卖判断）──────────────
// 将指标状态 type 对应到既有颜色类别：higher→绿、lower→红、其余→中性琥珀色，
// 仅作为「数值较高/较低」的视觉区分，不代表任何买卖信号。
const INDICATOR_TONE = { up: "bull", down: "bear", high: "neutral", low: "neutral", neutral: "neutral" };
function renderAdvice(advice) {
  const tone = INDICATOR_TONE[advice.signal_type] || "neutral";
  $("signalBadge").textContent = advice.signal;
  $("signalBadge").className = "signal-badge " + tone;
  $("adviceSummary").textContent = advice.summary;
  $("adviceDisclaimer").textContent = advice.disclaimer;

  const reasonsEl = $("adviceReasons");
  reasonsEl.innerHTML = "";
  (advice.reasons || []).forEach(r => {
    const tag = document.createElement("span");
    tag.className = `reason-tag ${INDICATOR_TONE[r.type] || "neutral"}`;
    tag.textContent = r.label;
    reasonsEl.appendChild(tag);
  });
}

// ── Chart.js 设定 ─────────────────────────────────
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

// ── K线图 + MA ────────────────────────────────────
function renderPriceChart(dates, ohlcv, indicators) {
  priceChart = destroyChart(priceChart);
  const closes = ohlcv.map(d => d.Close);

  // 蜡烛图数据用 OHLC 颜色模拟（用 bar chart 做视觉）
  // 实作：用 Close 折线图代替（避免需要外部插件）
  const ctx = $("priceChart").getContext("2d");
  priceChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "收盘价",
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
          label: "高位线 70",
          data: new Array(dates.length).fill(70),
          borderColor: "rgba(239,68,68,0.6)",
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: "低位线 30",
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
  };
  const sub = document.getElementById("chatSubtitle");
  if (sub) sub.textContent = `数据解读：${info?.name || symbol}`;
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
    appendMessage("ai", `⚠️ 发生错误：${e.message}`);
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

function renderHomepageRecommendationMarkdown(text) {
  const escaped = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const inline = (value) => value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

  const blocks = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    if (block === "---") {
      return "<hr/>";
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const isTable = lines.length >= 2 && lines.every((line) => /^\|.*\|$/.test(line));
    if (isTable) {
      const rows = lines.map((line) => line.slice(1, -1).split("|").map((cell) => inline(cell.trim())));
      const [header, divider, ...body] = rows;
      const hasDivider = divider && divider.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/<[^>]+>/g, "")));
      const bodyRows = hasDivider ? body : rows.slice(1);
      return `
        <table>
          <thead>
            <tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      `;
    }

    return lines.map((line) => {
      if (line === "---") {
        return "<hr/>";
      }
      if (line.startsWith("### ")) {
        return `<h5>${inline(line.slice(4).trim())}</h5>`;
      }
      if (line.startsWith("## ")) {
        return `<h4>${inline(line.slice(3).trim())}</h4>`;
      }
      if (line.startsWith("# ")) {
        return `<h3>${inline(line.slice(2).trim())}</h3>`;
      }
      return `<p>${inline(line)}</p>`;
    }).join("");
  }).join("");
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
// ── 科普小教室 互动逻辑 ──────────────────────────────
function expandKnowledge(index) {
  const container = $("welcomeKnowledge");
  const grid = $("knowledgeGrid");
  const backBtn = $("knowledgeBackBtn");
  const title = $("knowledgeTitle");

  // 先滚动到科普区
  container.scrollIntoView({ behavior: "smooth", block: "start" });

  // 设置 Grid 状态
  grid.classList.add("expanded");
  backBtn.classList.remove("hidden");
  title.classList.add("hidden");

  // 处理各个项目
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

// ── 滑雪游戏启动 ──────────────────────────────────
let lobbyHighDetailMode = false;
let skiTuningCollapsed = true;
const SKI_PROGRESS_KEY = "skiProgress";
const SKI_HIGH_DETAIL_THEME_SYMBOLS = new Set(["AAPL", "GOOGL", "AMZN", "META", "MSFT", "NVDA", "INTC"]);

function normalizeSkiThemeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/\./g, "_");
}

function hasSkiHighDetailTheme(symbol) {
  return SKI_HIGH_DETAIL_THEME_SYMBOLS.has(normalizeSkiThemeSymbol(symbol));
}

function setLobbyHighDetailMode(enabled) {
  lobbyHighDetailMode = !!enabled;
  const btn = document.getElementById('lobbyDetailToggle');
  if (btn) {
    btn.classList.toggle('active', lobbyHighDetailMode);
    btn.querySelector('.detail-label').textContent = lobbyHighDetailMode ? '高细节：开启' : '视觉细节';
  }
}

function syncLobbyDetailModeForStock(symbol) {
  setLobbyHighDetailMode(hasSkiHighDetailTheme(symbol));
}

function toggleLobbyDetailMode() {
  setLobbyHighDetailMode(!lobbyHighDetailMode);
}

function launchSkiGame() {
  if (!window.currentGameData) {
    alert('请先加载一支股票再开始滑雪！');
    return;
  }
  if (window.SkiGame) {
    window.SkiGame.launch(window.currentGameData, {
      highDetail: lobbyHighDetailMode,
      education: window.currentGameData.education,
    });
  }
}

function toggleSkiTuningPanel() {
  skiTuningCollapsed = !skiTuningCollapsed;
  localStorage.setItem('skiTuningCollapsed', skiTuningCollapsed ? '1' : '0');
  applySkiTuningCollapsed();
}

function applySkiTuningCollapsed() {
  const card = document.querySelector('.stock-action-card');
  const caret = document.getElementById('skiTuningCaret');
  card?.classList.toggle('ski-tuning-collapsed', skiTuningCollapsed);
  if (caret) caret.textContent = skiTuningCollapsed ? '?' : '?';
}

function launchSkiGamePractice() {
  if (!window.currentGameData) {
    alert('请先加载一支股票再开始练习！');
    return;
  }
  const steepness  = parseInt(document.getElementById('steepnessSlider')?.value ?? 40);
  const hitboxSize = parseInt(document.getElementById('hitboxSlider')?.value ?? 60);
  let startPct = parseInt(document.getElementById('rangeStart')?.value ?? 0);
  let endPct   = parseInt(document.getElementById('rangeEnd')?.value ?? 100);
  // 防呆：确保 start < end 且在 0~100
  startPct = Math.max(0, Math.min(99, startPct));
  endPct   = Math.max(startPct + 1, Math.min(100, endPct));
  if (window.SkiGame) {
    window.SkiGame.launch(window.currentGameData, { 
      practice: true,
      steepness, 
      hitboxSize,
      startPct,
      endPct,
      highDetail: lobbyHighDetailMode,
      education: window.currentGameData.education,
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
  button.title = state.isNormal ? '把这支股票变成滑雪关卡！' : '使用目前滑杆设定进入练习模式';
  icon.textContent = state.isNormal ? '🎿' : '🟡';
  text.textContent = state.isNormal ? '开始！' : '练习模式';
}

function getSkiDifficultyDisplayLabel(label) {
  const labels = {
    easy: '简单',
    normal: '普通',
    hard: '困难',
    expert: '专家',
    hell: '地狱',
  };
  return labels[label] || window.SkiDifficulty?.getDifficultyLabel?.(label) || '未定';
}

let lastSkiDifficultyPreview = null;
let skiDifficultyRenderQueued = false;

function applySkiDifficultyPreview(preview, state) {
  const scoreEl = document.getElementById('skiDifficultyScore');
  const levelEl = document.getElementById('skiDifficultyLevel');
  const metaEl = document.getElementById('skiDifficultyMeta');
  const panelEl = document.getElementById('skiDifficultyPanel');
  if (!scoreEl || !levelEl || !metaEl || !panelEl) return;
  scoreEl.textContent = String(preview.score);
  levelEl.textContent = getSkiDifficultyDisplayLabel(preview.label);
  metaEl.textContent = `${window.currentGameData.symbol} ? ${state.isNormal ? '标准模式' : `${state.startPct}% - ${state.endPct}% 练习区间`} ? 下坡风险 ${Math.round((preview.factors.downhillRisk || 0) * 100)}%`;
  panelEl.dataset.level = preview.label;
}

function renderSkiDifficultyPreview() {
  const scoreEl = document.getElementById('skiDifficultyScore');
  const levelEl = document.getElementById('skiDifficultyLevel');
  const metaEl = document.getElementById('skiDifficultyMeta');
  const panelEl = document.getElementById('skiDifficultyPanel');
  if (!scoreEl || !levelEl || !metaEl || !panelEl) return;

  if (!window.currentGameData) {
    lastSkiDifficultyPreview = null;
    scoreEl.textContent = '--';
    levelEl.textContent = '尚未加载';
    metaEl.textContent = '先查询股票后，这里会显示目前滑雪地图的难度系数。';
    panelEl.dataset.level = 'unknown';
    return;
  }

  const state = getSkiDifficultyState();
  const previewOptions = state.isNormal ? {} : {
    practice: true,
    steepness: state.steepness,
    hitboxSize: state.hitboxSize,
    startPct: state.startPct,
    endPct: state.endPct,
  };
  const previewApi = window.SkiDifficulty?.previewDifficulty || window.SkiGame?.previewDifficulty;
  if (!previewApi) {
    if (lastSkiDifficultyPreview) {
      applySkiDifficultyPreview(lastSkiDifficultyPreview.preview, lastSkiDifficultyPreview.state);
      metaEl.textContent += ' ? 暂用快取';
      return;
    }
    scoreEl.textContent = '--';
    levelEl.textContent = '尚未加载';
    metaEl.textContent = '难度模组尚未初始化完成。';
    panelEl.dataset.level = 'unknown';
    return;
  }

  let preview = null;
  try {
    preview = previewApi(window.currentGameData, previewOptions);
  } catch (error) {
    console.error('Failed to render ski difficulty preview:', error);
  }

  if (!preview) {
    if (lastSkiDifficultyPreview) {
      applySkiDifficultyPreview(lastSkiDifficultyPreview.preview, lastSkiDifficultyPreview.state);
      metaEl.textContent += ' ? 暂停更新';
      return;
    }
    scoreEl.textContent = '--';
    levelEl.textContent = '无法计算';
    metaEl.textContent = '目前数据不足，暂时无法创建滑雪难度。';
    panelEl.dataset.level = 'unknown';
    return;
  }

  lastSkiDifficultyPreview = {
    preview,
    state,
    symbol: window.currentGameData.symbol,
  };
  applySkiDifficultyPreview(preview, state);
}

function scheduleSkiDifficultyPreview() {
  if (skiDifficultyRenderQueued) return;
  skiDifficultyRenderQueued = true;
  window.requestAnimationFrame(() => {
    skiDifficultyRenderQueued = false;
    renderSkiDifficultyPreview();
  });
}

function getSkiMedalState() {
  try {
    const legacy = JSON.parse(localStorage.getItem('skiMedals') || '{}');
    const progress = JSON.parse(localStorage.getItem(SKI_PROGRESS_KEY) || '{}');
    return { ...legacy, ...progress };
  } catch {
    return {};
  }
}

function updateSkiMedals() {
  const medals = getSkiMedalState();
  const bronze = !!(medals.bronze || medals.normalComplete);
  const silver = !!(medals.silver || (medals.normalComplete && medals.cableAllCorrect));
  const gold = !!(medals.gold || (medals.skiAA && medals.cableAA));
  document.getElementById('medalBronze')?.classList.toggle('is-earned', bronze);
  document.getElementById('medalSilver')?.classList.toggle('is-earned', silver);
  document.getElementById('medalGold')?.classList.toggle('is-earned', gold);
  const skiBest = Number(medals.bestSkiScore || 0);
  const cableBest = Number(medals.bestCableScore || 0);
  const skiBestEl = document.getElementById('skiBestScore');
  const cableBestEl = document.getElementById('cableBestScore');
  if (skiBestEl) skiBestEl.textContent = skiBest > 0 ? String(Math.round(skiBest)) : '--';
  if (cableBestEl) cableBestEl.textContent = cableBest > 0 ? String(Math.round(cableBest)) : '--';
}

function launchSkiGameAdaptive() {
  const state = getSkiDifficultyState();
  if (state.isNormal) {
    launchSkiGame();
    return;
  }
  launchSkiGamePractice();
}

// 快速设定练习区间
function setPracticeRange(start, end) {
  const s = document.getElementById('rangeStart');
  const e = document.getElementById('rangeEnd');
  if (s) s.value = start;
  if (e) e.value = end;
  updateSkiLaunchButton();
  renderSkiDifficultyPreview();
}

// 滑杆初始化：让 CSS --val 变数追踪滑杆进度（填色效果）
(function initSliders() {
  let initialized = false;
  function syncSlider(el) {
    if (!el) return;
    el.style.setProperty('--val', el.value);
    el.addEventListener('input', () => {
      el.style.setProperty('--val', el.value);
      updateSkiLaunchButton();
      scheduleSkiDifficultyPreview();
    });
  }
  function bindRange(el) {
    if (!el) return;
    el.addEventListener('input', () => {
      updateSkiLaunchButton();
      scheduleSkiDifficultyPreview();
    });
    el.addEventListener('change', () => {
      updateSkiLaunchButton();
      scheduleSkiDifficultyPreview();
    });
  }
  function runInit() {
    if (initialized) return;
    initialized = true;
    setNormalPreset();
    syncSlider(document.getElementById('steepnessSlider'));
    syncSlider(document.getElementById('hitboxSlider'));
    bindRange(document.getElementById('rangeStart'));
    bindRange(document.getElementById('rangeEnd'));
    const storedSkiTuningCollapsed = localStorage.getItem('skiTuningCollapsed');
    skiTuningCollapsed = storedSkiTuningCollapsed === null ? true : storedSkiTuningCollapsed === '1';
    applySkiTuningCollapsed();
    updateSkiLaunchButton();
    updateSkiMedals();
  }
  document.addEventListener('DOMContentLoaded', runInit, { once: true });
  if (document.readyState !== 'loading') {
    runInit();
  }
})();

(function initHomepageRecommendationSurface() {
  document.addEventListener("DOMContentLoaded", initHomepageRecommendations);
  if (document.readyState !== "loading") {
    initHomepageRecommendations();
  }
})();

// 预设：正常难度（陡峭=100, 碰撞=1）
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
  renderSkiDifficultyPreview();
}

// ── 分类股票选股器 ─────────────────────────────────
let _pickerOpen = false;

function openStockPicker() {
  const panel = $('stockPickerPanel');
  if (!panel || _pickerOpen) return;
  _pickerOpen = true;
  panel.classList.remove('hidden');
}

function closeStockPicker() {
  const panel = $('stockPickerPanel');
  if (!panel || !_pickerOpen) return;
  _pickerOpen = false;
  panel.classList.add('hidden');
}

function initStockPicker() {
  const panel = $('stockPickerPanel');
  const categories = $('pickerCategories');
  const legacy = $('pickerCategoriesLegacy');
  const input = $('symbolInput');
  if (!panel || !categories || !legacy || !input) return;

  categories.innerHTML = legacy.innerHTML;
  const legacyPanel = $('stockPickerPanelLegacy');
  if (legacyPanel) legacyPanel.remove();

  input.addEventListener('focus', () => {
    openStockPicker();
    filterPickerStocks();
  });

  input.addEventListener('input', () => {
    openStockPicker();
    filterPickerStocks();
  });
}

document.addEventListener('click', (e) => {
  if (!_pickerOpen) return;
  const panel = $('stockPickerPanel');
  const input = $('symbolInput');
  const periodSelect = $('periodSelect');
  const searchBtn = $('searchBtn');
  if (
    panel &&
    !panel.contains(e.target) &&
    input && !input.contains(e.target) &&
    periodSelect && !periodSelect.contains(e.target) &&
    searchBtn && !searchBtn.contains(e.target)
  ) {
    closeStockPicker();
  }
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && _pickerOpen) closeStockPicker();
});

function pickStock(symbol) {
  closeStockPicker();
  $('symbolInput').value = symbol;
  loadStock();
}

function filterPickerStocks() {
  const q = ($('symbolInput').value || '').toLowerCase().trim();
  const categories = document.querySelectorAll('#stockPickerPanel .picker-category');

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

(function initStockPickerSurface() {
  document.addEventListener("DOMContentLoaded", initStockPicker);
  if (document.readyState !== "loading") {
    initStockPicker();
  }
})();
