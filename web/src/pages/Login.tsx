import React, { useState } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck, Shield, Key, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { login as apiLogin } from "../services/dataService";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      await apiLogin(username, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setLoading(true);
    setError(null);
    apiLogin(user, pass)
      .then(() => onLogin())
      .catch(err => setError(err.message || "登录失败"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="h-screen w-screen bg-login-bg flex items-center justify-center relative overflow-hidden select-none">
      {/* 背景网格 */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundSize: "60px 60px", backgroundImage: "linear-gradient(to right, #1a56db 1px, transparent 1px), linear-gradient(to bottom, #1a56db 1px, transparent 1px)" }} />
      {/* 光晕 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] bg-primary rounded-full blur-[200px] opacity-[0.08]" />
      </div>

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[400px] bg-dark-bg/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-8 shadow-[0_24px_48px_rgba(0,0,0,0.4)] flex flex-col gap-6"
      >
        {/* Logo */}
        <header className="text-center flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2 text-primary">
            <Shield className="w-7 h-7" />
            <h1 className="text-title font-bold tracking-tight">长明灯</h1>
          </div>
          <p className="text-body text-white/60 font-medium">监狱智能行为分析系统</p>
          <div className="h-0.5 w-8 bg-primary/60 mt-3 rounded-full" />
        </header>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && (
            <div className="text-danger-red text-caption bg-danger-red/10 p-2.5 rounded-lg border border-danger-red/20 flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest pl-0.5">账号</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                  <User size={16} />
                </div>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="请输入账号"
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-3 text-white placeholder:text-white/20 text-body focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-widest pl-0.5">密码</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full h-11 bg-white/[0.04] border border-white/[0.06] rounded-lg pl-10 pr-10 text-white placeholder:text-white/20 text-body focus:outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* 快捷登录 */}
          <div className="flex gap-2">
            <button type="button" onClick={() => quickLogin("admin", "123")}
              className="flex-1 h-8 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] font-semibold text-white/40 hover:bg-white/[0.08] hover:text-primary transition-all">
              超级管理员
            </button>
            <button type="button" onClick={() => quickLogin("officer", "123")}
              className="flex-1 h-8 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] font-semibold text-white/40 hover:bg-white/[0.08] hover:text-primary transition-all">
              值班干警
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary-container text-white rounded-lg font-semibold text-body tracking-wider shadow-[0_4px_16px_rgba(26,86,219,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 group relative overflow-hidden">
            <span className="relative z-10">{loading ? "正在验证..." : "登录系统"}</span>
            {!loading && <Key className="relative z-10 w-4 h-4 group-hover:rotate-12 transition-transform" />}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
          </button>

          <p className="text-[10px] text-center text-white/20 px-4 leading-relaxed">
            仅限授权人员登录。系统将自动记录所有操作行为。
          </p>
        </form>

        <footer className="text-center border-t border-white/[0.05] pt-3">
          <p className="text-[10px] font-mono text-white/20 flex items-center justify-center gap-1">
            <ShieldCheck size={10} className="text-primary" /> 安全门户 · AES-256 加密
          </p>
        </footer>
      </motion.main>
    </div>
  );
}
