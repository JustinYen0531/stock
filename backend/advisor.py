"""
advisor.py - 根据技术指标生成投资建议（规则型 Agent）
"""
import pandas as pd
from typing import dict as Dict


def generate_advice(df: pd.DataFrame, indicators: dict) -> dict:
    """
    根据 RSI、MACD、MA 信号综合判断投资方向
    
    返回：
    - signal: "强烈买入" | "买入" | "观望" | "卖出" | "强烈卖出"
    - score: -2 ~ +2 (负=空, 正=多)
    - reasons: 各指标信号列表
    - summary: 综合建议文字
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

    # ── RSI 信号 ─────────────────────────────
    if rsi_list:
        rsi = rsi_list[-1]
        if rsi < 30:
            score += 2
            reasons.append({"label": f"RSI {rsi:.1f} < 30（超卖）", "type": "bull"})
        elif rsi < 40:
            score += 1
            reasons.append({"label": f"RSI {rsi:.1f}（偏弱，接近超卖）", "type": "bull"})
        elif rsi > 70:
            score -= 2
            reasons.append({"label": f"RSI {rsi:.1f} > 70（超买）", "type": "bear"})
        elif rsi > 60:
            score -= 1
            reasons.append({"label": f"RSI {rsi:.1f}（偏强，接近超买）", "type": "bear"})
        else:
            reasons.append({"label": f"RSI {rsi:.1f}（中性区间）", "type": "neutral"})

    # ── MACD 信号 ────────────────────────────
    if macd_list and signal_list and len(hist_list) >= 2:
        macd_val = macd_list[-1]
        signal_val = signal_list[-1]
        hist_now = hist_list[-1]
        hist_prev = hist_list[-2]

        if hist_now > 0 and hist_prev <= 0:
            score += 2
            reasons.append({"label": "MACD 黄金交叉（强烈买入信号）", "type": "bull"})
        elif hist_now < 0 and hist_prev >= 0:
            score -= 2
            reasons.append({"label": "MACD 死亡交叉（强烈卖出信号）", "type": "bear"})
        elif macd_val > signal_val:
            score += 1
            reasons.append({"label": "MACD 在 Signal 上方（多头格局）", "type": "bull"})
        else:
            score -= 1
            reasons.append({"label": "MACD 在 Signal 下方（空头格局）", "type": "bear"})

    # ── MA 信号 ──────────────────────────────
    if ma5_list and ma20_list:
        # 找最后一个非 None 的值
        ma5_vals = [x for x in ma5_list if x is not None]
        ma20_vals = [x for x in ma20_list if x is not None]
        if ma5_vals and ma20_vals:
            ma5 = ma5_vals[-1]
            ma20 = ma20_vals[-1]
            if close > ma20:
                score += 1
                reasons.append({"label": f"收盘 {close:.2f} 站上 MA20 {ma20:.2f}（短多）", "type": "bull"})
            else:
                score -= 1
                reasons.append({"label": f"收盘 {close:.2f} 跌破 MA20 {ma20:.2f}（短空）", "type": "bear"})

            if ma5 > ma20:
                score += 1
                reasons.append({"label": f"MA5 {ma5:.2f} > MA20 {ma20:.2f}（均线多排）", "type": "bull"})
            else:
                score -= 1
                reasons.append({"label": f"MA5 {ma5:.2f} < MA20 {ma20:.2f}（均线空排）", "type": "bear"})

    # ── 综合评分 ─────────────────────────────
    if score >= 4:
        signal = "技术面极强"
        signal_type = "strong_bull"
        summary = "多项技术指标同时偏多，短期上升动能较强，呈现强势多头格局。"
    elif score >= 2:
        signal = "技术面偏多"
        signal_type = "bull"
        summary = "技术指标偏多，趋势震荡向上，短期呈现偏多态势。"
    elif score >= 1:
        signal = "多头整理"
        signal_type = "weak_bull"
        summary = "多空信号参杂但稍微偏多，当前处于震荡整理区间。"
    elif score <= -4:
        signal = "技术面极弱"
        signal_type = "strong_bear"
        summary = "多项技术指标同时走弱，下行波动风险较高，呈现弱势空头格局。"
    elif score <= -2:
        signal = "技术面偏空"
        signal_type = "bear"
        summary = "技术指标偏空，趋势震荡向下，短期呈现偏空态势。"
    elif score <= -1:
        signal = "空头整理"
        signal_type = "weak_bear"
        summary = "技术指标略微偏空，方向尚未完全明朗，处于偏空整理阶段。"
    else:
        signal = "中性整理"
        signal_type = "neutral"
        summary = "多空信号相互抵消，技术指标呈现中性震荡，建议关注关键均线变化。"

    disclaimer = "⚠️ 本分析仅为客观技术面数据解读，仅供游戏与学习展示，不构成任何真实世界的投资建议。"

    return {
        "signal": signal,
        "signal_type": signal_type,
        "score": score,
        "reasons": reasons,
        "summary": summary,
        "disclaimer": disclaimer,
    }
