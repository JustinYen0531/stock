# Stock Ski / StockAI 專案歷史總整理

整理日期：2026-05-16  
整理範圍：從最早可見 commit 到目前 `HEAD`  
目前分支：`main`

## 第一個 Commit 是什麼？就是 2026-03-07 那個

這個 repository 有兩個 root commit，代表歷史曾經有過合併或接枝過的來源。

你指定的「3/7 的第一個」，也就是用提交時間排序時最早的 commit，是：

- `59576de137e17950e3d8fcdc951087679e0aefc0`
- 作者：JustinYen0531
- 時間：2026-03-07 16:01:17 +0800
- 訊息：`feat: StockAI 股市分析儀表板，含 Gemini AI 聊天專家`

如果用「目前 HEAD 的 root commits」來看，Git 也列出：

- `0e6b92addb56b26965ea78e260496ea0a8d5d131`
- 作者：JustinYen0531
- 時間：2026-03-11 22:18:49 +0800
- 訊息：`Initial commit`

因此，這份文件明確以 `59576de...` 作為我們要追的第一個 commit；`0e6b92a...` 只是 Git 拓撲上另一個後來接進主線的 root 節點。

## 整體規模

- 總 commit 數：198
- 從最早 commit 到目前版本的整體差異：約 311 個檔案變更、26,186 行新增、178 行刪除
- 主要演進方向：從 StockAI 股市分析儀表板，逐步長成 Stock Ski 金融教育遊戲、股票主題滑雪挑戰、首頁推薦系統、高精度品牌地形視覺，以及金融教育樂園模式。

## 專案做了哪些事？

### 1. StockAI 股市分析儀表板打底

最早版本建立了股市分析儀表板，包含前端頁面、後端 API、股票資料查詢、技術指標、Gemini AI 聊天專家，以及基礎部署設定。接著補上 README、Vercel 部署相容性、首頁互動卡片、股票知識區塊與平滑捲動。

重點成果：

- 建立前後端架構。
- 加入股票分析、AI 諮詢與聊天互動。
- 新增 README 與部署設定。
- 首頁增加功能卡片與股市知識展開區。
- 建立使用者可點、可展開、可導覽的早期產品骨架。

### 2. Stock Ski 滑雪挑戰模式

3 月 12 日開始，專案核心從單純分析工具轉向「股票走勢滑雪遊戲」。這段期間大量調整滑雪控制、HUD、計分、失敗條件、速度倍率、滑鼠操作、鍵盤加速、時間限制、準確率條、結果畫面與獎章。

重點成果：

- 新增 ski challenge mode。
- 玩家可沿著股價曲線滑行。
- 加入偏離累積條、畫面震動、準確率門檻、時間條。
- 將失敗條件從漂移失敗改成時間限制。
- 加入加速、煞車、中鍵垂直 boost、空白鍵靈敏度 boost。
- 建立分數拆解、計時 bonus、獎章與結果頁。
- 多次修正 HUD 位置、按鈕尺寸、控制預設值、命中框顏色與動作恢復。

### 3. 首頁推薦與 AI 推薦理由

首頁開始從靜態入口變成股票推薦入口，先加入推薦卡片，後來改成即時排序與 Gemini 推薦理由。推薦理由也從簡單文字演進為結構化 Markdown，並補上 Gemini 不可用或輸出不完整時的 fallback。

重點成果：

- 首頁新增股票推薦。
- 推薦改為 live-ranked。
- 加入 API route 取得推薦 preview。
- 顯示單一主打股票與 Gemini 分析理由。
- 建立 fallback 推薦文案。
- 優化 Markdown 排版與完整性。
- 增加快速股票入口與輸入下拉選股器。

### 4. 股票主題背景、地形材質與技能工作流

3 月 13 日到 3 月 21 日，專案大幅擴充 Stock Ski 的視覺語言。大量新增股票主題背景、產業分類、四段式主題框架、地形材質工作流、首頁背景 SVG、滑雪道具 sprite，以及專屬技能文件。

重點成果：

- 建立 `stock-ski-theme-mapper` 技能。
- 新增產業分類與四段式主題框架。
- 產生大量首頁股票背景。
- 新增股票主題滑雪道具。
- 擴充地形材質流程。
- 將股票代號對應到 biome、代表色、道具組、視覺 prompt 與 Canvas 實作策略。
- 加入視覺演化、材質、優化等文件。

### 5. 滑雪鏡頭、地形移動與角色定位

3 月 13 日到 3 月 16 日，滑雪玩法大量聚焦在鏡頭感。包含山體與角色的相對移動、上下坡追蹤、dead zone、底部與頂部 handoff、角色固定、山體移動、可達螢幕底部等。

