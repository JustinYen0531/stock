import fs from "node:fs";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  image,
  text,
  fill,
  hug,
  wrap,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;
const ROOT = path.resolve("../..");
const WORKSPACE = path.resolve(".");
const SCRATCH = path.join(WORKSPACE, "scratch");
const PREVIEW_DIR = path.join(SCRATCH, "previews");
const LAYOUT_DIR = path.join(SCRATCH, "layouts");
const OUT = path.join(WORKSPACE, "output", "output.pptx");

fs.mkdirSync(PREVIEW_DIR, { recursive: true });
fs.mkdirSync(LAYOUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const assets = {
  cover: path.join(ROOT, "output", "ski-camera-dynamic-shot", "camera-dynamic-shot.png"),
  intc: path.join(ROOT, "output", "ski-hero-pack-batch8", "INTC.png"),
  nvda: path.join(ROOT, "output", "ski-hero-pack", "nvda-live.png"),
  jpm: path.join(ROOT, "output", "ski-hero-pack-batch2", "jpm-live.png"),
  meta: path.join(ROOT, "output", "ski-hero-pack", "meta-live.png"),
  googl: path.join(ROOT, "output", "ski-hero-pack-batch2", "googl-live.png"),
  aapl: path.join(ROOT, "output", "ski-hero-pack-batch3", "aapl-live.png"),
  material: path.join(ROOT, "frontend", "assets", "themes", "intel", "texture.png"),
};

const palette = {
  ink: "#07131F",
  navy: "#0D1B2A",
  deep: "#06111B",
  cyan: "#00FFFF",
  cyanSoft: "#69F7FF",
  orange: "#FF9F1C",
  green: "#3BE878",
  white: "#F4FBFF",
  muted: "#92A9B8",
  slate: "#1A2F3F",
  dim: "#0A2330",
  magenta: "#FF4FD8",
  gold: "#D8B84A",
};

const imageCache = new Map();

function imageDataUrl(imagePath) {
  if (!imageCache.has(imagePath)) {
    const bytes = fs.readFileSync(imagePath);
    imageCache.set(imagePath, `data:image/png;base64,${bytes.toString("base64")}`);
  }
  return imageCache.get(imagePath);
}

const titleStyle = {
  fontFamily: "Bahnschrift",
  bold: true,
  color: palette.white,
};

const bodyStyle = {
  fontFamily: "Microsoft JhengHei UI",
  color: "#D3E8F2",
};

function addBg(slide, color = palette.ink) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: 0, top: 0, width: W, height: H },
    fill: color,
    line: { width: 0, fill: color },
  });
}

function addRect(slide, left, top, width, height, fillColor, lineColor = fillColor, lineWidth = 0) {
  return slide.shapes.add({
    geometry: "rect",
    position: { left, top, width, height },
    fill: fillColor,
    line: { width: lineWidth, fill: lineColor },
  });
}

function addImage(slide, imagePath, left, top, width, height, fit = "cover", opacityScrim = 0) {
  slide.compose(
    image({
      dataUrl: imageDataUrl(imagePath),
      width: fill,
      height: fill,
      fit,
      alt: path.basename(imagePath),
    }),
    {
      frame: { left, top, width, height },
      baseUnit: 8,
    },
  );
  if (opacityScrim > 0) {
    addRect(slide, left, top, width, height, `rgba(6, 17, 27, ${opacityScrim})`);
  }
}

function addText(slide, value, left, top, width, height, style = {}, name = undefined) {
  slide.compose(
    text(value, {
      name,
      width: fill,
      height: hug,
      style: { ...bodyStyle, ...style },
    }),
    {
      frame: { left, top, width, height },
      baseUnit: 8,
    },
  );
}

function footer(slide, n) {
  addText(slide, `Stock Ski Adventure / Portfolio Deck / ${String(n).padStart(2, "0")}`, 96, 1010, 720, 28, {
    fontSize: 16,
    color: "#62899A",
    letterSpacing: 0,
  }, `footer-${n}`);
}

function eyebrow(slide, label, left = 96, top = 72) {
  addText(slide, label.toUpperCase(), left, top, 650, 36, {
    fontFamily: "Bahnschrift",
    fontSize: 20,
    bold: true,
    color: palette.cyan,
  }, `eyebrow-${label}`);
}

function title(slide, value, top = 116, width = 1220) {
  addText(slide, value, 96, top, width, 140, {
    ...titleStyle,
    fontSize: 58,
  }, `title-${value.slice(0, 10)}`);
}

