"""Combine long/flat strategy signals using a configurable voting rule."""

from typing import Literal, Sequence

import pandas as pd

from .base import BaseStrategy


class CombinedStrategy(BaseStrategy):
    """Combine two or more strategies with AND, OR, or strict majority voting."""

    METHODS = {"AND", "OR", "MAJORITY"}

    def __init__(self, strategies: Sequence[BaseStrategy], method: str = "AND") -> None:
        if len(strategies) < 2:
            raise ValueError("A combined strategy requires at least two strategies")
        if method not in self.METHODS:
            raise ValueError("method must be AND, OR, or MAJORITY")
        self.strategies = tuple(strategies)
        self.method: Literal["AND", "OR", "MAJORITY"] = method  # type: ignore[assignment]

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        votes = pd.concat([strategy.generate_signals(data) for strategy in self.strategies], axis=1)
        count = votes.sum(axis=1)
        if self.method == "AND":
            signal = count == len(self.strategies)
        elif self.method == "OR":
            signal = count > 0
        else:
            signal = count > len(self.strategies) / 2
        return signal.astype("int8").rename("signal")
