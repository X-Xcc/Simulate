import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Video, AlertTriangle, FolderLock, Settings2,
  BarChart3, History, Wrench, Search, Bell,
  Sun, Moon, UserCircle, Shield, LogOut, Cpu, ChevronDown,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import { fetchCameras } from "../services/dataService";
import type { Camera } from "../types";

const menuItems = [
  { icon: LayoutDashboard, label: "控制面板", path: "/dashboard" },
  { icon: Video, label: "实时监控", path: "/monitor", hasSubmenu: true },
  { icon: AlertTriangle, label: "告警中心", path: "/alerts" },
  { icon: FolderLock, label: "视频证据", path: "/evidence" },
  { icon: Settings2, label: "设备管理", path: "/devices" },
  { icon: BarChart3, label: "数据分析", path: "/analysis" },
  { icon: History, label: "审计日志", path: "/audit" },
  { icon: Cpu, label: "模型微调", path: "/model-training" },
  { icon: Wrench, label: "运维中心", path: "/maintenance" },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [monitorOpen, setMonitorOpen] = useState(location.pathname === "/monitor");

  useEffect(() => {
    const iv = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // 加载摄像头列表
  useEffect(() => {
    fetchCameras().then(setCameras).catch(() => {});
    const iv = setInterval(() => fetchCameras().then(setCameras).catch(() => {}), 10000);
    return () => clearInterval(iv);
  }, []);

  // 进入 monitor 页面自动展开
  useEffect(() => {
    if (location.pathname === "/monitor") setMonitorOpen(true);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-on-surface select-none">
      {/* 顶栏 */}
      <header className="h-[50px] bg-white border-b border-outline-variant flex items-center justify-between px-4 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-heading font-bold text-primary tracking-tight cursor-pointer flex items-center gap-2" onClick={() => navigate("/")}>
            <Shield size={24} fill="currentColor" /> 长明灯
          </span>
          <div className="h-5 w-px bg-outline-variant" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" size={14} />
            <input type="text" placeholder="搜索数据、区域或设备..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-container-low border border-outline-variant/60 rounded-lg h-8 pl-8 pr-3 text-body w-60 focus:w-72 transition-all outline-none placeholder:text-outline/40" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 时间 */}
          <span className="text-body-sm font-mono text-outline tabular-nums">
            {currentTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <div className="h-5 w-px bg-outline-variant" />

          {/* 通知 */}
          <button onClick={() => navigate("/alerts")}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors relative">
            <Bell size={18} />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-danger-red rounded-full" />
          </button>

          <button onClick={toggle}
            className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <div className="h-5 w-px bg-outline-variant" />

          {/* 用户 */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-surface-container-low">
            <div className="flex flex-col items-end leading-none">
              <span className="text-body-sm font-semibold text-primary">管理员</span>
              <span className="text-[10px] text-outline">超级管理员</span>
            </div>
            <UserCircle size={24} className="text-primary" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-[220px] flex flex-col bg-dark-sidebar border-r border-white/[0.06] shrink-0 py-4">
          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <div key={item.path}>
                {item.hasSubmenu ? (
                  <>
                    <button onClick={() => { setMonitorOpen(!monitorOpen); navigate(item.path); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 font-semibold text-body-sm group",
                        location.pathname === item.path
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "text-white/40 hover:bg-white/[0.04] hover:text-white/70 border border-transparent"
                      )}>
                      <item.icon size={18} className={cn("transition-colors", location.pathname === item.path ? "text-primary" : "text-white/30 group-hover:text-white/50")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown size={14} className={cn("transition-transform", monitorOpen && "rotate-180")} />
                    </button>
                    {monitorOpen && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-white/[0.08] pl-2">
                        {cameras.map((cam, i) => (
                          <button key={cam.id}
                            onClick={() => navigate(`/monitor?cam=${cam.id}`)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-body-sm transition-all",
                              location.search.includes(`cam=${cam.id}`)
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                            )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cam.status === "online" ? "bg-success-green" : "bg-outline")} />
                            <span>视频{i + 1}</span>
                          </button>
                        ))}
                        {cameras.length === 0 && (
                          <span className="block px-2 py-1.5 text-caption text-white/20">暂无设备</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink to={item.path}
                    className={({ isActive }) => cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 font-semibold text-body-sm group",
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/20"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70 border border-transparent"
                    )}>
                    <item.icon size={18} className={cn("transition-colors", location.pathname === item.path ? "text-primary" : "text-white/30 group-hover:text-white/50")} />
                    <span>{item.label}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </nav>

          <div className="px-2 mt-auto pt-3 border-t border-white/[0.06]">
            <button onClick={() => { logout(); navigate("/login"); }}
              className="w-full h-10 flex items-center gap-3 px-3 rounded-lg text-danger-red/50 hover:text-danger-red hover:bg-danger-red/[0.06] transition-all font-semibold group">
              <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
              <span className="text-body-sm">退出系统</span>
            </button>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto bg-[#f8f9fc] p-5 custom-scrollbar relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