function thinLine(slide, x1, y1, x2, y2, color = palette.cyan, thickness = 3) {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1) || thickness;
  const height = Math.abs(y2 - y1) || thickness;
  addRect(slide, left, top, width, height, color, color, 0);
}

function chip(slide, label, left, top, color = palette.cyan, width = 190) {
  addRect(slide, left, top, width, 42, "rgba(0,255,255,0.08)", color, 2);
  addText(slide, label, left + 18, top + 8, width - 36, 26, {
    fontFamily: "Bahnschrift",
    fontSize: 18,
    bold: true,
    color,
  }, `chip-${label}`);
}

function slide1(p) {
  const slide = p.slides.add();
  addImage(slide, assets.cover, 0, 0, W, H, "cover", 0.36);
  addRect(slide, 0, 0, W, H, "rgba(7,19,31,0.18)");
  addRect(slide, 96, 768, 720, 8, palette.cyan);
  addText(slide, "Stock Ski Adventure", 94, 116, 1180, 104, {
    ...titleStyle,
    fontSize: 82,
  }, "cover-title");
  addText(slide, "當金融數據遇上極限滑雪", 100, 230, 830, 54, {
    fontFamily: "Microsoft JhengHei UI",
    fontSize: 34,
    bold: true,
    color: palette.cyanSoft,
  }, "cover-subtitle");
  addText(slide, "以「數據決定幻想」為核心的動態地形與視覺演化系統", 100, 812, 900, 70, {
    fontSize: 30,
    color: "#E8F8FF",
  }, "cover-promise");
  addText(slide, "Portfolio Case Study", 100, 920, 380, 36, {
    fontFamily: "Bahnschrift",
    fontSize: 22,
    bold: true,
    color: palette.orange,
  }, "cover-tag");
}

function slide2(p) {
  const slide = p.slides.add();
  addBg(slide, palette.deep);
  eyebrow(slide, "Motivation");
  title(slide, "從「看不懂」到「想滑下去」");
  addText(slide, "身為財管學生，傳統看盤介面給我的第一個感受不是知識，而是距離。K 線、術語、數字像一面牆，讓新手還沒開始就先被勸退。", 98, 260, 760, 160, {
    fontSize: 30,
    lineSpacingMultiple: 1.18,
  }, "motivation-body");
  addText(slide, "問題不是金融太難，而是入口太冷。", 98, 460, 780, 72, {
    ...titleStyle,
    fontSize: 42,
    color: palette.orange,
  }, "motivation-claim");
  addRect(slide, 1040, 156, 720, 640, "rgba(18,34,48,0.88)", "#1F3E52", 2);
  addText(slide, "TRADITIONAL MARKET UI", 1080, 192, 500, 38, {
    fontFamily: "Bahnschrift",
    fontSize: 20,
    bold: true,
    color: "#6E8795",
  }, "trad-label");
  const chartY = [610, 560, 585, 500, 535, 410, 455, 360, 392, 305, 338, 285];
  for (let i = 0; i < chartY.length - 1; i++) {
    thinLine(slide, 1090 + i * 54, chartY[i], 1090 + (i + 1) * 54, chartY[i + 1], i % 2 ? "#AC4059" : "#3AA76D", 5);
  }
  for (let i = 0; i < 9; i++) {
    addRect(slide, 1100 + i * 68, 690 - i * 16, 34, 70 + (i % 3) * 36, i % 2 ? "rgba(255,79,216,0.35)" : "rgba(0,255,255,0.28)");
  }
  addText(slide, "Is there a better way?", 1078, 835, 620, 62, {
    ...titleStyle,
    fontSize: 46,
    color: palette.cyanSoft,
  }, "better-way");
  footer(slide, 2);
}

