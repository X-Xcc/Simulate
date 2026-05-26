import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import * as THREE from "three";
import {
  Shield, ArrowRight, PersonStanding, Swords, ScanEye,
  Eye, MapPinOff, Users, Radio, Zap, Activity, ChevronDown,
} from "lucide-react";

/* ═══════════════════════════════════════════
   星云粒子背景 — 圆形发光粒子
   自定义 ShaderMaterial 实现圆形光粒 + 球形分布
   ═══════════════════════════════════════════ */
function ParticleBackground() {
  const pointsRef = useRef<THREE.Points>(null!);
  const linesRef = useRef<THREE.LineSegments>(null!);
  const mouseRef = useRef({ x: 0, y: 0 });
  const mouseWorldRef = useRef(new THREE.Vector3());
  const targetRotRef = useRef({ x: 0, y: 0 });
  const rotRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  const PARTICLE_COUNT = 4000;

  // 自定义着色器：圆形发光粒子
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

  // 预计算粒子大小和颜色
  const particleSizes = useMemo(() => {
    const sizes = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 1.5 + Math.random() * 3.5; // 1.5-5.0 大小
    }
    return sizes;
  }, []);

  const particleColors = useMemo(() => {
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    // 淡蓝 + 淡紫 + 淡青 配色
    const colorPalette = [
      [0.7, 0.85, 1.0],   // 淡蓝
      [0.75, 0.8, 0.95],  // 冷蓝
      [0.8, 0.75, 0.9],   // 淡紫
      [0.75, 0.85, 0.9],  // 淡青
      [0.85, 0.8, 0.9],   // 浅紫蓝
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

  // 初始化粒子位置和速度
  useEffect(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // 球形分布
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 35 + Math.random() * 65;
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      // 极缓慢漂浮
      velocities[i3] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.008;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.008;
    }

    (pointsRef.current as any)._positions = positions;
    (pointsRef.current as any)._velocities = velocities;

    // 初始化几何
    const geo = pointsRef.current.geometry;
    (geo.attributes.position.array as Float32Array).set(positions);
    geo.attributes.position.needsUpdate = true;
  }, []);

  // 鼠标跟踪
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x, y };
      mouseWorldRef.current.set(x * 60, y * 50, 0);
      targetRotRef.current = { x: y * 0.3, y: x * 0.3 };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // 每帧更新
  useFrame((_, delta) => {
    if (!pointsRef.current || !(pointsRef.current as any)._positions) return;

    timeRef.current += delta;
    const positions = (pointsRef.current as any)._positions as Float32Array;
    const velocities = (pointsRef.current as any)._velocities as Float32Array;

    // 球形缓慢自转 + 鼠标响应
    rotRef.current.x += (targetRotRef.current.x - rotRef.current.x) * 0.01;
    rotRef.current.y += (targetRotRef.current.y - rotRef.current.y) * 0.01;
    pointsRef.current.rotation.x = rotRef.current.x + timeRef.current * 0.015;
    pointsRef.current.rotation.y = rotRef.current.y + timeRef.current * 0.01;

    // 更新粒子位置
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      // 鼠标斥力
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

      // 边界反弹
      if (Math.abs(positions[i3]) > 100) velocities[i3] *= -1;
      if (Math.abs(positions[i3 + 1]) > 80) velocities[i3 + 1] *= -1;
      if (Math.abs(positions[i3 + 2]) > 80) velocities[i3 + 2] *= -1;
    }

    // 更新几何
    const geo = pointsRef.current.geometry;
    (geo.attributes.position.array as Float32Array).set(positions);
    geo.attributes.position.needsUpdate = true;

    // 更新连接线
    if (linesRef.current) {
      linesRef.current.rotation.x = pointsRef.current.rotation.x;
      linesRef.current.rotation.y = pointsRef.current.rotation.y;

      const lineGeo = linesRef.current.geometry;
      const linePos = lineGeo.attributes.position.array as Float32Array;
      let lineIndex = 0;
      const maxDist = 9;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const x1 = positions[i3];
        const y1 = positions[i3 + 1];
        const z1 = positions[i3 + 2];

        for (let j = i + 1; j < PARTICLE_COUNT && lineIndex < 2000; j++) {
          const j3 = j * 3;
          const dx = x1 - positions[j3];
          const dy = y1 - positions[j3 + 1];
          const dz = z1 - positions[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDist) {
            linePos[lineIndex++] = x1;
            linePos[lineIndex++] = y1;
            linePos[lineIndex++] = z1;
            linePos[lineIndex++] = positions[j3];
            linePos[lineIndex++] = positions[j3 + 1];
            linePos[lineIndex++] = positions[j3 + 2];
          }
        }
      }

      lineGeo.setDrawRange(0, lineIndex);
      lineGeo.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      {/* 粒子层 */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(PARTICLE_COUNT * 3), 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[particleSizes, 1]}
          />
          <bufferAttribute
            attach="attributes-customColor"
            args={[particleColors, 3]}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* 连接线 */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(12000), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#8090a0" transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </>
  );
}

