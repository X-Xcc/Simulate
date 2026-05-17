/**
 * 虚拟数据层 — 让前端在无后端环境下完整运行
 * 所有页面使用此数据源，模拟真实业务场景
 */

import { Camera, CameraStatus, Alert, AlertLevel, AlertType, AuditLog, SystemStatus, Settings } from "../types";

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

/** 伪随机数生成器，按 seed 产生确定性序列 */
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── 摄像头数据 ───────────────────────────────────────────────────────────────

const CAMERA_NAMES = [
  { name: "视频1", type: "rtsp" as const, address: "rtsp://192.168.1.101:554/stream1" },
  { name: "视频2", type: "rtsp" as const, address: "rtsp://192.168.1.102:554/stream1" },
  { name: "视频3", type: "rtsp" as const, address: "rtsp://192.168.1.103:554/stream1" },
];

export function generateCameras(): Camera[] {
  return CAMERA_NAMES.map((cam, i) => ({
    id: `cam-${String(i + 1).padStart(3, "0")}`,
    name: cam.name,
    type: cam.type,
    address: cam.address,
    status: CameraStatus.ONLINE,
    streamUrl: `/video_feed?cam=${i}`,
    personCount: randomInt(1, 15),
  }));
}

// ── 告警数据 ─────────────────────────────────────────────────────────────────

const ALERT_TYPES: { type: AlertType; level: AlertLevel }[] = [
  { type: AlertType.FIGHT, level: AlertLevel.CRITICAL },
  { type: AlertType.FALL, level: AlertLevel.WARNING },
  { type: AlertType.CROWD, level: AlertLevel.MINOR },
  { type: AlertType.ABSENCE, level: AlertLevel.INFO },
];

const CAMERAS_FOR_ALERTS = CAMERA_NAMES;

