import React from 'react';
import {
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  Icons,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@wealthfolio/ui';
import { type PerformanceDataPoint } from '../performance-calculator';

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
  currency: string;
}

export function PerformanceChart({ data, currency }: PerformanceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const chartConfig = {
    totalReturn: {
      label: 'Total Return',
      color: '#2563eb',
      description: 'The overall performance of your account, including price changes and dividends.',
    },
    stockGain: {
      label: 'Stock Gain',
      color: '#10b981',
      description: 'Performance driven purely by asset price appreciation, excluding dividends.',
    },
    dividends: {
      label: 'Dividends',
      color: '#f59e0b',
      description: 'The total cumulative dividend income received in this account.',
    },
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="w-full h-[400px] min-h-[400px]">
        <ChartContainer 
          config={chartConfig} 
          className="w-full h-full"
          style={{ minWidth: 0, minHeight: 0 }}
        >
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartConfig.totalReturn.color} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={chartConfig.totalReturn.color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={30}
              tickFormatter={(value: string) => {
                const date = new Date(value);
                return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tickFormatter={formatCurrency}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                  }}
                  formatter={(value, name) => {
                    const config = chartConfig[name as keyof typeof chartConfig];
                    if (!config) return null;
                    return (
                      <div className="flex items-center justify-between gap-4 w-full min-w-[150px]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                          <span className="text-muted-foreground">{config.label}</span>
                        </div>
                        <span className="font-mono font-medium">{formatCurrency(Number(value))}</span>
                      </div>
                    );
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="totalReturn"
              fill="url(#colorTotal)"
              stroke={chartConfig.totalReturn.color}
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="stockGain"
              stroke={chartConfig.stockGain.color}
              strokeWidth={2}
              dot={data.length < 50}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="dividends"
              stroke={chartConfig.dividends.color}
              strokeWidth={2}
              dot={data.length < 50}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-6">
        <TooltipProvider>
          {Object.entries(chartConfig).map(([key, config]) => (
            <div key={key} className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span className="text-sm font-semibold">{config.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Icons.Info className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[250px] text-xs">
                    {config.description}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {config.description}
              </p>
            </div>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
