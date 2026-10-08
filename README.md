# FREERIDE A-share Option Research Demo

Static GitHub Pages demo for the A-share OTC European call research workflow.

Live demo: https://lancewang1.github.io/freeride-a-share-option-demo/

## Pages

- `index.html` — project overview, model flow, validation and limitations.
- `a-share-option-demo.html` / `stock-demo.js` — 2026-08-13 Market Context offer, rotatable 3D stock surface, heatmaps and smile comparison across three sources, editable assumptions and a client pricer.
- `vendor/plotly.min.js` — bundled Plotly library (MIT license notice included), so chart rendering needs no external CDN.
- `live-market.html` — latest Tushare snapshot viewer, historical realized-volatility panel and a new-trade client pricer.
- `latest-market-context.json` — dated public snapshot for five example A-shares; this file contains no Tushare credential.
- `live-market.js` / `live-pricing.js` — browser validation, polling, snapshot import and the cash-flow pricing kernel.
- `etf-surface-demo.html` — listed 50ETF/300ETF risk-neutral surface viewer.
- `surface-layers.js` — compact model-estimate and trailing-realized layers used by the static stock surface.
- `evidence/` — reproducible training and out-of-sample validation summaries.

The public Pages build does not call Tushare directly and never receives an API key. It displays the dated `latest-market-context.json` artifact (latest update: 2026-10-08 closes) and can import a client-generated snapshot. The local service can request Tushare server-side at `/api/market/ashare-live?ticker=000166`; configure `FREERIDE_MARKET_ORIGIN` before allowing a separately hosted page to call that endpoint.

Tushare `rt_k` is an optional entitlement. When it is unavailable (the current account returns code 40203), the adapter falls back to the latest completed `daily` close and labels its date and source. It does not call a stale quote “real time”. Daily history, `adj_factor`, `trade_cal` and `dividend` responses are validated, bounded and cached in memory. The 2026-08-13 Market Context surface and model are not silently relabelled as a live risk-neutral surface; a new market date is a separate client-pricing scenario and requires customer vol/rate assumptions.

Both stock pages use `live-pricing.js` for forward and cash-flow valuation. The frozen stock page defaults to its dated government-reference curve, with client flat-rate overrides; the latest-market page requires a client rate input. Cash dividends are recalculated from their actual dates under the selected carry. Missing exchange-calendar coverage stops valuation, including with a manual volatility override. Invalid inputs clear prior results and disable export. The frozen page supports 1–4M; the 2026-10-08 scenario supports 1–2M until the verified calendar extends into 2027.

## Local preview

```powershell
python -m http.server 8000
```

Open `http://127.0.0.1:8000/` from this directory. A local HTTP server is preferred because browser security rules can block downloads from `file://` pages.

For server-side Tushare access, run the local app from `freeride-mvp`:

```powershell
python -X utf8 run.py --port 8765
```

Then open `http://127.0.0.1:8765/stock-demo/live-market.html`. The API token is read from `TUSHARE_TOKEN` or the existing local credential file and is never returned to the browser or written into the public snapshot. `scripts/publish_market_context.py` builds a dated static artifact for the Pages site.

## Scope and limitations

The current research scope is CNY single-stock OTC European calls with cash settlement. The default convention is BUS/252 variance time, exchange-calendar following dates, premium payment T+1 and payoff settlement T+2. Rates, dividends and borrow are parameterized in the research engine. The live page is indicative only: it has no execution capability, no browser-side credentials and no production model approval. Historical realized volatility is a physical-measure reference, not an implied-volatility mark.
