# Wealthfolio Dividend Assistant Addon

This project is a [Wealthfolio](https://wealthfolio.app) addon that automatically detects and imports missing dividend entries based on a user's stock holdings and transaction history.

## Project Overview

- **Core Functionality**: Scans portfolio activities (BUY/SELL) to determine holdings on ex-dividend dates, fetches dividend data from Yahoo Finance, and identifies missing DIVIDEND entries.
- **Technologies**:
    - **Frontend**: React 19, TypeScript, Vite
    - **UI**: @wealthfolio/ui (Tailwind-based components)
    - **Data Fetching**: @tanstack/react-query
    - **Addon SDK**: @wealthfolio/addon-sdk (v3.2.0)
- **Architecture**:
    - `manifest.json`: Defines addon metadata, entry points, and required permissions.
    - `src/addon.tsx`: Main entry point, handles UI integration and sidebar registration.
    - `src/dividendLogic.ts`: Contains the business logic for calculating holdings and identifying missing dividends.

## Building and Running

The project uses `pnpm` as its package manager.

| Task | Command | Description |
| :--- | :--- | :--- |
| **Install** | `pnpm install` | Install all dependencies. |
| **Build** | `pnpm build` | Build the project for production into the `dist/` directory. |
| **Dev (Watch)**| `pnpm dev` | Build and watch for changes. |
| **Dev Server** | `pnpm dev:server`| Starts the `wealthfolio` development server. |
| **Bundle** | `pnpm bundle` | Cleans, builds, and packages the addon into a ZIP file in `dist/`. |
| **Lint** | `pnpm lint` | Runs TypeScript type checking (`tsc --noEmit`). |

## Development Conventions

- **Addon Entry Point**: The `enable(ctx: AddonContext)` function in `src/addon.tsx` is the primary entry point. It registers sidebar items and routes.
- **Permissions**: All required API permissions must be declared in `manifest.json`. Currently uses `accounts`, `activities`, `market`, and `ui` (sidebar/router) permissions.
- **Dividend Logic**:
    - Uses a "lot ledger" approach to calculate share holdings on a specific date.
    - Ex-dividend eligibility requires holding shares *before* the ex-date.
    - Supports Korean stocks by appending `.KS` suffix and using `KRW` currency.
- **UI Standards**:
    - Uses `@wealthfolio/ui` components for consistency with the main app.
    - Uses Lucide icons via `lucide-react`.
    - Implements responsive design with Tailwind CSS.
- **Data Integrity**:
    - Uses `ctx.api.activities.checkImport` and `ctx.api.activities.import` for safe activity creation.
    - Deduplicates dividends using a `symbol|accountId|date` key.

## Key Files

- `manifest.json`: Addon configuration and permissions.
- `src/addon.tsx`: UI and integration logic.
- `src/dividendLogic.ts`: Holding calculations and missing dividend detection.
- `vite.config.ts`: Build configuration using `@vitejs/plugin-react`.
