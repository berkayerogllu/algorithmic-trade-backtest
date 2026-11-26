alter table app_data.backtest_history
    drop constraint if exists backtest_history_strategy_check;

alter table app_data.backtest_history
    add constraint backtest_history_strategy_check
    check (strategy in (
        'SMA Crossover',
        'EMA Crossover',
        'RSI',
        'MACD',
        'Bollinger Bands',
        'Stochastic Oscillator',
        'Donchian Channel',
        'Buy & Hold',
        'Combined'
    ));
