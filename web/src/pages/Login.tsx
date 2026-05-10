import React, { useState } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck, Shield, Key, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { login } from "../services/dataService";

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
      await login(username, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-login-bg flex items-center justify-center relative overflow-hidden select-none">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundSize: "40px 40px", backgroundImage: "linear-gradient(to right, #0051ae 1px, transparent 1px), linear-gradient(to bottom, #0051ae 1px, transparent 1px)" }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[800px] h-[800px] bg-primary rounded-full blur-[150px] opacity-15 animate-pulse" />
      </div>

      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[420px] bg-dark-bg/60 backdrop-blur-xl border border-primary/30 rounded-xl p-xl shadow-[0_8px_48px_rgba(0,0,0,0.6)] flex flex-col gap-xl"
      >
        <header className="text-center flex flex-col items-center">
          <div className="flex items-center gap-sm mb-sm text-primary-fixed-dim">
            <Shield className="w-8 h-8" />
            <h1 className="text-[26px] font-extrabold tracking-wider">长明灯</h1>
          </div>
          <p className="text-[20px] font-bold text-on-primary-container/80 tracking-wide font-sans">监狱智能行为分析系统</p>
          <div className="h-1 w-12 bg-primary mt-sm rounded-full" />
        </header>

        <form onSubmit={handleLogin} className="flex flex-col gap-lg mt-md">
          {error && (
            <div className="text-error text-xs bg-error/10 p-sm rounded border border-error/20 animate-shake flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-md">
            <div className="flex flex-col gap-xs">
              <label className="text-[10px] font-bold text-on-primary-container/60 uppercase tracking-widest pl-1">账号</label>
              <div className="relative group">
                <div className="absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入账号"
                  className="w-full h-[48px] bg-white/5 border border-outline-variant/20 rounded-lg pl-xl pr-md text-on-primary-container focus:outline-none focus:border-primary transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <label className="text-[10px] font-bold text-on-primary-container/60 uppercase tracking-widest pl-1">密码</label>
              <div className="relative group">
                <div className="absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full h-[48px] bg-white/5 border border-outline-variant/20 rounded-lg pl-xl pr-[50px] text-on-primary-container focus:outline-none focus:border-primary transition-all"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-primary-container transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-sm">
            <button
              type="button"
              onClick={() => { setUsername("xx"); setPassword("123"); }}
              className="flex-1 h-[36px] bg-white/5 border border-outline-variant/20 rounded-lg text-[11px] font-bold text-on-primary-container/60 hover:bg-white/10 hover:text-primary transition-all"
            >
              超级管理员 (xx/123)
            </button>
            <button
              type="button"
              onClick={() => { setUsername("user"); setPassword("321"); }}
              className="flex-1 h-[36px] bg-white/5 border border-outline-variant/20 rounded-lg text-[11px] font-bold text-on-primary-container/60 hover:bg-white/10 hover:text-primary transition-all"
            >
              值班干警 (user/321)
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] bg-primary hover:bg-primary-container text-on-primary rounded-lg font-bold text-[16px] tracking-[2px] shadow-[0_4px_16px_rgba(0,81,174,0.3)] hover:shadow-[0_6px_20px_rgba(0,81,174,0.5)] transition-all flex items-center justify-center gap-sm disabled:opacity-50 group border border-primary-fixed/20 relative overflow-hidden"
          >
            <span className="relative z-10">{loading ? "正在验证..." : "登录系统"}</span>
            {!loading && <Key className="relative z-10 w-5 h-5 group-hover:rotate-12 transition-transform" />}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
          </button>

          <p className="text-[10px] text-center text-outline/40 px-lg leading-relaxed">
            仅限授权人员登录。系统将自动记录所有操作行为，任何违规尝试将触发安防联动报警。
          </p>
        </form>

        <footer className="mt-xs text-center border-t border-outline-variant/10 pt-md">
          <p className="text-[11px] font-mono text-outline/50 flex items-center justify-center gap-xs">
            <ShieldCheck size={12} className="text-primary" /> 安全门户连接已加密 (AES-256)
          </p>
        </footer>
      </motion.main>
    </div>
  );
}
