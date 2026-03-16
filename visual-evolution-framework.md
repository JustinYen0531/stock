# 滑雪遊戲視覺演化框架 (Visual Evolution Framework)

致力於創造具備「沈浸感」與「電影感」的遊戲畫面，同時保留「低細節模式」供基礎運行與穩定性考量。

---

## 核心原則：雙模式切換 (Dual-Mode Design)

遊戲提供兩種視覺渲染等級：

1.  **Low Detail (基礎模式)**：
    *   **渲染源**：純向量圖形（Vector）、簡單漸層、基礎圖標。
    *   **優點**：性能極佳、無外部負擔、視覺清晰，適合測試與低配設備。
    *   **核心**：以 [industry-taxonomy.md](industry-taxonomy.md) 的代表色與 [four-part-framework.md](four-part-framework.md) 的基礎組件為準。

2.  **High Detail (視覺重工模式)**：
    *   **渲染源**：AI 生成的無縫紋理 (Texture)、高清遠景圖 (Vista)、特製地標 (Landmark)。
    *   **優點**：沈浸感強、具備電影質感、細節豐富。
    *   **核心**：透過本框架的優化流程，對接 [terrain-material-workflow.md](terrain-material-workflow.md) 的進階渲染技術。

---

## 模組 1：靈魂提取與情緒映射 (Soul Extraction)

1.  **產業識別 (Industry Identification)**：
    *   依據 Ticker 查詢 `industry-taxonomy.md`。
    *   確定其 **代表色 (Color Anchor)** 與 **情緒關鍵字 (Tone Cues)**。
2.  **Biome 擴寫 (Atmospheric Briefing)**：
    *   依據 [four-part-framework.md](four-part-framework.md) 第 1 模組定義遠景。
    *   **優化重點**：定義「環境氣候」。例如：是「乾燥的工業霧霾」還是「濕潤的冷凍數據流」。

---

## 模組 2：深度材質化執行 (Material Fidelity) - 僅限高細節模式
*參考 [terrain-material-workflow.md](terrain-material-workflow.md) 執行。*

1.  **[TEXTURE] 無縫材質生成**：
    *   **指令**：生成符合產業類別的灰階無縫貼圖。
    *   **映射**：`Tech` -> 晶圓；`Finance` -> 大理石；`Consumer` -> 瓦楞紙。
2.  **[EDGE] 山脊處理 (Edge Treatment)**：
    *   加上「硬邊幾何」或「積雪漸層」，消除向量線條的單薄感。

---

## 模組 3：特製資產生成模型 (AI Asset Generation Model)

1.  **[VISTA] 遠景大氣景深圖**：
    *   **Prompt**：`[Biome Layout] + [Industry Props] + [Cinematic Lighting] + [Material Context]`。
    *   *目標*：建立宏大的世界視角。
2.  **[LANDMARK] 特徵地標 Sprite**：
    *   生成具備品牌辨識度的關鍵物件，取代通用的向量圖示。

---

## 模組 4：實作與混合邏輯 (The Mixer Implementation)

1.  **畫布層級 (Canvas Z-Index)**：
    *   **Layer 0 (-100)**：遠景大圖 `[VISTA]`（極慢視差）。
    *   **Layer 1 (-50)**：填滿 `[TEXTURE]` 的山體背景。
    *   **Layer 2 (0)**：主地形（具備 `Edge Treatment`）。
    *   **Layer 3 (+50)**：特製地標 `[LANDMARK]` 與動態粒子。
2.  **模式切換開關 (Visual Toggle)**：
    *   在前端介面提供預設開啟/關閉高細節模式的按鈕。

---

## 💡 執行檢查清單 (Consistency Check)

*   [ ] 顏色是否符合 `industry-taxonomy.md` 的代表色？
*   [ ] 遠景與材質是否指向同一個「產業幻想」？
*   [ ] 低細節模式是否依然保持可玩性與視覺清晰度？
*   [ ] 高細節資產是否有正確的 `fillPattern` 實作方式？
