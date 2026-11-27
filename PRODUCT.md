# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People comparing algorithmic strategies on BIST and US historical market data. The interface should also make the Python techniques used by the academic project understandable to its students and reviewers.

## Product Purpose

Run historical simulations, compare indicator strategies with a buy-and-hold baseline, inspect risk and performance, and review saved runs. Help users understand what each result represents and which Python component produced it.

## Positioning

The project combines a practical backtesting workspace with a transparent view of its Python architecture. A distinct advantage beyond that combination has not been established.

## Operating Context

Users choose a market and symbol, configure a strategy and period, run a simulation, compare results, and optionally save the backtest. Separate areas support price forecasts, random indicator research, and saved backtests. The application is an academic simulator and does not submit real orders.

## Capabilities and Constraints

- The analysis engine and API are Python; the browser interface is React and TypeScript.
- Supported research includes indicator strategies, combined signals, risk exits, historical comparisons, random strategy research, forecasts, and saved backtests.
- Python concepts should be explained in context with short notes and an optional architecture panel.
- Preserve the existing workflows and calculations while improving presentation and navigation.
- There is no generative-AI trading assistant or live-order workflow.

## Brand Commitments

- Product name: piyasa.lab.
- The established interface uses a white background and dark navy structure. Profit is green, loss is red, and vivid color is reserved for chart data.
- Keep the writing clear and educational without turning every control into a lesson.

## Evidence on Hand

- Python modules under `algorithmic_backtest/` implement data loading, strategy classes, backtesting, portfolio and risk management, performance analysis, optimization, and the API.
- The existing React/TypeScript application contains backtest, forecast, random research, and saved-history workflows.
- No customer testimonials or production trading claims are established.

## Product Principles

- Make historical assumptions and comparisons easy to see.
- Keep the analysis flow primary and educational explanations optional but discoverable.
- Explain metrics and Python components in plain language.
- Never present a historical result or forecast as a guarantee.
