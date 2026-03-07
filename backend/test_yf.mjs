import yf from "yahoo-finance2";
// v3: yf 是工廠函數，需要先 new yf() 得到 instance
const client = new yf();
const d = new Date(Date.now() - 30*24*60*60*1000);
try {
  const r = await client.chart("AAPL", { period1: d, interval: "1d" });
  console.log("OK:", r.quotes.length, "quotes");
} catch(e) {
  console.log("ERR:", e.message.slice(0, 500));
}
