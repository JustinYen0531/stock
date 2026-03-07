const _yf = require("yahoo-finance2");
const yf = _yf.default || _yf;
const d = new Date(Date.now() - 30*24*60*60*1000);
yf.chart("AAPL", { period1: d, interval: "1d" })
  .then(r => { console.log("OK:", r.quotes.length); process.exit(0); })
  .catch(e => { console.log("ERR:", e.message.slice(0,300)); process.exit(0); });