重點成果：

- 調整 camera anchor follow。
- 修正 vertical camera follow。
- 讓滑雪者固定，改由山體移動。
- 加入上坡追蹤觸發與釋放邏輯。
- 加入 blended vertical camera floor。
- 放寬低於價格線時的移動限制。
- 讓背景 tile 更自然。
- 調整角色底部可達位置與鏡頭接手時機。
- 加入 top camera handoff 與 bottom camera handoff。

### 6. 高精度視覺模式與品牌主題資產

從 INTC 開始，專案加入 high-detail visual toggle 與 Visual Evolution Framework。之後擴展到 GOOGL、AAPL、MSFT、AMZN、META、NVDA 等主題資產，包含 vista、texture、props、source images、影片 overlay 與專屬圖層渲染。

重點成果：

- 建立 high-detail toggle。
- INTC 高精度主題初版。
- GOOGL 專屬背景、紋理影片、ridge band、白色 glow。
- AAPL、MSFT、GOOGL、AMZN、META、NVDA 等高精度主題。
- 增加 vista、texture、props、icon、source images。
- 修正高亮背景下 HUD 可讀性。
- 中央化 ski theme profiles。
- 修正背景消失、遊戲崩潰、資料夾大小寫對應、低細節模式切換等問題。

### 7. 文件、簡報與專案資產沉澱

3 月下旬到 4 月，專案把大量視覺規格與展示內容保存成文件與簡報。

重點成果：

- 新增視覺背景優化框架。
- 新增山體材質工程手冊。
- 新增股市滑雪初步主題文件。
- 保存完整股市滑雪視覺與材質大合輯。
- 建立 Stock Ski portfolio presentation。
- 產出 PowerPoint、預覽圖、montage 與建構腳本。

### 8. 金融教育樂園與冒險模式

5 月 10 日是另一個大爆發日，Stock Ski 從滑雪遊戲再長出「金融教育樂園冒險模式」。包含纜車導覽、折疊式教育資料夾、全文課程、題庫、每日關卡、熱門關卡、主題任務、玩家資料面板、Quest 視覺、NPC 嚮導，以及更遊戲化的股票分析頁。

重點成果：

- 新增 education cable car flow。
- 新增折疊式股票教育資料夾。
- 新增教育全文與 quiz bank。
- 建立金融教育樂園冒險模式。
- 加入每日、熱門、主題任務推薦區。
- 建立售票亭選股下拉面板。
- 每主題 6 關流程燈與完成勳章系統。
- 加入可拖曳教育進度控制。
- 股票分析頁改為遊戲世界入口。
- 加入 NPC 嚮導、Quest 關卡視覺與 adventure launch panel。
- 教育測驗變難，並在滑雪過程中分段出題。

### 9. UI、背景與體驗打磨

最後一批變更集中在 park mode 的視覺與操作體驗：背景層級、搜尋列可點性、logo 回首頁、清晰背景、關卡縮圖、結果頁版面、長距離地形、遊戲選單感與 Gemini fallback。

重點成果：

- Park mode 全螢幕背景與主題 header。
- 修正推薦區沒有 render。
- 熱門關卡改為單列。
- 移除多餘 chart thumbnail 背景層。
- park-bg 成為唯一背景。
- 搜尋列可點性修正。
- logo 加回首頁功能。
- 背景改成清晰、無模糊、無遮罩。
- 任務卡縮圖背景恢復。
- Header 品牌改名為 Stock Ski。
- 修正 Gemini chat fallback。

## 重要里程碑時間線

- 2026-03-07：StockAI 股市分析儀表板誕生，加入 Gemini AI 聊天專家。
- 2026-03-11：接入另一個 root history，形成目前主線的一部分。
- 2026-03-12：Stock Ski 滑雪挑戰模式成形，玩法、HUD、計分開始快速迭代。
- 2026-03-13：股票主題背景、滑雪道具、地形材質流程開始大規模擴充。
- 2026-03-16：高精度視覺模式與 INTC 主題資產加入，首頁推薦也變得更 AI 化。
- 2026-03-21：GOOGL 視覺資產、主題 profiles、背景修復與視覺文件整理大量完成。
- 2026-04-24：新增 Stock Ski 作品集簡報。
- 2026-05-10：金融教育樂園冒險模式、教育題庫、任務系統與 AAPL/MSFT/GOOGL 高精度主題大量加入。

## 完整 Commit 摘要

