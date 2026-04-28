/**
 * addon.tsx — Dividend Assistant
 *
 * UI flow:
 *   Settings bar (account filter, date range)
 *   → "Scan" button
 *   → Table of missing dividends with per-row checkbox
 *   → "Log Selected" button → ctx.api.activities.saveMany()
 */

import React, { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddonContext, Activity } from '@wealthfolio/addon-sdk';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyPlaceholder,
  Icons,
  Input,
  Page,
  PageContent,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@wealthfolio/ui';

import {
  computeMissingDividends,
  toActivityPayload,
  type MissingDividend,
  type DividendEvent,
} from './dividendLogic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string, isFee = false) {
  const isKRW = currency === 'KRW';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: isKRW && !isFee ? 0 : 2,
    maximumFractionDigits: isKRW && !isFee ? 0 : 2,
  }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DividendAssistantPage({ ctx }: { ctx: AddonContext }) {
  const queryClient = useQueryClient();

  // ── Filter state ──
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');

  // ── Scan / result state ──
  const [missing, setMissing] = useState<MissingDividend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

      const filteredActivities = allActivities.filter(
        (a) =>
          targetIds.has(a.accountId) &&
          (a.activityType === 'BUY' || a.activityType === 'SELL') &&
          ((a as any).assetSymbol || (a as any).symbol)
      );

      const symbols = [
        ...new Set(
          filteredActivities
            .map((a) => ((a as any).assetSymbol || (a as any).symbol)!)
            .filter(Boolean)
        ),
      ];

      if (symbols.length === 0) {
        setMissing([]);
        setScanned(true);
        return;
      }

      // 3. Fetch dividend calendars for each symbol
      const dividendsBySymbol = new Map<string, DividendEvent[]>();

      await Promise.allSettled(
        symbols.map(async (symbol) => {
          try {
            // Convert Korean stock symbols for Yahoo Finance
            let yahooSymbol = symbol;
            if (/^\d{4,6}[A-Z0-9]{0,2}$/.test(symbol)) {
              // Korean listed products (stocks/ETFs)
              yahooSymbol = `${symbol}.KS`;
            } else if (/^[A-Z]+(\.[A-Z]+)?$/.test(symbol)) {
              // US listed products (stocks/ETFs) - no suffix needed
              yahooSymbol = symbol;
            }

            let events = null;

            // Debug logging
            ctx.api.logger.debug(`[Dividend Assistant] Fetching dividends for ${symbol} (yahooSymbol: ${yahooSymbol})`);
            ctx.api.logger.debug(`[Dividend Assistant] ctx.api.market exists: ${!!ctx.api.market}`);
            if (ctx.api.market) {
              ctx.api.logger.debug(`[Dividend Assistant] fetchDividends exists: ${typeof (ctx.api.market as any).fetchDividends}`);
            }

            // Try different API paths
            if (ctx.api.market && typeof (ctx.api.market as any).fetchDividends === 'function') {
              ctx.api.logger.info(`[Dividend Assistant] Using ctx.api.market.fetchDividends`);
              events = await (ctx.api.market as any).fetchDividends(yahooSymbol);
              ctx.api.logger.debug(`[Dividend Assistant] fetchDividends result:`, events);
            } else if (typeof (ctx.api as any).fetchDividends === 'function') {
              ctx.api.logger.info(`[Dividend Assistant] Using ctx.fetchDividends`);
              events = await (ctx.api as any).fetchDividends(yahooSymbol);
              ctx.api.logger.debug(`[Dividend Assistant] fetchDividends result:`, events);
            } else {
              ctx.api.logger.warn(`[Dividend Assistant] No fetchDividends function found`);
            }

            if (Array.isArray(events) && events.length > 0) {
              // Map the API response to DividendEvent format
              const mappedEvents = events.map((e: any) => {
                // Convert timestamp to YYYY-MM-DD if needed
                let exDate = e.exDate || e.date;
                if (typeof exDate === 'number') {
                  exDate = new Date(exDate * 1000).toISOString().slice(0, 10);
                }

                // Korean stocks should be KRW, others default to USD
                const currency = yahooSymbol.endsWith('.KS') ? 'KRW' : (e.currency || 'USD');

                return {
                  exDate,
                  amount: e.amount || e.dividend,
                  currency,
                };
              });
              dividendsBySymbol.set(symbol, mappedEvents as DividendEvent[]);
            }
          } catch (error) {
            // Log the error with details
            ctx.api.logger.error(`[Dividend Assistant] Error fetching dividends for ${symbol}:`, error);
            console.error(`[Dividend Assistant] Error fetching dividends for ${symbol}:`, error);
          }
        })
      );

      // 4. Compute missing
      const results = computeMissingDividends(
        allActivities,
        targetAccounts.map((a) => ({ id: a.id, name: a.name })),
        dividendsBySymbol
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
  }, [accounts, selectedAccountId, ctx]);

  // ── Log selected dividends ──
  const logMutation = useMutation({
    mutationFn: async (toLog: MissingDividend[]) => {
      const payloads = toLog.map((d) => toActivityPayload(d));

      // Check import first (only activities, no accountId)
      const checked = await (ctx.api.activities as any).checkImport(payloads);

      // Then import
      const imported = await (ctx.api.activities as any).import(checked);

      return imported;
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

  // Group totals by currency for meaningful display
  const selectedTotalsByCurrency = missing
    .filter((d) => selected.has(d.key))
    .reduce((acc, d) => {
      if (!acc[d.currency]) {
        acc[d.currency] = { gross: 0, fee: 0 };
      }
      acc[d.currency].gross += d.totalAmount;
      acc[d.currency].fee += d.fee;
      return acc;
    }, {} as Record<string, { gross: number; fee: number }>);

  const updateFee = (key: string, newFee: string) => {
    const val = parseFloat(newFee.replace(/,/g, ''));
    if (isNaN(val)) return;
    // Round to 2 decimal places
    const roundedVal = parseFloat(val.toFixed(2));
    setMissing((prev) =>
      prev.map((d) => (d.key === key ? { ...d, fee: roundedVal } : d))
    );
  };

  // Filter dividends by search term
  const filteredMissing = missing.filter((d) =>
    d.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.symbolName && d.symbolName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    d.accountName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Render ──
  const header = (
    <PageHeader>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold sm:text-xl">Dividend Assistant</h1>
          {scanned && <StatusBadge count={missing.length} />}
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">
          Detect and log missing dividend income based on your holdings.
        </p>
      </div>
    </PageHeader>
  );

  return (
    <Page>
      {header}
      <PageContent>
        <div className="flex w-full flex-col gap-6">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            {/* Row 1: Scan Settings */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground whitespace-nowrap">
                    Account
                  </label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="h-10 w-[200px]">
                      <SelectValue placeholder="All accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All accounts</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleScan}
                  disabled={scanning}
                  className="h-10"
                  variant={scanned ? "outline" : "default"}
                >
                  {scanning ? (
                    <>
                      <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                      Scanning…
                    </>
                  ) : (
                    <>
                      <Icons.Search className="mr-2 h-4 w-4" />
                      Scan
                    </>
                  )}
                </Button>
              </div>

              {scanned && missing.length > 0 && (
                <div className="text-sm font-medium text-muted-foreground">
                  Found <span className="text-foreground">{missing.length}</span> missing dividends
                </div>
              )}
            </div>

            {/* Row 2: Actions & Filters (Always visible for layout stability) */}
            <div className="flex flex-wrap items-center gap-4 border-t pt-4">
              <div className="w-full max-w-md">
                <div className="relative">
                  <Icons.Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search symbols or accounts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={!scanned || missing.length === 0}
                    className="h-10 pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <div className="text-sm text-muted-foreground mr-1">
                  <span className="font-semibold text-foreground">{selected.size}</span> selected
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleAll} 
                  className="h-9"
                  disabled={!scanned || missing.length === 0}
                >
                  {selected.size === filteredMissing.length && missing.length > 0 ? 'Deselect all' : 'Select all'}
                </Button>
                <Button
                  size="sm"
                  onClick={handleLogSelected}
                  disabled={selected.size === 0 || logMutation.isPending || !scanned}
                  className="h-9"
                >
                  {logMutation.isPending ? (
                    <>
                      <Icons.Loader className="mr-2 h-4 w-4 animate-spin" />
                      Logging…
                    </>
                  ) : (
                    <>
                      <Icons.Check className="mr-2 h-4 w-4" />
                      Log {selected.size} Dividends
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Error */}
          {scanError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <strong>Error:</strong> {scanError}
            </div>
          )}

          {/* Results table or empty state */}
          {missing.length === 0 ? (
            <div className="flex justify-center">
              <div className="w-full max-w-lg">
                <EmptyPlaceholder className="mt-16">
                  <EmptyPlaceholder.Icon name="Search" />
                  <EmptyPlaceholder.Title>
                    {scanned ? 'No Missing Dividends' : 'Ready to Scan'}
                  </EmptyPlaceholder.Title>
                  <EmptyPlaceholder.Description>
                    {scanned
                      ? 'All your dividend income has been logged. Great job!'
                      : 'Select an account, then click Scan to find missing dividend entries.'}
                  </EmptyPlaceholder.Description>
                </EmptyPlaceholder>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Missing Dividends</span>
                  {selected.size > 0 && (
                    <div className="text-sm font-normal text-muted-foreground">
                      <div className="flex flex-col items-end gap-0.5">
                        {Object.entries(selectedTotalsByCurrency).map(([currency, totals]) => (
                          <div key={currency} className="flex gap-3">
                            <span>Gross: <span className="font-medium text-foreground">{fmt(totals.gross, currency)}</span></span>
                            <span>Tax: <span className="font-medium text-foreground">{fmt(totals.fee, currency, true)}</span></span>
                            <span>Net: <span className="font-bold text-green-600 dark:text-green-400">{fmt(totals.gross - totals.fee, currency, true)}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t">
                  <div className="max-h-[600px] overflow-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr className="border-b">
                          <th className="w-12 p-3 text-left">
                            <Checkbox
                              checked={filteredMissing.length > 0 && filteredMissing.every((d) => selected.has(d.key))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  filteredMissing.forEach((d) => setSelected((prev) => new Set([...prev, d.key])));
                                } else {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    filteredMissing.forEach((d) => next.delete(d.key));
                                    return next;
                                  });
                                }
                              }}
                            />
                          </th>
                          <th className="p-3 text-left">Ex-Date</th>
                          <th className="p-3 text-left">Symbol</th>
                          <th className="p-3 text-right">Quantity</th>
                          <th className="p-3 text-right">Per share</th>
                          <th className="p-3 text-right">Amount</th>
                          <th className="p-3 text-right w-[120px]">Fee (Tax)</th>
                          <th className="p-3 text-left">Account</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMissing.map((d) => (
                          <tr
                            key={d.key}
                            className="hover:bg-muted/25 border-b"
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selected.has(d.key)}
                                onCheckedChange={() => toggleRow(d.key)}
                              />
                            </td>
                            <td className="p-3 text-sm">{fmtDate(d.exDate)}</td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className="font-medium">{d.symbol}</span>
                                {d.symbolName && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                    {d.symbolName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-sm text-right">
                              {d.sharesHeld}
                            </td>
                            <td className="p-3 text-sm text-right">
                              {fmt(d.amountPerShare, d.currency)}
                            </td>
                            <td className="p-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                              {fmt(d.totalAmount, d.currency)}
                            </td>
                            <td className="p-3 text-sm text-right">
                              <Input
                                type="text"
                                value={d.fee}
                                onChange={(e) => updateFee(d.key, e.target.value)}
                                className="h-8 w-[100px] ml-auto text-right text-xs"
                              />
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {d.accountName}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredMissing.length === 0 && missing.length > 0 && (
                  <div className="text-muted-foreground py-8 text-center">
                    No dividends match your search
                  </div>
                )}

                {/* Success feedback */}
                {logMutation.isSuccess && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    <div className="flex items-center gap-2">
                      <Icons.Check className="h-5 w-5" />
                      <span className="font-medium">Success!</span>
                    </div>
                    <p className="mt-1 text-sm">
                      Dividends logged successfully. Portfolio is being recalculated.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </Page>
  );
}

// ─── Status badge component ─────────────────────────────────────────────────────

function StatusBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        0 missing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
      {count} missing
    </span>
  );
}

// ─── Addon entry point ────────────────────────────────────────────────────────

export default function enable(ctx: AddonContext) {
  ctx.api.logger.info('Dividend Assistant: enabling');

  const sidebarItem = ctx.sidebar.addItem({
    id: 'dividend-assistant',
    label: 'Dividends',
    icon: <Icons.HandCoins className="h-5 w-5" />,
    route: '/addons/dividend-assistant',
    order: 50,
  });

  // Create our own QueryClient to avoid version compatibility issues
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  ctx.router.add({
    path: '/addons/dividend-assistant',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <QueryClientProvider client={queryClient}>
          <DividendAssistantPage ctx={ctx} />
          </QueryClientProvider>
        ),
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
