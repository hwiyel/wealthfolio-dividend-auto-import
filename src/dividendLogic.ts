/**
 * dividendLogic.ts
 *
 * Core logic:
 *  1. Build a per-symbol holding ledger from BUY/SELL activities
 *  2. Fetch ex-dividend events from Wealthfolio's Yahoo endpoint
 *  3. For each ex-date, compute how many shares were held at that moment
 *  4. Cross-check against existing DIVIDEND activities → emit only missing ones
 */

import type { Activity } from '@wealthfolio/addon-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DividendEvent {
  /** ex-dividend date (YYYY-MM-DD) */
  exDate: string;
  /** payment date, if available */
  paymentDate?: string;
  /** dividend per share in the security's native currency */
  amount: number;
  currency: string;
}

export interface MissingDividend {
  symbol: string;
  accountId: string;
  accountName: string;
  exDate: string;
  paymentDate?: string;
  sharesHeld: number;
  amountPerShare: number;
  totalAmount: number;
  currency: string;
  /** unique key used for deduplication in UI state */
  key: string;
}

// ─── Holding ledger ───────────────────────────────────────────────────────────

interface LotEntry {
  date: string; // ISO date string of the transaction
  shares: number; // positive = bought, negative = sold
}

function getActivitySymbol(activity: Activity): string | undefined {
  return (activity as any).assetSymbol || (activity as any).symbol;
}

function getActivityQuantity(activity: Activity): number | undefined {
  const raw =
    (activity as any).quantity ??
    (activity as any).shares ??
    (activity as any).units;

  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : undefined;
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

/**
 * Returns a map of symbol → sorted array of lot entries derived from BUY/SELL
 * activities for a specific account.
 */
function buildLotLedger(
  activities: Activity[],
  accountId: string
): Map<string, LotEntry[]> {
  const ledger = new Map<string, LotEntry[]>();

  const relevant = activities
    .filter(
      (a) =>
        (a as any).accountId === accountId &&
        ((a as any).activityType === 'BUY' || (a as any).activityType === 'SELL') &&
        getActivitySymbol(a)
    )
    .sort((a, b) => (a as any).date.localeCompare((b as any).date));

  for (const a of relevant) {
    const symbol = getActivitySymbol(a);
    const quantity = getActivityQuantity(a);
    if (!symbol || quantity === undefined) continue;

    const delta = (a as any).activityType === 'BUY' ? quantity : -quantity;
    if (!ledger.has(symbol)) ledger.set(symbol, []);
    ledger.get(symbol)!.push({ date: (a as any).date.slice(0, 10), shares: delta });
  }

  return ledger;
}

/**
 * Given a sorted lot ledger for one symbol, returns the number of shares held
 * at the START of the given date (i.e. before that day's transactions).
 *
 * Ex-dividend eligibility: you must hold the stock BEFORE the ex-date opens.
 */
function sharesHeldAt(lots: LotEntry[], targetDate: string): number {
  let total = 0;
  for (const lot of lots) {
    // Only count transactions that settled BEFORE the ex-date
    if (lot.date < targetDate) {
      total += lot.shares;
    }
  }
  return Math.max(0, total); // can't hold negative shares
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Builds a Set of "symbol|accountId|YYYY-MM-DD" keys for every DIVIDEND
 * activity that already exists.  Used to skip events already logged.
 */
function buildExistingDividendKeys(activities: Activity[]): Set<string> {
  const keys = new Set<string>();
  for (const a of activities) {
    const symbol = getActivitySymbol(a);
    if ((a as any).activityType === 'DIVIDEND' && symbol) {
      const date = (a as any).date.slice(0, 10);
      keys.add(`${symbol}|${(a as any).accountId}|${date}`);
    }
  }
  return keys;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface AccountInfo {
  id: string;
  name: string;
}

/**
 * Given all activities and dividend events per symbol, returns the list of
 * dividends that:
 *  - The user was entitled to (held shares on ex-date)
 *  - Have NOT yet been logged as a DIVIDEND activity
 */
export function computeMissingDividends(
  allActivities: Activity[],
  accounts: AccountInfo[],
  /** Map of symbol → DividendEvent[] fetched from market API */
  dividendsBySymbol: Map<string, DividendEvent[]>,
  /** Restrict to events on or after this date, e.g. "2020-01-01" */
  fromDate: string,
  /** Restrict to events up to and including today */
  toDate: string
): MissingDividend[] {
  const existingKeys = buildExistingDividendKeys(allActivities);
  const results: MissingDividend[] = [];

  for (const account of accounts) {
    const ledger = buildLotLedger(allActivities, account.id);

    for (const [symbol, events] of dividendsBySymbol.entries()) {
      const lots = ledger.get(symbol);
      if (!lots || lots.length === 0) continue; // never held this in this account

      for (const event of events) {
        if (event.exDate < fromDate || event.exDate > toDate) continue;

        const shares = sharesHeldAt(lots, event.exDate);
        if (shares <= 0) continue; // didn't hold on ex-date

        // Use ex-date as the activity date (most common convention)
        // Some users prefer payment date — we surface both in the UI
        const activityDate = event.paymentDate ?? event.exDate;
        const dedupeKey = `${symbol}|${account.id}|${event.exDate}`;

        if (existingKeys.has(dedupeKey)) continue; // already logged

        results.push({
          symbol,
          accountId: account.id,
          accountName: account.name,
          exDate: event.exDate,
          paymentDate: event.paymentDate,
          sharesHeld: shares,
          amountPerShare: event.amount,
          totalAmount: parseFloat((shares * event.amount).toFixed(4)),
          currency: event.currency,
          key: dedupeKey,
        });
      }
    }
  }

  // Most recent first
  return results.sort((a, b) => b.exDate.localeCompare(a.exDate));
}

/**
 * Converts MissingDividend entries into the Activity shape that
 * ctx.api.activities.saveMany() expects.
 *
 * Wealthfolio DIVIDEND activity:
 *   quantity  = shares held
 *   unitPrice = dividend per share
 *   total     = quantity * unitPrice  (computed by Wealthfolio)
 */
export function toActivityPayload(
  dividend: MissingDividend,
  usePaymentDate: boolean
): any {
  return {
    accountId: dividend.accountId,
    activityType: 'DIVIDEND',
    symbol: dividend.symbol,
    // Use payment date if available and user prefers it, else fall back to ex-date
    date: usePaymentDate && dividend.paymentDate
      ? dividend.paymentDate
      : dividend.exDate,
    quantity: dividend.sharesHeld,
    unitPrice: dividend.amountPerShare,
    currency: dividend.currency,
    fee: 0,
    amount: dividend.totalAmount,
    isDraft: false,
    isValid: true,
  };
}
