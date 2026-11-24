"""HTTP API used by the TypeScript research interface."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .backtest_engine import BacktestEngine
from .data_loader import DataLoader
from .performance import PerformanceAnalyzer
from .risk_manager import RiskManager
from .strategies import BuyAndHoldStrategy, MACDStrategy, RSIStrategy, SMACrossoverStrategy

PROJECT_ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="BIST Backtest API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class BacktestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    strategy: str
    initial_cash: float = Field(gt=0)
    commission_rate: float = Field(ge=0, lt=1)
    risk_enabled: bool = True


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/backtest")
def run_backtest(request: BacktestRequest) -> dict:
    symbol = request.symbol.upper()
    if not symbol.endswith(".IS"):
        symbol = f"{symbol}.IS"

    try:
        if symbol == "THYAO.IS":
            data = DataLoader().load_csv(PROJECT_ROOT / "data" / "THYAO.IS.csv")
        else:
            data = DataLoader().download_yfinance(symbol, start="2023-01-01")
        strategy = _strategy_for(request.strategy)
        risk = RiskManager() if request.risk_enabled else None
        results = BacktestEngine(request.initial_cash, request.commission_rate, risk).run(data, strategy)
        metrics = PerformanceAnalyzer().analyze(results)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Veri veya backtest hatası: {exc}") from exc

    first_close = float(data["Close"].iloc[0])
    points = [
        {
            "date": pd.Timestamp(index).strftime("%Y-%m-%d"),
            "price": float(row["Close"]),
            "equity": float(row["Equity"]),
            "benchmark": float(request.initial_cash * row["Close"] / first_close),
        }
        for index, row in results.iterrows()
    ]
    trades = [
        {
            "entry_date": pd.Timestamp(trade.entry_date).strftime("%Y-%m-%d"),
            "exit_date": pd.Timestamp(trade.exit_date).strftime("%Y-%m-%d"),
            "entry_price": trade.entry_price,
            "exit_price": trade.exit_price,
            "pnl": trade.pnl,
            "exit_reason": trade.exit_reason,
        }
        for trade in results.attrs.get("trades", [])
    ]
    return {
        "symbol": symbol,
        "strategy": request.strategy,
        "period": f"{date.fromisoformat(points[0]['date']).strftime('%d.%m.%Y')} — {date.fromisoformat(points[-1]['date']).strftime('%d.%m.%Y')}",
        "metrics": metrics,
        "points": points,
        "trades": trades,
    }


def _strategy_for(name: str):
    strategies = {
        "SMA Crossover": SMACrossoverStrategy,
        "RSI": RSIStrategy,
        "MACD": MACDStrategy,
        "Buy & Hold": BuyAndHoldStrategy,
    }
    try:
        return strategies[name]()
    except KeyError as exc:
        raise ValueError(f"Desteklenmeyen strateji: {name}") from exc
