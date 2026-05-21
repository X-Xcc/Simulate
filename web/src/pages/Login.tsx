import { useRef, useCallback, useMemo, useEffect, type FormEvent } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Eye, EyeOff, Shield } from "lucide-react";
import { motion } from "motion/react";
import * as THREE from "three";
import { useState } from "react";

// ═══════════ Three.js 呼吸粒子 ═══════════

const PARTICLE_COUNT = 400;
const CONNECT_DIST = 100;
const ATTRACT_RADIUS = 160;
const ATTRACT_FORCE = 0.1;

function BreathingParticles() {
  const meshRef = useRef<THREE.Points>(null!);
  const lineRef = useRef<THREE.LineSegments>(null!);
  const mouseRef = useRef(new THREE.Vector3(9999, 9999, 0));
  const mouseSmooth = useRef(new THREE.Vector3(9999, 9999, 0));

  const { camera } = useThree();

  // 初始化粒子数据
  const { positions, homePositions, velocities, baseSizes, phases, speeds, colors } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const homePositions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const baseSizes = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    const palette = [
      [0.506, 0.549, 0.976],
      [0.388, 0.400, 0.945],
      [0.231, 0.510, 0.965],
      [0.655, 0.545, 0.980],
      [0.416, 0.455, 0.996],
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const hx = (Math.random() - 0.5) * 800;
      const hy = (Math.random() - 0.5) * 600;
      const hz = (Math.random() - 0.5) * 200;
      positions[i3] = hx; positions[i3 + 1] = hy; positions[i3 + 2] = hz;
      homePositions[i3] = hx; homePositions[i3 + 1] = hy; homePositions[i3 + 2] = hz;
      velocities[i3] = (Math.random() - 0.5) * 0.2;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;
      baseSizes[i] = Math.random() * 5 + 2;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = Math.random() * 1.2 + 0.4;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c[0]; colors[i3 + 1] = c[1]; colors[i3 + 2] = c[2];
    }

    return { positions, homePositions, velocities, baseSizes, phases, speeds, colors };
  }, []);

  // 连线 buffer
  const lineData = useMemo(() => {
    const maxLines = 3000;
    return {
      positions: new Float32Array(maxLines * 6),
      colors: new Float32Array(maxLines * 6),
      maxLines,
    };
  }, []);

  // 鼠标事件
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    const vec = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    const world = camera.position.clone().add(dir.multiplyScalar(dist));
    mouseRef.current.set(world.x, world.y, 0);
  }, [camera]);

  const handlePointerLeave = useCallback(() => {
    mouseRef.current.set(9999, 9999, 0);
  }, []);

  // 注册事件
  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !lineRef.current) return;
    const t = clock.getElapsedTime();

    // 平滑鼠标
    mouseSmooth.current.lerp(mouseRef.current, 0.05);

    const posAttr = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const sizeAttr = meshRef.current.geometry.attributes.aSize as THREE.BufferAttribute;
    const sizeArr = sizeAttr.array as Float32Array;
    const alphaAttr = meshRef.current.geometry.attributes.aAlpha as THREE.BufferAttribute;
    const alphaArr = alphaAttr.array as Float32Array;

    const mx = mouseSmooth.current.x;
    const my = mouseSmooth.current.y;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      let px = posArr[i3], py = posArr[i3 + 1], pz = posArr[i3 + 2];
      let vx = velocities[i3], vy = velocities[i3 + 1], vz = velocities[i3 + 2];

      // 漂移
      vx += Math.sin(t * 0.3 + i) * 0.002;
      vy += Math.cos(t * 0.2 + i * 0.7) * 0.002;

      // 鼠标吸引
      const dx = mx - px;
      const dy = my - py;
      const mDist = Math.sqrt(dx * dx + dy * dy);
      if (mDist < ATTRACT_RADIUS && mDist > 1) {
        const attract = ATTRACT_FORCE * (1 - mDist / ATTRACT_RADIUS);
        vx += (dx / mDist) * attract;
        vy += (dy / mDist) * attract;
      }

      // 回归原位
      vx += (homePositions[i3] - px) * 0.006;
      vy += (homePositions[i3 + 1] - py) * 0.006;
      vz += (homePositions[i3 + 2] - pz) * 0.003;

      // 阻尼
      vx *= 0.96; vy *= 0.96; vz *= 0.98;

      posArr[i3] = px + vx;
      posArr[i3 + 1] = py + vy;
      posArr[i3 + 2] = pz + vz;
      velocities[i3] = vx; velocities[i3 + 1] = vy; velocities[i3 + 2] = vz;

      // 呼吸: size + alpha
      const breathe = Math.sin(t * speeds[i] + phases[i]) * 0.5 + 0.5;
      sizeArr[i] = baseSizes[i] * (0.5 + breathe * 0.9);
      alphaArr[i] = 0.15 + breathe * 0.6;

      // 鼠标附近变亮变大
      if (mDist < ATTRACT_RADIUS) {
        const boost = 1 - mDist / ATTRACT_RADIUS;
        sizeArr[i] *= 1 + boost * 0.6;
        alphaArr[i] = Math.min(0.9, alphaArr[i] + boost * 0.35);
      }
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    // 连线
    const lp = lineData.positions;
    const lc = lineData.colors;
    let lineIdx = 0;
    for (let i = 0; i < PARTICLE_COUNT && lineIdx < lineData.maxLines; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < lineData.maxLines; j++) {
        const dx = posArr[i * 3] - posArr[j * 3];
        const dy = posArr[i * 3 + 1] - posArr[j * 3 + 1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const a = (1 - dist / CONNECT_DIST) * 0.25;
          const li = lineIdx * 6;
          lp[li] = posArr[i * 3]; lp[li + 1] = posArr[i * 3 + 1]; lp[li + 2] = posArr[i * 3 + 2];
          lp[li + 3] = posArr[j * 3]; lp[li + 4] = posArr[j * 3 + 1]; lp[li + 5] = posArr[j * 3 + 2];
          lc[li] = 0.506 * a; lc[li + 1] = 0.549 * a; lc[li + 2] = 0.976 * a;
          lc[li + 3] = 0.506 * a; lc[li + 4] = 0.549 * a; lc[li + 5] = 0.976 * a;
          lineIdx++;
        }
      }
    }
    // 清空剩余
    for (let k = lineIdx * 6; k < lineData.maxLines * 6; k++) { lp[k] = 0; lc[k] = 0; }
    const linePosAttr = lineRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const lineColAttr = lineRef.current.geometry.attributes.color as THREE.BufferAttribute;
    linePosAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;
    lineRef.current.geometry.setDrawRange(0, lineIdx * 2);
  });

  const pointMaterial = useMemo(() => (
    <shaderMaterial
      vertexColors
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      vertexShader={`
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (250.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `}
      fragmentShader={`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 1.6);
          float core = 1.0 - smoothstep(0.0, 0.12, dist);
          float alpha = glow * vAlpha + core * 0.25;
          gl_FragColor = vec4(vColor * (0.8 + core * 0.5), alpha);
        }
      `}
    />
  ), []);

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[baseSizes, 1]} />
          <bufferAttribute attach="attributes-aAlpha" args={[new Float32Array(PARTICLE_COUNT).fill(0.3), 1]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        {pointMaterial}
      </points>

      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lineData.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineData.colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

// ═══════════ 登录页面 ═══════════

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // 卡片 3D 倾斜 + 光晕跟随
  useEffect(() => {
    const card = cardRef.current;
    const glow = glowRef.current;
    if (!card || !glow) return;

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      card.style.transform = `rotateY(${x * 5}deg) rotateX(${-y * 5}deg)`;
      card.style.transition = "transform 0.1s ease-out";

      const rect = card.getBoundingClientRect();
      glow.style.left = `${e.clientX - rect.left}px`;
      glow.style.top = `${e.clientY - rect.top}px`;
      glow.style.opacity = "1";
    };
    const onLeave = () => {
      card.style.transform = "rotateY(0) rotateX(0)";
      card.style.transition = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      glow.style.opacity = "0";
    };

    // 光球视差
    const orbs = document.querySelectorAll<HTMLElement>(".orb-parallax");

    const onMoveOrbs = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (orbs[0]) orbs[0].style.transform = `translate(${x * 30}px, ${y * 20}px)`;
      if (orbs[1]) orbs[1].style.transform = `translate(${-x * 20}px, ${-y * 15}px)`;
      if (orbs[2]) orbs[2].style.transform = `translate(${x * 15}px, ${y * 25}px)`;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousemove", onMoveOrbs);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousemove", onMoveOrbs);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1200);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden select-none" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 30%, #f0f4ff 60%, #dbeafe 100%)" }}>
      {/* Three.js 粒子背景 */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 500], fov: 60 }}
          dpr={[1, 2]}
          style={{ background: "transparent" }}
        >
          <BreathingParticles />
        </Canvas>
      </div>

      {/* 背景光球视差 */}
      <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
        <div className="orb-parallax absolute w-[400px] h-[400px] rounded-full -top-24 -left-24"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)", filter: "blur(60px)" }} />
        <div className="orb-parallax absolute w-[300px] h-[300px] rounded-full -bottom-20 -right-20"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)", filter: "blur(60px)" }} />
        <div className="orb-parallax absolute w-[250px] h-[250px] rounded-full top-1/2 left-[60%]"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.05), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* 登录卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="login-card-wrapper absolute inset-0 flex items-center justify-center z-10"
      >
        <div ref={cardRef} className="login-card w-full max-w-[420px] mx-4 relative"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: "24px",
            padding: "44px 40px 36px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.02), 0 12px 40px rgba(99,102,241,0.06), 0 1px 0 rgba(255,255,255,0.8) inset",
            transformStyle: "preserve-3d",
            perspective: "1000px",
          }}
        >
          {/* 光标跟随光晕 */}
          <div ref={glowRef} className="card-glow absolute pointer-events-none rounded-full opacity-0 transition-opacity duration-300"
            style={{
              width: 300, height: 300,
              background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
              transform: "translate(-50%, -50%)",
            }}
          />

          {/* 品牌 */}
          <header className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl"
              style={{
                background: "linear-gradient(135deg, #6366f1, #3b82f6)",
                boxShadow: "0 8px 24px rgba(99,102,241,0.3), 0 2px 8px rgba(59,130,246,0.2)",
              }}
            >
              <Shield className="w-6 h-6" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#111827", letterSpacing: "-0.5px" }}
            >
              长明灯
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-sm mt-1"
              style={{ color: "#9ca3af" }}
            >
              监狱智能行为分析系统
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="h-[3px] w-10 mx-auto mt-4 rounded-full"
              style={{ background: "linear-gradient(90deg, #6366f1, #3b82f6)", opacity: 0.4 }}
            />
          </header>

          {/* 表单 */}
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onSubmit={handleLogin}
          >
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7280", letterSpacing: "0.03em" }}>账号</label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="请输入账号" autoFocus
                className="w-full h-12 rounded-xl px-[18px] text-sm outline-none transition-all duration-300"
                style={{
                  border: "1.5px solid #e5e7eb",
                  color: "#111827",
                  background: "rgba(255,255,255,0.6)",
                  fontFamily: "inherit",
                }}
                onFocus={e => {
                  e.target.style.borderColor = "#6366f1";
                  e.target.style.background = "#fff";
                  e.target.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.08), 0 2px 8px rgba(99,102,241,0.06)";
                }}
                onBlur={e => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.background = "rgba(255,255,255,0.6)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7280", letterSpacing: "0.03em" }}>密码</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full h-12 rounded-xl px-[18px] pr-12 text-sm outline-none transition-all duration-300"
                  style={{
                    border: "1.5px solid #e5e7eb",
                    color: "#111827",
                    background: "rgba(255,255,255,0.6)",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = "#6366f1";
                    e.target.style.background = "#fff";
                    e.target.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.08), 0 2px 8px rgba(99,102,241,0.06)";
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = "#e5e7eb";
                    e.target.style.background = "rgba(255,255,255,0.6)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#c7d2fe" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#6366f1")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#c7d2fe")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 记住密码 / 忘记密码 */}
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#6b7280" }}>
                <input
                  type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="w-[18px] h-[18px] rounded-md cursor-pointer"
                  style={{ accentColor: "#6366f1" }}
                />
                记住密码
              </label>
              <a href="#" className="text-sm font-medium transition-colors" style={{ color: "#6366f1" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6366f1")}
              >
                忘记密码？
              </a>
            </div>

            {/* 登录按钮 */}
            <button type="submit" disabled={loading}
              className="login-btn w-full h-[52px] rounded-xl text-[15px] font-semibold tracking-wider text-white border-none cursor-pointer relative overflow-hidden transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #3b82f6 100%)",
                backgroundSize: "200% 200%",
                boxShadow: "0 4px 16px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.05)",
                fontFamily: "inherit",
                opacity: loading ? 0.85 : 1,
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 28px rgba(99,102,241,0.35), 0 2px 8px rgba(0,0,0,0.08)";
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.3), 0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              {loading ? (
                <div className="w-[22px] h-[22px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                <span className="relative z-10">登录系统</span>
              )}
              {/* 光泽扫过 */}
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.05) 50%, transparent 55%)",
                  transform: "translateX(-100%)",
                  transition: "transform 0.6s",
                }}
              />
            </button>
          </motion.form>

          {/* 底部 */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mt-6 text-xs"
            style={{ color: "#c7d2fe" }}
          >
            仅限授权人员登录 · <span style={{ color: "#a5b4fc" }}>AES-256</span> 加密传输
          </motion.footer>
        </div>
      </motion.div>
    </div>
  );
}
