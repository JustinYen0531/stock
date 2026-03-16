# 滑雪遊戲視覺演化框架 (Visual Evolution Framework)

致力於創造具備「沈浸感」與「電影感」的遊戲畫面，同時保留「低細節模式」供基礎運行與穩定性考量。

---

## 核心原則：雙模式切換 (Dual-Mode Design)

遊戲提供兩種視覺渲染等級：

1.  **Low Detail (基礎模式)**：
    *   **渲染源**：純向量圖形、簡單漸層、基礎圖標。
    *   **優點**：性能極佳、無外部負擔、視覺清晰。
    *   **特色**：保留原本設計的「數位感」與「快節奏」。
2.  **High Detail (視覺重工模式)**：
    *   **渲染源**：AI 生成的無縫紋理、高清遠景圖、具備景深的特效。
    *   **優點**：沈浸感強、具備電影質感、細節豐富。
    *   **實施**：透過 `visual-evolution-framework.md` 的優化流程進行生成。

---

## 模組 1：靈魂提取與模式判定 (Soul & Mode Detection)

1.  **產業識別 (Industry Identification)**：
    *   依據 Ticker 查詢 `industry-taxonomy.md`。
    *   確定其 **代表色 (Color Anchor)** 與 **情緒關鍵字 (Tone Cues)**。
2.  **Biome 擴寫 (Atmospheric Briefing)**：
    *   依據 [four-part-framework.md](four-part-framework.md) 第 1 模組定義遠景。
    *   **優化重點**：不再只是顏色，要定義「空氣」與「光照」。例如：是「乾燥的工業霧霾」還是「濕潤的冷凍數據流」。

---

## 模組 2：深度材質化執行 (Material Fidelity)
*參考 [terrain-material-workflow.md](terrain-material-workflow.md) 執行。*

1.  **[TEXTURE] 無縫材質生成**：
    *   **指令**：生成符合產業類別的灰階無縫貼圖。
    *   **映射規則**：
        *   `Tech` -> 晶圓、六角網格、二進位流。
        *   `Finance` -> 大理石裂紋、微縮指數帶。
        *   `Consumer` -> 瓦楞紙紋理、膠帶痕跡。
2.  **[EDGE] 山脊處理 (Edge Treatment)**：
    *   根據漲跌強弱定義 `edge_glow` 與 `rim_light`。
    *   **優化**：加上「硬邊幾何」或「積雪漸層」，消除向量線條的單薄感。

---

## 模組 3：特製資產生成模型 (AI Asset Generation Model)
*利用 Gemini 3.1 生成具備一致性的資產。*

1.  **[VISTA] 遠景大氣景深圖**：
    *   **Prompt 模板**：`[Biome Layout] + [Industry Props] + [Cinematic Lighting] + [Material Context]`。
    *   *目標*：建立宏大的世界視角。
2.  **[LANDMARK] 特徵地標 Sprite**：
    *   依據 `Company Props` 生成具備品牌辨識度的關鍵物件（如結冰購物車、AI 核心）。
    *   *目標*：在轉折點出現，取代通用的向量圖示。

---

## 模組 4：實作與混合邏輯 (The Mixer Implementation)

1.  **畫布層級 (Canvas Z-Index)**：
    *   **Layer 0 (-100)**：遠景大圖 `[VISTA]`（極慢視差）。
    *   **Layer 1 (-50)**：填充了 `[TEXTURE]` 的山體背景層。
    *   **Layer 2 (0)**：主地形（具備 `Edge Treatment` 與 `Gradient Mask`）。
    *   **Layer 3 (+50)**：特製地標 `[LANDMARK]` 與動態粒子特效。
2.  **數據驅動演化 (Data-Driven Evolution)**：
    *   成交量 -> 紋理亮度與密度。
    *   波動率 -> 材質破碎度與 Glitch 強度。

---

## 💡 執行檢查清單 (Consistency Check)

*   [ ] 顏色是否符合 `industry-taxonomy.md` 的代表色？
*   [ ] 遠景與材質是否指向同一個「產業幻想」？
*   [ ] `Implementation Plan` 是否交代了 `fillPattern` 與 `clip()` 順序？
*   [ ] 是否為 AI 提供具體的鏡頭參數（如 50mm, f/1.8, Low Angle）？
