import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Video, 
  AlertTriangle, 
  FolderLock, 
  Settings2, 
  BarChart3, 
  BrainCircuit, 
  History, 
  Wrench,
  Search,
  Bell,
  SunMoon,
  UserCircle,
  Shield,
  LogOut
} from "lucide-react";
import { cn } from "../lib/utils";
import { getCurrentUser } from "../services/dataService";
import { useAuth } from "../lib/auth";

const menuItems = [
  { icon: LayoutDashboard, label: "控制面板", path: "/dashboard" },
  { icon: Video, label: "实时监控", path: "/monitor/fullscreen" },
  { icon: AlertTriangle, label: "AI告警中心", path: "/alerts" },
  { icon: FolderLock, label: "视频证据", path: "/evidence" },
  { icon: Settings2, label: "设备管理", path: "/devices" },
  { icon: BarChart3, label: "数据分析", path: "/analysis" },
  { icon: History, label: "审计日志", path: "/audit" },
  { icon: Wrench, label: "运维中心", path: "/maintenance" },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setUserData({ displayName: user.name || user.username, role: user.role });
      })
      .catch(() => {
        setUserData({ displayName: "用户", role: "未知" });
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-on-surface select-none">
      {/* TopBar - Now Full Width */}
      <header className="h-[52px] bg-white border-b border-outline-variant flex items-center justify-between px-lg z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-xl">
          <span className="text-heading font-extrabold text-primary tracking-tighter cursor-pointer flex items-center gap-2" onClick={() => navigate("/")}>
            <Shield size={26} fill="currentColor" /> 长明灯
          </span>
          <div className="h-6 w-px bg-outline-variant"></div>
          <div className="relative group">
            <Search className="absolute left-sm top-1/2 -translate-y-1/2 text-outline" size={16} />
            <input 
              type="text" 
              placeholder="搜索数据、区域或设备..." 
              className="bg-surface-container-low/50 border border-outline-variant/60 rounded-lg h-8 pl-xl pr-md text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-64 transition-all placeholder:text-outline/40"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-md">
          <button className="p-xs text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
          </button>
          <button className="p-xs text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors">
            <SunMoon size={20} />
          </button>
          <div className="h-6 w-px bg-outline-variant mx-xs"></div>
          <div className="flex items-center gap-sm p-xs bg-surface-container-high/40 px-md py-1 rounded-full border border-outline-variant/10">
            <div className="flex flex-col items-end">
              <span className="text-body-sm font-bold text-primary truncate max-w-[100px]">
                {userData?.displayName || "用户"}
              </span>
              <span className="text-caption text-outline truncate max-w-[100px]">
                {userData?.role || "角色"}
              </span>
            </div>
            <UserCircle size={28} className="text-primary" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tech-Style Dark Sidebar */}
        <aside className="w-[180px] flex flex-col bg-[#0f141d] border-r border-white/5 shrink-0 py-lg">
          <nav className="flex-1 px-sm space-y-xs overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "w-full flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200 font-bold text-body-sm group",
                  isActive 
                    ? "bg-primary/20 text-primary border border-primary/30" 
                    : "text-outline/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon 
                  size={18} 
                  className={cn(
                    "transition-colors",
                    location.pathname === item.path ? "text-primary" : "text-outline group-hover:text-white"
                  )} 
                />
                <span className="tracking-tight">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          
          <div className="px-md mt-auto pt-md border-t border-white/5">
            <button 
              onClick={handleLogout}
              className="w-full h-[40px] flex items-center gap-md px-md rounded-lg text-error/60 hover:text-error hover:bg-error/10 transition-all font-bold group"
            >
              <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
              <span className="text-body-sm">退出系统</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-[#f8f9fc] p-xl custom-scrollbar relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
