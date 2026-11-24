"""HTTP API used by the TypeScript research interface."""

from __future__ import annotations

from datetime import date, timedelta
from time import monotonic
from pathlib import Path
import re
from typing import Literal, Optional

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .backtest_engine import BacktestEngine
from .data_loader import DataLoader
from .performance import PerformanceAnalyzer
from .forecasting import HistoricalReturnForecaster
from .risk_manager import RiskManager
from .strategies import BuyAndHoldStrategy, MACDStrategy, RSIStrategy, SMACrossoverStrategy

PROJECT_ROOT = Path(__file__).resolve().parent.parent
Market = Literal["BIST", "US"]
_SYMBOL_SEARCH_CACHE: dict[tuple[str, str], tuple[float, list[dict[str, str]]]] = {}
app = FastAPI(title="BIST Backtest API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class BacktestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    market: Market = "BIST"
    strategy: str
    initial_cash: float = Field(gt=0)
    commission_rate: float = Field(ge=0, lt=1)
    risk_enabled: bool = True
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parameters: dict[str, int] = Field(default_factory=dict)


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    market: Market = "BIST"
    horizon: int = Field(default=5, ge=1, le=20)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/symbols")
def search_symbols(
    q: str = Query(min_length=2, max_length=64),
    market: Market = "BIST",
) -> dict[str, list[dict[str, str]]]:
    query = q.strip()
    if len(query) < 2:
        return {"symbols": []}
    cache_key = (market, query.casefold())
    cached = _SYMBOL_SEARCH_CACHE.get(cache_key)
    if cached and monotonic() - cached[0] < 300:
        return {"symbols": cached[1]}
    try:
        search = yf.Search(
            query,
            max_results=30,
            news_count=0,
            lists_count=0,
            include_cb=False,
            timeout=8,
        )
        symbols: list[dict[str, str]] = []
        seen: set[str] = set()
        for quote in search.quotes:
            ticker = str(quote.get("symbol", "")).upper()
            if not ticker or ticker in seen or quote.get("quoteType") != "EQUITY":
                continue
            exchange = str(quote.get("exchDisp") or quote.get("exchange") or "").strip()
            exchange_code = str(quote.get("exchange", "")).upper()
            if market == "BIST":
                if not ticker.endswith(".IS"):
                    continue
            elif not _is_us_listing(exchange, exchange_code) or ticker.endswith(".IS"):
                continue
            seen.add(ticker)
            symbols.append({
                "symbol": ticker,
                "name": str(quote.get("longname") or quote.get("shortname") or ticker),
                "exchange": _exchange_label(market, exchange, exchange_code),
                "market": market,
            })
            if len(symbols) == 12:
                break
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Hisse arama sağlayıcısına şu anda ulaşılamıyor.") from exc
    _SYMBOL_SEARCH_CACHE[cache_key] = (monotonic(), symbols)
    return {"symbols": symbols}


def _is_us_listing(exchange: str, exchange_code: str) -> bool:
    known_codes = {"NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS", "NYS", "NAS", "NGS"}
    if exchange_code in known_codes:
        return True
    label = exchange.upper().replace(" ", "")
    return any(name in label for name in ("NASDAQ", "NYSE", "NEWYORKSTOCKEXCHANGE", "NYSEARCA", "NYSEAMERICAN"))


def _exchange_label(market: Market, exchange: str, exchange_code: str) -> str:
    if market == "BIST":
        return "Borsa İstanbul"
    exchange_labels = {
        "NMS": "NASDAQ",
        "NGM": "NASDAQ",
        "NCM": "NASDAQ",
        "NAS": "NASDAQ",
        "NGS": "NASDAQ",
        "NYQ": "NYSE",
        "NYS": "NYSE",
        "ASE": "NYSE American",
        "PCX": "NYSE Arca",
    }
    return exchange_labels.get(exchange_code, exchange or "ABD borsası")


@app.post("/api/backtest")
def run_backtest(request: BacktestRequest) -> dict:
    symbol = request.symbol.strip().upper()
    if request.market == "BIST":
        if not re.fullmatch(r"[A-Z0-9]{1,12}(\.IS)?", symbol):
            raise HTTPException(422, "Geçerli bir BIST hisse kodu girin.")
    elif not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,14}", symbol):
        raise HTTPException(422, "Geçerli bir ABD hisse sembolü girin.")
    if request.market == "BIST" and not symbol.endswith(".IS"):
        symbol = f"{symbol}.IS"

    start = request.start_date or date(2023, 1, 1)
    end = request.end_date
    if end and (end < start or end > date.today()):
        raise HTTPException(422, "Bitiş tarihi başlangıçtan önce veya bugünden sonra olamaz.")

    try:
        strategy = _strategy_for(request.strategy, request.parameters)
        if request.market == "BIST" and symbol == "THYAO.IS":
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
        "market": request.market,
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
    if request.market == "BIST":
        if not re.fullmatch(r"[A-Z0-9]{1,12}(\.IS)?", symbol):
            raise HTTPException(422, "Geçerli bir BIST hisse kodu girin.")
    elif not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,14}", symbol):
        raise HTTPException(422, "Geçerli bir ABD hisse sembolü girin.")
    if request.market == "BIST" and not symbol.endswith(".IS"):
        symbol += ".IS"
    start = request.start_date or date(2023, 1, 1)
    end = request.end_date
    if end and (end < start or end > date.today()):
        raise HTTPException(422, "Veri bitiş tarihi geçersiz.")
    try:
        loader = DataLoader()
        if request.market == "BIST" and symbol == "THYAO.IS":
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
    return {"symbol": symbol, "market": request.market, "source": source, "history": history, **result}


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
