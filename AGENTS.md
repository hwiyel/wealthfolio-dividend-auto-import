# AGENTS.md

## High-Signal Guidance

### Environment & Commands
- **Package Manager**: **`pnpm` is mandatory**. Ignore `npm` mentions in the README.
- **Verification**: Run `pnpm type-check` for linting/typing. 
- **Tests**: Currently, **no tests exist** in this repository.
- **Main App Dev Server**: To test the addon within the actual app, navigate to `/Users/hwiyel/git/wealthfolio` and run `VITE_ENABLE_ADDON_DEV_MODE=true pnpm tauri dev`.

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

### AI Token Optimization (RTK)
- **Token Reduction**: This repository uses [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) to reduce LLM token consumption on CLI outputs.
- **Setup**: If RTK is not yet installed in the environment, run `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh` and `rtk init --agent antigravity`.
- **Usage**: For heavy shell commands, use the `rtk` prefix to get compact output (e.g., `rtk pnpm list`, `rtk git diff`, `rtk find ...`) instead of raw shell commands, which saves context window space.

### Behavioral Guidelines (Karpathy Style)
- **Think Before Coding**: Don't assume or hide confusion. State assumptions explicitly. Surface tradeoffs and if multiple interpretations exist, present them instead of picking silently.
- **Simplicity First**: Write the minimum code that solves the problem. No speculative features, over-abstractions, or unrequested flexibility. If you write 200 lines and it could be 50, rewrite it.
- **Surgical Changes**: Touch only what you must. Clean up only your own mess (remove unused code caused by your changes). Match existing style. Don't "improve" adjacent code or refactor things that aren't broken. Every changed line should trace directly to the user's request.
- **Goal-Driven Execution**: Define clear success criteria before acting. Transform tasks into verifiable goals. State a brief plan for multi-step tasks and loop independently until verified.
