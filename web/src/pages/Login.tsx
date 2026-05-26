import { useState, useRef, useEffect, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion } from "motion/react";
import * as THREE from "three";
import { Shield, Eye, EyeOff, ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════
   星云粒子背景 — 复用 Home 效果
   ═══════════════════════════════════════════ */
function ParticleBackground() {
  const pointsRef = useRef<THREE.Points>(null!);
  const mouseRef = useRef({ x: 0, y: 0 });
  const mouseWorldRef = useRef(new THREE.Vector3());
  const targetRotRef = useRef({ x: 0, y: 0 });
  const rotRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  const PARTICLE_COUNT = 3000;

  const vertexShader = `
    attribute float size;
    attribute vec3 customColor;
    varying vec3 vColor;
    void main() {
      vColor = customColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const particleSizes = useMemo(() => {
    const sizes = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 1.5 + Math.random() * 3.5;
    }
    return sizes;
  }, []);

  const particleColors = useMemo(() => {
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const colorPalette = [
      [0.7, 0.85, 1.0],
      [0.75, 0.8, 0.95],
      [0.8, 0.75, 0.9],
      [0.75, 0.85, 0.9],
      [0.85, 0.8, 0.9],
    ];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const brightness = 0.7 + Math.random() * 0.3;
      colors[i * 3] = color[0] * brightness;
      colors[i * 3 + 1] = color[1] * brightness;
      colors[i * 3 + 2] = color[2] * brightness;
    }
    return colors;
  }, []);

  useEffect(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 35 + Math.random() * 65;
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      velocities[i3] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.008;
    }
    (pointsRef.current as any)._positions = positions;
    (pointsRef.current as any)._velocities = velocities;
    const geo = pointsRef.current.geometry;
    (geo.attributes.position.array as Float32Array).set(positions);
    geo.attributes.position.needsUpdate = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x, y };
      mouseWorldRef.current.set(x * 60, y * 50, 0);
      targetRotRef.current = { x: y * 0.3, y: x * 0.3 };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !(pointsRef.current as any)._positions) return;
    timeRef.current += delta;
    const positions = (pointsRef.current as any)._positions as Float32Array;
    const velocities = (pointsRef.current as any)._velocities as Float32Array;

    rotRef.current.x += (targetRotRef.current.x - rotRef.current.x) * 0.01;
    rotRef.current.y += (targetRotRef.current.y - rotRef.current.y) * 0.01;
    pointsRef.current.rotation.x = rotRef.current.x + timeRef.current * 0.015;
    pointsRef.current.rotation.y = rotRef.current.y + timeRef.current * 0.01;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      const dx = positions[i3] - mouseWorldRef.current.x;
      const dy = positions[i3 + 1] - mouseWorldRef.current.y;
      const dz = positions[i3 + 2] - mouseWorldRef.current.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < 20 && dist > 0) {
        const force = (20 - dist) / 20 * 0.4;
        positions[i3] += (dx / dist) * force;
        positions[i3 + 1] += (dy / dist) * force;
        positions[i3 + 2] += (dz / dist) * force;
      }

      if (Math.abs(positions[i3]) > 100) velocities[i3] *= -1;
      if (Math.abs(positions[i3 + 1]) > 80) velocities[i3 + 1] *= -1;
      if (Math.abs(positions[i3 + 2]) > 80) velocities[i3 + 2] *= -1;
    }

    const geo = pointsRef.current.geometry;
    (geo.attributes.position.array as Float32Array).set(positions);
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        <bufferAttribute attach="attributes-size" args={[particleSizes, 1]} />
        <bufferAttribute attach="attributes-customColor" args={[particleColors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════
   登录页
   ═══════════════════════════════════════════ */
interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 1200);
  };

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&display=swap" />
      <style>{`
        @font-face {
          font-family: '演示流云楷';
          src: url('/fonts/演示流云楷.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>

      <div className="relative min-h-screen overflow-hidden select-none" style={{ background: "#f8f8fa" }}>
        {/* 全屏粒子背景 */}
        <div className="fixed inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 50], fov: 75 }} dpr={[1, 2]} gl={{ antialias: true }}>
            <ParticleBackground />
          </Canvas>
        </div>

        {/* 左侧导航 */}
        <nav className="fixed left-8 top-0 bottom-0 z-50 hidden lg:flex flex-col justify-center items-start gap-6">
          {[
            { label: "首页", href: "#", onClick: () => navigate("/") },
            { label: "登录", href: "#", active: true },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`text-[13px] tracking-[0.05em] transition-all duration-700 ${
                item.active ? "text-gray-700" : "text-gray-400 hover:text-gray-700"
              }`}
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* 顶栏 */}
        <header className="fixed top-0 inset-x-0 z-50 px-8 lg:px-12 py-8 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, delay: 0.3 }}
            className="flex items-center gap-3"
          >
            <Shield className="w-3.5 h-3.5 text-gray-500" />
            <span
              className="text-[12px] tracking-[0.15em] text-gray-500 uppercase"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}
            >
              Everlight
            </span>
          </motion.div>
        </header>

        {/* 登录区域 */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            {/* 标题区 */}
            <div className="mb-12">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[3.5rem] leading-[0.85] tracking-[-0.02em] text-gray-900"
                style={{ fontFamily: "'演示流云楷', 'LiuQianYan', serif" }}
              >
                登录
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 text-[13px] text-gray-500"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}
              >
                监狱智能行为分析系统
              </motion.p>
            </div>

            {/* 表单 */}
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onSubmit={handleLogin}
              className="space-y-0"
            >
              {/* 账号 */}
              <div className="py-5 border-t border-gray-200">
                <label className="block text-[11px] tracking-[0.1em] text-gray-500 uppercase mb-3"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                  账号
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入账号"
                  autoFocus
                  className="w-full h-12 text-[14px] outline-none transition-all duration-200 bg-transparent"
                  style={{
                    border: "none",
                    color: "#1f2937",
                    fontFamily: "'Space Grotesk', sans-serif",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                  onFocus={(e) => (e.target.style.borderBottomColor = "#6366f1")}
                  onBlur={(e) => (e.target.style.borderBottomColor = "#e5e7eb")}
                />
              </div>

              {/* 密码 */}
              <div className="py-5 border-t border-gray-200">
                <label className="block text-[11px] tracking-[0.1em] text-gray-500 uppercase mb-3"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full h-12 text-[14px] outline-none transition-all duration-200 bg-transparent pr-10"
                    style={{
                      border: "none",
                      color: "#1f2937",
                      fontFamily: "'Space Grotesk', sans-serif",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                    onFocus={(e) => (e.target.style.borderBottomColor = "#6366f1")}
                    onBlur={(e) => (e.target.style.borderBottomColor = "#e5e7eb")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#9ca3af" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* 记住 & 登录 */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-8">
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "#6b7280" }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "#6366f1" }}
                    />
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
                      记住登录状态
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-[13px] transition-colors"
                    style={{ color: "#6366f1", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}
                  >
                    忘记密码？
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-[13px] tracking-[0.15em] uppercase transition-all duration-300"
                  style={{
                    background: "#1f2937",
                    color: "#fff",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 500,
                    borderRadius: "4px",
                    opacity: loading ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#374151"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1f2937")}
                >
                  {loading ? (
                    <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    "登录系统"
                  )}
                </button>
              </div>
            </motion.form>

            {/* 底部 */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-12 flex items-center justify-between"
            >
              <span className="text-[11px]" style={{ color: "#d1d5db", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
                仅限授权人员登录
              </span>
              <div className="flex items-center gap-1">
                <Shield size={12} style={{ color: "#d1d5db" }} />
                <span className="text-[11px]" style={{ color: "#d1d5db", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
                  AES-256 加密
                </span>
              </div>
            </motion.footer>
          </motion.div>
        </div>

        {/* 返回首页 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <button
            onClick={() => navigate("/")}
            className="text-[11px] tracking-[0.2em] transition-colors flex items-center gap-2"
            style={{ color: "#9ca3af", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}
          >
            <ChevronDown className="w-3 h-3 rotate-90" />
            返回首页
          </button>
        </motion.div>
      </div>
    </>
  );
}
