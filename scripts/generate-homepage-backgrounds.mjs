import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "frontend", "assets", "homepage-backgrounds");

const ENVIRONMENTS = {
  "digital-icefield": {
    label: "數位冰原",
    palette: {
      top: "#041a30",
      mid: "#0a3760",
      bottom: "#07111f",
      accent: "#00F2FF",
      glow: "#8CF8FF",
      surface: "#89C2FF",
      shadow: "#03101d",
    },
  },
  "metro-snow-city": {
    label: "摩天雪都",
    palette: {
      top: "#071224",
      mid: "#10284a",
      bottom: "#08111d",
      accent: "#FFD700",
      glow: "#FFE99A",
      surface: "#9DB4D8",
      shadow: "#030913",
    },
  },
  "steel-canyon": {
    label: "鋼鐵峽谷",
    palette: {
      top: "#1d232a",
      mid: "#3d4651",
      bottom: "#161b20",
      accent: "#F97316",
      glow: "#FDBA74",
      surface: "#9CA3AF",
      shadow: "#111317",
    },
  },
  "cloud-summit": {
    label: "雲端之巔",
    palette: {
      top: "#08142a",
      mid: "#14406b",
      bottom: "#0b1b33",
      accent: "#7DD3FC",
      glow: "#CFFAFE",
      surface: "#E0F2FE",
      shadow: "#06111f",
    },
  },
  "consumer-arcade": {
    label: "零售超市",
    palette: {
      top: "#2d1208",
      mid: "#7c2d12",
      bottom: "#1c0c08",
      accent: "#FB923C",
      glow: "#FED7AA",
      surface: "#FDE68A",
      shadow: "#120805",
    },
  },
  "future-transit": {
    label: "未來交通",
    palette: {
      top: "#0a1220",
      mid: "#2c3f56",
      bottom: "#0a1118",
      accent: "#93C5FD",
      glow: "#E0F2FE",
      surface: "#CBD5E1",
      shadow: "#060a10",
    },
  },
  "neon-media": {
    label: "霓虹傳媒",
    palette: {
      top: "#17071f",
      mid: "#4c1d95",
      bottom: "#130619",
      accent: "#FF00FF",
      glow: "#FDA4FF",
      surface: "#C4B5FD",
      shadow: "#0a020f",
    },
  },
  "dividend-vault": {
    label: "穩收金庫",
    palette: {
      top: "#0d1827",
      mid: "#28425e",
      bottom: "#0a1118",
      accent: "#FACC15",
      glow: "#FDE68A",
      surface: "#D1D5DB",
      shadow: "#060b11",
    },
  },
};

