import { useState, useEffect } from "react";
import { Camera, CameraStatus, Settings } from "../types";
import {
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Edit3,
  Database,
  BellRing,
  Activity,
  Mail,
  MessageSquare,
  Megaphone,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToCameras, addCamera, deleteCamera, fetchSettings, updateSettings } from "../services/dataService";

export default function Devices() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dataDirSizeMb, setDataDirSizeMb] = useState<number>(0);

  useEffect(() => {
    const unsub = subscribeToCameras((list) => {
      setCameras(list);
      setLoading(false);
    });
    fetchSettings().then(setSettings).catch(console.error);
    fetch("/api/system_info").then(r => r.json()).then(d => setDataDirSizeMb(d.dataDirSizeMb ?? 0)).catch(() => {});
    return () => unsub();
  }, []);

  const handleAddCamera = async () => {
    const newId = `CAM_${Math.floor(Math.random() * 1000)}`;
    const newCam: Camera = {
      id: newId,
      name: `新增摄像机 ${newId}`,
      sn: `SN-${Math.floor(Math.random() * 1000000)}`,
      status: CameraStatus.ONLINE,
      streamUrl: "rtsp://192.168.1.100/live",
      lastOnline: new Date().toISOString(),
      personCount: 0,
      location: "未分类"
    };
    await addCamera(newCam);
  };

  const handleDeleteCamera = async (id: string) => {
    if (confirm("确定要删除此设备吗？")) {
      await deleteCamera(id);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-lg">
      <div className="space-y-xl animate-in fade-in duration-500">
          <header className="flex justify-between items-center bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-md">
              <SettingsIcon className="text-primary" size={24} />
              <h2 className="text-title-lg font-bold">设备与识别中心</h2>
            </div>
            <div className="flex gap-md">
               <button 
                onClick={handleAddCamera}
                className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-[13px] flex items-center gap-sm hover:opacity-90 transition-all shadow-md active:scale-95"
               >
                 <Plus size={18} /> 添加新设备
               </button>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-xl">
            {/* Device List & AI Thresholds */}
            <div className="col-span-12 lg:col-span-8 space-y-lg">
              {/* List Card */}
              <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm overflow-hidden min-h-[400px]">
                <h3 className="font-bold text-[15px] mb-lg flex items-center gap-2">
                  <Activity className="text-primary" size={18} /> 监控设备列表
                </h3>
                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="border-b border-outline-variant font-bold text-on-surface-variant text-[11px] uppercase tracking-widest">
                        <tr>
                          <th className="pb-md px-sm">名称 / SN</th>
                          <th className="pb-md">状态</th>
                          <th className="pb-md">位置</th>
                          <th className="pb-md">最后在线</th>
                          <th className="pb-md text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant">
                        {cameras.map((cam) => (
                          <tr key={cam.id} className="hover:bg-surface-container-low transition-colors group">
                            <td className="py-md px-sm">
                              <div className="font-bold text-on-surface">{cam.name}</div>
                              <div className="text-[10px] font-mono text-outline">{cam.sn}</div>
                            </td>
                            <td className="py-md">
                              <span className={cn(
                                "px-sm py-unit rounded flex items-center gap-xs w-fit text-[10px] font-bold uppercase",
                                cam.status === CameraStatus.ONLINE ? "bg-success-green/10 text-success-green" : "bg-outline/10 text-outline"
                              )}>
                                <div className={cn("w-1.5 h-1.5 rounded-full", cam.status === CameraStatus.ONLINE ? "bg-success-green animate-pulse" : "bg-outline")} />
                                {cam.status === CameraStatus.ONLINE ? "在线" : "离线"}
                              </span>
                            </td>
                            <td className="py-md text-[11px] text-on-surface-variant">{cam.location}</td>
                            <td className="py-md text-[11px] opacity-60">
                              {new Date(cam.lastOnline).toLocaleDateString()}
                            </td>
                            <td className="py-md text-right space-x-1">
                              <button className="p-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"><Edit3 size={16} /></button>
                              <button 
                                onClick={() => handleDeleteCamera(cam.id)}
                                className="p-sm text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* AI Thresholds */}
              <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
                <h3 className="font-bold text-[15px] mb-lg flex items-center gap-2">
                  <Activity className="text-detect-purple" size={18} /> AI 算法灵敏度配置
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                  {[
                    { label: "打架斗殴识别", key: "fightDetection", color: "accent-primary" },
                    { label: "人员跌倒/晕厥", key: "fallDetection", color: "accent-detect-purple" },
                    { label: "违规攀爬检测", key: "climbingDetection", color: "accent-warning-orange" },
                    { label: "区域非法聚集", key: "crowdGathering", color: "accent-info-cyan" },
                  ].map((algo) => {
                    const val = settings?.aiSensitivity?.[algo.key as keyof typeof settings.aiSensitivity] ?? 0;
                    return (
                    <div key={algo.label} className="p-md bg-surface-container-low border border-outline-variant rounded-lg group">
                      <div className="flex justify-between items-center mb-md">
                        <span className="font-bold text-on-surface">{algo.label}</span>
                        <span className="text-[14px] font-mono font-bold text-primary">{val}%</span>
                      </div>
                      <input
                        type="range"
                        value={val}
                        onChange={(e) => {
                          if (!settings) return;
                          setSettings({
                            ...settings,
                            aiSensitivity: { ...settings.aiSensitivity, [algo.key]: Number(e.target.value) },
                          });
                        }}
                        className={cn("w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer", algo.color)}
                      />
                    </div>
                    );
                  })}
                </div>
                <div className="mt-xl flex justify-end gap-md">
                  <button className="bg-surface-container-highest text-on-surface-variant px-lg py-sm rounded-lg font-bold text-[12px] flex items-center gap-2 transition-all active:scale-95">
                    <RotateCcw size={16} /> 恢复默认
                  </button>
                  <button
                    onClick={() => settings && updateSettings({ aiSensitivity: settings.aiSensitivity }).then(s => setSettings(s)).catch(console.error)}
                    className="bg-primary text-on-primary px-xl py-sm rounded-lg font-bold text-[12px] flex items-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Check size={16} /> 应用变更
                  </button>
                </div>
              </section>
            </div>

            {/* Sidebar Info */}
            <div className="col-span-12 lg:col-span-4 space-y-lg">
              {/* Storage */}
              <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
                <h3 className="font-bold text-[15px] mb-lg flex items-center gap-2 text-info-cyan">
                  <Database size={18} /> 存储与空间管理
                </h3>
                <div className="space-y-lg">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-xs">
                      <span>云端录像存储 (SSD)</span>
                      <span className="font-mono">{(dataDirSizeMb / 1024).toFixed(1)}GB</span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${Math.min(100, dataDirSizeMb / 40960 * 100)}%` }} />
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-md rounded-lg border border-outline-variant">
                     <div className="flex items-center justify-between mb-xs">
                       <span className="font-bold text-[13px]">自动覆盖策略</span>
                       <div className="w-8 h-4 rounded-full bg-primary relative cursor-pointer"><div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5" /></div>
                     </div>
                     <p className="text-[11px] opacity-70">当空间不足 10% 时，按时间循环覆盖非加密视频。</p>
                  </div>
                </div>
              </section>

              {/* Notifications */}
              <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
                <h3 className="font-bold text-[15px] mb-lg flex items-center gap-2 text-warning-orange">
                  <BellRing size={18} /> 全局通知策略
                </h3>
                <div className="space-y-md">
                  {[
                    { icon: Mail, label: "邮件推送", detail: "重大告警实时发送", color: "text-primary" },
                    { icon: MessageSquare, label: "短信网关", detail: "二级响应级别触发", color: "text-success-green" },
                    { icon: Megaphone, label: "中控台警报", detail: "指挥室语音播报", color: "text-error" },
                  ].map((item) => (
                    <div key={item.label} className="p-md border border-outline-variant rounded-lg flex items-center justify-between hover:bg-surface-container-low transition-all cursor-pointer">
                      <div className="flex items-center gap-md">
                        <item.icon className={item.color} size={20} />
                        <div>
                          <div className="font-bold text-[13px]">{item.label}</div>
                          <div className="text-[10px] opacity-60">{item.detail}</div>
                        </div>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
  );
}
