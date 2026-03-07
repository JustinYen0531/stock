"""
indicators.py - 計算技術指標：MA、RSI、MACD
"""
import pandas as pd
import numpy as np


def calculate_ma(df: pd.DataFrame, windows: list = [5, 20, 60]) -> dict:
    """移動平均線"""
    result = {}
    for w in windows:
        if len(df) >= w:
            result[f"ma{w}"] = df["Close"].rolling(window=w).mean().round(4).tolist()
        else:
            result[f"ma{w}"] = [None] * len(df)
    return result


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> list:
    """
    RSI - 相對強弱指數（Wilder 平滑法）
    RSI = 100 - (100 / (1 + RS))
    RS = 平均漲幅 / 平均跌幅
    """
    close = df["Close"]
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Wilder 平滑（等同 EMA alpha=1/period）
    avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.fillna(0)

    return rsi.round(2).tolist()


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """
    MACD - 指數移動平均收斂發散指標
    MACD Line = EMA12 - EMA26
    Signal Line = EMA9(MACD)
    Histogram = MACD - Signal
    """
    close = df["Close"]
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line

    return {
        "macd": macd_line.round(4).tolist(),
        "signal": signal_line.round(4).tolist(),
        "histogram": histogram.round(4).tolist(),
    }


def calculate_all(df: pd.DataFrame) -> dict:
    """計算所有指標並整合"""
    ma = calculate_ma(df)
    rsi = calculate_rsi(df)
    macd = calculate_macd(df)

    return {
        **ma,
        "rsi": rsi,
        **macd,
    }
