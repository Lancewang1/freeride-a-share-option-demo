# FREERIDE A-share Option Research Demo

Static GitHub Pages demo for the A-share OTC European call research workflow.

Live demo: https://lancewang1.github.io/freeride-a-share-option-demo/

## Pages

- `index.html` — project overview, model flow, validation and limitations.
- `a-share-option-demo.html` — 2026-08-13 SOL Final Offer and offer-equivalent IV viewer.
- `etf-surface-demo.html` — listed 50ETF/300ETF risk-neutral surface viewer.
- `evidence/` — reproducible training and out-of-sample validation summaries.

The site is self-contained. It does not call Tushare, require an API key, or send data to a server. The embedded SOL snapshot is a research reference supplied for this project; its offer-equivalent IV includes the observed provider's commercial layer and is not a dealer-mid volatility mark.

## Local preview

```powershell
python -m http.server 8000
```

Open `http://127.0.0.1:8000/` from this directory. A local HTTP server is preferred because browser security rules can block downloads from `file://` pages.

## Scope and limitations

The current research scope is CNY single-stock OTC European calls with cash settlement. The default convention is BUS/252 variance time, exchange-calendar following dates, premium payment T+1 and payoff settlement T+2. Rates, dividends and borrow are parameterized in the research engine. This public demo is indicative only: it has no live market feed, no execution capability, no credentials and no production model approval.