const STOCKS = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    industryClass: "Tech",
    environment: "digital-icefield",
    companyProps: ["gpu", "ai-core", "server", "fiber-tree"],
    mixerLogic: "近期強勢時讓坡度變陡、跳台更密，營造高速算力狂飆感。",
    terrainMood: "bull-run",
  },
  {
    symbol: "AMD",
    name: "AMD",
    industryClass: "Tech",
    environment: "digital-icefield",
    companyProps: ["chip", "server", "wave-ring", "ai-core"],
    mixerLogic: "把補漲節奏做成階梯式下切，讓地形在推進時有連續爆發感。",
    terrainMood: "step-rally",
  },
  {
    symbol: "AVGO",
    name: "Broadcom",
    industryClass: "Tech",
    environment: "digital-icefield",
    companyProps: ["network-chip", "signal-beam", "fiber-node", "chip"],
    mixerLogic: "用網路訊號節點與階梯坡面表達大型半導體權值的穩健推進。",
    terrainMood: "stable-climb",
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    industryClass: "Tech",
    environment: "cloud-summit",
    companyProps: ["cloud-block", "window-panel", "copilot-orb", "data-bridge"],
    mixerLogic: "把雲層間的光橋與長弧地形成熟結合，讓上升趨勢更像雲端平台的持續擴張。",
    terrainMood: "steady-climb",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    industryClass: "Tech",
    environment: "cloud-summit",
    companyProps: ["orbit-ring", "search-beam", "data-prism", "cloud-block"],
    mixerLogic: "讓地形在平順主升段之間插入搜尋脈衝般的小波動，保留資料流的動態節奏。",
    terrainMood: "pulse-wave",
  },
  {
    symbol: "META",
    name: "Meta",
    industryClass: "Media",
    environment: "neon-media",
    companyProps: ["chat-bubble", "portal-ring", "pixel-stack", "visor"],
    mixerLogic: "把情緒波動映射成連續折返與光噪斷層，做出社群熱度忽冷忽熱的感覺。",
    terrainMood: "sentiment-wave",
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    industryClass: "Consumer",
    environment: "consumer-arcade",
    companyProps: ["parcel", "cart", "arrow-arc", "cloud-block"],
    mixerLogic: "用倉儲與零售節奏做長坡推進，在中段混入包裹跳台與配送節點。",
    terrainMood: "distribution-run",
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    industryClass: "Auto",
    environment: "future-transit",
    companyProps: ["tire", "charge-pillar", "hover-engine", "speed-fin"],
    mixerLogic: "把高速下坡與銳利轉折疊在一起，保留電動車題材常見的大波動與加速度。",
    terrainMood: "volatile-drop",
  },
  {
    symbol: "RIVN",
    name: "Rivian",
    industryClass: "Auto",
    environment: "future-transit",
    companyProps: ["headlamp", "battery-pack", "tire", "trail-rack"],
    mixerLogic: "地形更像越野賽段，坡面起伏大、跳躍多，帶出新創電車的野性與不穩定。",
    terrainMood: "rugged-jump",
  },
  {
    symbol: "NIO",
    name: "NIO",
    industryClass: "Auto",
    environment: "future-transit",
    companyProps: ["swap-station", "wing-light", "battery-pack", "speed-fin"],
    mixerLogic: "用中速長彎與換電站節點做節奏切換，表現題材股的脈衝推進感。",
    terrainMood: "glide-curve",
  },
  {
    symbol: "2330.TW",
    name: "TSMC",
    industryClass: "Tech",
    environment: "digital-icefield",
    companyProps: ["wafer", "chip", "cleanroom-tower", "signal-beam"],
    mixerLogic: "地形以穩定主升結構為主，局部加入晶圓光脈衝與權值龍頭的厚重慣性。",
    terrainMood: "bluechip-climb",
  },
  {
    symbol: "2454.TW",
    name: "MediaTek",
    industryClass: "Tech",
    environment: "cloud-summit",
    companyProps: ["mobile-chip", "signal-beam", "orbit-ring", "data-prism"],
    mixerLogic: "讓坡道在平穩推進中穿插通訊訊號脈衝，形成晶片平台節奏。",
    terrainMood: "signal-step",
  },
  {
    symbol: "2317.TW",
    name: "Hon Hai",
    industryClass: "Industrial",
    environment: "steel-canyon",
    companyProps: ["factory", "connector", "container", "beam-frame"],
    mixerLogic: "把大型製造鏈的重量感做成低頻大坡與金屬平台，節奏偏穩但慣性很強。",
    terrainMood: "heavy-inertia",
  },
  {
    symbol: "2382.TW",
    name: "Quanta",
    industryClass: "Tech",
    environment: "cloud-summit",
    companyProps: ["server-rack", "data-cube", "cloud-block", "window-panel"],
    mixerLogic: "用伺服器矩陣排列與順滑長坡，表現 AI 伺服器供應鏈的延展感。",
    terrainMood: "server-glide",
  },
  {
    symbol: "0050.TW",
    name: "元大台灣50",
    industryClass: "Finance",
    environment: "dividend-vault",
    companyProps: ["coin", "column", "shield", "ribbon"],
    mixerLogic: "地形以穩定長弧為主，波動收斂，突出大型 ETF 的防守與基準感。",
    terrainMood: "stable-arc",
  },
  {
    symbol: "0056.TW",
    name: "元大高股息",
    industryClass: "Finance",
    environment: "dividend-vault",
    companyProps: ["coin", "coupon", "vault", "cash-badge"],
    mixerLogic: "把現金流階梯感轉成連續緩坡與規律平台，節奏偏穩、落點偏準。",
    terrainMood: "income-ladder",
  },
  {
    symbol: "00878.TW",
    name: "國泰永續高股息",
    industryClass: "Finance",
    environment: "dividend-vault",
    companyProps: ["coin", "leaf-grid", "coupon", "shield"],
    mixerLogic: "維持高股息的平穩主調，再加入永續感的網格與綠色點光。",
    terrainMood: "steady-income",
  },
  {
    symbol: "00919.TW",
    name: "群益台灣精選高息",
    industryClass: "Finance",
    environment: "dividend-vault",
    companyProps: ["coin", "medal", "cash-badge", "column"],
    mixerLogic: "讓地形呈現規律級距與中低震盪，像穩定配息被切成一階一階的平台。",
    terrainMood: "income-step",
  },
  {
    symbol: "BABA",
    name: "Alibaba",
    industryClass: "Consumer",
    environment: "consumer-arcade",
    companyProps: ["parcel", "market-arch", "lantern", "data-prism"],
    mixerLogic: "把大型電商的市集感與全球流通節奏揉進長坡與促銷跳點。",
    terrainMood: "market-surge",
  },
  {
    symbol: "PDD",
    name: "PDD",
    industryClass: "Consumer",
    environment: "consumer-arcade",
    companyProps: ["parcel", "price-tag", "megaphone", "cart"],
    mixerLogic: "讓坡面更活潑、更碎，模擬折扣型平台的高頻刺激與成交衝刺。",
    terrainMood: "bargain-bounce",
  },
  {
    symbol: "700.HK",
    name: "Tencent",
    industryClass: "Media",
    environment: "neon-media",
    companyProps: ["chat-bubble", "game-pad", "portal-ring", "neon-tower"],
    mixerLogic: "用社交訊號和遊戲傳送門做層層疊加，地形保持波浪推進與情緒噪點。",
    terrainMood: "social-arcade",
  },
];

