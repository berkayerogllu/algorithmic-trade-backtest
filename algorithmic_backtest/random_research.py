"""Generate reproducible random indicator combinations for strategy research."""

from __future__ import annotations

import random
from typing import Any


INDICATOR_POOL = (
    "SMA Crossover",
    "EMA Crossover",
    "RSI",
    "MACD",
    "Bollinger Bands",
    "Stochastic Oscillator",
    "Donchian Channel",
)


def generate_random_candidates(
    indicators: list[str], iterations: int, seed: int | None
) -> list[dict[str, Any]]:
    """Build distinct candidate configurations from the selected indicator pool."""
    rng = random.Random(seed)
    candidates: dict[str, dict[str, Any]] = {}
    methods = ("AND", "OR", "MAJORITY")
    attempts = 0
    while len(candidates) < iterations and attempts < iterations * 40:
        attempts += 1
        count = rng.randint(2, min(4, len(indicators)))
        names = rng.sample(indicators, count)
        components = [{"strategy": name, "parameters": _random_parameters(name, rng)} for name in names]
        method = rng.choice(methods)
        key = repr((tuple((item["strategy"], tuple(sorted(item["parameters"].items()))) for item in components), method))
        candidates.setdefault(key, {"components": components, "combination_method": method})
    return list(candidates.values())


def _random_parameters(name: str, rng: random.Random) -> dict[str, int]:
    if name in ("SMA Crossover", "EMA Crossover"):
        fast, slow = rng.choice(((5, 15), (8, 21), (10, 25), (12, 26), (14, 30), (20, 35)))
        return {"fast_period": fast, "slow_period": slow}
    if name == "RSI":
        oversold = rng.choice((20, 25, 30, 35))
        overbought = rng.choice((65, 70, 75, 80))
        return {"period": rng.choice((7, 10, 14, 21)), "oversold": oversold, "overbought": overbought}
    if name == "MACD":
        fast, slow = rng.choice(((8, 21), (10, 26), (12, 26), (12, 30)))
        return {"fast_period": fast, "slow_period": slow, "signal_period": rng.choice((5, 7, 9))}
    if name == "Bollinger Bands":
        return {"period": rng.choice((10, 14, 20, 30)), "deviations": rng.choice((1, 2, 3))}
    if name == "Stochastic Oscillator":
        oversold = rng.choice((15, 20, 25))
        overbought = rng.choice((75, 80, 85))
        return {"k_period": rng.choice((9, 14, 21)), "d_period": rng.choice((3, 5)), "oversold": oversold, "overbought": overbought}
    if name == "Donchian Channel":
        return {"period": rng.choice((10, 14, 20, 30))}
    raise ValueError(f"Unsupported indicator: {name}")


def describe_candidate(candidate: dict[str, Any]) -> str:
    """Return a compact, human-readable name including sampled parameters."""
    labels = []
    for component in candidate["components"]:
        name, params = component["strategy"], component["parameters"]
        if name in ("SMA Crossover", "EMA Crossover"):
            short = "SMA" if name.startswith("SMA") else "EMA"
            label = f"{short} {params['fast_period']}/{params['slow_period']}"
        elif name == "RSI":
            label = f"RSI {params['period']} ({params['oversold']}/{params['overbought']})"
        elif name == "MACD":
            label = f"MACD {params['fast_period']}/{params['slow_period']}/{params['signal_period']}"
        elif name == "Bollinger Bands":
            label = f"Bollinger {params['period']} · {params['deviations']}σ"
        elif name == "Stochastic Oscillator":
            label = f"Stochastic {params['k_period']}/{params['d_period']}"
        else:
            label = f"Donchian {params['period']}"
        labels.append(label)
    return f"{' + '.join(labels)} · {candidate['combination_method']}"