export function generateAlerts(count = 50): Alert[] {
  return Array.from({ length: count }, (_, i) => {
    const { type, level } = pick(ALERT_TYPES);
    const cam = pick(CAMERAS_FOR_ALERTS);
    const statuses: Alert["status"][] = ["pending", "confirmed", "ignored", "confirmed", "confirmed"];
    return {
      id: `ALT-${Date.now()}-${genId()}`,
      cameraId: `cam-${String(CAMERAS_FOR_ALERTS.indexOf(cam) + 1).padStart(3, "0")}`,
      cameraName: cam.name,
      type,
      level,
      time: timeAgo(randomInt(1, 1440)),
      snapshotUrl: "",
      status: pick(statuses),
      confidence: randomFloat(75, 99, 1),
      duration: `00:${randomInt(0, 5).toString().padStart(2, "0")}:${randomInt(0, 59).toString().padStart(2, "0")}`,
      message: `${cam.name}检测到${type}行为`,
    };
  }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

// ── 审计日志 ─────────────────────────────────────────────────────────────────

const OPERATORS = [
  { id: "A001", name: "用户1" },
  { id: "A002", name: "用户2" },
  { id: "A003", name: "用户3" },
  { id: "B001", name: "用户4" },
];

const AUDIT_CATEGORIES = ["登录管理", "设备配置", "告警处理", "系统设置", "数据导出", "用户管理"];
const AUDIT_ACTIONS = [
  "用户登录系统", "修改摄像头配置", "确认打架告警", "调整AI灵敏度",
  "导出月度报表", "添加新设备", "删除过期数据", "修改通知策略",
  "重置密码", "查看监控回放", "批量确认告警", "更新系统固件",
];

export function generateAuditLogs(count = 100): AuditLog[] {
  return Array.from({ length: count }, (_, i) => {
    const op = pick(OPERATORS);
    const riskLevels: AuditLog["riskLevel"][] = ["high", "medium", "low", "low", "low", "medium"];
    return {
      id: `LOG-${genId()}`,
      timestamp: timeAgo(randomInt(1, 10080)),
      operatorId: op.id,
      operatorName: op.name,
      category: pick(AUDIT_CATEGORIES),
      action: pick(AUDIT_ACTIONS),
      riskLevel: pick(riskLevels),
      status: Math.random() > 0.1,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ── 系统状态 ─────────────────────────────────────────────────────────────────

export function generateSystemStatus(): SystemStatus {
  return {
    cpuUsage: randomInt(25, 75),
    memoryUsage: randomInt(40, 80),
    storageUsage: randomInt(30, 65),
    gpuUsage: randomInt(50, 95),
    version: "v3.2.1",
    lastUpdate: new Date().toLocaleString("zh-CN"),
    engine: "YOLOv8n-pose",
    onlineDevices: 3,
    totalDevices: 3,
    activeModels: 2,
    totalModels: 4,
    dataDirSizeMb: randomInt(800, 3200),
    detectionCount: randomInt(15000, 50000),
    services: [
      { name: "推理引擎 (YOLOv8)", uptime: "15天4小时", status: "Running", health: "healthy" as const },
      { name: "Spring Boot 后端", uptime: "15天4小时", status: "Running", health: "healthy" as const },
      { name: "SSE 事件总线", uptime: "15天4小时", status: "Running", health: "healthy" as const },
      { name: "视频流服务", uptime: "15天3小时", status: "Running", health: "healthy" as const },
      { name: "Qwen2.5-VL 服务", uptime: "8天12小时", status: "Running", health: "healthy" as const },
      { name: "数据清理服务", uptime: "15天4小时", status: "Running", health: "healthy" as const },
      { name: "告警推送服务", uptime: "15天4小时", status: "Running", health: "healthy" as const },
      { name: "Nginx 网关", uptime: "30天", status: "Running", health: "healthy" as const },
    ],
  };
}

// ── 趋势数据（确定性，使用 seed 保证刷新不跳变） ────────────────────────────────

export function generateTrendData(range: "day" | "week" | "month" | "quarter") {
  const pointCount = range === "day" ? 24 : range === "week" ? 7 : range === "month" ? 30 : 90;
  const rand = seededRandom(range === "day" ? 100 : range === "week" ? 200 : range === "month" ? 300 : 400);
  const labels: string[] = [];
  const data: Record<string, number[]> = { "打架": [], "跌倒": [], "离岗": [], "人员聚集": [] };

  for (let i = 0; i < pointCount; i++) {
    if (range === "day") {
      labels.push(`${i.toString().padStart(2, "0")}:00`);
      // 凌晨低、白天高、夜间中等
      const hourFactor = (i >= 2 && i <= 5) ? 0.2 : (i >= 8 && i <= 20) ? 1.0 : 0.5;
      data["打架"].push(Math.round((rand() * 5 + 1) * hourFactor));
      data["跌倒"].push(Math.round((rand() * 3 + 0.5) * hourFactor));
      data["离岗"].push(Math.round((rand() * 8 + 2) * hourFactor));
      data["人员聚集"].push(Math.round((rand() * 4 + 1) * hourFactor));
    } else if (range === "week") {
      const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      labels.push(dayLabels[i]);
      // 工作日高、周末低
      const dayFactor = i < 5 ? 1.0 : 0.4;
      data["打架"].push(Math.round((rand() * 6 + 2) * dayFactor));
      data["跌倒"].push(Math.round((rand() * 4 + 1) * dayFactor));
      data["离岗"].push(Math.round((rand() * 9 + 3) * dayFactor));
      data["人员聚集"].push(Math.round((rand() * 5 + 1) * dayFactor));
    } else if (range === "month") {
      labels.push(`${i + 1}日`);
      // 月内波动，每 7 天一个峰值
      const waveFactor = 0.6 + 0.4 * Math.sin((i / 7) * Math.PI);
      data["打架"].push(Math.round((rand() * 5 + 1) * waveFactor));
      data["跌倒"].push(Math.round((rand() * 3 + 0.5) * waveFactor));
      data["离岗"].push(Math.round((rand() * 8 + 2) * waveFactor));
      data["人员聚集"].push(Math.round((rand() * 4 + 1) * waveFactor));
    } else {
      // quarter: 90天，按周聚合，每7天一个点
      const d = new Date();
      d.setDate(d.getDate() - 90 + i);
      labels.push(`${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`);
      // 周期性波动 + 随机噪声
      const weekFactor = 0.5 + 0.5 * Math.sin((i / 14) * Math.PI);
      const dayOfWeek = i % 7;
      const weekdayFactor = dayOfWeek < 5 ? 1.0 : 0.5;
      const factor = weekFactor * weekdayFactor;
      data["打架"].push(Math.round((rand() * 5 + 1) * factor));
      data["跌倒"].push(Math.round((rand() * 3 + 0.5) * factor));
      data["离岗"].push(Math.round((rand() * 8 + 2) * factor));
      data["人员聚集"].push(Math.round((rand() * 4 + 1) * factor));
    }
  }

  return { labels, data };
}

// ── 统计对比 ─────────────────────────────────────────────────────────────────

export function generateStatsCompare() {
  return {
    "打架": { today: randomInt(2, 12), yesterday: randomInt(2, 12), change: randomInt(-30, 30) },
    "跌倒": { today: randomInt(0, 6), yesterday: randomInt(0, 6), change: randomInt(-40, 40) },
    "离岗": { today: randomInt(3, 15), yesterday: randomInt(3, 15), change: randomInt(-20, 20) },
    "人员聚集": { today: randomInt(1, 8), yesterday: randomInt(1, 8), change: randomInt(-25, 25) },
  };
}

// ── 统计摘要 ─────────────────────────────────────────────────────────────────

export function generateStatsSummary() {
  return {
    behaviorCounts: {
      "打架": randomInt(8, 35),
      "跌倒": randomInt(3, 18),
      "离岗": randomInt(12, 50),
      "人员聚集": randomInt(5, 25),
    },
    total: randomInt(2000, 8000),
    compare: {},
  };
}

// ── 区域统计 ─────────────────────────────────────────────────────────────────

export function generateRegionalStats() {
  return [
    { name: "A区", value: randomInt(10, 50), color: "#0051ae" },
    { name: "B区", value: randomInt(8, 40), color: "#0058be" },
    { name: "C区", value: randomInt(5, 30), color: "#bf8700" },
    { name: "D区", value: randomInt(3, 25), color: "#7c4dff" },
    { name: "E区", value: randomInt(2, 20), color: "#1a7f37" },
    { name: "F区", value: randomInt(1, 15), color: "#cf222e" },
  ];
}

// ── 证据列表 ─────────────────────────────────────────────────────────────────

export function generateEvidenceItems(count = 24) {
  const actions = ["打架", "跌倒", "离岗", "人员聚集"];
  return Array.from({ length: count }, (_, i) => {
    const cam = pick(CAMERAS_FOR_ALERTS);
    const camIdx = CAMERAS_FOR_ALERTS.indexOf(cam);
    return {
      id: `EV-${genId()}`,
      timestamp: timeAgo(randomInt(1, 4320)),
      actions: [pick(actions)],
      personCount: randomInt(1, 8),
      cameraName: cam.name,
      cameraId: `cam-${String(camIdx + 1).padStart(3, "0")}`,
      imageFilename: `detection_${Date.now()}_${genId()}.jpg`,
      snapshotUrl: null as string | null,
      confidence: randomFloat(70, 99),
    };
  });
}

// ── FPS 统计 ─────────────────────────────────────────────────────────────────

export function generateFpsStats() {
  return { avg: randomFloat(25, 32), min: randomFloat(18, 24), max: randomFloat(33, 38), count: randomInt(5000, 20000) };
}

// ── 模型信息 ─────────────────────────────────────────────────────────────────

export function generateModelInfo() {
  return { model_size_mb: 5.2, device: "CUDA (RTX 5060)", precision: "fp16" };
}

// ── 设置 ─────────────────────────────────────────────────────────────────────

export function generateSettings(): Settings {
  return {
    confidence: 0.5,
    iou: 0.45,
    interval: 2,
    maxPeople: 50,
    cooldown: 30,
    fatigueThreshold: 15,
    aiSensitivity: { fightDetection: 80, fallDetection: 75, climbingDetection: 70, crowdGathering: 65 },
    notifications: { email: true, sms: false, centralAlarm: true },
    storage: { autoOverwrite: true },
  };
}

// ── 证据统计 ─────────────────────────────────────────────────────────────────

export function generateEvidenceStats() {
  return { total: randomInt(5000, 20000), archived: randomInt(3000, 15000), critical: randomInt(50, 200), onlineRate: randomInt(85, 99) };
}

// ── 自动化率 ─────────────────────────────────────────────────────────────────

export function generateAutomationRate() {
  return { rate: randomInt(78, 96) };
}

// ── 审计趋势 ─────────────────────────────────────────────────────────────────

export function generateAuditTrend(range: "day" | "week") {
  const count = range === "day" ? 24 : 7;
  const labels: string[] = [];
  const data: number[] = [];
  for (let i = 0; i < count; i++) {
    if (range === "day") labels.push(`${i.toString().padStart(2, "0")}:00`);
    else labels.push(["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i]);
    data.push(randomInt(5, 40));
  }
  return { labels, data };
}

// ── 热力图数据（监区区域活动密度） ──────────────────────────────────────────────

export interface HeatmapZone {
  id: string;
  name: string;
  /** 相对位置 (百分比 0-100)，用于虚拟地图布局 */
  x: number;
  y: number;
  /** 区域宽高 (百分比) */
  w: number;
  h: number;
  /** 活动密度 0-100 */
  intensity: number;
  /** 该区域告警数 */
  alertCount: number;
  /** 主要行为类型 */
  topBehavior: string;
}

const ZONE_DEFS: Omit<HeatmapZone, "intensity" | "alertCount" | "topBehavior">[] = [
  { id: "A", name: "A区监舍", x: 5, y: 8, w: 28, h: 38 },
  { id: "B", name: "B区活动场", x: 36, y: 8, w: 28, h: 38 },
  { id: "C", name: "C区食堂", x: 67, y: 8, w: 28, h: 38 },
  { id: "D", name: "D区车间", x: 5, y: 54, w: 28, h: 38 },
  { id: "E", name: "E区会见室", x: 36, y: 54, w: 28, h: 38 },
  { id: "F", name: "F区医疗/图书", x: 67, y: 54, w: 28, h: 38 },
];

const BEHAVIORS = ["打架", "跌倒", "离岗", "人员聚集"];

export function generateHeatmapData(): HeatmapZone[] {
  const rand = seededRandom(500);
  return ZONE_DEFS.map(z => ({
    ...z,
    intensity: Math.round(rand() * 80 + 10),
    alertCount: Math.round(rand() * 20 + 1),
    topBehavior: BEHAVIORS[Math.floor(rand() * BEHAVIORS.length)],
  }));
}
