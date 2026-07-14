import type { AddonContext, ActivityDetails, PerformanceMetrics } from '@wealthfolio/addon-sdk';

export interface PerformanceDataPoint {
  date: string;
  stockGain: number;
  dividends: number;
  totalReturn: number;
}

export async function getHistoricalTotalReturn(
  ctx: AddonContext,
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<PerformanceDataPoint[]> {
  try {
    ctx.api.logger.debug(`[Performance] Fetching valuations for account: ${accountId}`);
    
    const effectiveStartDate = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

    const sdkAccountId = accountId === 'ALL' ? 'TOTAL' : accountId;

    let valuations: any[] = [];
    try {
      valuations = await ctx.api.portfolio.getHistoricalValuations(
        sdkAccountId,
        effectiveStartDate,
        effectiveEndDate
      );
    } catch (vError) {
      ctx.api.logger.warn(`[Performance] Historical valuations failed, falling back to performance history: ${vError}`);
      
      const perf = await ctx.api.performance.calculateHistory(
        'account',
        sdkAccountId,
        effectiveStartDate,
        effectiveEndDate
      );
      
      if (perf && perf.series && perf.series.length > 0) {
        const totalGain = perf.returns.valueReturn || 0;
        const lastReturn = perf.series[perf.series.length - 1].value || 1;
        
        valuations = perf.series.map((r: { date: string; value: number }) => ({
          valuationDate: r.date,
          totalValueMinusContribution: lastReturn !== 0 ? totalGain * (r.value / lastReturn) : 0,
          isFromPerformance: true
        }));
      }
    }

    ctx.api.logger.debug(`[Performance] Received ${valuations?.length || 0} data points`);

    if (!valuations || valuations.length === 0) {
      return [];
    }

    const allActivities: ActivityDetails[] = await ctx.api.activities.getAll(
      accountId === 'ALL' ? undefined : accountId
    );

    const dividends = allActivities.filter((a) => a.activityType === 'DIVIDEND');

    const dividendMap = new Map<string, number>();
    let cumDiv = 0;
    
    const sortedDividends = [...dividends].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const div of sortedDividends) {
      const dt = new Date(div.date);
      const dateStr = dt.toISOString().split('T')[0];
      const amount = parseFloat(div.amount || '0');
      const fee = parseFloat(div.fee || '0');
      cumDiv += (amount - fee);
      dividendMap.set(dateStr, cumDiv);
    }

    let lastCumDiv = 0;
    const result = valuations.map((v) => {
      const dt = new Date(v.valuationDate);
      const dateStr = dt.toISOString().split('T')[0];
      if (dividendMap.has(dateStr)) {
        lastCumDiv = dividendMap.get(dateStr)!;
      }
      
      const totalReturn = v.isFromPerformance 
        ? v.totalValueMinusContribution 
        : (v.totalValue - v.netContribution);
        
      const stockGain = totalReturn - lastCumDiv;

      return {
        date: dateStr,
        stockGain,
        dividends: lastCumDiv,
        totalReturn,
      };
    });

    return result;
  } catch (error) {
    ctx.api.logger.error(`[Performance] Error calculating total return: ${error}`);
    return [];
  }
}
