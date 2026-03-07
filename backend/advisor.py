"""
advisor.py - 根據技術指標生成投資建議（規則型 Agent）
"""
import pandas as pd
from typing import dict as Dict


def generate_advice(df: pd.DataFrame, indicators: dict) -> dict:
    """
    根據 RSI、MACD、MA 信號綜合判斷投資方向
    
    返回：
    - signal: "強烈買入" | "買入" | "觀望" | "賣出" | "強烈賣出"
    - score: -2 ~ +2 (負=空, 正=多)
    - reasons: 各指標信號列表
    - summary: 綜合建議文字
    """
    reasons = []
    score = 0

    close = df["Close"].iloc[-1]
    rsi_list = indicators.get("rsi", [])
    macd_list = indicators.get("macd", [])
    signal_list = indicators.get("signal", [])
    ma20_list = indicators.get("ma20", [])
    ma5_list = indicators.get("ma5", [])
    hist_list = indicators.get("histogram", [])

    # ── RSI 信號 ─────────────────────────────
    if rsi_list:
        rsi = rsi_list[-1]
        if rsi < 30:
            score += 2
            reasons.append({"label": f"RSI {rsi:.1f} < 30（超賣）", "type": "bull"})
        elif rsi < 40:
            score += 1
            reasons.append({"label": f"RSI {rsi:.1f}（偏弱，接近超賣）", "type": "bull"})
        elif rsi > 70:
            score -= 2
            reasons.append({"label": f"RSI {rsi:.1f} > 70（超買）", "type": "bear"})
        elif rsi > 60:
            score -= 1
            reasons.append({"label": f"RSI {rsi:.1f}（偏強，接近超買）", "type": "bear"})
        else:
            reasons.append({"label": f"RSI {rsi:.1f}（中性區間）", "type": "neutral"})

    # ── MACD 信號 ────────────────────────────
    if macd_list and signal_list and len(hist_list) >= 2:
        macd_val = macd_list[-1]
        signal_val = signal_list[-1]
        hist_now = hist_list[-1]
        hist_prev = hist_list[-2]

        if hist_now > 0 and hist_prev <= 0:
            score += 2
            reasons.append({"label": "MACD 黃金交叉（強烈買入信號）", "type": "bull"})
        elif hist_now < 0 and hist_prev >= 0:
            score -= 2
            reasons.append({"label": "MACD 死亡交叉（強烈賣出信號）", "type": "bear"})
        elif macd_val > signal_val:
            score += 1
            reasons.append({"label": "MACD 在 Signal 上方（多頭格局）", "type": "bull"})
        else:
            score -= 1
            reasons.append({"label": "MACD 在 Signal 下方（空頭格局）", "type": "bear"})

    # ── MA 信號 ──────────────────────────────
    if ma5_list and ma20_list:
        # 找最後一個非 None 的值
        ma5_vals = [x for x in ma5_list if x is not None]
        ma20_vals = [x for x in ma20_list if x is not None]
        if ma5_vals and ma20_vals:
            ma5 = ma5_vals[-1]
            ma20 = ma20_vals[-1]
            if close > ma20:
                score += 1
                reasons.append({"label": f"收盤 {close:.2f} 站上 MA20 {ma20:.2f}（短多）", "type": "bull"})
            else:
                score -= 1
                reasons.append({"label": f"收盤 {close:.2f} 跌破 MA20 {ma20:.2f}（短空）", "type": "bear"})

            if ma5 > ma20:
                score += 1
                reasons.append({"label": f"MA5 {ma5:.2f} > MA20 {ma20:.2f}（均線多排）", "type": "bull"})
            else:
                score -= 1
                reasons.append({"label": f"MA5 {ma5:.2f} < MA20 {ma20:.2f}（均線空排）", "type": "bear"})

    # ── 綜合評分 ─────────────────────────────
    if score >= 4:
        signal = "強烈買入"
        signal_type = "strong_bull"
        summary = "多項指標同時發出買入信號，短期具備上漲動能，可考慮分批布局。"
    elif score >= 2:
        signal = "買入"
        signal_type = "bull"
        summary = "指標偏多，趨勢向上，適合積極型投資人考慮買入。"
    elif score >= 1:
        signal = "偏多觀望"
        signal_type = "weak_bull"
        summary = "多空信號混雜但稍偏多，建議等待更明確突破再進場。"
    elif score <= -4:
        signal = "強烈賣出"
        signal_type = "strong_bear"
        summary = "多項指標同時發出賣出警訊，短期下行風險較高，建議減碼或觀望。"
    elif score <= -2:
        signal = "賣出"
        signal_type = "bear"
        summary = "指標偏空，趨勢走弱，建議謹慎持有或考慮賣出。"
    elif score <= -1:
        signal = "偏空觀望"
        signal_type = "weak_bear"
        summary = "指標略偏空，尚無明確大幅下行，建議暫時觀望。"
    else:
        signal = "中性觀望"
        signal_type = "neutral"
        summary = "多空信號相互抵消，市場方向不明，建議耐心等待突破訊號。"

    disclaimer = "⚠️ 本建議為技術面分析，僅供參考，不構成實際投資建議。投資有風險，請自行判斷。"

    return {
        "signal": signal,
        "signal_type": signal_type,
        "score": score,
        "reasons": reasons,
        "summary": summary,
        "disclaimer": disclaimer,
    }
