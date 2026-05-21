import { useState, useEffect, useCallback } from "react";
import { Camera, CameraStatus, Settings } from "../types";
import type { DiscoveredCamera } from "../types";
import {
  Plus,
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
  X,
  Zap,
  Loader2,
  Camera as CameraIcon,
  Search,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useToast } from "../components/Toast";
import { fetchCameras, addCamera, updateCamera, deleteCamera, testCamera, discoverCameras, batchAddCameras } from "../services/dataService";

const TYPE_LABELS: Record<string, string> = {
  usb: "USB 摄像头",
  rtsp: "RTSP 网络摄像机",
  http_snapshot: "HTTP 快照",
};

export default function Devices() {
  const toast = useToast();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingConn, setTestingConn] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    confidence: 0.5, iou: 0.45, interval: 2, maxPeople: 50, cooldown: 30, fatigueThreshold: 15,
    aiSensitivity: { fightDetection: 80, fallDetection: 75, climbingDetection: 70, crowdGathering: 65 },
    notifications: { email: true, sms: false, centralAlarm: true },
    storage: { autoOverwrite: true },
  });
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "rtsp" as "usb" | "rtsp" | "http_snapshot", address: "", user: "", password: "" });
  const [successMsg, setSuccessMsg] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredCamera[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  const loadCameras = useCallback(async () => {
    try {
      const data = await fetchCameras();
      setCameras(data);
    } catch {
      // 静默失败，不弹窗
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCameras(); }, [loadCameras]);

  // Auto-clear success message
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const onlineCount = cameras.filter(c => c.status === CameraStatus.ONLINE).length;

  const handleAdd = async () => {
    if (!form.name || !form.address) { toast.show("请填写名称和地址", "error"); return; }
    try {
      await addCamera({ name: form.name, type: form.type, address: form.type === "usb" ? Number(form.address) : form.address, user: form.user || undefined, password: form.password || undefined });
      setSuccessMsg("设备已添加");
      setShowModal(false);
      await loadCameras();
    } catch (e: any) {
      toast.show("添加失败: " + e.message, "error");
    }
  };

  const handleEdit = async () => {
    if (!editId || !form.name || !form.address) { toast.show("请填写名称和地址", "error"); return; }
    try {
      await updateCamera(editId, { name: form.name, type: form.type, address: form.type === "usb" ? Number(form.address) : form.address, user: form.user || undefined, password: form.password || undefined });
      setSuccessMsg("设备已更新");
      setShowModal(false);
      await loadCameras();
    } catch (e: any) {
      toast.show("更新失败: " + e.message, "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCamera(id);
      toast.show("设备已删除");
      await loadCameras();
    } catch (e: any) {
      toast.show("删除失败: " + e.message, "error");
    }
  };

  const handleTest = async () => {
    if (!form.address) { toast.show("请先填写设备地址", "error"); return; }
    setTestingConn(true);
    try {
      const res = await testCamera({ type: form.type, address: form.type === "usb" ? Number(form.address) : form.address, user: form.user || undefined, password: form.password || undefined });
      toast.show(res.message, res.reachable ? "success" : "error");
    } catch (e: any) {
      toast.show("测试失败: " + e.message, "error");
    } finally {
      setTestingConn(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await discoverCameras();
      setDiscovered(result);
      setShowDiscovery(true);
      setSelectedDevices(new Set(result.map(d => d.ip)));
      toast.show(`发现 ${result.length} 个摄像头`, "success");
    } catch (e: any) {
      toast.show("扫描失败: " + e.message, "error");
    } finally {
      setScanning(false);
    }
  };

  const handleBatchAdd = async () => {
    const toAdd = discovered
      .filter(d => selectedDevices.has(d.ip))
      .map(d => ({
        name: d.name,
        type: "rtsp" as const,
        address: d.rtspUrl,
        ip: d.ip,
        brand: d.brand || undefined,
        model: d.model || undefined,
        port: 554,
      }));
    try {
      const result = await batchAddCameras(toAdd);
      toast.show(`成功添加 ${result.added} 个摄像头`, "success");
      if (result.errors.length > 0) {
        toast.show(`${result.errors.length} 个失败: ${result.errors.join(", ")}`, "error");
      }
      setShowDiscovery(false);
      setDiscovered([]);
      await loadCameras();
    } catch (e: any) {
      toast.show("批量添加失败: " + e.message, "error");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-fade-in-up">
      {successMsg && (
        <div className="bg-success-green/10 text-success-green px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2">
          <Check size={16} /> {successMsg}
        </div>
      )}

      {/* 页头 */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditId(null); setForm({ name: "", type: "rtsp", address: "", user: "", password: "" }); setShowModal(true); }}
            className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
          >
            <Plus size={16} /> 添加摄像头
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-caption rounded-lg bg-surface-container-low border border-outline-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            {scanning ? "扫描中..." : "自动扫描"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* 设备列表 + AI灵敏度 */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* 设备列表 */}
          <section className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex items-center gap-2">
              <CameraIcon size={16} className="text-primary" />
              <h3 className="font-bold text-body-lg">监控设备列表</h3>
            </div>
            {loading ? (
              <div className="p-8 text-center text-outline">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-primary" />
                加载中...
              </div>
            ) : cameras.length === 0 ? (
              <div className="p-8 text-center text-outline">
                暂无设备，点击右上角「添加摄像头」开始配置
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-outline-variant">
                    <tr>
                      <th className="px-4 py-2 text-caption font-semibold text-outline uppercase tracking-wider">名称 / 类型</th>
                      <th className="px-4 py-2 text-caption font-semibold text-outline uppercase tracking-wider">品牌</th>
                      <th className="px-4 py-2 text-caption font-semibold text-outline uppercase tracking-wider">地址</th>
                      <th className="px-4 py-2 text-caption font-semibold text-outline uppercase tracking-wider">状态</th>
                      <th className="px-4 py-2 text-caption font-semibold text-outline uppercase tracking-wider text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 text-body">
                    {cameras.map((cam) => (
                      <tr key={cam.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-on-surface">{cam.name}</div>
                          <div className="text-caption font-mono text-outline">{TYPE_LABELS[cam.type] ?? cam.type}</div>
                        </td>
                        <td className="px-4 py-3 text-body-sm text-on-surface-variant">
                          {cam.brand || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-body-sm text-on-surface-variant truncate max-w-[200px]">
                          {String(cam.address)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-caption font-semibold flex items-center gap-1 w-fit",
                            cam.status === CameraStatus.ONLINE
                              ? "bg-success-green/10 text-success-green"
                              : "bg-outline/10 text-outline"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              cam.status === CameraStatus.ONLINE ? "bg-success-green" : "bg-outline"
                            )} />
                            {cam.status === CameraStatus.ONLINE ? "在线" : "离线"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1">
                          <button onClick={() => {
                            setEditId(cam.id);
                            setForm({ name: cam.name, type: cam.type, address: String(cam.address), user: cam.user || "", password: cam.password || "" });
                            setShowModal(true);
                          }} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="编辑">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(cam.id)} className="p-1.5 text-outline hover:text-danger-red hover:bg-error-container/30 rounded-lg transition-colors" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* AI 灵敏度 */}
          <section className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-detect-purple" />
              <h3 className="font-bold text-body-lg">AI 算法灵敏度配置</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: "打架斗殴识别", key: "fightDetection", color: "#1a56db" },
                { label: "人员跌倒/晕厥", key: "fallDetection", color: "#7c3aed" },
                { label: "违规攀爬检测", key: "climbingDetection", color: "#c27a18" },
                { label: "区域非法聚集", key: "crowdGathering", color: "#0e7490" },
              ].map((algo) => {
                const val = settings.aiSensitivity[algo.key as keyof typeof settings.aiSensitivity] ?? 0;
                return (
                  <div key={algo.label} className="p-3 bg-surface-container-low border border-outline-variant/50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-body text-on-surface">{algo.label}</span>
                      <span className="font-mono text-body-sm font-bold" style={{ color: algo.color }}>{val}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        aiSensitivity: { ...prev.aiSensitivity, [algo.key]: Number(e.target.value) },
                      }))}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSettings(prev => ({
                  ...prev,
                  aiSensitivity: { fightDetection: 80, fallDetection: 75, climbingDetection: 70, crowdGathering: 65 },
                }))}
                className="px-4 py-2 bg-surface-container-high rounded-lg font-semibold text-body flex items-center gap-1.5 hover:bg-surface-container-highest transition-colors"
              >
                <RotateCcw size={14} /> 恢复默认
              </button>
              <button onClick={() => toast.show("灵敏度配置已应用")} className="px-5 py-2 bg-primary text-white rounded-lg font-semibold text-body flex items-center gap-1.5 shadow-sm">
                <Check size={14} /> 应用变更
              </button>
            </div>
          </section>
        </div>

        {/* 侧栏 */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* 存储 */}
          <section className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-info-cyan" />
              <h3 className="font-bold text-body-lg">存储管理</h3>
            </div>
            <div>
              <div className="flex justify-between text-body-sm font-semibold text-on-surface-variant mb-1.5">
                <span>录像存储 (SSD)</span>
                <span className="font-mono">1.8GB / 40GB</span>
              </div>
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: "4.5%" }} />
              </div>
            </div>
            <div className="mt-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-body">自动覆盖策略</span>
                  <p className="text-caption text-outline mt-0.5">空间不足时循环覆盖旧数据</p>
                </div>
                <div
                  onClick={() => setSettings(prev => ({ ...prev, storage: { autoOverwrite: !prev.storage.autoOverwrite } }))}
                  className={cn(
                    "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                    settings.storage.autoOverwrite ? "bg-primary" : "bg-outline-variant"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                    settings.storage.autoOverwrite ? "right-0.5" : "left-0.5"
                  )} />
                </div>
              </div>
            </div>
          </section>

          {/* 通知策略 */}
          <section className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <BellRing size={16} className="text-warning-orange" />
              <h3 className="font-bold text-body-lg">通知策略</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: Mail, label: "邮件推送", detail: "重大告警实时发送", color: "text-primary", key: "email" as const },
                { icon: MessageSquare, label: "短信网关", detail: "二级响应级别触发", color: "text-success-green", key: "sms" as const },
                { icon: Megaphone, label: "中控台警报", detail: "指挥室语音播报", color: "text-danger-red", key: "centralAlarm" as const },
              ].map((item) => (
                <div key={item.label} className="p-3 border border-outline-variant/50 rounded-lg flex items-center justify-between hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <item.icon className={item.color} size={18} />
                    <div>
                      <div className="font-semibold text-body">{item.label}</div>
                      <div className="text-caption text-outline">{item.detail}</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications[item.key]}
                    onChange={() => setSettings(prev => ({
                      ...prev,
                      notifications: { ...prev.notifications, [item.key]: !prev.notifications[item.key] },
                    }))}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 快捷信息 */}
          <section className="bg-white rounded-xl border border-outline-variant shadow-sm p-4">
            <h3 className="font-bold text-body-lg mb-3">设备概要</h3>
            <div className="space-y-3">
              {[
                { label: "设备总数", value: cameras.length.toString() },
                { label: "在线设备", value: onlineCount.toString() },
                { label: "RTSP 设备", value: cameras.filter(c => c.type === "rtsp").length.toString() },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-body-sm text-outline font-medium">{item.label}</span>
                  <span className="font-mono font-semibold text-body tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 添加/编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[460px] mx-4 overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <h3 className="font-bold text-body-lg">{editId ? "编辑摄像头" : "添加摄像头"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-surface-container rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-1">名称</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：A区大门摄像头"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-1">类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["usb", "rtsp", "http_snapshot"] as const).map(t => (
                    <button key={t} onClick={() => setForm({ ...form, type: t, address: "" })}
                      className={cn(
                        "py-2 rounded-lg text-caption font-semibold border transition-all",
                        form.type === t ? "bg-primary text-white border-primary" : "bg-surface-container-low text-on-surface-variant border-outline-variant"
                      )}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                  {form.type === "usb" ? "设备索引" : "地址"}
                </label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder={form.type === "usb" ? "0" : form.type === "rtsp" ? "rtsp://192.168.1.100:554/stream" : "http://192.168.1.100/snapshot.jpg"}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
              {form.type === "rtsp" && (
                <>
                  <div>
                    <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-1">用户名（可选）</label>
                    <input type="text" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} placeholder="admin"
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-1">密码（可选）</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••"
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-t border-outline-variant">
              <button disabled={testingConn} onClick={handleTest} className="px-3 py-2 rounded-lg text-body-sm font-semibold border border-outline-variant flex items-center gap-1.5 hover:bg-surface-container transition-colors disabled:opacity-50">
                {testingConn ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {testingConn ? "测试中..." : "测试连接"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-body font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">取消</button>
                <button onClick={editId ? handleEdit : handleAdd} className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body shadow-sm">{editId ? "保存" : "添加"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONVIF 自动发现弹窗 */}
      {showDiscovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[700px] mx-4 overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <h3 className="font-bold text-body-lg">发现 {discovered.length} 个设备</h3>
              <button onClick={() => setShowDiscovery(false)} className="p-1 hover:bg-surface-container rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {discovered.length === 0 ? (
                <p className="text-center text-outline py-8">未发现任何设备</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="border-b border-outline-variant">
                    <tr>
                      <th className="px-3 py-2 text-caption font-semibold text-outline uppercase tracking-wider w-10">
                        <input
                          type="checkbox"
                          checked={selectedDevices.size === discovered.length && discovered.length > 0}
                          onChange={(e) => setSelectedDevices(e.target.checked ? new Set(discovered.map(d => d.ip)) : new Set())}
                        />
                      </th>
                      <th className="px-3 py-2 text-caption font-semibold text-outline uppercase tracking-wider">IP</th>
                      <th className="px-3 py-2 text-caption font-semibold text-outline uppercase tracking-wider">名称</th>
                      <th className="px-3 py-2 text-caption font-semibold text-outline uppercase tracking-wider">品牌</th>
                      <th className="px-3 py-2 text-caption font-semibold text-outline uppercase tracking-wider">型号</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 text-body-sm">
                    {discovered.map((d) => (
                      <tr key={d.ip} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedDevices.has(d.ip)}
                            onChange={(e) => {
                              setSelectedDevices(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(d.ip); else next.delete(d.ip);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono">{d.ip}</td>
                        <td className="px-3 py-2 font-semibold text-on-surface">{d.name}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{d.brand || "-"}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{d.model || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-surface-container-low border-t border-outline-variant">
              <button onClick={() => setShowDiscovery(false)} className="px-4 py-2 rounded-lg text-body font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">取消</button>
              <button
                onClick={handleBatchAdd}
                disabled={selectedDevices.size === 0}
                className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-body shadow-sm disabled:opacity-50"
              >
                批量添加 ({selectedDevices.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
