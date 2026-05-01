# AGENTS.md

## High-Signal Guidance

### Environment & Commands
- **Package Manager**: **`pnpm` is mandatory**. Ignore `npm` mentions in the README.
- **Verification**: Run `pnpm type-check` for linting/typing. 
- **Tests**: Currently, **no tests exist** in this repository.

### Domain Logic
- **Symbol Logic (.KS Suffix)**: For Korean stocks, append `.KS` if the symbol matches `/^\d{4,6}[A-Z0-9]{0,2}$/`.
- **Tax Calculation**:
  - **KRW**: 15.4% tax, truncated (floor) under 10 won.
  - **Other Currencies**: Flat 15.0% tax.
  - **Exempt**: 0% tax.
- **Dividend Eligibility**: Eligibility is determined by holding the stock **before** the ex-dividend date (`transactionDate < exDate`).

### Implementation Patterns
- **Safe Import Flow**: Always use the two-step verification process for importing activities:
  1. `ctx.api.activities.checkImport(payloads)`
  2. `ctx.api.activities.import(checkedResults)`
- **Deduplication**: Use a composite key format `symbol|accountId|YYYY-MM-DD` to prevent duplicate dividend entries.
- **Entry Point**: `src/addon.tsx` (via `enable(ctx)`).