/* ═══════════════════════════════════════════
   数字递增
   ═══════════════════════════════════════════ */
function CountUp({ value, suffix = "", prefix = "", duration = 2.5 }: {
  value: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(prefix + "0" + suffix);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = Math.round(eased * value * 10) / 10;
      setDisplay(
        prefix +
          (Number.isInteger(current) ? current.toFixed(0) : current.toFixed(1)) +
          suffix
      );
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, value, suffix, prefix, duration]);

  return <span ref={ref}>{display}</span>;
}

/* ═══════════════════════════════════════════
   Scroll Reveal
   ═══════════════════════════════════════════ */
function Reveal({
  children, className = "", delay = 0, direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  const variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
      x: direction === "left" ? 40 : direction === "right" ? -40 : 0,
      scale: direction === "scale" ? 0.92 : 1,
    },
    visible: {
      opacity: 1, y: 0, x: 0, scale: 1,
      transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <motion.div ref={ref} className={className} initial="hidden" animate={isInView ? "visible" : "hidden"} variants={variants}>
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   数据
   ═══════════════════════════════════════════ */
const FEATURES = [
  { icon: PersonStanding, name: "跌倒检测", desc: "3D 骨骼关键点分析，毫秒级跌倒识别" },
  { icon: Swords, name: "打架检测", desc: "多目标动作分析与冲突预警" },
  { icon: ScanEye, name: "疲劳检测", desc: "面部特征驱动的疲劳状态分析" },
  { icon: Eye, name: "眼疲劳检测", desc: "EAR 算法精准眨眼频率监测" },
  { icon: MapPinOff, name: "自杀检测", desc: "电子围栏与区域越界实时告警" },
  { icon: Users, name: "人员聚集", desc: "密度分析与异常聚集自动识别" },
];

const ARCH_NODES = [
  { label: "摄像头接入", sub: "RTSP / HTTP / USB", icon: Radio },
  { label: "AI 推理引擎", sub: "YOLOv8n-pose · TensorRT", icon: Zap },
  { label: "行为分析", sub: "6 种检测算法并行", icon: Activity },
  { label: "智能告警", sub: "SSE 实时推送", icon: Shield },
];

/* ═══════════════════════════════════════════
   主页
   ═══════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.15, delayChildren: 0.6 } } };
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const } },
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

      <div className="relative min-h-screen text-gray-900 overflow-x-hidden" style={{ background: "#f8f8fa" }}>

        {/* ── 全屏粒子背景 (fixed) ── */}
        <div className="fixed inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 50], fov: 75 }} dpr={[1, 2]} gl={{ antialias: true }}>
            <ParticleBackground />
          </Canvas>
        </div>

        {/* ── 左侧栏导航 (仿 Active Theory) ── */}
        <nav className="fixed left-8 top-0 bottom-0 z-50 hidden lg:flex flex-col justify-center items-start gap-6">
          {[
            { label: "首页", href: "#hero", active: true },
            { label: "功能", href: "#features" },
            { label: "指标", href: "#metrics" },
            { label: "架构", href: "#arch" },
          ].map((item) => (
            <a key={item.label} href={item.href}
               className={`text-[13px] tracking-[0.05em] transition-all duration-700 ${
                 item.active ? "text-gray-700" : "text-gray-400 hover:text-gray-700"
               }`}
               style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
              {item.label}
            </a>
          ))}
        </nav>

        {/* ── 顶栏 ── */}
        <header className="fixed top-0 inset-x-0 z-50 px-8 lg:px-12 py-8 flex items-center justify-between">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 0.3 }}
            className="flex items-center gap-3">
            <Shield className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[12px] tracking-[0.15em] text-gray-500 uppercase"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
              Everlight
            </span>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5, delay: 0.8 }}
            className="flex items-center gap-6">
            <button onClick={() => navigate("/login")}
              className="text-[11px] tracking-[0.25em] text-gray-500 hover:text-gray-700 transition-colors duration-700 uppercase"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
              Enter
            </button>
          </motion.div>
        </header>

        {/* ════════════════════════════════════
            Hero — 仿 Active Theory 大字居中
            ════════════════════════════════════ */}
        <section ref={heroRef} id="hero" className="relative h-screen flex items-center justify-center z-10">
          <motion.div style={{ y: heroY, opacity: heroOpacity }}
            className="text-center px-8 select-none">
            <motion.div variants={stagger} initial="hidden" animate="visible">

              {/* 主标题 — 演示流云楷字体 */}
              <motion.h1 variants={fadeUp}
                className="text-[clamp(5rem,16vw,14rem)] leading-[0.82] tracking-[-0.02em] text-gray-900"
                style={{ fontFamily: "'演示流云楷', 'LiuQianYan', serif" }}>
                长明灯
              </motion.h1>

              <motion.p variants={fadeUp}
                className="mt-8 text-[clamp(0.55rem,0.9vw,0.7rem)] tracking-[0.8em] text-gray-500 uppercase"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                Prison Behavioral Analysis System
              </motion.p>

              {/* CTA — 无边框文字链 */}
              <motion.div variants={fadeUp} className="mt-16">
                <button onClick={() => navigate("/login")}
                  className="group text-[12px] tracking-[0.3em] text-gray-500 hover:text-gray-700 transition-colors duration-1000 uppercase"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                  Start
                  <span className="inline-block ml-3 w-8 h-px bg-gray-300 group-hover:w-14 group-hover:bg-gray-500 transition-all duration-1000 align-middle" />
                </button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* 底部 SCROLL 提示 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
            <span className="text-[9px] tracking-[0.4em] text-gray-400 uppercase mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>Scroll</span>
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </motion.div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════
            关于 — 仿 Active Theory 文案区
            ════════════════════════════════════ */}
        <section className="relative z-10 min-h-screen flex items-center px-8 lg:px-32 py-40">
          <div className="max-w-[1400px]">
            <Reveal>
              <p className="text-[48px] text-gray-700"
                 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
                长明灯为监狱场景打造全天候智能行为分析系统
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-8 text-[27px] leading-[1.8] text-gray-500 max-w-[600px]"
                 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300 }}>
                覆盖跌倒、打架、疲劳、眼疲劳、自杀、人员聚集六大核心场景。基于 YOLOv8 姿态估计，从摄像头接入到智能告警，全链路毫秒级响应。
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-14 flex gap-10">
                {["Python", "YOLOv8", "Spring Boot", "React", "CUDA"].map((t) => (
                  <span key={t} className="text-[14px] tracking-[0.3em] text-gray-400 uppercase"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════
            检测能力 — 极简列表式
            ════════════════════════════════════ */}
        <section id="features" className="relative z-10 px-8 lg:px-32 py-40">
          <div className="max-w-[1400px]">
            <Reveal>
              <span className="text-[10px] tracking-[0.5em] text-gray-500 uppercase block mb-20"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                Detection
              </span>
            </Reveal>

            <div className="space-y-0">
              {FEATURES.map((f, i) => (
                <Reveal key={f.name} delay={i * 0.06}>
                  <div className="group flex items-center gap-6 py-7 border-t border-gray-200 hover:border-gray-300 transition-all duration-700 cursor-default">
                    <f.icon className="w-[18px] h-[18px] text-gray-400 shrink-0 group-hover:text-gray-700 transition-colors duration-700" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[48px] text-gray-700 group-hover:text-gray-900 transition-colors duration-700"
                            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
                        {f.name}
                      </span>
                      <span className="ml-4 text-[27px] text-gray-400 hidden sm:inline"
                            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                        {f.desc}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-700 shrink-0" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            指标
            ════════════════════════════════════ */}
        <section id="metrics" className="relative z-10 px-8 lg:px-32 py-40">
          <div className="max-w-[1400px]">
            <Reveal>
              <span className="text-[10px] tracking-[0.5em] text-gray-500 uppercase block mb-20"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                Performance
              </span>
            </Reveal>

            <div className="grid grid-cols-4 gap-8 justify-items-center">
              {[
                { value: 96.5, suffix: "%", label: "检测准确率" },
                { value: 200, suffix: "ms", prefix: "<", label: "响应延迟" },
                { value: 50, suffix: "+", label: "并发摄像头" },
                { value: 99.9, suffix: "%", label: "系统可用性" },
              ].map((m, i) => (
                <Reveal key={m.label} delay={i * 0.1}>
                  <div>
                    <div className="text-[clamp(2.2rem,4.5vw,3.5rem)] text-gray-700"
                         style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                      <CountUp value={m.value} suffix={m.suffix} prefix={m.prefix ?? ""} />
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500 tracking-[0.05em]"
                         style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                      {m.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            架构 — 表格式极简
            ════════════════════════════════════ */}
        <section id="arch" className="relative z-10 px-8 lg:px-32 py-40">
          <div className="max-w-[1400px]">
            <Reveal>
              <span className="text-[10px] tracking-[0.5em] text-gray-500 uppercase block mb-20"
                    style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                Architecture
              </span>
            </Reveal>

            <div className="space-y-0">
              {ARCH_NODES.map((node, i) => (
                <Reveal key={node.label} delay={i * 0.08}>
                  <div className="group flex items-center gap-6 py-7 border-t border-gray-200 hover:border-gray-300 transition-all duration-700">
                    <node.icon className="w-[18px] h-[18px] text-gray-400 shrink-0 group-hover:text-gray-700 transition-colors duration-700" />
                    <div className="flex-1">
                      <span className="text-[48px] text-gray-700 group-hover:text-gray-900 transition-colors duration-700"
                            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500 }}>
                        {node.label}
                      </span>
                      <span className="ml-4 text-[27px] text-gray-400"
                            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
                        {node.sub}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-700 shrink-0" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════
            CTA — 居中斜体
            ════════════════════════════════════ */}
        <section className="relative z-10 min-h-[50vh] flex items-center justify-center px-8 py-40">
          <Reveal className="text-center">
            <p className="text-[clamp(1.4rem,3vw,2.4rem)] text-gray-500 mb-10"
               style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 300, fontStyle: "italic" }}>
              准备好开始了吗
            </p>
            <button onClick={() => navigate("/login")}
              className="text-[11px] tracking-[0.4em] text-gray-500 hover:text-gray-700 transition-colors duration-1000 uppercase"
              style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
              立即体验 →
            </button>
          </Reveal>
        </section>

        {/* ── 页脚 ── */}
        <footer className="relative z-10 py-8 px-8 lg:px-12 flex items-center justify-between border-t border-gray-100">
          <span className="text-[10px] text-gray-400 tracking-[0.1em]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
            长明灯 · 监狱智能行为分析系统
          </span>
          <a href="#hero" className="text-[10px] text-gray-400 tracking-[0.15em] hover:text-gray-700 transition-colors duration-500 uppercase"
             style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400 }}>
            Back to top
          </a>
        </footer>
      </div>
    </>
  );
}
