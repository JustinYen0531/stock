"""
main.py - FastAPI 主应用
股市分析 API - 提供股票数据、技术指标、投资建议
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from fetcher import fetch_stock_data, fetch_stock_info
from indicators import calculate_all
from advisor import generate_advice

app = FastAPI(title="股市分析 API", version="1.0.0")

# CORS - 允许前端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载前端静态文件
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")


@app.get("/")
def root():
    """返回前端首页"""
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "股市分析 API 运行中", "docs": "/docs"}


@app.get("/stock/{symbol}")
def get_stock(symbol: str, period: str = "3mo"):
    """
    获取股票 OHLCV 数据
    - symbol: 股票代码（美股如 AAPL，台股如 2330.TW）
    - period: 时间范围 (1mo, 3mo, 6mo, 1y, 2y)
    """
    try:
        df = fetch_stock_data(symbol.upper(), period)
        return {
            "symbol": symbol.upper(),
            "period": period,
            "count": len(df),
            "data": df.to_dict(orient="records"),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"抓取数据失败：{str(e)}")


@app.get("/info/{symbol}")
def get_info(symbol: str):
    """获取股票基本信息"""
    try:
        info = fetch_stock_info(symbol.upper())
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取信息失败：{str(e)}")


@app.get("/indicators/{symbol}")
def get_indicators(symbol: str, period: str = "3mo"):
    """
    获取技术指标：MA5/MA20/MA60、RSI(14)、MACD
    """
    try:
        df = fetch_stock_data(symbol.upper(), period)
        indicators = calculate_all(df)
        dates = df["Date"].tolist()
        return {
            "symbol": symbol.upper(),
            "dates": dates,
            **indicators,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"计算指标失败：{str(e)}")


@app.get("/advice/{symbol}")
def get_advice(symbol: str, period: str = "3mo"):
    """
    获取 AI Agent 投资建议
    综合 RSI、MACD、MA 给出多空建议
    """
    try:
        df = fetch_stock_data(symbol.upper(), period)
        indicators = calculate_all(df)
        advice = generate_advice(df, indicators)
        return {
            "symbol": symbol.upper(),
            **advice,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成建议失败：{str(e)}")


@app.get("/full/{symbol}")
def get_full(symbol: str, period: str = "3mo"):
    """
    一次获取所有数据：OHLCV + 指标 + 建议
    减少前端请求次数
    """
    try:
        df = fetch_stock_data(symbol.upper(), period)
        info = {}
        try:
            info = fetch_stock_info(symbol.upper())
        except:
            pass
        indicators = calculate_all(df)
        advice = generate_advice(df, indicators)

        return {
            "symbol": symbol.upper(),
            "info": info,
            "dates": df["Date"].tolist(),
            "ohlcv": df.to_dict(orient="records"),
            "indicators": indicators,
            "advice": advice,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取完整数据失败：{str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
