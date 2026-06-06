import { Alert, AlertType } from '../types';

export type DashboardTrendRange = 'day' | 'week' | 'month';

export const DASHBOARD_RANGE_OPTIONS = [
  { key: 'day' as const, label: '24小时' },
  { key: 'week' as const, label: '7天' },
  { key: 'month' as const, label: '30天' },
];

export function buildDashboardTrend(trendDataRaw?: { labels: string[]; data: Record<string, number[]> }) {
  if (!trendDataRaw?.labels) return { trendData: [], trendKeys: [] as string[] };
  const keys = Object.keys(trendDataRaw.data);
  return {
    trendKeys: keys,
    trendData: trendDataRaw.labels.map((label, index) => {
      const point: Record<string, string | number> = { name: label };
      for (const key of keys) point[key] = trendDataRaw.data[key][index] ?? 0;
      return point;
    }),
  };
}

export function buildBehaviorCounts(alerts: Alert[]) {
  const base: Record<string, number> = { 打架: 0, 跌倒: 0, 离岗: 0, 人员聚集: 0 };
  const keyMap: Record<string, string> = {
    打架: '打架',
    跌倒: '跌倒',
    离岗: '离岗',
    人员聚集: '人员聚集',
    fight: '打架',
    fall: '跌倒',
    absent: '离岗',
    gathering: '人员聚集',
  };
  for (const alert of alerts) {
    const key = keyMap[alert.type] ?? alert.type;
    base[key] = (base[key] ?? 0) + 1;
  }
  return base;
}

export function buildDistributionData(trendData: Array<Record<string, string | number>>, trendKeys: string[], palette: Record<string, string>) {
  const totals: Record<string, number> = {};
  for (const point of trendData) {
    for (const key of trendKeys) {
      totals[key] = (totals[key] ?? 0) + Number(point[key] ?? 0);
    }
  }
  return [
    { name: '跌倒', value: totals['跌倒'] ?? 0, color: palette['跌倒'] },
    { name: '打架', value: totals['打架'] ?? 0, color: palette['打架'] },
    { name: '离岗', value: totals['离岗'] ?? 0, color: palette['离岗'] },
    { name: '人员聚集', value: totals['人员聚集'] ?? 0, color: palette['人员聚集'] },
  ];
}

export function sumDistributionValues(distribution: Array<{ value: number }>) {
  return distribution.reduce((sum, item) => sum + item.value, 0);
}

export function selectRecentAlerts(alerts: Alert[], limit = 10) {
  return alerts.filter(alert => alert.snapshotUrl).slice(0, limit);
}
