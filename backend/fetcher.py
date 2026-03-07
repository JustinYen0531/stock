"""
fetcher.py - 從 Yahoo Finance 抓取股票資料
"""
import yfinance as yf
import pandas as pd


def fetch_stock_data(symbol: str, period: str = "3mo") -> pd.DataFrame:
    """
    抓取股票 OHLCV 資料
    period 可以是: 1mo, 3mo, 6mo, 1y, 2y, 5y
    """
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period)

    if df.empty:
        raise ValueError(f"找不到股票代碼：{symbol}，請確認是否正確（台股需加 .TW，例如 2330.TW）")

    df = df.reset_index()
    df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
    return df[["Date", "Open", "High", "Low", "Close", "Volume"]]


def fetch_stock_info(symbol: str) -> dict:
    """
    抓取股票基本資訊
    """
    ticker = yf.Ticker(symbol)
    info = ticker.info
    return {
        "name": info.get("longName") or info.get("shortName") or symbol,
        "currency": info.get("currency", "USD"),
        "exchange": info.get("exchange", ""),
        "sector": info.get("sector", ""),
        "market_cap": info.get("marketCap"),
    }
