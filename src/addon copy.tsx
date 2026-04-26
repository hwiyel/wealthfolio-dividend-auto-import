/**
 * addon.tsx — Dividend Assistant
 *
 * UI flow:
 *   Settings bar (account filter, date range, date preference)
 *   → "Scan" button
 *   → Table of missing dividends with per-row checkbox
 *   → "Log Selected" button → ctx.api.activities.saveMany()
 */

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddonContext, Activity } from '@wealthfolio/addon-sdk';
import { CircleDollarSign } from 'lucide-react';

import {
  computeMissingDividends,
  toActivityPayload,
  type MissingDividend,
  type DividendEvent,
} from './dividendLogic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function oneYearAgoStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function fmt(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ count }: { count: number }) {
  if (count === 0)
    return (
      <span style={styles.badgeGreen}>All caught up ✓</span>
    );
  return <span style={styles.badgeAmber}>{count} missing</span>;
}

function EmptyState({ scanned }: { scanned: boolean }) {
  return (
    <div style={styles.emptyState}>
      {scanned ? (
        <>
          <div style={styles.emptyIcon}>✓</div>
          <div style={styles.emptyTitle}>No missing dividends found</div>
          <div style={styles.emptyDesc}>
            All ex-dividend dates in this range are already recorded.
          </div>
        </>
      ) : (
        <>
          <div style={styles.emptyIcon}>⟳</div>
          <div style={styles.emptyTitle}>Ready to scan</div>
          <div style={styles.emptyDesc}>
            Set your filters and click <strong>Scan</strong> to detect unrecorded dividends.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DividendAssistantPage({ ctx }: { ctx: AddonContext }) {
  const queryClient = useQueryClient();

  // ── Filter state ──
  const [fromDate, setFromDate] = useState(oneYearAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [usePaymentDate, setUsePaymentDate] = useState(false);

  // ── Scan / result state ──
  const [missing, setMissing] = useState<MissingDividend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // ── Load accounts ──
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => ctx.api.accounts.getAll(),
  });

  // ── Scan logic ──
  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    setMissing([]);
    setSelected(new Set());

    try {
      // 1. Load all activities
      const allActivities: Activity[] = await ctx.api.activities.getAll();

      // 2. Find unique symbols from BUY/SELL in the selected account(s)
      const targetAccounts =
        selectedAccountId === 'ALL'
          ? accounts
          : accounts.filter((a) => a.id === selectedAccountId);

      const targetIds = new Set(targetAccounts.map((a) => a.id));
      const symbols = [
        ...new Set(
          allActivities
            .filter(
              (a) =>
                targetIds.has(a.accountId) &&
                (a.activityType === 'BUY' || a.activityType === 'SELL') &&
                a.symbol
            )
            .map((a) => a.symbol!)
        ),
      ];

      if (symbols.length === 0) {
        setMissing([]);
        setScanned(true);
        return;
      }

      // 3. Fetch dividend calendars for each symbol
      //    ctx.api.market.getDividends(symbol, from, to) → DividendEvent[]
      //    This uses Wealthfolio's built-in Yahoo Finance endpoint.
      const dividendsBySymbol = new Map<string, DividendEvent[]>();

      await Promise.allSettled(
        symbols.map(async (symbol) => {
          try {
            // The SDK exposes this after the Yahoo dividends endpoint was added
            const events = await (ctx.api.market as any).getDividends(
              symbol,
              fromDate,
              toDate
            );
            if (Array.isArray(events) && events.length > 0) {
              dividendsBySymbol.set(symbol, events as DividendEvent[]);
            }
          } catch {
            // Symbol may not have dividend data — skip silently
          }
        })
      );

      // 4. Compute missing
      const results = computeMissingDividends(
        allActivities,
        targetAccounts.map((a) => ({ id: a.id, name: a.name })),
        dividendsBySymbol,
        fromDate,
        toDate
      );

      setMissing(results);
      // Pre-select all
      setSelected(new Set(results.map((r) => r.key)));
      setScanned(true);
    } catch (err: any) {
      setScanError(err?.message ?? 'Unknown error during scan');
    } finally {
      setScanning(false);
    }
  }, [accounts, selectedAccountId, fromDate, toDate, ctx]);

  // ── Log selected dividends ──
  const logMutation = useMutation({
    mutationFn: async (toLog: MissingDividend[]) => {
      const payloads = toLog.map((d) =>
        toActivityPayload(d, usePaymentDate)
      );
      return ctx.api.activities.saveMany(payloads as Activity[]);
    },
    onSuccess: () => {
      ctx.api.logger.info('Dividend Assistant: activities saved');
      // Invalidate activities cache so the Activities page reflects changes
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      // Remove logged items from the list
      setMissing((prev) => prev.filter((d) => !selected.has(d.key)));
      setSelected(new Set());
    },
    onError: (err: any) => {
      setScanError(err?.message ?? 'Failed to save activities');
    },
  });

  const handleLogSelected = () => {
    const toLog = missing.filter((d) => selected.has(d.key));
    if (toLog.length === 0) return;
    logMutation.mutate(toLog);
  };

  // ── Row selection helpers ──
  const toggleRow = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === missing.length) setSelected(new Set());
    else setSelected(new Set(missing.map((d) => d.key)));
  };

  const selectedTotal = missing
    .filter((d) => selected.has(d.key))
    .reduce((sum, d) => sum + d.totalAmount, 0);

  // ── Render ──
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dividend Assistant</h1>
          <p style={styles.subtitle}>
            Detect and log missing dividend income based on your holdings.
          </p>
        </div>
        {scanned && <StatusBadge count={missing.length} />}
      </div>

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Account</label>
          <select
            style={styles.select}
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            <option value="ALL">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>From</label>
          <input
            type="date"
            style={styles.input}
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>To</label>
          <input
            type="date"
            style={styles.input}
            value={toDate}
            min={fromDate}
            max={todayStr()}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <div style={{ ...styles.filterGroup, alignSelf: 'flex-end' }}>
          <label style={styles.labelCheck}>
            <input
              type="checkbox"
              checked={usePaymentDate}
              onChange={(e) => setUsePaymentDate(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Use payment date
          </label>
        </div>

        <button
          style={{
            ...styles.btnPrimary,
            alignSelf: 'flex-end',
            opacity: scanning ? 0.7 : 1,
          }}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Error */}
      {scanError && (
        <div style={styles.errorBanner}>
          <strong>Error:</strong> {scanError}
        </div>
      )}

      {/* Results table or empty state */}
      {missing.length === 0 ? (
        <EmptyState scanned={scanned} />
      ) : (
        <>
          {/* Bulk action bar */}
          <div style={styles.actionBar}>
            <span style={styles.actionCount}>
              {selected.size} of {missing.length} selected
              {selected.size > 0 && (
                <span style={styles.actionTotal}>
                  {' '}— total approx.{' '}
                  {/* We can't sum across currencies accurately here, warn user */}
                  {missing
                    .filter((d) => selected.has(d.key))
                    .map((d) => fmt(d.totalAmount, d.currency))
                    .join(' + ')}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.btnSecondary} onClick={toggleAll}>
                {selected.size === missing.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                style={{
                  ...styles.btnPrimary,
                  opacity: selected.size === 0 || logMutation.isPending ? 0.6 : 1,
                }}
                onClick={handleLogSelected}
                disabled={selected.size === 0 || logMutation.isPending}
              >
                {logMutation.isPending
                  ? 'Logging…'
                  : `Log ${selected.size} dividend${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === missing.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th style={styles.th}>Symbol</th>
                  <th style={styles.th}>Account</th>
                  <th style={styles.th}>Ex-date</th>
                  <th style={styles.th}>Payment date</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Shares</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Per share</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((d) => (
                  <tr
                    key={d.key}
                    style={{
                      ...styles.tr,
                      background: selected.has(d.key)
                        ? 'var(--color-background-info)'
                        : undefined,
                    }}
                    onClick={() => toggleRow(d.key)}
                  >
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selected.has(d.key)}
                        onChange={() => toggleRow(d.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{d.symbol}</td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)' }}>
                      {d.accountName}
                    </td>
                    <td style={styles.td}>{fmtDate(d.exDate)}</td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)' }}>
                      {d.paymentDate ? fmtDate(d.paymentDate) : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {d.sharesHeld}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {fmt(d.amountPerShare, d.currency)}
                    </td>
                    <td
                      style={{
                        ...styles.td,
                        textAlign: 'right',
                        fontWeight: 500,
                        color: 'var(--color-text-success)',
                      }}
                    >
                      {fmt(d.totalAmount, d.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Success feedback */}
          {logMutation.isSuccess && (
            <div style={styles.successBanner}>
              Dividends logged successfully. Portfolio is being recalculated.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 32px',
    maxWidth: 1100,
    margin: '0 auto',
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 500,
    margin: 0,
    color: 'var(--color-text-primary)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: '4px 0 0',
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    padding: '16px 20px',
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    marginBottom: 20,
    border: '0.5px solid var(--color-border-tertiary)',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  labelCheck: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    paddingBottom: 2,
  },
  select: {
    fontSize: 13,
    minWidth: 160,
  },
  input: {
    fontSize: 13,
    minWidth: 130,
  },
  btnPrimary: {
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 20px',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    background: 'var(--color-text-primary)',
    color: 'var(--color-background-primary)',
    border: 'none',
    transition: 'opacity 0.15s',
  },
  btnSecondary: {
    fontSize: 13,
    padding: '7px 16px',
    borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  actionCount: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  actionTotal: {
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  tableWrap: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '10px 14px',
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    textAlign: 'left',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  td: {
    padding: '11px 14px',
    color: 'var(--color-text-primary)',
  },
  badgeGreen: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 99,
    background: 'var(--color-background-success)',
    color: 'var(--color-text-success)',
  },
  badgeAmber: {
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 99,
    background: 'var(--color-background-warning)',
    color: 'var(--color-text-warning)',
  },
  errorBanner: {
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-danger)',
    color: 'var(--color-text-danger)',
    fontSize: 13,
    marginBottom: 16,
    border: '0.5px solid var(--color-border-danger)',
  },
  successBanner: {
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-success)',
    color: 'var(--color-text-success)',
    fontSize: 13,
    marginTop: 16,
    border: '0.5px solid var(--color-border-success)',
  },
  emptyState: {
    padding: '64px 32px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: 340,
    margin: '0 auto',
  },
};

// ─── Addon entry point ────────────────────────────────────────────────────────

export default function enable(ctx: AddonContext) {
  ctx.api.logger.info('Dividend Assistant: enabling');

  const sidebarItem = ctx.sidebar.addItem({
    id: 'dividend-assistant',
    label: 'Dividends',
    icon: <CircleDollarSign className="h-5 w-5" />,
    route: '/addons/dividend-assistant',
    order: 50,
  });

  ctx.router.add({
    path: '/addons/dividend-assistant',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => <DividendAssistantPage ctx={ctx} />,
      })
    ),
  });

  return {
    disable() {
      sidebarItem.remove();
      ctx.api.logger.info('Dividend Assistant: disabled');
    },
  };
}