以下依時間由早到晚列出 commit 主題，方便回頭追蹤每一步。Merge commit 也保留，因為它們代表分支內容被帶回主線。

### 2026-03-07

- `59576de` feat: StockAI 股市分析儀表板，含 Gemini AI 聊天專家
- `f484b55` docs: add README.md
- `01b63aa` fix: compatibility for Vercel deployment
- `616016f` feat: add interactive feature cards and stock knowledge section
- `156daea` feat: add interactive expansion to stock knowledge section
- `2956bfa` feat: unify feature card interactions with knowledge expansion and smooth scrolling

### 2026-03-11

- `0e6b92a` Initial commit
- `b23421f` Merge remote-tracking branch origin/main

### 2026-03-12

- `db6e34b` Add ski challenge mode and dashboard UI updates
- `3cdbef2` update: ajust ski game difficulty and update frontend
- `864241f` Update ski game controls and price guides
- `89edd7e` feat: 新增滑雪遊戲偏離累積條 UI 與畫面震動特效，優化累積邏輯
- `37ca64a` fix: adjust ski offset accumulation tolerance
- `f1290b0` fix: restore ski hud danger ratio
- `bb5fc43` fix: reset ski hitbox color on recovery
- `83f6ac1` feat: show ski accuracy threshold bar
- `fb00ab4` feat: replace ski drift fail with time limit
- `3585e6d` feat: add ski time bar above accuracy
- `3dfc701` feat: add ski accel and brake controls
- `4008169` feat: show current ski speed multiplier
- `de54c07` feat: enlarge ski multiplier at bottom center
- `9ac127e` feat: center and enlarge ski bottom hud
- `86c6e8a` fix: separate ski control multiplier from velocity
- `646728f` fix: restore ski middle-click vertical boost
- `9d55708` feat: show ski middle-click hint text
- `7e2fc54` feat: add mouse-only ski control bonus
- `9a39396` feat: make ski launch button adapt to practice settings
- `e0d63a2` fix: default ski controls to normal mode
- `704c39d` fix: force normal ski defaults on load
- `112ead6` feat: add ski medals and tighten action layout
- `93338ba` fix: restore ski title and right-align controls
- `36192f9` fix: center ski medals and tighten control cluster
- `71b64b8` fix: truly center ski medals
- `61bdd7c` tweak: space ski controls and enlarge medals
- `95525e1` tweak: normalize ski action button sizing
- `56e1b91` feat: expand ski score breakdown
- `a716cf5` fix: restore ski motion and add timer bonus
- `bd9d207` style: polish ski result summary
- `fdcc38e` refactor: move ski HUD bars to top
- `5a68ee1` fix: align top HUD rows and wire result buttons
- `8722e7b` fix: center result overlay and animate confetti
- `530ef5e` fix: use real time for ski timer
- `4079691` feat: add spacebar sensitivity boost
- `128cd4a` feat: add homepage stock recommendations

### 2026-03-13

- `c451417` feat: make homepage recommendations live-ranked
- `1fad78c` Add homepage stock backgrounds and stock-ski theme skill
- `fb4256d` Apply themed stock backgrounds to ski game
- `5257f6d` Expand reusable ski stock backgrounds
- `61b68cc` Expand stock ski skill terrain workflow
- `5ffcb79` Apply ski terrain material workflow
- `5233785` Boost ski terrain prop visibility
- `26018ef` refine ski result screen investment terminology
- `7bc6b42` fix result table spacing and scale
- `e2a05dd` Deepen ski terrain materials and props
- `6a4fc63` Add ski prop sprite pack
- `878fe20` Spread ski props across terrain
- `32f6566` Adjust ski camera anchor follow
- `395aced` Record lower terrain prop pass
- `d09fccc` Fix ski vertical camera follow
- `d9fdc74` Add stock-specific ski hero props
- `a521cca` Tune ski vertical visual motion
- `e9d36d5` Shift ski mountain relative to price line
- `99c0e69` Boost in-mountain prop visibility
- `ebf745f` Keep ski rider fixed and move mountain
- `a2b2704` Add second batch ski hero props
- `b6fb6cc` Add third batch ski hero props
- `d72b2c1` Add fourth and fifth batch ski hero props
- `169f1a9` Lower ski rider screen anchor
- `be31c7e` Add sixth batch ski hero props
- `1065db0` Add ski camera state machine
- `749a7dc` Revert "Add ski camera state machine"
- `93af95b` Add eighth batch ski hero props
- `a4cb087` Document 60 percent uphill follow verification
- `f1077b5` Stop uphill camera follow below trigger
- `7c6fc67` Freeze mountain when uphill follow releases
- `d379cb5` Add blended vertical camera floor
- `07de8f9` Refine dead zone camera follow
- `d995618` Raise dead zone camera floor
- `7d5bb43` Relax below-line movement constraints
- `8540ae8` Make ski backgrounds tile seamlessly
- `ccfc1b6` Remove remaining bottom clamp
- `388a50b` Restore ski theme backgrounds

