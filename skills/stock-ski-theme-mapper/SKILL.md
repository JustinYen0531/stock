---
name: stock-ski-theme-mapper
description: 將股票代碼、公司名稱、產業類別與市場主題映射成 Stock Ski Adventure 的四段式主題包：遠景氛圍、公司組件、排列組合邏輯與開發實作建議。當 Codex 需要把 公司代碼、ticker、產業、K線主題 轉成 biome、代表色、道具組、AI 圖像 prompt、鏡頭方向、燈光設計、氛圍處理、滾輪物理參數或 Canvas layering 開發方案時使用，特別適合 ticker 對產業映射、視覺資產生成、關卡 key art、場景組裝與遊戲控制風格的一致化。
---

# Stock Ski Theme Mapper

把市場身份轉成一個完整、可玩的滑雪主題包，並附帶一致的電影感視覺方向與可實作的分層開發方案。

## 工作流程

1. 先確認公司的核心業務。
- 優先採用使用者、程式碼或資料集裡明確提供的 sector 或 industry 資訊。
- 如果只有 ticker 或公司名，根據可靠的本地上下文謹慎推斷。
- 如果映射有不確定性，先說明假設再繼續。

2. 把公司歸入一個主要類別。
- 一律先讀 [references/industry-taxonomy.md](references/industry-taxonomy.md)。
- 一律再讀 [references/four-part-framework.md](references/four-part-framework.md)。
- 如果任務涉及山體材質、方格貼圖、sprite sheet、Clip/Pattern 渲染或數據驅動裝飾，一律再讀 [references/terrain-material-workflow.md](references/terrain-material-workflow.md)。
- 先用細分產業類別決定主色、物理語氣與品牌幻想。
- 如果公司真的跨兩種核心業務，而且使用者明確要求混搭，才加入次要 accent。

3. 以四大模組來生成主題。
- `Environment Biomes`：決定遠景氛圍、天氣、遠處輪廓與整體色調。
- `Company Props`：決定貼附在中景或近景的品牌符號、障礙物與裝飾件。
- `The Mixer`：決定遠景、組件、地形與市場資料如何被組裝在一起。
- `Implementation`：決定如何把前 3 項落成 Canvas layering 或實作步驟。

4. 先定義情緒核心，再生成視覺。
- 決定玩家前兩秒應該感受到什麼，例如速度、壓迫、過載、奢華、精密或工業重量。
- 把 biome、props、天氣與材質都當成情緒支撐，而不是獨立炫技元素。
- 情緒必須服從所選產業類別，不要加入無關的視覺奇觀。

5. 輸出完整主題包。
- 至少包含 `industry_class`、`color`、`environment_biome`、`company_props`、`mixer_logic`、`implementation_plan`、`physics`、`reasoning`。
- 如果任務直接碰到滑雪山體視覺或遊戲渲染，補上 `terrain_materials`、`edge_treatment`、`sprite_sheet_plan`、`data_reactivity`。
- 確保環境美術與操作手感指向同一個產業幻想。
- 場景輸出要補齊鏡頭、燈光、氛圍與材質細節。
- 只有在主題映射確定後，才把內容轉成 AI 圖像語言。

6. 依任務形式調整輸出。
- 如果是美術方向，輸出電影感場景 brief、一條 prompt 與技術鏡頭說明。
- 如果是遊戲實作，輸出精簡的 config 物件或 preset 列表。
- 如果是遊戲實作或 review，優先採用第 4 模組的 Canvas layering 建議，把前 3 模組落到實際渲染流程。
- 如果是山體材質化或關卡美術系統設計，優先把 terrain 視為 `base tiles + edge treatment + sprite decoration` 的模組化組裝，而不是一張整體大圖。
- 如果是 review，檢查配色、道具、場景與手感是否都屬於同一套幻想。

## 映射規則

- 以公司真正決定營收與心智印象的主營業務為準，不要被短期新聞、投資敘事或行銷包裝帶偏。
- 面對控股公司、綜合企業與平台型公司，以主要營運故事為準，不要以小型子公司決定主題。
- `Energy` 用於發電、儲能、石油、天然氣、再生能源設備與能源硬體。
- `Utility` 用於受監管的基礎設施、電網、水務與公共服務網路。
- `Consumer` 用於大眾零售與日常購物；只有真正高端、 aspirational 的品牌才用 `Luxury`。
- `Media` 用於娛樂、出版、廣告、遊戲、創作者平台與注意力經濟。
- 如果沒有完全吻合的類別，選最接近的遊戲幻想，並清楚說明取捨。
- 遠景類別與組件範例都只是示例，不是封閉清單；當現有例子不夠時，沿用相同的情緒、材質與產業對應原則擴寫新的 biome 或 props。
- 新增 biome 時，至少定義主色、天氣、遠處輪廓、材質語氣與運鏡情緒。
- 新增 props 時，至少定義 2 到 4 個可視符號，並說明它們為何能代表該公司或產業。

## 輸出格式

當使用者要你做新的主題映射時，依照這個順序回答：

1. Environment Biome
2. Company Props
3. The Mixer
4. Implementation Plan
5. Scene Summary
- 固定寫兩句。
- 以情緒鉤子為主，不要只是列物件。

6. Visual Breakdown
- 用 `Lighting`、`Camera`、`Objects` 三段組織。
- 把 atmosphere、color grading、material cues 自然折進這三段裡。

7. Physics package
8. Prompt string or config snippet（如果有需要）
9. Technical Specs
- 只要任務涉及視覺生成，就補上鏡頭、光圈與必要構圖說明。

## 一致性檢查

- 至少保留 reference 檔案中的一個主色錨點。
- 除非使用者明確要求 crossover event，否則不要混用多個 biome 家族。
- 以遊戲語言描述 physics，例如 inertia、resistance、gravity drift、friction、tolerance、turn radius。
- 除非使用者要求分層變化，否則選單、HUD、障礙物與 key art 都要維持同一主題。
- `Environment Biome` 要回答大氣氛與遠景輪廓，`Company Props` 要回答品牌細節，`The Mixer` 要回答如何把兩者接到地形與市場資料上。
- `Implementation Plan` 不能只講概念，必須說清楚層級、繪製順序、資產放置方式與與現有 Canvas 的接點。
- 如果任務涉及山體表面或可貼附組件，`Implementation Plan` 必須交代 fill texture、rim/edge、sprite sheet 來源、clip 順序、pattern 上色與數據如何驅動特效。
- 氛圍優先於物件數量。
- 讓燈光承擔敘事功能，不要只當作照明。
- 用精確材質詞，例如 frosted glass、oxidized steel、velvet、wet asphalt、sterile acrylic、polished marble，避免空泛稱讚。
- 鏡頭選擇要服務產業幻想：廣角用於尺度與脆弱感，長焦用於壓縮與觀察，較大光圈可用於奢華或電子霓虹的夢幻感。
