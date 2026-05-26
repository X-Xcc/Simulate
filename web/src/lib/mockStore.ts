/**
 * 统一 mock 数据 Store — 所有页面共享同一个数据源
 * 确保 Dashboard、AI告警中心、数据分析等页面的行为计数一致
 */

import { create } from "zustand";
import {
  Camera, Alert, AuditLog, SystemStatus, Settings,
  RegionalStat, StatsSummary, ModelInfo, FpsStats,
  TrendData, StatsCompare,
} from "../types";
import * as mock from "./mockData";
import type { HeatmapZone } from "./mockData";

// ── 类型定义 ────────────────────────────────────────────────────────────────

interface MockStore {
  cameras: Camera[];
  alerts: Alert[];
  statsSummary: StatsSummary;
  statsCompare: StatsCompare;
  trendData: Record<string, TrendData>;
  heatmapData: HeatmapZone[];
  systemStatus: SystemStatus;
  modelInfo: ModelInfo;
  settings: Settings;
  regionalStats: RegionalStat[];
  fpsStats: FpsStats;
  evidenceItems: ReturnType<typeof mock.generateEvidenceItems>;
  evidenceStats: ReturnType<typeof mock.generateEvidenceStats>;
  auditLogs: AuditLog[];
  automationRate: { rate: number };
  auditTrend: Record<string, { labels: string[]; data: number[] }>;

  // 跨页面同步：每次手动触发报警递增，供 Evidence 等页面订阅
  evidenceBump: number;

  // 定时器控制
  _timers: ReturnType<typeof setInterval>[];
  start: () => void;
  stop: () => void;

  // 告警操作
  updateAlertStatus: (id: string, status: Alert["status"]) => void;
  addAlert: (alert: Alert) => void;
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

function randomDelta() {
  return Math.floor(Math.random() * 3) + 1;
}

function countAlertsByType(alerts: Alert[]): Record<string, number> {
  const counts: Record<string, number> = { "打架": 0, "跌倒": 0, "自杀": 0, "人员聚集": 0 };
  for (const alert of alerts) {
    if (counts[alert.type] !== undefined) {
      counts[alert.type]++;
    }
  }
  return counts;
}

// ── Store 创建 ───────────────────────────────────────────────────────────────

const isZeroPort = typeof window !== "undefined" && window.location.port === "5001";
const ZERO = isZeroPort; // 5001清零，5000显示假数据

// 月度 labels（供 week/day 派生）
const MONTH_LABELS_30 = Array.from({ length: 30 }, (_, i) => `${i + 1}日`);
const DAY_LABELS_24 = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);
const WEEK_LABELS = ["1日","2日","3日","4日","5日","6日","7日"];

export const useMockStore = create<MockStore>((set, get) => {
  const emptyCounts = { "打架": 0, "跌倒": 0, "自杀": 0, "人员聚集": 0 };

  // 5000 端口：填充真实假数据
  const mockTrend = mock.generateTrendData("month");
  const statsCompare = mock.generateStatsCompare();
  const statsSummary = mock.generateStatsSummary();
  // 让 statsSummary 的 behaviorCounts 与 trendData 月度求和一致
  const monthSums = { "打架": 0, "跌倒": 0, "自杀": 0, "人员聚集": 0 };
  for (const key of Object.keys(mockTrend.data)) {
    monthSums[key as keyof typeof monthSums] =
      (mockTrend.data[key] as number[]).reduce((s, v) => s + v, 0);
  }
  statsSummary.behaviorCounts = monthSums;
  statsSummary.total = Object.values(monthSums).reduce((s, v) => s + v, 0);

  return {
    cameras: mock.generateCameras(),
    alerts: mock.generateAlerts(20),
    statsSummary,
    statsCompare,
    trendData: {
      day:    mock.generateTrendData("day"),
      week:   mock.generateTrendData("week"),
      month:  mockTrend,
      quarter: mock.generateTrendData("quarter"),
    },
    heatmapData: mock.generateHeatmapData(),
    systemStatus: mock.generateSystemStatus(),
    modelInfo: mock.generateModelInfo(),
    settings: mock.generateSettings(),
    regionalStats: mock.generateRegionalStats(),
    fpsStats: mock.generateFpsStats(),
    evidenceItems: mock.generateEvidenceItems(24),
    evidenceStats: mock.generateEvidenceStats(),
    auditLogs: mock.generateAuditLogs(100),
    automationRate: mock.generateAutomationRate(),
    auditTrend: {
      day:   mock.generateAuditTrend("day"),
      week:  mock.generateAuditTrend("week"),
    },

    evidenceBump: 0,

    _timers: [],

    start() {
      // 清零模式：不启动定时器
    },

    stop() {
      const { _timers } = get();
      _timers.forEach(clearInterval);
      set({ _timers: [] });
    },

    updateAlertStatus(id: string, status: Alert["status"]) {
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, status } : a
        ),
      }));
    },

    addAlert(alert: Alert) {
      set((state) => {
        const newBehaviorCounts = { ...state.statsSummary.behaviorCounts };
        newBehaviorCounts[alert.type] = (newBehaviorCounts[alert.type] || 0) + 1;

        // 同步添加一条证据记录
        const evItem = {
          id: `EV-${alert.id}`,
          timestamp: alert.time,
          actions: [alert.type],
          personCount: 1,
          cameraName: alert.cameraName,
          cameraId: alert.cameraId,
          imageFilename: `screenshot_${alert.type}_${Date.now()}.jpg`,
          snapshotUrl: alert.snapshotUrl || null,
          confidence: alert.confidence,
        };

        return {
          alerts: [alert, ...state.alerts].slice(0, 100),
          evidenceItems: [evItem as any, ...state.evidenceItems].slice(0, 50),
          statsSummary: {
            behaviorCounts: newBehaviorCounts,
            total: state.statsSummary.total + 1,
            compare: state.statsSummary.compare,
          },
        };
      });
    },
  };
});

// 模块加载即启动定时器
useMockStore.getState().start();
