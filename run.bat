@echo off
echo.
echo  ====================================
echo   StockAI - 股市分析 App 啟動中
echo  ====================================
echo.
echo  安裝 Node.js 依賴...
cd backend
npm install
echo.
echo  啟動後端伺服器...
echo  請用瀏覽器開啟：http://localhost:8000
echo.
node server.js
pause
