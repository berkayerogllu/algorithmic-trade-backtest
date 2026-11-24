"""HTTP API used by the TypeScript research interface."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
import re
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .backtest_engine import BacktestEngine
from .data_loader import DataLoader
from .performance import PerformanceAnalyzer
from .forecasting import HistoricalReturnForecaster
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
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parameters: dict[str, int] = Field(default_factory=dict)


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    horizon: int = Field(default=5, ge=1, le=20)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/backtest")
def run_backtest(request: BacktestRequest) -> dict:
    symbol = request.symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{1,12}(\.IS)?", symbol):
        raise HTTPException(422, "Geçerli bir BIST hisse kodu girin.")
    if not symbol.endswith(".IS"):
        symbol = f"{symbol}.IS"

    start = request.start_date or date(2023, 1, 1)
    end = request.end_date
    if end and (end < start or end > date.today()):
        raise HTTPException(422, "Bitiş tarihi başlangıçtan önce veya bugünden sonra olamaz.")

    try:
        strategy = _strategy_for(request.strategy, request.parameters)
        if symbol == "THYAO.IS":
            data = DataLoader().load_csv(PROJECT_ROOT / "data" / "THYAO.IS.csv")
            source = "Yahoo Finance · Yerel THYAO arşivi"
        else:
            download_end = (end + timedelta(days=1)).isoformat() if end else None
            data = DataLoader().download_yfinance(symbol, start.isoformat(), download_end)
            source = "Yahoo Finance · İndirilen tarihsel veri"
        dates = pd.DatetimeIndex(data.index).date
        data = data[dates >= start]
        if end:
            data = data[pd.DatetimeIndex(data.index).date <= end]
        minimum = {
            "SMA Crossover": lambda: strategy.slow_period + 1,
            "RSI": lambda: strategy.period + 2,
            "MACD": lambda: strategy.slow_period + strategy.signal_period,
            "Buy & Hold": lambda: 2,
        }[request.strategy]()
        if len(data) < minimum:
            raise ValueError(f"Bu strateji için en az {minimum} işlem günü gerekli. Tarih aralığını genişletin.")
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
        "source": source,
        "parameters": request.parameters,
        "period": f"{date.fromisoformat(points[0]['date']).strftime('%d.%m.%Y')} — {date.fromisoformat(points[-1]['date']).strftime('%d.%m.%Y')}",
        "metrics": metrics,
        "points": points,
        "trades": trades,
    }


@app.post("/api/forecast")
def forecast(request: ForecastRequest) -> dict:
    symbol = request.symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{1,12}(\.IS)?", symbol):
        raise HTTPException(422, "Geçerli bir BIST hisse kodu girin.")
    if not symbol.endswith(".IS"):
        symbol += ".IS"
    start = request.start_date or date(2023, 1, 1)
    end = request.end_date
    if end and (end < start or end > date.today()):
        raise HTTPException(422, "Veri bitiş tarihi geçersiz.")
    try:
        loader = DataLoader()
        if symbol == "THYAO.IS":
            data = loader.load_csv(PROJECT_ROOT / "data" / "THYAO.IS.csv")
            source = "Yahoo Finance · THYAO arşivi"
        else:
            until = (end + timedelta(days=1)).isoformat() if end else None
            data = loader.download_yfinance(symbol, start.isoformat(), until)
            source = "Yahoo Finance · Günlük tarihsel veri"
        dates = pd.DatetimeIndex(data.index).date
        data = data[dates >= start]
        if end:
            data = data[pd.DatetimeIndex(data.index).date <= end]
        result = HistoricalReturnForecaster().forecast(data, request.horizon)
    except (ValueError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Veri veya tahmin hatası: {exc}") from exc
    history = [
        {"date": pd.Timestamp(index).strftime("%Y-%m-%d"), "close": float(value)}
        for index, value in data["Close"].iloc[-120:].items()
    ]
    return {"symbol": symbol, "source": source, "history": history, **result}


def _strategy_for(name: str, parameters: dict[str, int]):
    strategies = {
        "SMA Crossover": SMACrossoverStrategy,
        "RSI": RSIStrategy,
        "MACD": MACDStrategy,
        "Buy & Hold": BuyAndHoldStrategy,
    }
    try:
        return strategies[name](**parameters)
    except (KeyError, TypeError) as exc:
        raise ValueError("Strateji veya parametreleri geçersiz.") from exc
