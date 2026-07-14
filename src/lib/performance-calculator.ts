import type { AddonContext, ActivityDetails, PerformanceMetrics } from '@wealthfolio/addon-sdk';

export interface PerformanceDataPoint {
  date: string;
  stockGain: number;
  dividends: number;
  totalReturn: number;
}

/**
 * Calculates historical total return by combining stock performance and cumulative dividends.
 */
export async function getHistoricalTotalReturn(
  ctx: AddonContext,
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<PerformanceDataPoint[]> {
  // 1. Fetch performance history from SDK
  // The SDK performance.calculateHistory usually provides market value based returns
  const performance: PerformanceMetrics = await ctx.api.performance.calculateHistory(
    'account',
    accountId,
    startDate || '',
    endDate || ''
  );

  // 2. Fetch all activities to extract dividends
  const allActivities: ActivityDetails[] = await ctx.api.activities.getAll(
    accountId === 'ALL' ? undefined : accountId
  );

  const dividends = allActivities.filter((a) => a.activityType === 'DIVIDEND');

  // 3. Create a map of cumulative dividends by date
  const dividendMap = new Map<string, number>();
  let cumDiv = 0;
  
  // Sort dividends by date
  const sortedDividends = [...dividends].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const div of sortedDividends) {
    const dateStr = div.date.toISOString().split('T')[0];
    const amount = parseFloat(div.amount || '0');
    const fee = parseFloat(div.fee || '0');
    cumDiv += (amount - fee);
    dividendMap.set(dateStr, cumDiv);
  }

  // 4. Merge performance returns with dividends
  // We need to fill in cumulative dividends for every date in performance returns
  let lastCumDiv = 0;
  const merged: PerformanceDataPoint[] = performance.series.map((ret: { date: string; value: number }) => {
    const dateStr = ret.date;
    // Update lastCumDiv if there's an entry for this date
    if (dividendMap.has(dateStr)) {
      lastCumDiv = dividendMap.get(dateStr)!;
    }
    
    // In Wealthfolio, 'value' in performance returns is typically the Gain/Loss amount
    // including realized and unrealized gains, but sometimes excluding dividends 
    // depending on the tracking mode. To be safe and meet the user's "Stock + Dividend"
    // requirement, we treat ret.value as stock gain and add our calculated dividends.
    const stockGain = ret.value;
    const totalReturn = stockGain + lastCumDiv;

    return {
      date: dateStr,
      stockGain,
      dividends: lastCumDiv,
      totalReturn,
    };
  });

  return merged;
}
