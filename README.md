# 📈 StockAI - 技術面分析儀表板

一個極簡、美觀且強大的股市分析工具，內建 **Gemini AI 股票專家**。

![Dashboard Preview](https://via.placeholder.com/1200x600.png?text=StockAI+Dashboard)

## ✨ 特色功能

- **📊 即時技術指標**：自動計算 MA (5, 20, 60)、RSI (14)、MACD。
- **🕯️ K線與圖表**：使用 Chart.js 繪製美觀的收盤價與指標圖表。
- **🤖 AI 股票專家**：內建 Gemini AI，可以根據當前股票的數據回答您的問題。
- **🌗 深色模式**：針對視覺舒適度設計的深色 UI。

## 🛠️ 技術棧

- **Frontend**: HTML5, Vanilla CSS, JavaScript (ESM)
- **Backend**: Node.js, Express, Yahoo Finance API
- **AI**: Google Gemini API (1.5 Flash / 2.0 Flash)

## 🚀 快速開始

### 1. 取得 API Key
前往 [Google AI Studio](https://aistudio.google.com/) 取得免費的 Gemini API Key。

### 2. 環境設定
在 `backend` 資料夾下建立 `.env` 檔案：
```env
GEMINI_API_KEY=您的_API_KEY
```

### 3. 安裝與執行
```bash
# 安裝依賴
cd backend
npm install

# 啟動伺服器
node server.js
```
開啟瀏覽器訪問 `http://localhost:8000`。

## 📝 免責聲明
本專案僅供學習與研究使用，所提供之數據與 AI 建議不構成任何形式的投資建議。投資有風險，入市需謹慎。
