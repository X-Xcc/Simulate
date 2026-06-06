import { Alert, AlertLevel, AlertType, Camera } from '../types';

export type AlarmType = 'fight' | 'fall' | 'suicide' | 'gathering';
export type GridMode = 2 | 4 | 8 | 16;

export const MONITOR_SLOT_ORDER = ['cam-12', 'cam-10', 'cam-11'] as const;
export const MONITOR_REFRESH_INTERVAL_MS = 10000;

export const ALARM_CONFIGS: Record<AlarmType, { hex: string; label: string; msg: string }> = {
  fight: {
    hex: '#dc2626',
    label: '打架报警',
    msg: '区域 A 检测到打架行为 — 连续拳击动作，双方肢体冲突特征明显',
  },
  fall: {
    hex: '#dc2626',
    label: '跌倒报警',
    msg: '区域 B 检测到跌倒事件 — 人员姿态异常，身体重心急剧下降',
  },
  suicide: {
    hex: '#dc2626',
    label: '离岗报警',
    msg: '区域 C 检测到自残风险 — 异常姿态动作，疑似自我伤害行为',
  },
  gathering: {
    hex: '#dc2626',
    label: '异常聚集报警',
    msg: '区域 D 检测到异常聚集 — 同一区域人数超过阈值，持续聚集',
  },
};

export const ALARM_TO_ALERT: Record<AlarmType, { type: AlertType; level: AlertLevel }> = {
  fight: { type: AlertType.FIGHT, level: AlertLevel.CRITICAL },
  fall: { type: AlertType.FALL, level: AlertLevel.WARNING },
  suicide: { type: AlertType.FIGHT, level: AlertLevel.CRITICAL },
  gathering: { type: AlertType.CROWD, level: AlertLevel.MINOR },
};

export const GRID_COLS: Record<GridMode, string> = {
  2: 'grid-cols-2',
  4: 'grid-cols-2',
  8: 'grid-cols-4',
  16: 'grid-cols-4',
};

export const GRID_ROWS: Record<GridMode, string> = {
  2: 'grid-rows-1',
  4: 'grid-rows-2',
  8: 'grid-rows-2',
  16: 'grid-rows-4',
};

export function getMonitorSlotCameras(cameras: Camera[]): Array<Camera | undefined> {
  return MONITOR_SLOT_ORDER.map(id => cameras.find(camera => camera.id === id));
}

export function normalizeActiveAlarms(activeAlarms: Set<AlarmType>, acknowledged: AlarmType): {
  activeAlarms: Set<AlarmType>;
  alarmFullscreen: boolean;
} {
  const next = new Set(activeAlarms);
  next.delete(acknowledged);
  return {
    activeAlarms: next,
    alarmFullscreen: next.size > 0,
  };
}

export function getMonitorRealtimeUrl(streamId: string, hostname = window.location.hostname) {
  return `http://${hostname}:1984/stream.html?src=${streamId}`;
}

export function buildMonitorAlert(type: AlarmType, cameras: Camera[], captured: string, now = new Date()): Alert {
  const camera = cameras[1] ?? cameras[0];
  const alarm = ALARM_TO_ALERT[type];
  const config = ALARM_CONFIGS[type];

  return {
    id: `ALT-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    cameraId: camera?.id ?? 'cam-001',
    cameraName: camera?.name ?? '视频1',
    type: alarm.type,
    level: alarm.level,
    time: now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    snapshotUrl: captured,
    status: 'pending',
    confidence: +(85 + Math.random() * 14).toFixed(1),
    duration: '00:00:00',
    message: config.msg,
  };
}