function slugifySymbol(symbol) {
  return symbol.replace(/[^A-Za-z0-9]+/g, "_");
}

function hashString(input) {
  let h = 2166136261;
  for (const char of input) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedText) {
  let seed = hashString(seedText) || 1;
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
}

function alpha(hex, opacity) {
  const value = Math.max(0, Math.min(1, opacity));
  const suffix = Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${suffix}`;
}

function buildAtmosphere(envId, palette, rng, width, height) {
  switch (envId) {
    case "digital-icefield":
      return `
        <g opacity="0.95">
          <path d="M-40 220 C240 80, 420 260, 720 170 S1200 80, 1640 210 L1640 0 L-40 0 Z" fill="${alpha(
            palette.accent,
            0.18
          )}"/>
          <path d="M-20 270 C210 170, 440 280, 690 210 S1160 140, 1620 260" stroke="${alpha(
            palette.glow,
            0.55
          )}" stroke-width="8" fill="none" stroke-linecap="round"/>
          ${Array.from({ length: 7 }, (_, index) => {
            const x = 100 + index * 220 + rng() * 50;
            const peak = 300 + rng() * 120;
            const base = 630 + rng() * 100;
            return `<path d="M${x - 120} 900 L${x} ${peak} L${x + 150} ${base} L${x + 270} 900 Z" fill="${alpha(
              palette.surface,
              0.16 + rng() * 0.12
            )}"/>`;
          }).join("")}
          ${Array.from({ length: 16 }, () => {
            const x = 40 + rng() * (width - 80);
            const y = 280 + rng() * 420;
            const w = 32 + rng() * 90;
            return `<rect x="${x}" y="${y}" width="${w}" height="2" fill="${alpha(
              palette.accent,
              0.18
            )}"/>`;
          }).join("")}
        </g>
      `;
    case "metro-snow-city":
    case "dividend-vault":
      return `
        <g>
          ${Array.from({ length: 14 }, (_, index) => {
            const x = index * 120 + rng() * 36;
            const w = 70 + rng() * 60;
            const h = 160 + rng() * 260;
            return `<rect x="${x}" y="${520 - h}" width="${w}" height="${h}" rx="8" fill="${alpha(
              palette.surface,
              0.16 + rng() * 0.12
            )}"/>`;
          }).join("")}
          ${Array.from({ length: 60 }, () => {
            const x = rng() * width;
            const y = rng() * height;
            const r = 1 + rng() * 2.4;
            return `<circle cx="${x}" cy="${y}" r="${r}" fill="${alpha("#FFFFFF", 0.55 + rng() * 0.25)}"/>`;
          }).join("")}
        </g>
      `;
    case "steel-canyon":
      return `
        <g>
          ${Array.from({ length: 10 }, (_, index) => {
            const x = 30 + index * 150 + rng() * 20;
            const h = 220 + rng() * 180;
            return `
              <rect x="${x}" y="${620 - h}" width="92" height="${h}" rx="6" fill="${alpha(
                palette.surface,
                0.16
              )}"/>
              <line x1="${x + 10}" y1="${620 - h}" x2="${x + 80}" y2="${480 - h}" stroke="${alpha(
                palette.accent,
                0.34
              )}" stroke-width="5"/>
              <line x1="${x + 80}" y1="${480 - h}" x2="${x + 126}" y2="${480 - h}" stroke="${alpha(
                palette.accent,
                0.34
              )}" stroke-width="5"/>
            `;
          }).join("")}
          ${Array.from({ length: 6 }, () => {
            const x = 150 + rng() * 1200;
            const y = 180 + rng() * 160;
            return `<ellipse cx="${x}" cy="${y}" rx="${90 + rng() * 60}" ry="${30 + rng() * 16}" fill="${alpha(
              "#FFFFFF",
              0.06
            )}"/>`;
          }).join("")}
        </g>
      `;
    case "cloud-summit":
      return `
        <g>
          ${Array.from({ length: 9 }, () => {
            const x = 60 + rng() * 1380;
            const y = 120 + rng() * 280;
            const scale = 0.8 + rng() * 1.2;
            return `
              <ellipse cx="${x}" cy="${y}" rx="${110 * scale}" ry="${38 * scale}" fill="${alpha(
                palette.glow,
                0.17
              )}"/>
              <ellipse cx="${x - 70 * scale}" cy="${y + 10 * scale}" rx="${70 * scale}" ry="${26 * scale}" fill="${alpha(
                palette.surface,
                0.14
              )}"/>
              <ellipse cx="${x + 70 * scale}" cy="${y + 14 * scale}" rx="${80 * scale}" ry="${28 * scale}" fill="${alpha(
                palette.surface,
                0.11
              )}"/>
            `;
          }).join("")}
          ${Array.from({ length: 15 }, () => {
            const x = 80 + rng() * 1360;
            const y = 170 + rng() * 360;
            const size = 28 + rng() * 60;
            return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="${alpha(
              palette.accent,
              0.11
            )}" stroke="${alpha(palette.glow, 0.18)}"/>`;
          }).join("")}
        </g>
      `;
    case "consumer-arcade":
      return `
        <g>
          ${Array.from({ length: 12 }, (_, index) => {
            const x = index * 128 + rng() * 10;
            const h = 120 + rng() * 120;
            return `
              <rect x="${x}" y="${610 - h}" width="102" height="${h}" rx="10" fill="${alpha(
                palette.surface,
                0.12
              )}"/>
              <rect x="${x + 14}" y="${630 - h}" width="72" height="20" rx="6" fill="${alpha(
                palette.accent,
                0.22
              )}"/>
            `;
          }).join("")}
          ${Array.from({ length: 18 }, () => {
            const x = rng() * width;
            const y = 150 + rng() * 520;
            const w = 28 + rng() * 62;
            return `<rect x="${x}" y="${y}" width="${w}" height="10" rx="4" fill="${alpha(
              "#FFFFFF",
              0.08
            )}"/>`;
          }).join("")}
        </g>
      `;
    case "future-transit":
      return `
        <g>
          ${Array.from({ length: 12 }, (_, index) => {
            const y = 140 + index * 42;
            return `<path d="M-40 ${y} L1640 ${y - 120}" stroke="${alpha(
              palette.accent,
              0.14 + index * 0.01
            )}" stroke-width="${4 + (index % 3)}"/>`;
          }).join("")}
          ${Array.from({ length: 4 }, (_, index) => {
            const y = 540 + index * 46;
            return `<path d="M0 ${y} Q800 ${y - 140}, 1600 ${y}" stroke="${alpha(
              palette.surface,
              0.16
            )}" stroke-width="3" fill="none"/>`;
          }).join("")}
        </g>
      `;
    case "neon-media":
      return `
        <g>
          ${Array.from({ length: 16 }, () => {
            const x = rng() * width;
            const y = 90 + rng() * 500;
            const w = 120 + rng() * 260;
            const h = 8 + rng() * 18;
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${alpha(
              rng() > 0.5 ? palette.accent : palette.surface,
              0.12 + rng() * 0.08
            )}"/>`;
          }).join("")}
          ${Array.from({ length: 11 }, () => {
            const x = 60 + rng() * 1460;
            const y = 170 + rng() * 320;
            const size = 20 + rng() * 40;
            return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${alpha(
              palette.glow,
              0.12
            )}"/>`;
          }).join("")}
        </g>
      `;
    default:
      return "";
  }
}

function buildTerrain(mood, palette, rng) {
  const points = [];
  const steps = 10;
  let y = 670 - rng() * 40;
  for (let index = 0; index <= steps; index += 1) {
    const x = (index / steps) * 1600;
    switch (mood) {
      case "bull-run":
        y -= 24 + rng() * 42;
        break;
      case "step-rally":
      case "signal-step":
      case "income-step":
        y += index % 2 === 0 ? -55 - rng() * 10 : 6 + rng() * 28;
        break;
      case "volatile-drop":
      case "sentiment-wave":
      case "social-arcade":
        y += (index % 2 === 0 ? -1 : 1) * (55 + rng() * 70);
        break;
      case "rugged-jump":
      case "bargain-bounce":
        y += (index % 2 === 0 ? -1 : 1) * (35 + rng() * 60);
        break;
      case "stable-climb":
      case "steady-climb":
      case "bluechip-climb":
      case "server-glide":
      case "income-ladder":
      case "steady-income":
      case "glide-curve":
      case "distribution-run":
      case "market-surge":
        y -= 12 + rng() * 26;
        break;
      case "heavy-inertia":
        y += (index % 3 === 0 ? -1 : 1) * (16 + rng() * 22);
        break;
      default:
        y += (rng() - 0.5) * 50;
        break;
    }
    y = Math.max(310, Math.min(790, y));
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const area = [`0,900`, ...points, `1600,900`].join(" ");
  return `
    <g>
      <polyline points="${points.join(" ")}" fill="none" stroke="${alpha(palette.glow, 0.88)}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="${area}" fill="${alpha(palette.accent, 0.12)}"/>
    </g>
  `;
}

function buildPropIcon(kind, x, y, size, palette) {
  const fill = alpha(palette.accent, 0.78);
  const stroke = alpha(palette.glow, 0.6);
  const dark = alpha(palette.shadow, 0.9);
  switch (kind) {
    case "gpu":
    case "chip":
    case "network-chip":
    case "mobile-chip":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.16}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <rect x="${-size * 0.22}" y="${-size * 0.22}" width="${size * 0.44}" height="${size * 0.44}" rx="${size * 0.07}" fill="${dark}"/>
          ${Array.from({ length: 4 }, (_, index) => {
            const offset = -size * 0.42 + index * (size * 0.28);
            return `<rect x="${offset}" y="${-size * 0.64}" width="${size * 0.08}" height="${size * 0.16}" fill="${stroke}"/>
              <rect x="${offset}" y="${size * 0.48}" width="${size * 0.08}" height="${size * 0.16}" fill="${stroke}"/>`;
          }).join("")}
        </g>
      `;
    case "ai-core":
    case "copilot-orb":
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.45}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <circle r="${size * 0.18}" fill="${dark}"/>
          <path d="M0 ${-size * 0.58} L0 ${size * 0.58} M${-size * 0.58} 0 L${size * 0.58} 0" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
        </g>
      `;
    case "server":
    case "server-rack":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.32}" y="${-size * 0.5}" width="${size * 0.64}" height="${size}" rx="${size * 0.08}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <rect x="${-size * 0.22}" y="${-size * 0.32}" width="${size * 0.44}" height="${size * 0.11}" rx="4" fill="${dark}"/>
          <rect x="${-size * 0.22}" y="${-size * 0.06}" width="${size * 0.44}" height="${size * 0.11}" rx="4" fill="${dark}"/>
          <rect x="${-size * 0.22}" y="${size * 0.2}" width="${size * 0.44}" height="${size * 0.11}" rx="4" fill="${dark}"/>
        </g>
      `;
    case "window-panel":
    case "cloud-block":
    case "data-cube":
    case "data-prism":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.34}" y="${-size * 0.34}" width="${size * 0.68}" height="${size * 0.68}" rx="${size * 0.1}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.18} 0 H${size * 0.18} M0 -${size * 0.18} V${size * 0.18}" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "data-bridge":
    case "market-arch":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.42} ${size * 0.2} Q0 -${size * 0.34} ${size * 0.42} ${size * 0.2}" stroke="${stroke}" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M-${size * 0.3} ${size * 0.2} V${size * 0.42} M${size * 0.3} ${size * 0.2} V${size * 0.42}" stroke="${fill}" stroke-width="6" stroke-linecap="round"/>
        </g>
      `;
    case "fiber-tree":
    case "cleanroom-tower":
    case "neon-tower":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M0 ${size * 0.46} V-${size * 0.42}" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>
          <path d="M0 -${size * 0.2} L-${size * 0.22} ${size * 0.06} M0 -${size * 0.2} L${size * 0.22} ${size * 0.06} M0 -${size * 0.04} L-${size * 0.28} ${size * 0.18} M0 -${size * 0.04} L${size * 0.28} ${size * 0.18}" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>
          <circle cx="0" cy="-${size * 0.3}" r="${size * 0.08}" fill="${fill}"/>
        </g>
      `;
    case "coin":
    case "cash-badge":
    case "medal":
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.44}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
          <circle r="${size * 0.24}" fill="none" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "column":
    case "pillar":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.16}" y="${-size * 0.46}" width="${size * 0.32}" height="${size * 0.92}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <rect x="${-size * 0.28}" y="${-size * 0.54}" width="${size * 0.56}" height="${size * 0.12}" rx="6" fill="${dark}"/>
          <rect x="${-size * 0.28}" y="${size * 0.42}" width="${size * 0.56}" height="${size * 0.12}" rx="6" fill="${dark}"/>
        </g>
      `;
    case "shield":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M0 -${size * 0.42} L${size * 0.3} -${size * 0.24} V${size * 0.1} Q${size * 0.3} ${size * 0.34} 0 ${size * 0.46} Q-${size * 0.3} ${size * 0.34} -${size * 0.3} ${size * 0.1} V-${size * 0.24} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M0 -${size * 0.18} V${size * 0.18}" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "ribbon":
    case "arrow-arc":
    case "speed-fin":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.44} ${size * 0.1} Q-${size * 0.08} -${size * 0.34} ${size * 0.42} -${size * 0.08}" stroke="${stroke}" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M${size * 0.24} -${size * 0.16} L${size * 0.42} -${size * 0.08} L${size * 0.28} ${size * 0.06}" fill="${fill}"/>
        </g>
      `;
    case "vault":
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.46}" fill="${fill}" stroke="${stroke}" stroke-width="4"/>
          <circle r="${size * 0.1}" fill="${dark}"/>
          <path d="M0 -${size * 0.32} L0 ${size * 0.32} M-${size * 0.32} 0 L${size * 0.32} 0" stroke="${dark}" stroke-width="4"/>
        </g>
      `;
    case "chat-bubble":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.46}" y="${-size * 0.34}" width="${size * 0.92}" height="${size * 0.56}" rx="${size * 0.16}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.08} ${size * 0.22} L-${size * 0.2} ${size * 0.48} L${size * 0.06} ${size * 0.28}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
        </g>
      `;
    case "parcel":
    case "coupon":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.38}" y="${-size * 0.3}" width="${size * 0.76}" height="${size * 0.6}" rx="${size * 0.08}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.38} 0 H${size * 0.38} M0 -${size * 0.3} V${size * 0.3}" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "cart":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.42} -${size * 0.16} H${size * 0.14} L${size * 0.28} ${size * 0.14} H-${size * 0.26} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <circle cx="${-size * 0.18}" cy="${size * 0.28}" r="${size * 0.1}" fill="${dark}"/>
          <circle cx="${size * 0.14}" cy="${size * 0.28}" r="${size * 0.1}" fill="${dark}"/>
        </g>
      `;
    case "tire":
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.4}" fill="${dark}" stroke="${stroke}" stroke-width="4"/>
          <circle r="${size * 0.18}" fill="${fill}"/>
        </g>
      `;
    case "headlamp":
    case "wing-light":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.38} 0 Q-${size * 0.06} -${size * 0.28} ${size * 0.38} 0 Q-${size * 0.06} ${size * 0.28} -${size * 0.38} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <circle cx="${size * 0.16}" cy="0" r="${size * 0.08}" fill="${dark}"/>
        </g>
      `;
    case "trail-rack":
    case "connector":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.34} -${size * 0.12} H${size * 0.34} M-${size * 0.22} ${size * 0.12} H${size * 0.22}" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>
          <circle cx="-${size * 0.4}" cy="-${size * 0.12}" r="${size * 0.08}" fill="${fill}"/>
          <circle cx="${size * 0.4}" cy="-${size * 0.12}" r="${size * 0.08}" fill="${fill}"/>
        </g>
      `;
    case "charge-pillar":
    case "swap-station":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.22}" y="${-size * 0.46}" width="${size * 0.44}" height="${size * 0.92}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.08} -${size * 0.18} H${size * 0.06} L-${size * 0.02} ${size * 0.02} H${size * 0.1} L-${size * 0.08} ${size * 0.28} Z" fill="${dark}"/>
        </g>
      `;
    case "portal-ring":
    case "orbit-ring":
    case "wave-ring":
      return `
        <g transform="translate(${x}, ${y})">
          <ellipse rx="${size * 0.42}" ry="${size * 0.24}" fill="none" stroke="${stroke}" stroke-width="5"/>
          <ellipse rx="${size * 0.2}" ry="${size * 0.1}" fill="none" stroke="${fill}" stroke-width="3"/>
        </g>
      `;
    case "factory":
    case "beam-frame":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.42} ${size * 0.34} V-${size * 0.16} L-${size * 0.08} ${size * 0.04} V-${size * 0.16} L${size * 0.24} ${size * 0.04} V-${size * 0.3} H${size * 0.42} V${size * 0.34} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
        </g>
      `;
    case "hover-engine":
      return `
        <g transform="translate(${x}, ${y})">
          <ellipse rx="${size * 0.38}" ry="${size * 0.18}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.18} ${size * 0.16} Q0 ${size * 0.42} ${size * 0.18} ${size * 0.16}" stroke="${stroke}" stroke-width="4" fill="none"/>
        </g>
      `;
    case "container":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.46}" y="${-size * 0.22}" width="${size * 0.92}" height="${size * 0.44}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.2} -${size * 0.18} V${size * 0.18} M0 -${size * 0.18} V${size * 0.18} M${size * 0.2} -${size * 0.18} V${size * 0.18}" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "wafer":
    case "leaf-grid":
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.38}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          ${Array.from({ length: 3 }, (_, index) => {
            const offset = -size * 0.16 + index * size * 0.16;
            return `<path d="M${offset} -${size * 0.3} V${size * 0.3}" stroke="${dark}" stroke-width="2"/>`;
          }).join("")}
          ${Array.from({ length: 3 }, (_, index) => {
            const offset = -size * 0.16 + index * size * 0.16;
            return `<path d="M-${size * 0.3} ${offset} H${size * 0.3}" stroke="${dark}" stroke-width="2"/>`;
          }).join("")}
        </g>
      `;
    case "price-tag":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.38} -${size * 0.16} H${size * 0.08} L${size * 0.34} 0 L${size * 0.08} ${size * 0.16} H-${size * 0.38} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <circle cx="${-size * 0.18}" cy="0" r="${size * 0.05}" fill="${dark}"/>
        </g>
      `;
    case "megaphone":
    case "signal-beam":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.28} -${size * 0.18} L${size * 0.18} -${size * 0.32} V${size * 0.32} L-${size * 0.28} ${size * 0.18} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M${size * 0.26} -${size * 0.2} Q${size * 0.44} 0 ${size * 0.26} ${size * 0.2}" fill="none" stroke="${stroke}" stroke-width="3"/>
        </g>
      `;
    case "lantern":
      return `
        <g transform="translate(${x}, ${y})">
          <ellipse rx="${size * 0.24}" ry="${size * 0.3}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M0 -${size * 0.42} V-${size * 0.3} M0 ${size * 0.3} V${size * 0.42}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>
        </g>
      `;
    case "visor":
      return `
        <g transform="translate(${x}, ${y})">
          <path d="M-${size * 0.38} 0 Q0 -${size * 0.24} ${size * 0.38} 0 Q0 ${size * 0.24} -${size * 0.38} 0 Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.14} 0 H${size * 0.16}" stroke="${dark}" stroke-width="3"/>
        </g>
      `;
    case "game-pad":
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="${-size * 0.44}" y="${-size * 0.22}" width="${size * 0.88}" height="${size * 0.44}" rx="${size * 0.16}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
          <path d="M-${size * 0.18} 0 H-${size * 0.04} M-${size * 0.11} -${size * 0.07} V${size * 0.07}" stroke="${dark}" stroke-width="3"/>
          <circle cx="${size * 0.16}" cy="-${size * 0.05}" r="${size * 0.04}" fill="${dark}"/>
          <circle cx="${size * 0.24}" cy="${size * 0.05}" r="${size * 0.04}" fill="${dark}"/>
        </g>
      `;
    default:
      return `
        <g transform="translate(${x}, ${y})">
          <circle r="${size * 0.3}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
        </g>
      `;
  }
}

