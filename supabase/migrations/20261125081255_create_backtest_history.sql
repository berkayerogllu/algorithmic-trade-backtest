-- Saved backtests are private server-side records. The browser never connects
-- to Postgres directly; the local FastAPI service uses the DATABASE_URL secret.
create schema if not exists app_data;
revoke all on schema app_data from public, anon, authenticated;

create table app_data.backtest_history (
    id uuid primary key,
    saved_at timestamptz not null default now(),
    symbol text not null check (length(symbol) between 1 and 20),
    market text not null check (market in ('BIST', 'US')),
    strategy text not null check (strategy in ('SMA Crossover', 'RSI', 'MACD', 'Buy & Hold')),
    result jsonb not null
);

create index backtest_history_saved_at_idx
    on app_data.backtest_history (saved_at desc);

alter table app_data.backtest_history enable row level security;
revoke all on table app_data.backtest_history from public, anon, authenticated, service_role;