function slide3(p) {
  const slide = p.slides.add();
  addBg(slide, "#081723");
  eyebrow(slide, "Origin");
  addText(slide, "Antigravity 工作坊：\n把冷軟體變成會說故事的世界", 96, 126, 880, 150, {
    ...titleStyle,
    fontSize: 52,
  }, "origin-title");
  addImage(slide, assets.googl, 1030, 140, 700, 430, "cover", 0.34);
  addText(slide, "轉折點", 100, 290, 260, 48, { ...titleStyle, fontSize: 38, color: palette.orange }, "origin-turn");
  addText(slide, "第一次接觸 Antigravity 時，我意識到 AI 不只是在幫我寫功能，也可以幫我把抽象資料翻譯成一種情緒、一種場景。", 100, 354, 760, 130, { fontSize: 30 }, "origin-body");
  addText(slide, "構思：讓使用者在滑雪時，直觀感受公司的產業特色與漲跌趨勢。", 100, 525, 820, 92, { fontSize: 34, bold: true, color: palette.cyanSoft }, "origin-idea");
  addText(slide, "K line", 202, 760, 160, 34, { fontFamily: "Bahnschrift", fontSize: 20, bold: true, color: "#7896A5" }, "kline-label");
  addText(slide, "Mountain", 792, 760, 210, 34, { fontFamily: "Bahnschrift", fontSize: 20, bold: true, color: "#7896A5" }, "mountain-label");
  const pts = [[188, 702], [290, 650], [398, 704], [510, 594], [620, 634], [730, 520], [852, 560]];
  for (let i = 0; i < pts.length - 1; i++) thinLine(slide, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], palette.magenta, 4);
  for (let i = 0; i < pts.length - 1; i++) thinLine(slide, pts[i][0], pts[i][1] + 28, pts[i + 1][0], pts[i + 1][1] + 28, palette.cyan, 3);
  addText(slide, "DATA STORYTELLING", 1058, 612, 560, 42, { fontFamily: "Bahnschrift", fontSize: 28, bold: true, color: palette.cyan }, "origin-data");
  addText(slide, "輸入股票代碼，世界不是換皮，而是依照產業與市場特徵重新生成。", 1058, 666, 570, 92, { fontSize: 30 }, "origin-data-body");
  footer(slide, 3);
}

function slide4(p) {
  const slide = p.slides.add();
  addBg(slide, "#07121D");
  eyebrow(slide, "Data-Driven Fantasy");
  title(slide, "產業映射：股票代碼決定世界長什麼樣");
  const cards = [
    { img: assets.intc, ticker: "INTC", label: "科技 / 數位冰原", color: palette.cyan, x: 96 },
    { img: assets.nvda, ticker: "NVDA", label: "AI 晶片 / 神經冰川", color: palette.green, x: 680 },
    { img: assets.jpm, ticker: "JPM", label: "金融 / 古典石柱群", color: palette.gold, x: 1264 },
  ];
  for (const c of cards) {
    addImage(slide, c.img, c.x, 260, 520, 360, "cover", 0.22);
    addRect(slide, c.x, 260, 520, 360, "rgba(0,0,0,0)", c.color, 3);
    addText(slide, c.ticker, c.x + 26, 646, 160, 42, { ...titleStyle, fontSize: 36, color: c.color }, `ticker-${c.ticker}`);
    addText(slide, c.label, c.x + 26, 704, 420, 46, { fontSize: 26, bold: true }, `sector-${c.ticker}`);
  }
  addText(slide, "不是 AAPL vs XOM 的表格比較，而是每支股票都能開出一條完全不同的雪道。", 100, 842, 1180, 56, { fontSize: 32, color: "#E8F8FF" }, "mapping-claim");
  footer(slide, 4);
}

function slide5(p) {
  const slide = p.slides.add();
  addImage(slide, assets.cover, 0, 0, W, H, "cover", 0.56);
  eyebrow(slide, "Gameplay");
  title(slide, "玩法核心：把角色留在收盤線上");
  addText(slide, "路徑保持", 96, 282, 460, 60, { ...titleStyle, fontSize: 48, color: palette.cyan }, "gameplay-core");
  addText(slide, "Hitbox 不能完全偏離股票收盤線。玩家不是在躲障礙，而是在追蹤一條會波動、會讓人手心發熱的資料曲線。", 96, 356, 780, 136, { fontSize: 31 }, "gameplay-body");
  const controls = [
    ["滾輪", "垂直位移", "追蹤陡峭漲跌"],
    ["左右鍵 / A D", "速度調控", "加速與減速"],
    ["中鍵", "靈敏度增幅", "處理極端波動"],
  ];
  controls.forEach((item, idx) => {
    const y = 596 + idx * 92;
    addText(slide, item[0], 118, y, 210, 44, { fontFamily: "Bahnschrift", fontSize: 26, bold: true, color: palette.orange }, `control-key-${idx}`);
    addText(slide, item[1], 352, y, 260, 44, { fontSize: 27, bold: true, color: palette.white }, `control-name-${idx}`);
    addText(slide, item[2], 648, y + 2, 330, 42, { fontSize: 24, color: "#BFD4DF" }, `control-desc-${idx}`);
  });
  addRect(slide, 1110, 430, 600, 4, palette.magenta);
  addRect(slide, 1220, 406, 110, 52, "rgba(0,255,255,0.18)", palette.cyan, 3);
  addText(slide, "HITBOX", 1242, 416, 90, 30, { fontFamily: "Bahnschrift", fontSize: 18, bold: true, color: palette.cyan }, "hitbox-label");
  footer(slide, 5);
}

