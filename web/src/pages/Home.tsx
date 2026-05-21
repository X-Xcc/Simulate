import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import {
  Shield,
  PersonStanding,
  Swords,
  Eye,
  ScanEye,
  MapPinOff,
  Users,
  ChevronDown,
  ArrowRight,
  Zap,
  Cpu,
  Radio,
  Activity,
  Terminal,
  Gauge,
  Layers,
} from "lucide-react";

/* ═══════════════════════════════════════════
   字体加载
   ═══════════════════════════════════════════ */
function FontLoader() {
  return (
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;500;600;700;800;900&family=Exo+2:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap"
    />
  );
}

/* ═══════════════════════════════════════════
   Radar Canvas — 背景扫描线 + 距离环
   ═══════════════════════════════════════════ */
function RadarBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let angle = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // 网格
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 0.5;
      const gap = 60;
      for (let x = 0; x < w; x += gap) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const cx = w / 2;
      const cy = h / 2;
      const len = Math.hypot(w, h);
      angle += 0.005;

      // 扫描线
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + Math.sin(angle) * len;
      const grad = ctx.createLinearGradient(cx, cy, ex, ey);
      grad.addColorStop(0, "rgba(16,185,129,0.15)");
      grad.addColorStop(0.5, "rgba(6,182,212,0.06)");
      grad.addColorStop(1, "rgba(16,185,129,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();

      // 扫描扇面
      const sweep = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
      sweep.addColorStop(0, "rgba(16,185,129,0.04)");
      sweep.addColorStop(1, "rgba(16,185,129,0)");
      ctx.fillStyle = sweep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, len, angle - 0.7, angle);
      ctx.closePath();
      ctx.fill();

      // 距离环
      const maxR = Math.min(w, h) * 0.42;
      for (let i = 1; i <= 4; i++) {
        const r = (maxR / 4) * i;
        ctx.strokeStyle = `rgba(16,185,129,${0.03 + i * 0.005})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 十字准线
      ctx.strokeStyle = "rgba(16,185,129,0.04)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy); ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />;
}

/* ═══════════════════════════════════════════
   浮动粒子
   ═══════════════════════════════════════════ */
function FloatingParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${(i * 37 + 13) % 100}%`,
    top: `${(i * 53 + 7) % 100}%`,
    size: 1 + (i % 3),
    delay: `${(i * 0.6) % 10}s`,
    duration: `${5 + (i % 6) * 1.8}s`,
    color: i % 3 === 0
      ? "rgba(6,182,212,0.4)"
      : i % 3 === 1
        ? "rgba(139,92,246,0.35)"
        : "rgba(16,185,129,0.45)",
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="home-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   数字递增动画
   ═══════════════════════════════════════════ */
function CountUp({ value, suffix = "", prefix = "", duration = 2 }: {
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
   Scroll Reveal 包装器
   ═══════════════════════════════════════════ */
function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const variants = {
    hidden: {
      opacity: 0,
      y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
      x: direction === "left" ? 40 : direction === "right" ? -40 : 0,
      scale: direction === "scale" ? 0.92 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        delay,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   检测能力配置
   ═══════════════════════════════════════════ */
const FEATURES = [
  {
    icon: PersonStanding,
    name: "跌倒检测",
    desc: "基于 YOLOv8 姿态估计的实时跌倒识别，3D 骨骼关键点分析，毫秒级响应",
    color: "#ef4444",
    accent: "from-red-500/10 to-red-500/0",
  },
  {
    icon: Swords,
    name: "打架检测",
    desc: "多目标动作分析与冲突预警，速度场异常行为捕捉，智能分级告警",
    color: "#f97316",
    accent: "from-orange-500/10 to-orange-500/0",
  },
  {
    icon: ScanEye,
    name: "疲劳检测",
    desc: "面部特征驱动的疲劳状态分析，头部姿态追踪，PERCLOS 算法",
    color: "#eab308",
    accent: "from-yellow-500/10 to-yellow-500/0",
  },
  {
    icon: Eye,
    name: "眼疲劳检测",
    desc: "EAR 算法精准眨眼频率监测，微表情识别，视线追踪分析",
    color: "#8b5cf6",
    accent: "from-violet-500/10 to-violet-500/0",
  },
  {
    icon: MapPinOff,
    name: "离岗检测",
    desc: "电子围栏与区域越界实时告警，时空轨迹追踪，自适应阈值",
    color: "#06b6d4",
    accent: "from-cyan-500/10 to-cyan-500/0",
  },
  {
    icon: Users,
    name: "人员聚集",
    desc: "密度分析与异常聚集自动识别，热力图预警，人群流动建模",
    color: "#22c55e",
    accent: "from-emerald-500/10 to-emerald-500/0",
  },
];

/* ═══════════════════════════════════════════
   架构节点
   ═══════════════════════════════════════════ */
const ARCH_NODES = [
  { label: "摄像头接入", sub: "RTSP / HTTP / USB", icon: Radio, color: "#22c55e" },
  { label: "视频流解码", sub: "OpenCV + CUDA 加速", icon: Cpu, color: "#06b6d4" },
  { label: "AI 推理引擎", sub: "YOLOv8n-pose · TensorRT", icon: Zap, color: "#8b5cf6" },
  { label: "行为分析引擎", sub: "6 种检测算法并行", icon: Activity, color: "#f97316" },
  { label: "智能告警推送", sub: "SSE 实时 · WebSocket", icon: Shield, color: "#ef4444" },
];

/* ═══════════════════════════════════════════
   技术栈标签
   ═══════════════════════════════════════════ */
const TECH_STACK = [
  { name: "Python", icon: Terminal },
  { name: "Spring Boot", icon: Layers },
  { name: "React", icon: Gauge },
  { name: "CUDA", icon: Cpu },
];

/* ═══════════════════════════════════════════
   主页组件
   ═══════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hero 进入动画序列
  const stagger = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.12, delayChildren: 0.3 },
    },
  };

  const fadeItem = {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: "easeOut" as const },
    },
  };

  return (
    <>
      <FontLoader />
      <div className="min-h-screen bg-[#030817] text-white overflow-x-hidden selection:bg-emerald-500/30">
        {/* ── 导航栏 ── */}
        <header
          className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
            scrolled
              ? "bg-[#030817]/60 backdrop-blur-2xl border-b border-white/[0.04] shadow-[0_1px_30px_rgba(0,0,0,0.3)]"
              : "bg-transparent"
          }`}
        >
          <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="relative">
                <Shield className="w-[22px] h-[22px] text-emerald-400" />
                <div className="absolute inset-0 w-[22px] h-[22px] rounded-full bg-emerald-400/20 blur-lg" />
              </div>
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
              >
                长明灯
              </span>
              <span
                className="hidden sm:inline text-[10px] text-white/15 tracking-[0.35em] uppercase ml-1"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Everlight
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <a
                href="#features"
                className="hidden md:inline text-[13px] text-white/30 hover:text-white/60 transition-colors duration-300"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                功能
              </a>
              <a
                href="#metrics"
                className="hidden md:inline text-[13px] text-white/30 hover:text-white/60 transition-colors duration-300"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                指标
              </a>
              <a
                href="#arch"
                className="hidden md:inline text-[13px] text-white/30 hover:text-white/60 transition-colors duration-300"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                架构
              </a>
              <div className="w-px h-4 bg-white/10 hidden md:block mx-1" />
              <button
                onClick={() => navigate("/login")}
                className="group relative px-4 py-[7px] rounded-lg bg-white/[0.04] border border-white/[0.08]
                           text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/[0.08]
                           hover:border-white/[0.15] transition-all duration-300 cursor-pointer"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                进入系统
                <ArrowRight className="inline-block w-3 h-3 ml-1 -translate-y-px opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
              </button>
            </motion.div>
          </div>
        </header>

        {/* ── Hero ── */}
        <section ref={heroRef} className="relative h-screen flex flex-col items-center justify-center px-6 noise-overlay scanline">
          {/* 背景层 */}
          <RadarBackground />
          <FloatingParticles />

          {/* 渐变光球 */}
          <div className="hero-blob hero-blob-1" style={{ top: "10%", left: "20%" }} />
          <div className="hero-blob hero-blob-2" style={{ top: "30%", right: "10%" }} />
          <div className="hero-blob hero-blob-3" style={{ bottom: "20%", left: "40%" }} />

          {/* 内容层 */}
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="relative z-10 text-center max-w-[900px]"
          >
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center"
            >
              {/* 状态徽章 */}
              <motion.div
                variants={fadeItem}
                className="inline-flex items-center gap-2.5 px-4 py-[6px] rounded-full bg-white/[0.03] border border-white/[0.06] mb-10"
              >
                <span className="relative flex h-[6px] w-[6px]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-[6px] w-[6px] bg-emerald-400" />
                </span>
                <span
                  className="text-[10px] text-white/30 tracking-[0.25em] uppercase"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  System Online · AI Active · All Modules Running
                </span>
              </motion.div>

              {/* 主标题 */}
              <motion.h1
                variants={fadeItem}
                className="text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.9] tracking-[-0.04em]"
              >
                <span
                  className="block text-gradient-white"
                  style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
                >
                  监狱智能
                </span>
                <span
                  className="block mt-2 text-gradient-emerald"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  行为分析平台
                </span>
              </motion.h1>

              {/* 副标题 */}
              <motion.p
                variants={fadeItem}
                className="mt-8 text-[15px] text-white/20 tracking-[0.4em] uppercase"
                style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 400 }}
              >
                AI · Realtime · Prevention
              </motion.p>

              {/* CTA */}
              <motion.div variants={fadeItem} className="mt-12 flex items-center gap-4">
                <button
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  className="group relative px-8 py-3.5 rounded-xl font-semibold text-[14px] cursor-pointer
                             text-white transition-all duration-300 overflow-hidden"
                  style={{
                    fontFamily: "'Exo 2', sans-serif",
                    background: "linear-gradient(135deg, #059669, #0d9488)",
                    boxShadow: "0 0 40px rgba(16,185,129,0.2), 0 0 80px rgba(16,185,129,0.05), inset 0 1px 0 rgba(255,255,255,0.1)",
                  }}
                >
                  <span className="relative z-10">了解更多</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="group px-8 py-3.5 rounded-xl font-medium text-[14px] cursor-pointer
                             bg-white/[0.03] border border-white/[0.08] text-white/50
                             hover:bg-white/[0.06] hover:text-white/80 hover:border-white/[0.12]
                             transition-all duration-300"
                  style={{ fontFamily: "'Exo 2', sans-serif" }}
                >
                  直接体验
                  <ArrowRight className="inline-block w-3.5 h-3.5 ml-1.5 -translate-y-px opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* 滚动指示器 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.8 }}
            className="absolute bottom-10 z-10"
          >
            <div className="w-[22px] h-[36px] rounded-full border border-white/15 flex items-start justify-center pt-[6px]">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-[3px] h-[6px] rounded-full bg-white/30"
              />
            </div>
          </motion.div>
        </section>

        {/* ── 检测能力 (Bento Grid) ── */}
        <section id="features" className="relative py-32 px-6">
          <div className="max-w-[1200px] mx-auto">
            <Reveal className="text-center mb-20">
              <span
                className="text-[10px] text-emerald-500/50 tracking-[0.4em] uppercase block mb-3"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Detection Capabilities
              </span>
              <h2
                className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-tight"
                style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
              >
                六大检测能力
              </h2>
              <p
                className="mt-4 text-[14px] text-white/20 max-w-lg mx-auto leading-relaxed"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                基于 YOLOv8 姿态估计，覆盖监狱核心安全场景，全天候智能守护
              </p>
            </Reveal>

            {/* Bento Grid: 1 大 + 5 小 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 大卡片 — 跌倒检测 */}
              {(() => {
                const FallIcon = FEATURES[0].icon;
                return (
              <Reveal delay={0} className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
                <div
                  className="group relative h-full min-h-[320px] rounded-2xl p-[1px] cursor-default overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${FEATURES[0].color}25, transparent 60%)`,
                  }}
                >
                  <div className="relative rounded-2xl bg-[#070d1a]/90 backdrop-blur-sm p-8 h-full flex flex-col justify-between">
                    {/* 背景光晕 */}
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-red-500/[0.06] blur-[80px] group-hover:bg-red-500/[0.10] transition-colors duration-700" />

                    <div className="relative">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                        style={{ backgroundColor: FEATURES[0].color + "12", color: FEATURES[0].color }}
                      >
                        <FallIcon className="w-7 h-7" />
                      </div>
                      <h3
                        className="text-xl font-bold mb-3"
                        style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
                      >
                        {FEATURES[0].name}
                      </h3>
                      <p
                        className="text-[13px] text-white/25 leading-relaxed max-w-sm"
                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                      >
                        {FEATURES[0].desc}
                      </p>
                    </div>

                    {/* 底部装饰线 */}
                    <div className="relative mt-6 h-[1px] bg-gradient-to-r from-red-500/20 via-transparent to-transparent" />
                  </div>
                </div>
              </Reveal>
                );
              })()}

              {/* 小卡片 — 其余 5 个 */}
              {FEATURES.slice(1).map((f, i) => (
                <Reveal key={f.name} delay={0.08 * (i + 1)}>
                  <div
                    className="group relative h-full rounded-2xl p-[1px] cursor-default overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${f.color}18, transparent 50%)`,
                    }}
                  >
                    <div className="relative rounded-2xl bg-[#070d1a]/80 backdrop-blur-sm p-5 h-full">
                      <div
                        className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{ backgroundColor: f.color + "10" }}
                      />

                      <div
                        className="relative w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundColor: f.color + "10", color: f.color }}
                      >
                        <f.icon className="w-[18px] h-[18px]" />
                      </div>

                      <h3
                        className="relative text-[14px] font-semibold mb-1.5"
                        style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
                      >
                        {f.name}
                      </h3>
                      <p
                        className="relative text-[12px] text-white/20 leading-relaxed"
                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                      >
                        {f.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── 核心指标 ── */}
        <section id="metrics" className="relative py-32 px-6">
          <div className="max-w-[1200px] mx-auto">
            <Reveal className="text-center mb-20">
              <span
                className="text-[10px] text-emerald-500/50 tracking-[0.4em] uppercase block mb-3"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Performance
              </span>
              <h2
                className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-tight"
                style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
              >
                核心指标
              </h2>
            </Reveal>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { value: 96.5, suffix: "%", label: "检测准确率", color: "text-emerald-400", glow: "shadow-emerald-500/5" },
                { value: 200, suffix: "ms", prefix: "<", label: "响应延迟", color: "text-cyan-400", glow: "shadow-cyan-500/5" },
                { value: 50, suffix: "+", label: "并发摄像头", color: "text-violet-400", glow: "shadow-violet-500/5" },
                { value: 99.9, suffix: "%", label: "系统可用性", color: "text-emerald-400", glow: "shadow-emerald-500/5" },
              ].map((m, i) => (
                <Reveal key={m.label} delay={i * 0.1}>
                  <div
                    className={`group relative rounded-2xl bg-white/[0.02] border border-white/[0.04] p-7
                               hover:bg-white/[0.035] hover:border-white/[0.07] transition-all duration-500
                               shadow-lg ${m.glow}`}
                  >
                    <div
                      className={`text-[clamp(2.5rem,5vw,3.5rem)] font-bold tracking-tight ${m.color}`}
                      style={{ fontFamily: "'Share Tech Mono', monospace" }}
                    >
                      <CountUp value={m.value} suffix={m.suffix} prefix={m.prefix ?? ""} />
                    </div>
                    <div
                      className="mt-3 text-[13px] text-white/25"
                      style={{ fontFamily: "'Exo 2', sans-serif" }}
                    >
                      {m.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── 技术架构 (数据流管道) ── */}
        <section id="arch" className="relative py-32 px-6">
          <div className="max-w-[800px] mx-auto">
            <Reveal className="text-center mb-24">
              <span
                className="text-[10px] text-emerald-500/50 tracking-[0.4em] uppercase block mb-3"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                Architecture
              </span>
              <h2
                className="text-[clamp(2rem,4vw,3.5rem)] font-bold tracking-tight"
                style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
              >
                技术架构
              </h2>
              <p
                className="mt-4 text-[14px] text-white/20"
                style={{ fontFamily: "'Exo 2', sans-serif" }}
              >
                从摄像头接入到智能告警，全链路毫秒级响应
              </p>
            </Reveal>

            {/* 竖向管道 */}
            <div className="relative">
              {/* 中心线 */}
              <div className="absolute left-[23px] sm:left-1/2 top-0 bottom-0 w-px sm:-translate-x-px">
                <div className="w-full h-full bg-gradient-to-b from-emerald-500/20 via-emerald-500/8 to-transparent data-flow-line" />
              </div>

              {ARCH_NODES.map((node, i) => (
                <Reveal
                  key={node.label}
                  delay={i * 0.12}
                  direction={i % 2 === 0 ? "left" : "right"}
                  className="relative mb-12 last:mb-0"
                >
                  <div className={`flex items-center gap-5 sm:gap-0 ${i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"}`}>
                    {/* 文字区 */}
                    <div className={`flex-1 ${i % 2 === 0 ? "sm:pr-12 sm:text-right" : "sm:pl-12 sm:text-left"} pl-16 sm:pl-0`}>
                      <div
                        className="text-[15px] font-semibold mb-1"
                        style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
                      >
                        {node.label}
                      </div>
                      <div
                        className="text-[12px] text-white/20 font-light tracking-wide"
                        style={{ fontFamily: "'Share Tech Mono', monospace" }}
                      >
                        {node.sub}
                      </div>
                    </div>

                    {/* 节点 */}
                    <div className="absolute left-0 sm:relative sm:left-auto shrink-0 z-10">
                      <div
                        className="w-12 h-12 rounded-full bg-[#070d1a] border flex items-center justify-center
                                   shadow-[0_0_25px_rgba(16,185,129,0.06)] transition-shadow duration-500
                                   hover:shadow-[0_0_35px_rgba(16,185,129,0.12)]"
                        style={{ borderColor: node.color + "25" }}
                      >
                        <node.icon className="w-5 h-5" style={{ color: node.color }} />
                      </div>
                    </div>

                    {/* 对侧空白 */}
                    <div className="hidden sm:block flex-1" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="relative py-32 px-6">
          <Reveal className="max-w-[600px] mx-auto text-center">
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight mb-5"
              style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
            >
              准备好开始了吗？
            </h2>
            <p
              className="text-[14px] text-white/20 mb-10 leading-relaxed"
              style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
              部署长明灯，让 AI 为您的安防体系注入智能
            </p>
            <button
              onClick={() => navigate("/login")}
              className="group relative px-10 py-4 rounded-xl font-semibold text-[15px] cursor-pointer
                         text-white transition-all duration-300 overflow-hidden"
              style={{
                fontFamily: "'Exo 2', sans-serif",
                background: "linear-gradient(135deg, #059669, #0d9488)",
                boxShadow: "0 0 60px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <span className="relative z-10">立即体验</span>
              <ArrowRight className="inline-block w-4 h-4 ml-2 -translate-y-px relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>
          </Reveal>
        </section>

        {/* ── 页脚 ── */}
        <footer className="relative py-14 border-t border-white/[0.03]">
          <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5 text-white/15 text-[12px]">
              <Shield className="w-3.5 h-3.5 text-emerald-500/25" />
              <span style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>长明灯 · 监狱智能行为分析系统</span>
            </div>
            <div className="flex items-center gap-2">
              {TECH_STACK.map((t) => (
                <span
                  key={t.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.035] text-[11px] text-white/12"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  <t.icon className="w-3 h-3" />
                  {t.name}
                </span>
              ))}
            </div>
            <span
              className="text-[11px] text-white/10"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              &copy; 2026
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