### 2026-03-14

- `e01094c` Clamp ski rider to 30 percent bottom line

### 2026-03-16

- `367a888` Adjust ski bottom reach
- `c6b026e` Let skier reach screen bottom
- `7608eb4` Delay lower camera follow
- `e697c6f` Remove downward camera pull
- `a594eac` Pan camera after bottom anchor
- `1109763` Smooth bottom camera handoff
- `4ea902a` Add top camera handoff
- `ea319d7` feat: implement Visual Evolution Framework and Intel high-detail assets
- `00d4133` feat: implement high-detail visual toggle and Intel (INTC) specific assets
- `750672b` feat: move high-detail toggle to lobby and finalize Intel theme assets
- `8f9204b` Add homepage quick stock entry shortcuts
- `90a3608` Replace stock browser with input dropdown picker
- `57be8a0` Restructure homepage quick access and recommendation layout
- `09162ca` Adjust homepage recommendations to left-column three-card layout
- `50b8e63` Make all homepage recommendation cards equal primary rows
- `c5555ba` Show one homepage featured stock with Gemini rationale
- `f19289f` Use API route for homepage recommendations preview
- `fff5525` Expand homepage Gemini rationale into structured markdown
- `6da49df` Expand fallback homepage rationale when Gemini is unavailable
- `964a11a` Polish homepage rationale typography and markdown structure
- `ac2276a` Fix ski game countdown progressing by elapsed time
- `f7164fb` Add per-map ski difficulty scoring
- `0633d73` Show ski difficulty coefficient preview
- `1052ae6` Merge remote-tracking branch 'origin/visual-evolution-intc'
- `903470f` Merge main into 學校執行內容
- `f749bf8` Merge pull request #1 from JustinYen0531/學校執行內容
- `048d96a` Fix homepage AI rationale markdown rendering
- `1966444` Fallback homepage AI rationale when Gemini output is incomplete
- `8724ae9` Fix homepage AI rationale markdown rendering
- `033d9c7` Fallback homepage AI rationale when Gemini output is incomplete

### 2026-03-18

- `91ca492` Update homepage themes and ski game assets

### 2026-03-21

- `f91c308` Update homepage and ski game assets
- `3c21eb6` Merge pull request #2 from JustinYen0531/首頁優化
- `327ada3` Merge pull request #3 from JustinYen0531/codex/merge-school-content
- `5144e4a` feat: apply GOOGL mountain texture animation
- `f33320f` fix: enable GOOGL terrain texture overlay
- `c3a3b3a` feat: render GOOGL terrain with direct video overlay
- `34a2a5f` Merge pull request #5 from JustinYen0531/codex/merge-school-content
- `a832f0f` feat: use dedicated GOOGL background and texture videos
- `56e704b` fix: fade out GOOGL terrain texture bottom edge
- `3fc5feb` fix: limit GOOGL terrain texture to ridge band
- `2a466ff` fix: restore visible GOOGL terrain texture band
- `d8ee6fa` fix: brighten GOOGL terrain texture visibility
- `a4d00df` fix: remove heavy GOOGL terrain darkening
- `6d91672` fix: use white glow for GOOGL theme props
- `b881d7b` feat: add GOOGL visual workflow for ridge and glow
- `5cde180` fix: add outlined HUD text for bright backgrounds
- `d2179f2` refactor: centralize ski theme profiles
- `9baee22` feat: add theme profile controls for GOOGL visual noise
- `6acebcc` fix: 還原 ski-game.js 到 merge 前的正確版本，清除 merge 殘骸
- `0fbbed7` fix: 徹底解決背景消失與遊戲崩潰問題。修復 loadThemeAssets 觸發時機與 launch 結構完整性。
- `7c7b7b6` fix: Vista 背景移除 highDetailMode 依賴，GOOGL 直接自動顯示
- `6eb7b23` fix: loadThemeAssets 改用股票代號(大寫)直接對應資料夾，修正 google→GOOGL 大小寫錯誤，同時支援 AMZN META MSFT NVDA
- `4beb1d5` fix: 優化畫面質感並恢復低細節模式開關功能
- `3d6849c` docs: 完整保存股市滑雪視覺與材質實作大合輯
- `d9e072f` docs: 建立視覺進化指南資料夾，並還原三份失蹤文件至該目錄
- `c4804aa` docs: 100% 全文還原視覺演化與材質實作指南 (90+ 行規格全面復原)
- `8348c49` fix: 徹底還原最美好的 Google 高精度 Vista 與山體材質 (Texture)
- `42920a5` fix: 恢復最美 Google 資產（Vista/Texture/Hexagon）並同步渲染亮度
- `46cdef9` Revert "perf: lighten high-detail vista and overlays"
- `2122da0` Revert "fix: 恢復最美 Google 資產（Vista/Texture/Hexagon）並同步渲染亮度"
- `234dfb3` fix: restore shared ski difficulty after rollback