function slide6(p) {
  const slide = p.slides.add();
  addBg(slide, "#07131E");
  eyebrow(slide, "Visual Evolution");
  title(slide, "視覺演化：從色塊到數位向量美學");
  const steps = [
    ["01", "基礎色塊", "先確立產業主色與地形輪廓"],
    ["02", "電路覆層", "山體加入導線、蜂巢、晶片紋理"],
    ["03", "發光與景深", "用深色底托住霓虹、光暈與速度感"],
  ];
  addImage(slide, assets.material, 1040, 220, 680, 520, "cover", 0.18);
  steps.forEach((s, i) => {
    const y = 260 + i * 160;
    addText(slide, s[0], 104, y, 82, 54, { ...titleStyle, fontSize: 42, color: i === 2 ? palette.orange : palette.cyan }, `evo-num-${i}`);
    addText(slide, s[1], 220, y, 420, 50, { ...titleStyle, fontSize: 38 }, `evo-title-${i}`);
    addText(slide, s[2], 222, y + 58, 620, 46, { fontSize: 26, color: "#BFD4DF" }, `evo-desc-${i}`);
    if (i < 2) thinLine(slide, 144, y + 72, 144, y + 152, "#244B5D", 4);
  });
  addText(slide, "幾何純淨度不是少做，而是把畫面的每一個發光面都變成資料人格的一部分。", 104, 822, 980, 70, { fontSize: 32, bold: true, color: palette.cyanSoft }, "evo-claim");
  footer(slide, 6);
}

function slide7(p) {
  const slide = p.slides.add();
  addBg(slide, palette.navy);
  eyebrow(slide, "Parallax Architecture");
  title(slide, "五層視差渲染：讓資料山脈有速度與深度");
  const layers = [
    ["0.10x", "Far Vista", "大氣光柱、雷射星空"],
    ["0.35x", "Mid-range", "科技地標、漂浮晶圓"],
    ["1.00x", "Main Terrain", "K 線實體山脈"],
    ["1.15x", "Detail / Sheen", "山脊光暈、動態發光"],
    ["HUD", "Control Layer", "角色、hitbox、速度儀表"],
  ];
  layers.forEach((l, i) => {
    const x = 120 + i * 340;
    const y = 330 + i * 46;
    addRect(slide, x, y, 280, 150, `rgba(${i * 12}, ${180 + i * 8}, 255, 0.10)`, i === 2 ? palette.orange : palette.cyan, 2);
    addText(slide, l[0], x + 22, y + 20, 104, 34, { fontFamily: "Bahnschrift", fontSize: 22, bold: true, color: i === 2 ? palette.orange : palette.cyan }, `layer-speed-${i}`);
    addText(slide, l[1], x + 22, y + 60, 224, 34, { ...titleStyle, fontSize: 26 }, `layer-name-${i}`);
    addText(slide, l[2], x + 22, y + 102, 236, 34, { fontSize: 20, color: "#BED3DE" }, `layer-desc-${i}`);
    if (i < layers.length - 1) thinLine(slide, x + 280, y + 72, x + 340, y + 118, "#315D70", 3);
  });
  addText(slide, "API data", 210, 800, 160, 36, { fontFamily: "Bahnschrift", fontSize: 22, bold: true, color: palette.orange }, "flow-api");
  addText(slide, "terrain generator", 520, 800, 260, 36, { fontFamily: "Bahnschrift", fontSize: 22, bold: true, color: palette.cyan }, "flow-terrain");
  addText(slide, "multi-layer renderer", 900, 800, 330, 36, { fontFamily: "Bahnschrift", fontSize: 22, bold: true, color: palette.cyan }, "flow-renderer");
  addText(slide, "interactive canvas", 1320, 800, 300, 36, { fontFamily: "Bahnschrift", fontSize: 22, bold: true, color: palette.orange }, "flow-canvas");
  thinLine(slide, 380, 818, 500, 818, palette.cyan, 4);
  thinLine(slide, 790, 818, 880, 818, palette.cyan, 4);
  thinLine(slide, 1240, 818, 1300, 818, palette.cyan, 4);
  footer(slide, 7);
}

