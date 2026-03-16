# 山體材質組件化工作流

這份檔案用來把 K 線山體拆成可重組的材質系統，而不是一次生成一整張不可重用的大圖。

適用時機：

- 使用者要做滑雪冒險模式裡的山體質感、坡面貼圖或邊緣特效。
- 任務涉及 `CanvasPattern`、`clip()`、灰階材質上色、sprite sheet、動態地形合成。
- 需要讓不同股票共用同一套底層素材，只在產業與公司層做局部變化。

## 目錄

1. 底層方格
2. 材質變化工作流
3. 具體材質包
4. 公司視覺資產庫
5. 動態地形合成
6. 數據驅動演化
7. 技術落地建議

## 1. 底層方格

不要把山體視為一整塊圖，而要視為由 `fills` 和 `edges` 組成的模組。

### Fills

- 先定義可重複的 seamless textures，建議尺寸 `256x256` 或 `512x512`。
- 優先做灰階底稿，再在程式裡動態上色，避免每個產業都要存一套完整彩色版本。
- 每種方格至少定義：底色傾向、線條密度、表面材質、可疊加的品牌細節。

### 典型 texture maps

- `Circuit Tile / 科技類`：深藍底，淡青色發光導線，像電路板或冷卻通道。
- `Logistics Tile / 零售物流類`：紙箱棕或輸送帶灰，混入膠帶、條碼、包裹封條浮水印。
- `Marble Tile / 金融類`：大理石裂紋，或以微縮 ticker tape、數字流構成的細密底紋。
- `Snow or Ice Tile / 通用類`：半透明藍白色，帶斜向冰裂、霜痕與冷凝噪點。

### Edges

為了避免方格拼接後看起來像表格，需要額外設計 `rim` 或 `edge treatment`。

- `積雪層`：在 K 線下方約 `10px` 到 `16px` 疊一層白到透明的漸層，模擬山脊積雪。
- `光溢出`：根據漲跌與情緒，對山脊線加 bloom。
- `硬邊輪廓`：金融或工業主題可用幾何硬邊，讓山脊像石造建築或金屬屋脊。
- `鋸齒封條`：零售主題可把山脊做成封箱膠帶或撕裂封條的邊緣節奏。

## 2. 材質變化工作流

核心原則是：數據決定方格排列、濾鏡強度與裝飾節奏。

### Step 1. Data Mapping

把市場資料映射成材質參數：

- `volume -> texture_density`
  - 成交量放大時，讓電路、條碼、數字流或封條紋理更密、更亮。
- `volatility -> displacement_amount`
  - 波動率高時，增加位移干擾、噪點偏移或局部破碎感。
- `price_change -> edge_glow`
  - 上漲偏金光、青光、品牌亮色。
  - 下跌偏紅光、低飽和警示色或冷裂痕。
- `trend_strength -> terrain_steepness`
  - 強勢主升用更陡的長坡。
  - 盤整或防守型資產則用較平順長弧。

### Step 2. Layering Logic

每一塊山體至少由三層構成：

1. `Solid Color`
- 產業或品牌代表色。
- 例如 Amazon 橘、Nvidia 綠、金融金、能源綠。

2. `Pattern Overlay`
- 疊加灰階 seamless texture。
- 建議用 `multiply`、`overlay` 或 `soft-light` 類型的疊色思路。

3. `Gradient Mask`
- 用由上而下或由外往內的透明黑色漸層，讓山腳沉進暗部，保留深邃感。

### Step 3. Procedural Decoration

在山體填滿後，再做程序化裝飾：

- `節點裝飾`
  - K 線轉折點可自動生成冰晶、品牌建築、能量節點或里程碑 props。
- `視差背景`
  - 複製山體輪廓，縮小、調暗、模糊後放到後景，形成 parallax mountain。
- `局部特效`
  - 量能爆發時提高粒子密度。
  - 高波動時在局部加 glitch、裂紋或放電。

## 3. 具體材質包

以下是可直接重用的產業材質方案。

### 零售超市 / Amazon 類

- `Texture Elements`：半透明膠帶條紋、波浪包裹封條、淡 QR Code、物流標籤切角。
- `Edge Treatment`：山脊做成封箱膠帶鋸齒，像被拉開的包裹邊。
- `Props`：飛行包裹、結冰購物車、Logo 石碑、Prime 箭頭加速帶、AWS 伺服器塔。

### 科技半導體 / Nvidia 類