### 2026-04-24

- `a977c7d` Add Stock Ski portfolio presentation

### 2026-05-10

- `f7ca397` Add education cable car flow
- `fb93eae` Add foldable stock education folders
- `18b7305` Add education full text and quiz bank
- `ccf6aa9` Optimize ski lobby achievements
- `783ca58` Add education previews for featured stock picker
- `5da48ec` Refine cable car intro guide
- `c72e5d8` Add park mode: 金融教育樂園冒險模式
- `02e7cce` Smooth cable intro scrolling
- `4e55317` Add AAPL high detail ski theme
- `4f47a42` Fix park mode: fullscreen background + park-themed header
- `b3a6872` Optimize high detail ski vista rendering
- `dc8d18c` Add AAPL theme source image folder
- `4b93b0d` Add park mode recommendation sections: daily/hot/theme quests
- `9796462` Fix park mode recommendations not rendering
- `0131586` Use supplied AAPL high detail artwork
- `0ad8fcd` feat(park): 每日關卡縮圖、熱門橫排、個人資料面板 JS 完整實作
- `d0c076f` fix(park): 熱門關卡改為單列、每日縮圖背景 SVG 修正
- `db5a673` feat(park): 售票亭輸入框新增可收合選股下拉面板
- `7eae5b5` Apply AAPL terrain texture and sprite props
- `58ee059` feat(park): 主題關卡地圖 — 每主題 6 關流程燈 + 完成勳章系統
- `9e85fc2` Add draggable education progress control
- `6892275` Optimize AAPL high detail rendering
- `284aaba` feat(park): 股票分析頁遊戲化 — 語言替換 + NPC 嚮導 + Quest 關卡視覺
- `57b61c1` Tune AAPL high detail background and props
- `2b3a25d` feat(park): PATCH G — dashboard transforms into game-world hero launcher
- `f683e61` Add MSFT and GOOGL high detail ski themes
- `0287042` feat(park): real blurred chart thumbnail as dashboard background
- `4caff3e` Gameify adventure result copy
- `fab05e7` Integrate adventure launch panel into quest hero
- `bd7d084` Fix high detail ski timing fairness
- `90cd335` Add real quest thumbnail backdrop
- `c99dcc8` Rebalance adventure page as game menu
- `ba7087e` Fix quest launch stats layout
- `b31e3ff` Adjust result screen vertical layout
- `85ec1c6` Tune long-range ski terrain
- `a359250` fix(park): search bar clickability & add logo home button
- `79f6cb7` refactor(park): dashboard background → home page blue sky
- `9c44f8b` fix(park): correct z-index layering for dashboard background
- `a35e7b0` refactor(park): clearer background, smaller launch button, stronger intel toggle
- `9a678bb` refactor(park): crystal clear background — no blur, no overlay
- `ae6c75c` Clarify park quest background
- `de34be5` Make education quizzes harder
- `3a8bee3` Segment education quizzes during ski run
- `f34f9a7` refactor(park): featured routes — only 5 premium stocks (AAPL AMZN GOOGL META MSFT)
- `7000286` fix(park): move park-bg outside parkWelcomePage — snow+mountains always visible
- `bed4b3d` Fix high-detail asset progress note
- `c2e9468` fix(park): kill chart thumbnail layer — park-bg is the only background
- `5bf3b13` Adjust education challenge timing
- `7485d53` Use snowy park background for quest hero
- `e9a530b` Rename header brand to Stock Ski
- `635893e` Restore quest card thumbnail background
- `0f54720` Fix Gemini chat fallback

## 一句話總結

這個專案從「股票分析儀表板」一路變成「把股票、AI 分析、滑雪遊戲、品牌化地形、教育題庫與冒險任務揉在一起的金融學習遊戲」。它不是單純多做幾個功能，而是整個產品人格從工具型，長成了遊戲化、教育化、視覺化的 Stock Ski。
