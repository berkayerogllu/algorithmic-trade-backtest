from algorithmic_backtest import __version__
from algorithmic_backtest.exceptions import BacktestError


def test_project_version_is_available():
    assert __version__ == "0.1.0"


def test_backtest_error_is_an_exception():
    assert issubclass(BacktestError, Exception)