function slide8(p) {
  const slide = p.slides.add();
  addBg(slide, "#06131C");
  eyebrow(slide, "Responsive Materials");
  title(slide, "數據不只改變地形，也改變質感");
  const rows = [
    ["Volume", "成交量", "發光強度 / 紋理亮度", palette.cyan],
    ["Volatility", "波動率", "破碎度 / 幾何尖銳度", palette.orange],
    ["Price Change", "漲跌幅", "環境主色調偏移", palette.green],
  ];
  rows.forEach((r, i) => {
    const y = 300 + i * 170;
    addText(slide, r[0], 126, y, 260, 44, { fontFamily: "Bahnschrift", fontSize: 32, bold: true, color: r[3] }, `mat-key-${i}`);
    addText(slide, r[1], 420, y, 190, 44, { fontSize: 30, bold: true, color: palette.white }, `mat-cn-${i}`);
    addText(slide, r[2], 660, y, 430, 44, { fontSize: 28, color: "#CFE1E8" }, `mat-effect-${i}`);
    addRect(slide, 1160, y + 10, 420, 24, "rgba(255,255,255,0.08)", "#1C3A4A", 1);
    addRect(slide, 1160, y + 10, 140 + i * 110, 24, r[3]);
    chip(slide, i === 0 ? "brighter" : i === 1 ? "sharper" : "warmer", 1600, y - 2, r[3], 148);
    thinLine(slide, 126, y + 90, 1750, y + 90, "#173346", 2);
  });
  addText(slide, "同一條股價線，會因成交量、波動率、漲跌幅而產生不同的「觸感」。這是遊戲最像金融、也最不像金融的地方。", 128, 860, 1330, 70, { fontSize: 32, bold: true, color: palette.cyanSoft }, "materials-claim");
  footer(slide, 8);
}

function slide9(p) {
  const slide = p.slides.add();
  addImage(slide, assets.meta, 0, 0, W, H, "cover", 0.62);
  eyebrow(slide, "Future Vision");
  addText(slide, "讓科技溫暖人心，讓數據成為一場冒險", 96, 142, 1120, 136, { ...titleStyle, fontSize: 58, color: palette.white }, "future-title");
  const items = [
    ["AI Agent 自主創作", "自動生成場景資產，讓每支股票都有自己的世界。"],
    ["OpenCLAW 龍蝦系統", "在無人類干預下，迭代高品質視覺內容。"],
    ["高資訊密度整合", "把即時金融訊息自然嵌入遊戲，不破壞滑雪快感。"],
  ];
  items.forEach((it, i) => {
    const y = 380 + i * 136;
    addText(slide, `0${i + 1}`, 104, y, 86, 42, { fontFamily: "Bahnschrift", fontSize: 30, bold: true, color: i === 1 ? palette.orange : palette.cyan }, `future-num-${i}`);
    addText(slide, it[0], 220, y, 520, 42, { ...titleStyle, fontSize: 32 }, `future-head-${i}`);
    addText(slide, it[1], 220, y + 54, 760, 44, { fontSize: 24, color: "#D7E8EF" }, `future-body-${i}`);
  });
  addText(slide, "愉快學習不是降低難度，而是讓人願意再多看一眼。", 104, 860, 900, 54, { fontSize: 34, bold: true, color: palette.orange }, "future-closing");
  footer(slide, 9);
}

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

[slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8, slide9].forEach((build) => build(presentation));

const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(OUT);

for (let i = 0; i < presentation.slides.items.length; i++) {
  const slide = presentation.slides.items[i];
  const index = String(i + 1).padStart(2, "0");
  const png = await slide.export({ format: "png" });
  fs.writeFileSync(path.join(PREVIEW_DIR, `slide-${index}.png`), Buffer.from(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  fs.writeFileSync(path.join(LAYOUT_DIR, `slide-${index}.layout.json`), JSON.stringify(layout, null, 2), "utf8");
}

console.log(JSON.stringify({
  pptx: OUT,
  previews: PREVIEW_DIR,
  layouts: LAYOUT_DIR,
  slides: presentation.slides.items.length,
}, null, 2));