function buildProps(stock, palette, rng) {
  return stock.companyProps
    .map((prop, index) => {
      const x = 250 + index * 320 + rng() * 100;
      const y = 530 + (index % 2 === 0 ? -1 : 1) * (50 + rng() * 60);
      const size = 84 + rng() * 26;
      return buildPropIcon(prop, x, y, size, palette);
    })
    .join("");
}

function buildSvg(stock) {
  const width = 1600;
  const height = 900;
  const env = ENVIRONMENTS[stock.environment];
  const palette = env.palette;
  const rng = createRng(stock.symbol);
  const filename = `${slugifySymbol(stock.symbol)}.svg`;

  return {
    filename,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.top}"/>
      <stop offset="48%" stop-color="${palette.mid}"/>
      <stop offset="100%" stop-color="${palette.bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="25%" r="65%">
      <stop offset="0%" stop-color="${alpha(palette.glow, 0.28)}"/>
      <stop offset="100%" stop-color="${alpha(palette.glow, 0)}"/>
    </radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${alpha(palette.accent, 0.18)}"/>
      <stop offset="100%" stop-color="${alpha(palette.surface, 0.03)}"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect width="${width}" height="${height}" fill="url(#fade)"/>

  ${buildAtmosphere(stock.environment, palette, rng, width, height)}

  <g opacity="0.92">
    ${buildProps(stock, palette, rng)}
  </g>

  ${buildTerrain(stock.terrainMood, palette, rng)}

  <g opacity="0.09">
    <text x="70" y="784" font-family="Segoe UI, Arial, sans-serif" font-size="180" font-weight="700" fill="${palette.glow}">
      ${stock.symbol}
    </text>
  </g>
  <g opacity="0.95">
    <text x="82" y="96" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" fill="${palette.glow}">
      ${stock.symbol}
    </text>
    <text x="82" y="132" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="500" fill="${alpha(
      palette.surface,
      0.9
    )}">
      ${stock.name} · ${env.label}
    </text>
  </g>
</svg>`.trim(),
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const manifest = [];
  for (const stock of STOCKS) {
    const { filename, svg } = buildSvg(stock);
    await fs.writeFile(path.join(outputDir, filename), svg, "utf8");
    manifest.push({
      symbol: stock.symbol,
      name: stock.name,
      file: `./${filename}`,
      industryClass: stock.industryClass,
      environmentBiome: ENVIRONMENTS[stock.environment].label,
      companyProps: stock.companyProps,
      mixerLogic: stock.mixerLogic,
      implementationPlan: "Canvas Layering: Bottom Layer background, Object Layer props, Terrain Layer stock slope.",
    });
  }

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: manifest.length,
        stocks: manifest,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Generated ${manifest.length} homepage backgrounds in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
