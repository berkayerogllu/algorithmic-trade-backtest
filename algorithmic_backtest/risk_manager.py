"""Position sizing and price-based exit rules."""

from __future__ import annotations


class RiskManager:
    """Apply long-position sizing, stop-loss, and take-profit rules.

    Percentage arguments use decimal fractions: 0.05 means five percent.
    Exit levels are evaluated against closing prices.
    """

    def __init__(
        self,
        stop_loss_pct: float | None = 0.05,
        take_profit_pct: float | None = 0.10,
        risk_per_trade: float = 0.01,
        max_position_fraction: float = 1.0,
    ) -> None:
        for name, value in (("stop_loss_pct", stop_loss_pct), ("take_profit_pct", take_profit_pct)):
            if value is not None and not 0 < value < 1:
                raise ValueError(f"{name} must be between 0 and 1")
        if not 0 < risk_per_trade < 1:
            raise ValueError("risk_per_trade must be between 0 and 1")
        if not 0 < max_position_fraction <= 1:
            raise ValueError("max_position_fraction must be in (0, 1]")
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self.risk_per_trade = risk_per_trade
        self.max_position_fraction = max_position_fraction

    def allocation_fraction(self) -> float:
        """Return the cash fraction to allocate, capped by stop risk and exposure."""
        if self.stop_loss_pct is None:
            return self.max_position_fraction
        risk_limited_fraction = self.risk_per_trade / self.stop_loss_pct
        return min(self.max_position_fraction, risk_limited_fraction)

    def exit_reason(self, entry_price: float, current_price: float) -> str | None:
        """Return the triggered exit rule, if any."""
        if self.stop_loss_pct is not None and current_price <= entry_price * (1 - self.stop_loss_pct):
            return "stop_loss"
        if self.take_profit_pct is not None and current_price >= entry_price * (1 + self.take_profit_pct):
            return "take_profit"
        return None
