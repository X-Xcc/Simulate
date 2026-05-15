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

  // 定时器控制
  _timers: ReturnType<typeof setInterval>[];
  start: () => void;
  stop: () => void;

  // 告警操作
  updateAlertStatus: (id: string, status: Alert["status"]) => void;
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────────

function randomDelta() {
  return Math.floor(Math.random() * 3) + 1;
}

function countAlertsByType(alerts: Alert[]): Record<string, number> {
  const counts: Record<string, number> = { "打架": 0, "跌倒": 0, "离岗": 0, "人员聚集": 0 };
  for (const alert of alerts) {
    if (counts[alert.type] !== undefined) {
      counts[alert.type]++;
    }
  }
  return counts;
}

// ── Store 创建 ───────────────────────────────────────────────────────────────

export const useMockStore = create<MockStore>((set, get) => {
  const initAlerts = mock.generateAlerts(50);
  const initBehaviorCounts = countAlertsByType(initAlerts);
  const initTotalDetections = initAlerts.length + Math.floor(Math.random() * 3000 + 5000);

  return {
    cameras: mock.generateCameras(),
    alerts: initAlerts,
    statsSummary: {
      behaviorCounts: initBehaviorCounts,
      total: initTotalDetections,
      compare: {},
    },
    statsCompare: mock.generateStatsCompare(),
    trendData: {
      day: mock.generateTrendData("day"),
      week: mock.generateTrendData("week"),
      month: mock.generateTrendData("month"),
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
      day: mock.generateAuditTrend("day"),
      week: mock.generateAuditTrend("week"),
    },

    _timers: [],

    start() {
      const timers: ReturnType<typeof setInterval>[] = [];

      // 每 8 秒：30% 概率生成新告警 → 同步更新 statsSummary
      timers.push(setInterval(() => {
        if (Math.random() > 0.7) {
          const newAlerts = mock.generateAlerts(1);
          const alertType = newAlerts[0].type;

          set((state) => {
            const updatedAlerts = [...newAlerts, ...state.alerts].slice(0, 100);
            const newBehaviorCounts = { ...state.statsSummary.behaviorCounts };
            newBehaviorCounts[alertType] = (newBehaviorCounts[alertType] || 0) + 1;

            return {
              alerts: updatedAlerts,
              statsSummary: {
                behaviorCounts: newBehaviorCounts,
                total: state.statsSummary.total + 1,
                compare: state.statsSummary.compare,
              },
            };
          });
        }
      }, 8000));

      // 每 3 秒：CPU/memory/GPU 波动
      timers.push(setInterval(() => {
        set((state) => ({
          systemStatus: {
            ...state.systemStatus,
            cpuUsage: Math.max(10, Math.min(95, state.systemStatus.cpuUsage + (Math.random() > 0.5 ? 1 : -1) * randomDelta())),
            memoryUsage: Math.max(20, Math.min(90, state.systemStatus.memoryUsage + (Math.random() > 0.5 ? 1 : -1) * randomDelta())),
            gpuUsage: Math.max(30, Math.min(99, state.systemStatus.gpuUsage + (Math.random() > 0.5 ? 1 : -1) * randomDelta())),
            lastUpdate: new Date().toLocaleString("zh-CN"),
          },
        }));
      }, 3000));

      // 每 5 秒：camera personCount 波动
      timers.push(setInterval(() => {
        set((state) => ({
          cameras: state.cameras.map((c) => ({
            ...c,
            personCount: c.status === "online"
              ? Math.max(0, c.personCount + (Math.random() > 0.5 ? 1 : -1))
              : 0,
          })),
        }));
      }, 5000));

      set({ _timers: timers });
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
  };
});

// 模块加载即启动定时器
useMockStore.getState().start();
