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

export function utcToKstDate(utcDate: string): string {
  const dt = new Date(utcDate);
  if (isNaN(dt.getTime())) {
    return utcDate.slice(0, 10);
  }
  const kstDate = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().slice(0, 10);
}

export function timestampToKstDate(timestamp: number): string {
  const dt = new Date(timestamp * 1000);
  if (isNaN(dt.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const kstDate = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().slice(0, 10);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DividendEvent {
  /** ex-dividend date (YYYY-MM-DD) */
  exDate: string;
  /** dividend per share in the security's native currency */
  amount: number;
  currency: string;
}

export interface MissingDividend {
  symbol: string;
  symbolName?: string;
  accountId: string;
  accountName: string;
  exDate: string;
  sharesHeld: number;
  amountPerShare: number;
  totalAmount: number;
  fee: number;
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

function getActivityName(activity: Activity): string | undefined {
  return (activity as any).assetName || (activity as any).name;
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
    ledger.get(symbol)!.push({ date: utcToKstDate((a as any).date), shares: delta });
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
      const date = utcToKstDate((a as any).date);
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
  /** Set of account IDs that are tax-exempt */
  taxExemptAccountIds?: Set<string>
): MissingDividend[] {
  const existingKeys = buildExistingDividendKeys(allActivities);
  const results: MissingDividend[] = [];

  // Map symbols to names from activities
  const symbolNames = new Map<string, string>();
  for (const a of allActivities) {
    const symbol = getActivitySymbol(a);
    const name = getActivityName(a);
    if (symbol && name) {
      symbolNames.set(symbol, name);
    }
  }

  for (const account of accounts) {
    const ledger = buildLotLedger(allActivities, account.id);

    for (const [symbol, events] of dividendsBySymbol.entries()) {
      const lots = ledger.get(symbol);
      if (!lots || lots.length === 0) continue; // never held this in this account

      for (const event of events) {
        const shares = sharesHeldAt(lots, event.exDate);
        if (shares <= 0) continue; // didn't hold on ex-date

        const dedupeKey = `${symbol}|${account.id}|${event.exDate}`;

        if (existingKeys.has(dedupeKey)) continue; // already logged

        const totalAmount = parseFloat((shares * event.amount).toFixed(4));
        
        // Check if this account is tax-exempt
        const isTaxExempt = taxExemptAccountIds?.has(account.id);
        
        let fee: number;
        if (isTaxExempt) {
          // Tax-exempt account: no tax
          fee = 0;
        } else {
          // Simple estimated tax: 15.4% for KRW, 15% for others
          const taxRate = event.currency === 'KRW' ? 0.154 : 0.15;
          fee = totalAmount * taxRate;
          
          if (event.currency === 'KRW') {
            // Truncate under 10 won (Korean Tax Law)
            fee = Math.floor(fee / 10) * 10;
          } else {
            fee = parseFloat(fee.toFixed(2));
          }
        }

        results.push({
          symbol,
          symbolName: symbolNames.get(symbol),
          accountId: account.id,
          accountName: account.name,
          exDate: event.exDate,
          sharesHeld: shares,
          amountPerShare: event.amount,
          totalAmount,
          fee,
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
  dividend: MissingDividend
): any {
  return {
    accountId: dividend.accountId,
    activityType: 'DIVIDEND',
    symbol: dividend.symbol,
    date: dividend.exDate,
    quantity: dividend.sharesHeld,
    unitPrice: dividend.amountPerShare,
    currency: dividend.currency,
    fee: dividend.fee,
    amount: dividend.totalAmount,
    isDraft: false,
    isValid: true,
  };
}
