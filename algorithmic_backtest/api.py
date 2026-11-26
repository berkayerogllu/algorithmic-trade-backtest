"""HTTP API used by the TypeScript research interface."""

from __future__ import annotations

from datetime import date, timedelta
from time import monotonic
from pathlib import Path
import re
from typing import Any, Literal, Optional
from uuid import UUID

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg

from .backtest_engine import BacktestEngine
from .data_loader import DataLoader
from . import database
from .performance import PerformanceAnalyzer
from .forecasting import HistoricalReturnForecaster
from .random_research import describe_candidate, generate_random_candidates
from .risk_manager import RiskManager
from .strategies import (
    BollingerBandsStrategy,
    BuyAndHoldStrategy,
    CombinedStrategy,
    DonchianChannelStrategy,
    EMACrossoverStrategy,
    MACDStrategy,
    RSIStrategy,
    SMACrossoverStrategy,
    StochasticOscillatorStrategy,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
Market = Literal["BIST", "US"]
Interval = Literal["1d", "1wk", "1mo"]
_SYMBOL_SEARCH_CACHE: dict[tuple[str, str], tuple[float, list[dict[str, str]]]] = {}
app = FastAPI(title="BIST Backtest API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


class StrategyComponent(BaseModel):
    strategy: Literal[
        "SMA Crossover", "EMA Crossover", "RSI", "MACD", "Bollinger Bands",
        "Stochastic Oscillator", "Donchian Channel",
    ]
    parameters: dict[str, int] = Field(default_factory=dict)


class BacktestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    market: Market = "BIST"
    strategy: str
    interval: Interval = "1d"
    components: list[StrategyComponent] = Field(default_factory=list)
    combination_method: Literal["AND", "OR", "MAJORITY"] = "AND"
    initial_cash: float = Field(gt=0)
    commission_rate: float = Field(ge=0, lt=1)
    risk_enabled: bool = True
    stop_loss_pct: float = Field(default=5.0, gt=0, lt=100)
    take_profit_pct: float = Field(default=10.0, gt=0, lt=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    parameters: dict[str, int] = Field(default_factory=dict)


class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    market: Market = "BIST"
    horizon: int = Field(default=5, ge=1, le=20)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class RandomResearchRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    market: Market = "BIST"
    interval: Interval = "1d"
    indicators: list[Literal[
        "SMA Crossover", "EMA Crossover", "RSI", "MACD", "Bollinger Bands",
        "Stochastic Oscillator", "Donchian Channel",
    ]] = Field(min_length=2, max_length=7)
    iterations: int = Field(default=30, ge=5, le=100)
    seed: Optional[int] = Field(default=None, ge=0, le=2**32 - 1)
    initial_cash: float = Field(default=100_000, gt=0)
    commission_rate: float = Field(default=0.001, ge=0, lt=1)
    risk_enabled: bool = True
    stop_loss_pct: float = Field(default=5.0, gt=0, lt=100)
    take_profit_pct: float = Field(default=10.0, gt=0, lt=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class SavedBacktestRequest(BaseModel):
    result: dict[str, Any]


@app.get("/api/health")
def health() -> dict[str, str]:
    try:
        database.check_connection()
        database_status = "connected"
    except (psycopg.Error, RuntimeError):
        database_status = "disconnected"
    return {"status": "ok", "database": database_status}


@app.get("/api/history")
def get_backtest_history() -> list[dict[str, Any]]:
    try:
        return database.list_saved_backtests()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Supabase test geçmişine ulaşılamıyor.") from exc


@app.post("/api/history", status_code=201)
def save_backtest_history(request: SavedBacktestRequest) -> dict[str, Any]:
    result = request.result
    if (
        not isinstance(result.get("symbol"), str)
        or result.get("market") not in ("BIST", "US")
        or result.get("strategy") not in (
            "SMA Crossover", "EMA Crossover", "RSI", "MACD", "Bollinger Bands",
            "Stochastic Oscillator", "Donchian Channel", "Buy & Hold", "Combined",
        )
        or not isinstance(result.get("metrics"), dict)
        or not isinstance(result.get("points"), list)
        or not isinstance(result.get("trades"), list)
    ):
        raise HTTPException(status_code=422, detail="Kaydedilecek backtest sonucu geçersiz.")
    try:
        return database.save_backtest(result)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Backtest Supabase'e kaydedilemedi.") from exc


@app.delete("/api/history/{run_id}", status_code=204)
def delete_backtest_history(run_id: UUID) -> None:
    try:
        deleted = database.delete_saved_backtest(run_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Supabase test geçmişine ulaşılamıyor.") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")


@app.delete("/api/history", status_code=204)
def clear_backtest_history() -> None:
    try:
        database.clear_saved_backtests()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Supabase test geçmişi temizlenemedi.") from exc


@app.get("/api/symbols")
def search_symbols(
    q: str = Query(default="", max_length=64),
    market: Market = "BIST",
) -> dict[str, list[dict[str, str]]]:
    query = q.strip()[:64]
    try:
        symbols = database.search_stock_universe(market, query, 12)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Hisse kataloğuna şu anda ulaşılamıyor.") from exc

    exact_symbol = query.upper()
    if market == "BIST" and not exact_symbol.endswith(".IS"):
        exact_symbol += ".IS"
    has_exact = any(item["symbol"].upper() == exact_symbol for item in symbols)
    if len(query) < 2 or len(symbols) >= 12 or has_exact:
        return {"symbols": symbols}

    cache_key = (market, query.casefold())
    cached = _SYMBOL_SEARCH_CACHE.get(cache_key)
    if cached and monotonic() - cached[0] < 300:
        discovered = cached[1]
    else:
        try:
            search = yf.Search(query, max_results=30, news_count=0, lists_count=0, include_cb=False, timeout=8)
            discovered = []
            seen = {item["symbol"] for item in symbols}
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
                discovered.append({
                    "symbol": ticker,
                    "name": str(quote.get("longname") or quote.get("shortname") or ticker),
                    "exchange": _exchange_label(market, exchange, exchange_code),
                    "market": market,
                })
                if len(discovered) >= 12:
                    break
        except Exception:
            # Keep database matches usable when the optional live discovery service is down.
            if not symbols:
                raise HTTPException(status_code=502, detail="Hisse arama sağlayıcısına şu anda ulaşılamıyor.")
            discovered = []
        if discovered:
            try:
                database.upsert_stock_universe(discovered)
            except (psycopg.Error, RuntimeError) as exc:
                raise HTTPException(status_code=503, detail="Bulunan hisse kataloğa eklenemedi.") from exc
        _SYMBOL_SEARCH_CACHE[cache_key] = (monotonic(), discovered)
    merged = {item["symbol"]: item for item in symbols}
    merged.update({item["symbol"]: item for item in discovered})
    return {"symbols": list(merged.values())[:12]}


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
        strategy = _strategy_for(
            request.strategy,
            request.parameters,
            request.components,
            request.combination_method,
        )
        loader = DataLoader()
        if request.market == "BIST" and symbol == "THYAO.IS":
            data = loader.load_csv(PROJECT_ROOT / "data" / "THYAO.IS.csv")
            data = loader.resample(data, request.interval)
            source = "Yahoo Finance · Yerel THYAO arşivi"
        else:
            download_end = (end + timedelta(days=1)).isoformat() if end else None
            data = loader.download_yfinance(symbol, start.isoformat(), download_end, request.interval)
            source = "Yahoo Finance · İndirilen tarihsel veri"
        dates = pd.DatetimeIndex(data.index).date
        data = data[dates >= start]
        if end:
            data = data[pd.DatetimeIndex(data.index).date <= end]
        interval_names = {"1d": "günlük", "1wk": "haftalık", "1mo": "aylık"}
        if request.strategy == "Combined":
            minimum = max(_minimum_bars(component.strategy, component.parameters) for component in request.components)
        else:
            minimum = _minimum_bars(request.strategy, request.parameters)
        if len(data) < minimum:
            raise ValueError(
                f"Bu ayarlar için en az {minimum} {interval_names[request.interval]} veri barı gerekli. "
                "Tarih aralığını genişletin veya indikatör dönemlerini kısaltın."
            )
        risk = (
            RiskManager(
                stop_loss_pct=request.stop_loss_pct / 100,
                take_profit_pct=request.take_profit_pct / 100,
            )
            if request.risk_enabled
            else None
        )
        results = BacktestEngine(request.initial_cash, request.commission_rate, risk).run(data, strategy)
        periods_per_year = {"1d": 252, "1wk": 52, "1mo": 12}[request.interval]
        analyzer = PerformanceAnalyzer(periods_per_year=periods_per_year)
        metrics = analyzer.analyze(results)
        counterfactual_risk = None if request.risk_enabled else RiskManager(
            stop_loss_pct=request.stop_loss_pct / 100,
            take_profit_pct=request.take_profit_pct / 100,
        )
        counterfactual = BacktestEngine(
            request.initial_cash,
            request.commission_rate,
            counterfactual_risk if not request.risk_enabled else None,
        ).run(data, strategy)
        counterfactual_metrics = analyzer.analyze(counterfactual)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Veri veya backtest hatası: {exc}") from exc

    first_close = float(data["Close"].iloc[0])
    risk_on_results = results if request.risk_enabled else counterfactual
    risk_off_results = counterfactual if request.risk_enabled else results
    risk_on_metrics = metrics if request.risk_enabled else counterfactual_metrics
    risk_off_metrics = counterfactual_metrics if request.risk_enabled else metrics
    risk_effect = {
        "risk_on": {
            **risk_on_metrics,
            "final_value": float(risk_on_results["Equity"].iloc[-1]),
        },
        "risk_off": {
            **risk_off_metrics,
            "final_value": float(risk_off_results["Equity"].iloc[-1]),
        },
        "return_delta": float(risk_on_metrics["total_return"] - risk_off_metrics["total_return"]),
        "drawdown_delta": float(risk_on_metrics["max_drawdown"] - risk_off_metrics["max_drawdown"]),
        "trade_delta": int(risk_on_metrics["closed_trades"] - risk_off_metrics["closed_trades"]),
    }
    indicator_effects: list[dict[str, Any]] = []
    if isinstance(strategy, CombinedStrategy):
        for component, request_component in zip(strategy.strategies, request.components):
            component_risk = (
                RiskManager(
                    stop_loss_pct=request.stop_loss_pct / 100,
                    take_profit_pct=request.take_profit_pct / 100,
                )
                if request.risk_enabled
                else None
            )
            component_results = BacktestEngine(
                request.initial_cash,
                request.commission_rate,
                component_risk,
            ).run(data, component)
            component_metrics = analyzer.analyze(component_results)
            indicator_effects.append({
                "strategy": request_component.strategy,
                "metrics": component_metrics,
                "final_value": float(component_results["Equity"].iloc[-1]),
                "combined": False,
            })
        indicator_effects.append({
            "strategy": "Combined",
            "metrics": metrics,
            "final_value": float(results["Equity"].iloc[-1]),
            "combined": True,
        })
    strategy_instances = strategy.strategies if isinstance(strategy, CombinedStrategy) else (strategy,)
    indicator_lines: list[dict[str, str]] = []
    indicator_values: dict[str, pd.Series] = {}
    component_names = (
        [component.strategy for component in request.components]
        if request.strategy == "Combined"
        else [request.strategy]
    )
    for component_index, component in enumerate(strategy_instances):
        plot_series = getattr(component, "plot_series", None)
        if plot_series is None:
            continue
        for series_name, (kind, values) in plot_series(data).items():
            key = f"indicator_{component_index}_{len(indicator_lines)}"
            line_name = f"{component_names[component_index]} · {series_name}" if request.strategy == "Combined" else series_name
            indicator_lines.append({"key": key, "name": line_name, "kind": kind})
            indicator_values[key] = values

    points = [
        {
            "date": pd.Timestamp(row_date).strftime("%Y-%m-%d"),
            "price": float(row["Close"]),
            "equity": float(row["Equity"]),
            "benchmark": float(request.initial_cash * row["Close"] / first_close),
            "indicators": {
                key: (float(values.iloc[row_index]) if pd.notna(values.iloc[row_index]) else None)
                for key, values in indicator_values.items()
            },
        }
        for row_index, (row_date, row) in enumerate(results.iterrows())
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
        "interval": request.interval,
        "components": [component.model_dump() if hasattr(component, "model_dump") else component.dict() for component in request.components],
        "combination_method": request.combination_method if request.strategy == "Combined" else None,
        "source": source,
        "parameters": request.parameters,
        "risk_enabled": request.risk_enabled,
        "stop_loss_pct": request.stop_loss_pct,
        "take_profit_pct": request.take_profit_pct,
        "indicator_lines": indicator_lines,
        "risk_effect": risk_effect,
        "indicator_effects": indicator_effects,
        "period": f"{date.fromisoformat(points[0]['date']).strftime('%d.%m.%Y')} — {date.fromisoformat(points[-1]['date']).strftime('%d.%m.%Y')}",
        "metrics": metrics,
        "points": points,
        "trades": trades,
    }


@app.post("/api/random-strategy-research")
def random_strategy_research(request: RandomResearchRequest) -> dict[str, Any]:
    """Compare random indicator combinations using chronological holdout periods."""
    symbol = request.symbol.strip().upper()
    if request.market == "BIST":
        if not re.fullmatch(r"[A-Z0-9]{1,12}(\.IS)?", symbol):
            raise HTTPException(422, "Geçerli bir BIST hisse kodu girin.")
        if not symbol.endswith(".IS"):
            symbol += ".IS"
    elif not re.fullmatch(r"[A-Z][A-Z0-9.-]{0,14}", symbol):
        raise HTTPException(422, "Geçerli bir ABD hisse sembolü girin.")

    start = request.start_date or date(2023, 1, 1)
    end = request.end_date
    if end and (end < start or end > date.today()):
        raise HTTPException(422, "Bitiş tarihi başlangıçtan önce veya bugünden sonra olamaz.")
    if len(set(request.indicators)) < 2:
        raise HTTPException(422, "En az iki farklı indikatör seçin.")

    try:
        loader = DataLoader()
        if request.market == "BIST" and symbol == "THYAO.IS":
            data = loader.load_csv(PROJECT_ROOT / "data" / "THYAO.IS.csv")
            data = loader.resample(data, request.interval)
            source = "Yahoo Finance · Yerel THYAO arşivi"
        else:
            until = (end + timedelta(days=1)).isoformat() if end else None
            data = loader.download_yfinance(symbol, start.isoformat(), until, request.interval)
            source = "Yahoo Finance · İndirilen tarihsel veri"
        dates = pd.DatetimeIndex(data.index).date
        data = data[dates >= start]
        if end:
            data = data[pd.DatetimeIndex(data.index).date <= end]
        if len(data) < 200:
            raise ValueError(
                f"Kronolojik keşif/doğrulama/test ayrımı için en az 200 {request.interval} veri barı gerekli. "
                "Tarih aralığını genişletin veya daha sık veri aralığı seçin."
            )

        boundaries = (int(len(data) * 0.6), int(len(data) * 0.8))
        segments = {
            "optimization": data.iloc[:boundaries[0]],
            "validation": data.iloc[boundaries[0]:boundaries[1]],
            "test": data.iloc[boundaries[1]:],
        }
        candidates = generate_random_candidates(list(dict.fromkeys(request.indicators)), request.iterations, request.seed)
        periods_per_year = {"1d": 252, "1wk": 52, "1mo": 12}[request.interval]
        analyzer = PerformanceAnalyzer(periods_per_year=periods_per_year)
        risk_options = {
            "stop_loss_pct": request.stop_loss_pct / 100,
            "take_profit_pct": request.take_profit_pct / 100,
        }
        risk_manager = RiskManager(**risk_options) if request.risk_enabled else None

        def evaluate(frame: pd.DataFrame, strategy: Any) -> dict[str, Any]:
            result = BacktestEngine(request.initial_cash, request.commission_rate, risk_manager).run(frame, strategy)
            metrics = analyzer.analyze(result)
            return {
                **metrics,
                "final_value": float(result["Equity"].iloc[-1]),
            }

        baseline = {
            split: evaluate(frame, BuyAndHoldStrategy())
            for split, frame in segments.items()
        }
        evaluated: list[dict[str, Any]] = []
        for candidate in candidates:
            components = [StrategyComponent(**item) for item in candidate["components"]]
            strategy = _strategy_for("Combined", {}, components, candidate["combination_method"])
            minimum = max(_minimum_bars(item.strategy, item.parameters) for item in components)
            if any(len(frame) < minimum for frame in segments.values()):
                continue
            by_split = {split: evaluate(frame, strategy) for split, frame in segments.items()}
            evaluated.append({
                **candidate,
                "label": describe_candidate(candidate),
                "metrics": by_split,
            })
        if not evaluated:
            raise ValueError("Bu tarih aralığındaki her bölüm en az 40 bar içermeli. Günlük veriye veya daha uzun döneme geçin.")
        # Candidate selection uses only the optimization segment. Validation/test remain reporting-only holdouts.
        evaluated.sort(
            key=lambda item: (
                item["metrics"]["optimization"]["total_return"],
                item["metrics"]["optimization"]["sharpe_ratio"],
            ),
            reverse=True,
        )
        for rank, item in enumerate(evaluated, start=1):
            item["rank"] = rank
        return {
            "symbol": symbol,
            "market": request.market,
            "interval": request.interval,
            "period": f"{pd.Timestamp(data.index[0]).date().isoformat()} — {pd.Timestamp(data.index[-1]).date().isoformat()}",
            "source": source,
            "seed": request.seed,
            "requested_iterations": request.iterations,
            "evaluated_iterations": len(evaluated),
            "split_bars": {name: len(frame) for name, frame in segments.items()},
            "risk_enabled": request.risk_enabled,
            "stop_loss_pct": request.stop_loss_pct,
            "take_profit_pct": request.take_profit_pct,
            "baseline": baseline,
            "candidates": evaluated,
            "selection_rule": "Keşif dönemindeki toplam getiri; eşitlikte Sharpe oranı.",
        }
    except (ValueError, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Veri veya strateji araştırması hatası: {exc}") from exc


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


def _strategy_for(
    name: str,
    parameters: dict[str, int],
    components: list[StrategyComponent] | None = None,
    combination_method: str = "AND",
):
    strategies = {
        "SMA Crossover": SMACrossoverStrategy,
        "EMA Crossover": EMACrossoverStrategy,
        "RSI": RSIStrategy,
        "MACD": MACDStrategy,
        "Bollinger Bands": BollingerBandsStrategy,
        "Stochastic Oscillator": StochasticOscillatorStrategy,
        "Donchian Channel": DonchianChannelStrategy,
        "Buy & Hold": BuyAndHoldStrategy,
    }
    try:
        if name == "Combined":
            selected = components or []
            if len(selected) < 2:
                raise ValueError("Birleşik strateji için en az iki indikatör seçin.")
            component_strategies = [strategies[item.strategy](**item.parameters) for item in selected]
            return CombinedStrategy(component_strategies, combination_method)
        if components:
            raise ValueError("Bileşen listesi yalnızca birleşik stratejide kullanılabilir.")
        return strategies[name](**parameters)
    except (KeyError, TypeError) as exc:
        raise ValueError("Strateji veya parametreleri geçersiz.") from exc


def _minimum_bars(name: str, parameters: dict[str, int]) -> int:
    requirements = {
        "SMA Crossover": lambda: parameters.get("slow_period", 50) + 1,
        "EMA Crossover": lambda: parameters.get("slow_period", 26) + 1,
        "RSI": lambda: parameters.get("period", 14) + 2,
        "MACD": lambda: parameters.get("slow_period", 26) + parameters.get("signal_period", 9),
        "Bollinger Bands": lambda: parameters.get("period", 20) + 1,
        "Stochastic Oscillator": lambda: parameters.get("k_period", 14) + parameters.get("d_period", 3) + 1,
        "Donchian Channel": lambda: parameters.get("period", 20) + 1,
        "Buy & Hold": lambda: 2,
    }
    try:
        return requirements[name]()
    except KeyError as exc:
        raise ValueError("Strateji veya parametreleri geçersiz.") from exc
