# 四大模組生成框架

用這份檔案把產業分類轉成可實作的滑雪關卡主題。

## 核心原則

- 這四大類是生成框架，不是封閉分類表。
- `Environment Biomes` 與 `Company Props` 裡的名稱都只是示例，不是只能從清單中挑選。
- 當示例不夠用時，沿用相同原則擴寫新的遠景或組件：先定義情緒，再定義材質，再定義可識別輪廓。
- 前 3 模組負責生成內容，第 4 模組負責把它們落地到實作。
- 如果任務明確要求山體材質、K 線貼圖、公司配件貼附或數據驅動造型，額外讀 [terrain-material-workflow.md](terrain-material-workflow.md)。

## 1. Environment Biomes

`Environment Biomes` 決定整張關卡的遠景、天氣、空氣質感、遠方輪廓與基礎色調。

### 典型示例

- `數位冰原`：科技、半導體、硬體、資安。冷色調、極光、電路紋理冰山、數位結晶。
- `摩天雪都`：金融、銀行、支付。都市剪影、夜間燈火、暴雪、玻璃與石材反光。
- `鋼鐵峽谷`：航運、重工、物流、基建。起重機、貨櫃山、鋼架、霧霾與工業雪。
- `雲端之巔`：軟體、AI、平台型服務。漂浮雲朵、半透明方塊、光橋、懸浮資料層。

### 擴寫規則

- 不要把示例當作唯一選項。
- 若產業不在示例裡，先判斷它偏向哪種大氣氛：冰冷精密、都市秩序、工業重量、雲端飄浮，或新建一個相同品質的新 biome。
- 每次新增 biome，至少定義：
  - 主色與輔色
  - 天氣或空氣條件
  - 遠方輪廓
  - 兩種以上材質描述
  - 一句情緒總結

## 2. Company Props

`Company Props` 是貼在背景與中景上的公司特徵物件，用來補足品牌辨識度。

### 典型示例

- `金融組件`：旋轉金幣、牛熊雕像、古羅馬式柱頭、保險庫圓門。
- `科技組件`：懸浮 GPU、衛星天線、投影旗幟、AI 核心、發光伺服器。
- `能源組件`：結冰風機、運轉採油機、電池槽、太陽能板。
- `消費組件`：巨大購物車、漂浮包裹、條碼牌、貨架標牌。

### 擴寫規則

- props 不是通用裝飾，它們必須回答「這家公司是誰」。
- 如果使用者指定公司，優先從該公司的產品、商業模式、符號或大眾印象抽出 props。
- 每次輸出 props，至少給 2 到 4 個具體物件，並解釋其來源。
- 如果沒有現成資產，先用簡化幾何或 placeholder shapes 代替，後續再替換成圖庫。

## 3. The Mixer

`The Mixer` 負責把遠景、組件、地形與市場數據組裝成一個完整關卡。

### 基本流程

1. 先用細分產業決定主色、physics 與視覺語氣。
2. 再決定 `Environment Biome`。
3. 再決定 `Company Props`。
4. 最後把股價資料映射到地形節奏、坡度、跳台密度或震盪感。

### 地形規則

- 大漲：地形更陡、下坡更長、跳台與速度感更強。
- 高震盪：坡面破碎、上下切換快、障礙分佈更密。
- 穩定慢漲：坡道更順、長弧線更多、節奏偏穩定。
- 量能爆發：可以增加光效、粒子、風切或 prop 出現頻率。

### 案例

#### NVDA

- `Environment Biome`：數位冰原
- `Company Props`：發光 GPU、AI 核心、伺服器矩陣
- `The Mixer`：如果近期股價強勢上漲，就把坡度拉陡，增加高速下切與跳台節奏

#### JPM

- `Environment Biome`：摩天雪都
- `Company Props`：旋轉金幣、古典柱頭、保險庫門
- `The Mixer`：用當天震盪幅度決定地形波動幅度與節奏密度

## 4. Implementation Plan

用 `Canvas Layering` 把前 3 個模組落地。

### 推薦分層

1. `Bottom Layer`
- 放 AI 生成或程式化生成的循環背景圖。
- 負責天空、遠山、都市剪影、雲海、極光或大型結構。
- 可以做水平 scrolling 與輕微 parallax。

2. `Object Layer`
- 根據 ticker 與時間範圍生成固定 seed。
- 用固定 seed 在合理區域隨機放置 props，避免每一幀都跳位。
- 使用 `ctx.drawImage()` 繪製圖庫資產；若資產未到位，先用 Canvas 向量圖形替代。

3. `Terrain Layer`
- 保留 K 線轉換而來的物理坡道作為主要可玩層。
- 所有視覺包裝都要服務這條地形，而不是遮住它。

### 對接現有前端的建議

在 [frontend/ski-game.js](C:\Users\閻星澄\Desktop\stock-main\frontend\ski-game.js) 裡，現況已經有背景與地形分離的基礎：

- 背景目前主要在 `drawBackground()` 與其相關繪製流程處理。
- 地形目前主要在 `drawTerrain()` 處理。

落地時優先採用這個順序：

1. 把現有背景繪製整理成 `drawThemeBackground(theme, W, H)`。
2. 新增 `drawThemeProps(theme, seed, scrollX)`，專門負責中景物件。
3. 保留 `drawTerrain(W, H)` 作為最後的主要可玩層。
4. 若需要前景特效，再額外加 `drawThemeFx()`，但不要讓它遮蔽 hitbox 與路線辨識。

### 實作原則

- 所有 props 座標都要可重現，避免每次 render 都重新亂數。
- 遠景與 props 都要跟著 theme object 走，不要把顏色與圖片路徑寫死在主 loop。
- 若先做 MVP，先完成資料結構與 placeholder 畫法，再替換成 AI 生成資產。

### 若要做山體材質化

- 把 `Terrain Layer` 再拆成 `fill texture`、`edge treatment`、`gradient mask` 與 `sprite decoration`。
- 優先用重複貼圖與 sprite sheet，而不是一張固定大圖。
- 把成交量、波動率、漲跌幅映射成紋理密度、位移強度與山脊發光。
- 在轉折點、上坡處與平台處，按規則貼上公司組件，而不是平均撒點。
