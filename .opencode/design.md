# Dividend Assistant - Ignore Feature Design (v3.0.1)

## Objective
Allow users to exclude specific dividend items from the scan results so they do not repeatedly show up as "missing" if the user intentionally does not want to import them.

## Technical Design

### 1. Storage (State Persistence)
- **Mechanism**: `localStorage`
- **Key**: `dividend-assistant-ignored-items`
- **Data Structure**: Array/Set of string keys.
- **Key Format**: `symbol|accountId|YYYY-MM-DD` (matching the existing deduplication key pattern used in the app).

### 2. Main UI Integration (`src/pages/Index.tsx` / `src/addon.tsx`)
- **Filtering**: After scanning, filter the detected missing dividends against the `localStorage` ignored list.
- **Action**: Add an "Ignore" button (e.g., EyeOff icon) to each row in the results table.
- **Action Handler**: Clicking "Ignore" adds the item's key to `localStorage` and immediately removes it from the current view.

### 3. Settings UI Integration (`src/pages/Settings.tsx`)
- **Management Section**: A new card titled "Ignored Dividends".
- **List**: Display all currently ignored items (showing Symbol, Date, and potentially Account ID if resolvable).
- **Restore Action**: A "Restore" button next to each item to remove it from the ignored list.

## Development Progress
Check `progress.md` for real-time task tracking.
