import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Video, AlertTriangle, FolderLock, Settings2,
  BarChart3, History, Wrench, Search, Bell,
  Sun, Moon, UserCircle, Shield, LogOut, Cpu, ChevronDown, Pencil,
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
      <header className="h-[52px] bg-white/95 backdrop-blur-sm border-b border-outline-variant flex items-center justify-between px-5 z-50 shadow-sm/50 shrink-0">
        <div className="flex items-center gap-5">
          {/* Logo */}
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Shield size={16} className="text-white" fill="currentColor" />
            </div>
            <span className="text-[15px] font-bold text-on-surface tracking-tight">长明灯</span>
          </button>
          <div className="h-5 w-px bg-outline-variant/50" />
          {/* 搜索 */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" size={14} />
            <input type="text" placeholder="搜索..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-container-low border border-transparent hover:border-outline-variant/50 focus:border-primary/30 rounded-lg h-8 pl-8.5 pr-3 text-[13px] w-56 focus:w-72 transition-all outline-none placeholder:text-outline/60" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 时间 */}
          <div className="px-3 py-1.5 bg-surface-container-low rounded-lg">
            <span className="text-[12px] font-mono text-on-surface-variant tabular-nums font-medium">
              {currentTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
          <div className="h-5 w-px bg-outline-variant/50" />

          {/* 通知 */}
          <button onClick={() => navigate("/alerts")}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary rounded-lg transition-all relative">
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-red rounded-full" />
          </button>

          {/* 主题切换 */}
          <button onClick={toggle}
            className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary rounded-lg transition-all">
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          <div className="h-5 w-px bg-outline-variant/50" />

          {/* 用户信息 */}
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-all cursor-pointer">
            <div className="flex flex-col items-end leading-none">
              <span className="text-[12px] font-semibold text-on-surface">管理员</span>
              <span className="text-[10px] text-outline">系统管理员</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-blue-500/80 flex items-center justify-center text-white text-[13px] font-bold shadow-sm">
              管
            </div>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-[220px] flex flex-col bg-white border-r border-outline-variant/50 shrink-0 py-3">
          <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <div key={item.path}>
                {item.hasSubmenu ? (
                  <>
                    <button onClick={() => { setMonitorOpen(!monitorOpen); navigate(item.path); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 font-semibold text-[13px] group",
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary border border-primary/15"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-transparent"
                      )}>
                      <item.icon size={17} className={cn("transition-colors", location.pathname === item.path ? "text-primary" : "text-outline group-hover:text-on-surface-variant")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown size={13} className={cn("transition-transform text-outline/60", monitorOpen && "rotate-180")} />
                    </button>
                    {monitorOpen && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-outline-variant/40 pl-2.5">
                        {cameras.map((cam, i) => (
                          <button key={cam.id}
                            onClick={() => navigate(`/monitor?cam=${cam.id}`)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition-all",
                              location.search.includes(`cam=${cam.id}`)
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                            )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cam.status === "online" ? "bg-success-green" : "bg-outline/40")} />
                            <span>视频{i + 1}</span>
                          </button>
                        ))}
                        {cameras.length === 0 && (
                          <span className="block px-2 py-1.5 text-[11px] text-outline/60">暂无设备</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink to={item.path}
                    className={({ isActive }) => cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 font-semibold text-[13px] group",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/15"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-transparent"
                    )}>
                    <item.icon size={17} className={cn("transition-colors", location.pathname === item.path ? "text-primary" : "text-outline group-hover:text-on-surface-variant")} />
                    <span>{item.label}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </nav>

          <div className="px-2.5 mt-auto pt-3 border-t border-outline-variant/40 space-y-0.5">
          {/* 数据标注快捷入口 */}
          <button
            onClick={() => window.open('/annotation.html', '_blank')}
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all"
            title="数据标注"
          >
            <Pencil size={15} />
          </button>

          <button onClick={() => { logout(); navigate("/login"); }}
            className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:text-danger-red hover:bg-surface-container-high transition-all"
            title="退出系统"
          >
            <LogOut size={15} />
          </button>
          </div>
        </aside>

        {/* 主内容 */}
        <main className="flex-1 overflow-auto bg-[#f4f6fb] p-5 custom-scrollbar relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
