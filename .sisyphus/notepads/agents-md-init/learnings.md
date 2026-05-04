# Wealthfolio Dividend Assistant - Codebase Learnings

## Developer Commands & Environment
- **Package Manager**: Strictly `pnpm` (`packageManager: pnpm@10.33.0` in package.json and `pnpm-lock.yaml` presence). README.md's mention of npm should be treated as a typo.
- **Commands**:
  - Build: `pnpm build` (vite build)
  - Bundle: `pnpm bundle` (clean, build, package via zip)
  - Dev: `pnpm dev` (watch mode) and `pnpm dev:server` (starts wealthfolio dev server)
  - Lint: `pnpm lint` and `pnpm type-check` both run `tsc --noEmit`.
- **Tests**: No testing framework or test files currently set up.
- **Build specifics**: Vite is used with `rollup-plugin-external-globals` to externalize `react` and `react-dom`, bundling into `dist/addon.js`.

## Architecture & Integration
- **Addon Structure**: Defined in `manifest.json`. Requested permissions include reading accounts/activities, writing activities, and accessing market dividend data.
- **Entry Point**: `src/addon.tsx` exposes `default function enable(ctx: AddonContext)`. It registers a sidebar item and multiple routes (main page, settings page).
- **Import Mechanism ("Log")**: Safe import flow. It uses `ctx.api.activities.checkImport(payloads)` followed by `ctx.api.activities.import(checked)`.
- **Dividend Fetching**: Handled by either `ctx.api.market.fetchDividends(symbol)` or `ctx.api.fetchDividends(symbol)`, pointing to Wealthfolio's internal Yahoo Finance integration.

## Dividend Logic & Data Flow
- **Holding Ledger**: Business logic in `src/dividendLogic.ts`. Scans `BUY` and `SELL` activities to build a per-account, per-symbol lot ledger.
- **Eligibility**: Ex-dividend eligibility requires the transaction date to be strictly *before* the dividend's ex-date (`lot.date < targetDate`).
- **Korean Stock Handling (.KS)**: Found in `src/addon.tsx`. If a symbol matches `/^\d{4,6}[A-Z0-9]{0,2}$/`, it appends `.KS` to query Yahoo Finance. Currency is set to `KRW`.
- **Tax Calculation**: 
  - Non-exempt KRW: 15.4% tax, truncated under 10 won.
  - Non-exempt other: 15.0% tax.
  - Exempt: 0 tax.
- **Deduplication**: Prevent double imports using a key formatted as `symbol|accountId|YYYY-MM-DD`.
