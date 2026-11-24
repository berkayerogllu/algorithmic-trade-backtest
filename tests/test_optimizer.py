import pandas as pd
import pytest

from algorithmic_backtest.optimizer import StrategyOptimizer
from algorithmic_backtest.strategies import SMACrossoverStrategy


def sample_prices():
    values = [100, 98, 97, 99, 102, 105, 104, 108, 112, 110, 115, 120, 118, 123, 125]
    return pd.DataFrame({"Close": values}, index=pd.date_range("2024-01-01", periods=len(values)))


def test_sequential_and_parallel_search_return_same_ranked_results():
    grid = {"fast_period": [2, 3], "slow_period": [5, 7]}
    optimizer = StrategyOptimizer()
    sequential = optimizer.optimize(sample_prices(), SMACrossoverStrategy, grid, n_jobs=1)
    parallel = optimizer.optimize(sample_prices(), SMACrossoverStrategy, grid, n_jobs=2)

    pd.testing.assert_frame_equal(sequential, parallel)
    assert len(sequential) == 4
    assert sequential["sharpe_ratio"].is_monotonic_decreasing


@pytest.mark.parametrize(
    "kwargs",
    [
        {"param_grid": {}},
        {"param_grid": {"fast_period": []}},
        {"param_grid": {"fast_period": [2]}, "metric": "unknown"},
        {"param_grid": {"fast_period": [2]}, "n_jobs": 0},
    ],
)
def test_optimizer_rejects_invalid_configuration(kwargs):
    defaults = {"param_grid": {"fast_period": [2]}}
    defaults.update(kwargs)
    with pytest.raises(ValueError):
        StrategyOptimizer().optimize(sample_prices(), SMACrossoverStrategy, **defaults)
