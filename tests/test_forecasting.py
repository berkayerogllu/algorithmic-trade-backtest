import numpy as np
import pandas as pd
import pytest

from algorithmic_backtest.exceptions import BacktestError
from algorithmic_backtest.forecasting import HistoricalReturnForecaster


def synthetic_market(rows=520):
    rng = np.random.default_rng(4015)
    changes = rng.normal(0.0004, 0.018, rows)
    close = 100 * np.exp(np.cumsum(changes))
    return pd.DataFrame(
        {"Close": close, "Volume": rng.integers(100_000, 500_000, rows)},
        index=pd.bdate_range("2023-01-02", periods=rows),
    )


def test_forecast_has_ordered_prediction_interval_and_chronological_metrics():
    result = HistoricalReturnForecaster().forecast(synthetic_market(), horizon=5)

    assert result["lower_close"] <= result["predicted_close"] <= result["upper_close"]
    assert result["validation_samples"] >= 20
    assert 0 <= result["directional_accuracy"] <= 1
    assert result["horizon"] == 5


def test_forecaster_rejects_short_history():
    with pytest.raises(BacktestError, match="180"):
        HistoricalReturnForecaster().forecast(synthetic_market(100))


def test_forecaster_rejects_unsupported_horizon():
    with pytest.raises(ValueError, match="1, 5 veya 20"):
        HistoricalReturnForecaster().forecast(synthetic_market(), horizon=3)