- `Texture Elements`：六角蜂巢、發光導線、晶片針腳、二進位數字流。
- `Edge Treatment`：發光冰脊、規律呼吸燈、精密切面。
- `Props`：GPU、AI 核心、伺服器塔、冷卻光柱、數位稜鏡。

### 芝加哥金融 / JPM 類

- `Texture Elements`：垂直希臘柱影、大理石裂紋、微型美元符號、ticker tape 浮水印。
- `Edge Treatment`：神廟屋頂般的硬邊幾何，少用柔軟雪浪。
- `Props`：金幣、石柱、保險庫門、獎章、盾牌、古典建築片段。

### 能源綠能 / Tesla 類

- `Texture Elements`：葉脈紋理、電池正負極、綠色流體光影、電流通道。
- `Edge Treatment`：邊緣帶放電粒子或電弧。
- `Props`：Cybertruck、充電樁、巨大電池、風機、太陽能板。

## 4. 公司視覺資產庫

不要直接產整張圖。先建立透明背景的小組件 `sprite sheet asset`，再用程式貼到山體上。

### 基本規則

- 每個產業至少準備一個 `sprite pack`。
- 每個 pack 至少包含：
  - `ambient props`
  - `landmark props`
  - `interactive props`
- 優先讓同產業公司共用 60% 到 80% 的素材，只保留少數公司專屬件。

### Amazon 零售包示例

- 飛行包裹：帶笑臉箭頭的棕色紙箱。
- 結冰購物車：至少準備 2 到 4 個角度。
- 雲端伺服器塔：代表 AWS，避免只把 Amazon 簡化成零售。
- Prime 箭頭：可當加速帶或上坡導向標記。

## 5. 動態地形合成

用 Canvas 在山體內有邏輯地貼上這些組件。

### 三層合成

1. `Bottom Layer`
- 基礎雪山、漸層山體、遠景光影。

2. `Middle Layer`
- 在山體內部的合理區域貼上裝飾型 props。
- 例如結冰購物車、公司 Logo 石碑、金融柱影、GPU 嵌片。

3. `Top Layer`
- 放可互動或高辨識度組件。
- 例如 Prime 加速帶、伺服器塔障礙物、金融石柱、充電樁。

### 放置邏輯

- 使用固定 seed 產生座標，避免每次 render 重排。
- 讓 props 依坡度、轉折點或局部平臺出現，不要完全平均散佈。
- 裝飾型 props 偏向山體內部，可互動 props 偏向山脊、上坡或平台。

## 6. 數據驅動演化

同一組素材要能隨近期股價狀態變化，而不是永遠長得一樣。

### 建議狀態

- `normal`
- `bullish`
- `volatile`
- `bearish`
- `crash`

### 演化方式

- `normal`：維持完整、穩定、光效節制。
- `bullish`：增加亮度、粒子、節點數量與加速帶頻率。
- `volatile`：加入位移、裂紋、故障光、翻折封條。
- `bearish`：降低飽和度、光感收斂、讓邊緣變冷或變紅。
- `crash`：使用結冰、斷裂、熄燈、碎片化版本。

### TSLA 示例

- 平時：Cybertruck 穩定停靠，充電樁正常發光。
- 利空快訊或暴跌：充電樁可切換成結冰、斷裂版本；車窗可出現裂痕或失壓狀態。

## 7. 技術落地建議

### CanvasPattern

- 先載入小方格圖，再用 `ctx.createPattern(img, 'repeat')` 填滿山體。
- 讓山體再大都不會把貼圖拉扁。

### Clipping

- 先畫出 K 線所圍出的封閉區域。
- `ctx.clip()` 後再把 pattern、gradient mask 與裝飾畫進去。

### Dynamic Color

- 用灰階貼圖當底稿。
- 以 `globalCompositeOperation = 'color'` 或相近思路動態上色。
- 這樣能讓同一套材質服務多個產業與 ticker。

### 建議欄位

如果任務需要輸出 config，優先補上：

- `fill_texture`
- `fill_tint`
- `texture_density`
- `edge_style`
- `edge_glow_color`
- `edge_glow_strength`
- `displacement_amount`
- `sprite_pack`
- `sprite_density`
- `interactive_prop_rules`
- `parallax_scale`
- `state_variant`

### 對現有 Canvas 的提醒

- 背景、山體材質、props、地形 hitbox 要分開畫。
- 裝飾不可以蓋掉主路線判讀。
- 先讓資料結構與 placeholder 運作，再替換成 AI 生成或手繪資產。
