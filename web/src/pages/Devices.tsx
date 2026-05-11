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
  Wifi,
  WifiOff,
  X,
  Zap,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { subscribeToCameras, addCamera, deleteCamera, updateCamera, fetchSettings, updateSettings, testCamera } from "../services/dataService";
import { apiGet } from "../lib/api";

interface CameraForm {
  name: string;
  type: "usb" | "rtsp" | "http_snapshot";
  address: string;
  user: string;
  password: string;
}

const EMPTY_FORM: CameraForm = { name: "", type: "rtsp", address: "", user: "", password: "" };

const TYPE_LABELS: Record<string, string> = {
  usb: "USB 摄像头",
  rtsp: "RTSP 网络摄像机",
  http_snapshot: "HTTP 快照",
};

export default function Devices() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dataDirSizeMb, setDataDirSizeMb] = useState<number>(0);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CameraForm>(EMPTY_FORM);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ reachable: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeToCameras((list) => {
      setCameras(list);
      setLoading(false);
    });
    fetchSettings().then(setSettings).catch(console.error);
    apiGet<any>("/api/system_info").then(d => setDataDirSizeMb(d.dataDirSizeMb ?? 0)).catch(() => {});
    return () => unsub();
  }, []);

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setTestResult(null);
    setError("");
    setShowModal(true);
  };

  const openEdit = (cam: Camera) => {
    setEditId(cam.id);
    setForm({
      name: cam.name,
      type: cam.type,
      address: String(cam.address),
      user: cam.user ?? "",
      password: cam.password ?? "",
    });
    setTestResult(null);
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("名称不能为空"); return; }
    if (!form.address.trim()) { setError("地址不能为空"); return; }

    setSaving(true);
    setError("");
    try {
      const payload: any = {
        name: form.name.trim(),
        type: form.type,
        address: form.type === "usb" ? parseInt(form.address) || 0 : form.address.trim(),
      };
      if (form.user) payload.user = form.user;
      if (form.password) payload.password = form.password;

      if (editId) {
        await updateCamera(editId, payload);
      } else {
        await addCamera(payload);
      }
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.address.trim()) { setError("请先填写地址"); return; }
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const res = await testCamera({
        type: form.type,
        address: form.type === "usb" ? parseInt(form.address) || 0 : form.address,
        user: form.user || undefined,
        password: form.password || undefined,
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ reachable: false, message: e.message || "测试失败" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此摄像头吗？")) return;
    try {
      await deleteCamera(id);
    } catch (e: any) {
      alert("删除失败: " + e.message);
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
          <button
            onClick={openAdd}
            className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-sm hover:opacity-90 transition-all shadow-md active:scale-95"
          >
            <Plus size={18} /> 添加摄像头
          </button>
        </header>

        <div className="grid grid-cols-12 gap-xl">
          {/* Device List & AI Thresholds */}
          <div className="col-span-12 lg:col-span-8 space-y-lg">
            {/* Camera List */}
            <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm overflow-hidden min-h-[400px]">
              <h3 className="font-bold text-body-lg mb-lg flex items-center gap-2">
                <Activity className="text-primary" size={18} /> 监控设备列表
              </h3>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : cameras.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-outline gap-md">
                    <WifiOff size={40} className="opacity-30" />
                    <span className="text-body-lg">暂无摄像头设备</span>
                    <button onClick={openAdd} className="text-body-lg text-primary font-bold hover:underline">点击添加</button>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="border-b border-outline-variant font-bold text-on-surface-variant text-body-sm uppercase tracking-widest">
                      <tr>
                        <th className="pb-md px-sm">名称 / 类型</th>
                        <th className="pb-md">地址</th>
                        <th className="pb-md">状态</th>
                        <th className="pb-md">人数</th>
                        <th className="pb-md text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {cameras.map((cam) => (
                        <tr key={cam.id} className="hover:bg-surface-container-low transition-colors group">
                          <td className="py-md px-sm">
                            <div className="font-bold text-on-surface">{cam.name}</div>
                            <div className="text-body-lg font-mono text-outline">
                              {TYPE_LABELS[cam.type] ?? cam.type} · {cam.id}
                            </div>
                          </td>
                          <td className="py-md">
                            <span className="text-body-lg font-mono text-on-surface-variant">
                              {String(cam.address)}
                            </span>
                          </td>
                          <td className="py-md">
                            <span className={cn(
                              "px-sm py-unit rounded flex items-center gap-xs w-fit text-body-sm font-bold uppercase",
                              cam.status === CameraStatus.ONLINE
                                ? "bg-success-green/10 text-success-green"
                                : "bg-outline/10 text-outline"
                            )}>
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                cam.status === CameraStatus.ONLINE ? "bg-success-green animate-pulse" : "bg-outline"
                              )} />
                              {cam.status === CameraStatus.ONLINE ? "在线" : "离线"}
                            </span>
                          </td>
                          <td className="py-md text-body-lg font-mono">
                            {cam.personCount}
                          </td>
                          <td className="py-md text-right space-x-1">
                            <button
                              onClick={() => openEdit(cam)}
                              className="p-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="编辑"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(cam.id)}
                              className="p-sm text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                              title="删除"
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
              <h3 className="font-bold text-body-lg mb-lg flex items-center gap-2">
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
                      <span className="text-body-lg font-mono font-bold text-primary">{val}%</span>
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
                <button
                  onClick={() => {
                    const defaults = { fightDetection: 80, fallDetection: 75, climbingDetection: 70, crowdGathering: 65 };
                    if (!settings) return;
                    const updated = { ...settings, aiSensitivity: defaults };
                    setSettings(updated);
                    updateSettings({ aiSensitivity: defaults }).then(setSettings).catch(console.error);
                  }}
                  className="bg-surface-container-highest text-on-surface-variant px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-2 transition-all active:scale-95"
                >
                  <RotateCcw size={16} /> 恢复默认
                </button>
                <button
                  onClick={() => settings && updateSettings({ aiSensitivity: settings.aiSensitivity }).then(s => setSettings(s)).catch(console.error)}
                  className="bg-primary text-on-primary px-xl py-sm rounded-lg font-bold text-body-lg flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Check size={16} /> 应用变更
                </button>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-lg">
            {/* Storage */}
            <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-bold text-body-lg mb-lg flex items-center gap-2 text-info-cyan">
                <Database size={18} /> 存储与空间管理
              </h3>
              <div className="space-y-lg">
                <div>
                  <div className="flex justify-between text-body-lg font-bold text-on-surface-variant mb-xs">
                    <span>云端录像存储 (SSD)</span>
                    <span className="font-mono">{(dataDirSizeMb / 1024).toFixed(1)}GB</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${Math.min(100, dataDirSizeMb / 40960 * 100)}%` }} />
                  </div>
                </div>
                <div className="bg-surface-container-low p-md rounded-lg border border-outline-variant">
                   <div className="flex items-center justify-between mb-xs">
                     <span className="font-bold text-body-lg">自动覆盖策略</span>
                     <div
                       onClick={() => {
                         if (!settings) return;
                         const newVal = !settings.storage.autoOverwrite;
                         const updated = { ...settings, storage: { ...settings.storage, autoOverwrite: newVal } };
                         setSettings(updated);
                         updateSettings({ storage: { ...settings.storage, autoOverwrite: newVal } }).catch(console.error);
                       }}
                       className={cn("w-8 h-4 rounded-full relative cursor-pointer transition-colors", settings?.storage?.autoOverwrite ? "bg-primary" : "bg-outline-variant")}
                     >
                       <div className={cn("w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all", settings?.storage?.autoOverwrite ? "right-0.5" : "left-0.5")} />
                     </div>
                   </div>
                   <p className="text-body-lg opacity-70">当空间不足 10% 时，按时间循环覆盖非加密视频。</p>
                </div>
              </div>
            </section>

            {/* Notifications */}
            <section className="bg-white p-lg rounded-xl border border-outline-variant shadow-sm">
              <h3 className="font-bold text-body-lg mb-lg flex items-center gap-2 text-warning-orange">
                <BellRing size={18} /> 全局通知策略
              </h3>
              <div className="space-y-md">
                {[
                  { icon: Mail, label: "邮件推送", detail: "重大告警实时发送", color: "text-primary", key: "email" as const },
                  { icon: MessageSquare, label: "短信网关", detail: "二级响应级别触发", color: "text-success-green", key: "sms" as const },
                  { icon: Megaphone, label: "中控台警报", detail: "指挥室语音播报", color: "text-error", key: "centralAlarm" as const },
                ].map((item) => (
                  <div key={item.label} className="p-md border border-outline-variant rounded-lg flex items-center justify-between hover:bg-surface-container-low transition-all cursor-pointer">
                    <div className="flex items-center gap-md">
                      <item.icon className={item.color} size={20} />
                      <div>
                        <div className="font-bold text-body-lg">{item.label}</div>
                        <div className="text-body-lg opacity-60">{item.detail}</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings?.notifications?.[item.key] ?? false}
                      onChange={() => {
                        if (!settings) return;
                        const newVal = !(settings.notifications?.[item.key] ?? false);
                        const updated = { ...settings, notifications: { ...settings.notifications, [item.key]: newVal } };
                        setSettings(updated);
                        updateSettings({ notifications: { ...settings.notifications, [item.key]: newVal } }).catch(console.error);
                      }}
                      className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] mx-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant">
              <h3 className="font-bold text-body-lg">
                {editId ? "编辑摄像头" : "添加摄像头"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-container rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <div className="p-lg space-y-md">
              {error && (
                <div className="p-sm bg-error/10 text-error text-body-lg rounded-lg font-bold">{error}</div>
              )}

              {/* Name */}
              <div>
                <label className="block text-body-lg font-bold text-on-surface-variant uppercase tracking-wider mb-xs">名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：A区大门摄像头"
                  className="w-full px-md py-sm border border-outline-variant rounded-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-body-lg font-bold text-on-surface-variant uppercase tracking-wider mb-xs">类型</label>
                <div className="grid grid-cols-3 gap-sm">
                  {(["usb", "rtsp", "http_snapshot"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setForm({ ...form, type: t, address: "" }); setTestResult(null); }}
                      className={cn(
                        "py-sm rounded-lg text-body-lg font-bold border transition-all",
                        form.type === t
                          ? "bg-primary text-white border-primary"
                          : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50"
                      )}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-body-lg font-bold text-on-surface-variant uppercase tracking-wider mb-xs">
                  {form.type === "usb" ? "设备索引 (0, 1, 2...)" : "地址"}
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => { setForm({ ...form, address: e.target.value }); setTestResult(null); }}
                  placeholder={
                    form.type === "usb" ? "0"
                    : form.type === "rtsp" ? "rtsp://192.168.1.100:554/stream"
                    : "http://192.168.1.100/snapshot.jpg"
                  }
                  className="w-full px-md py-sm border border-outline-variant rounded-lg text-body-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Credentials (RTSP / HTTP only) */}
              {form.type !== "usb" && (
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="block text-body-lg font-bold text-on-surface-variant uppercase tracking-wider mb-xs">用户名 (可选)</label>
                    <input
                      type="text"
                      value={form.user}
                      onChange={e => { setForm({ ...form, user: e.target.value }); setTestResult(null); }}
                      placeholder="admin"
                      className="w-full px-md py-sm border border-outline-variant rounded-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-body-lg font-bold text-on-surface-variant uppercase tracking-wider mb-xs">密码 (可选)</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => { setForm({ ...form, password: e.target.value }); setTestResult(null); }}
                      placeholder="••••••"
                      className="w-full px-md py-sm border border-outline-variant rounded-lg text-body-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  "p-sm rounded-lg text-body-lg font-bold flex items-center gap-sm",
                  testResult.reachable ? "bg-success-green/10 text-success-green" : "bg-error/10 text-error"
                )}>
                  {testResult.reachable ? <Wifi size={14} /> : <WifiOff size={14} />}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-lg py-md bg-surface-container-low border-t border-outline-variant">
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-md py-sm rounded-lg text-body-lg font-bold flex items-center gap-sm border border-outline-variant hover:bg-surface-container transition-all disabled:opacity-50"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                测试连接
              </button>
              <div className="flex gap-sm">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-lg py-sm rounded-lg text-body-lg font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-primary text-on-primary px-lg py-sm rounded-lg font-bold text-body-lg flex items-center gap-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editId ? "保存修改" : "添加"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
