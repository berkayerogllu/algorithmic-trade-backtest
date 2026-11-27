"""Sequential and process based strategy parameter search."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor
from itertools import product
from typing import Type

import pandas as pd

from .backtest_engine import BacktestEngine
from .performance import PerformanceAnalyzer
from .risk_manager import RiskManager
from .strategies.base import BaseStrategy


def _evaluate_candidate(payload: tuple) -> dict:
    data, strategy_class, parameters, initial_cash, commission_rate, risk_manager, metric = payload
    strategy = strategy_class(**parameters)
    result = BacktestEngine(initial_cash, commission_rate, risk_manager).run(data, strategy)
    metrics = PerformanceAnalyzer().analyze(result)
    return {**parameters, **metrics}


class StrategyOptimizer:
    """Search a parameter grid and rank candidates by an in-sample metric."""

    VALID_METRICS = {"total_return", "sharpe_ratio", "max_drawdown", "win_rate"}

    def optimize(
        self,
        data: pd.DataFrame,
        strategy_class: Type[BaseStrategy],
        param_grid: dict[str, list],
        metric: str = "sharpe_ratio",
        n_jobs: int = 1,
        initial_cash: float = 100_000.0,
        commission_rate: float = 0.0,
        risk_manager: RiskManager | None = None,
    ) -> pd.DataFrame:
        """Evaluate every parameter combination on the supplied data only.

        For process parallelism, ``strategy_class`` must be importable and
        picklable. ``n_jobs=1`` provides deterministic sequential execution.
        """
        if data.empty:
            raise ValueError("data must not be empty")
        if not param_grid or any(not values for values in param_grid.values()):
            raise ValueError("param_grid must contain non-empty value lists")
        if metric not in self.VALID_METRICS:
            raise ValueError(f"Unsupported metric: {metric}")
        if n_jobs < 1:
            raise ValueError("n_jobs must be at least 1")

        parameter_names = list(param_grid)
        candidates = [
            dict(zip(parameter_names, values))
            for values in product(*(param_grid[name] for name in parameter_names))
        ]
        payloads = [
            (data, strategy_class, params, initial_cash, commission_rate, risk_manager, metric)
            for params in candidates
        ]

        if n_jobs == 1:
            rows = [_evaluate_candidate(payload) for payload in payloads]
        else:
            with ProcessPoolExecutor(max_workers=n_jobs) as executor:
                rows = list(executor.map(_evaluate_candidate, payloads))

        return pd.DataFrame(rows).sort_values(metric, ascending=False).reset_index(drop=True)
