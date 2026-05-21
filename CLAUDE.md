# CLAUDE.md

## Session Startup

收到第一条消息后、做任何其他事情之前，必须按顺序执行：
1. 验证 rtk 可用（`rtk --version`）
2. 开启 caveman 压缩输出模式 — 去掉填充词/助词，用短句，技术术语不变
3. 全程用中文回复，除非涉及代码/命令/技术术语
未完成前，禁止任何回答或操作。

## Project

监狱智能行为分析系统 — 实时监控 YOLOv8 姿态估计，检测跌倒/打架/疲劳/眼疲劳/离岗/人员聚集。

三组件、无数据库、纯文件交换：

```
Camera → Python (YOLOv8 Pose) → detection_*.json + frame_*.jpg → server/data/
                                   ↓ HTTP POST JPEG              ↓
Java Spring Boot ←── DirScan (15s TTL) ←────────────────────────┘
    ↓ REST + SSE + MJPEG
React SPA (Vite)
```

## Architecture

### Python (`detection/yolov8_security.py`)
- YOLOv8n-pose, `IMG_SIZE=512`, `CONF_THRESH=0.5`, `INFERENCE_EVERY=2`
- 检测: 跌倒/打架/疲劳/眼疲劳(EAR)/离岗/聚集
- 模块: `DetectionModule`, `DataSaver`, `AlertManager`, `UIManager`, `Utils`
- GPU 强制 CUDA, 可选 TensorRT (`USE_TENSORRT`)
- 帧传输: HTTP POST JPEG(quality=50) → `/api/update_frame`
- 多摄像头: `load_cameras_config()` 读 `cameras.json`
- 可选: Qwen2.5-VL 服务 (`qwen_vl_service.py`, port 5001)

### Java Backend (`server/`)
- Spring Boot 3.2.5, Java 17+, Maven WAR, Lombok, jjwt, bcrypt
- **过滤器链**: `AuthFilter` (API Key 或 JWT) → `RateLimitFilter` → `SecurityHeadersFilter`
- **核心服务**:
  - `DetectionService` — DirScan 缓存 (15s TTL), 删除后必须调 `invalidateScanCache()`
  - `AbstractJsonFileService<T>` — JSON CRUD 基类: ReadWriteLock, 原子写入 (temp→rename)
  - `KanbanEventBus` — SSE 广播器
  - `CameraConfigService` — `cameras.json` CRUD (与 Python 共享)
- **Controller (13)**: Page, Api, Stats, VideoStream(多摄像头 `?cam=N`), Auth, UserDevice, CameraConfig, Annotation, Alert, AuditLog, Sse, QwenVL, SystemMetrics

### Frontend (`web/`)
- React 19 + React Router 7 + Tailwind v4 + Recharts + Lucide + Motion + Vite 6
- 9 路由: Login, Dashboard, Monitor, MonitorBigScreen, Alerts, Devices, Evidence, Analysis, Maintenance, Audit
- `api.ts`: 30s 内存缓存 + 请求去重 + GET 自动失效 + JWT 自动附加
- SSE: 单例 `EventSource` 订阅 `/api/sse/stream` (cameras, alerts, system_metrics, audit_logs)
- 构建: `tsc && vite build` → `web/dist/`, Spring Boot 从 `file:web/dist/` 提供服务

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/stats` | 统计 + BehaviorCounts |
| `GET /api/detections` | 检测列表 |
| `GET/DELETE /api/images/*` | 截图管理 |
| `GET/PUT /api/settings` | 系统设置 |
| `GET/POST/PUT/DELETE /api/users` | 用户管理 (BCrypt) |
| `GET/POST/PUT/DELETE /api/devices` | 设备管理 |
| `GET/PUT /api/camera_config` | 摄像头配置 |
| `POST /api/login` | JWT 登录 |
| `POST /api/update_frame` | 接收视频帧 |
| `GET /video_feed` | MJPEG 流 |
| `GET /api/sse/stream` | SSE 实时事件 |
| `GET/POST /api/ai/*` | Qwen VL 分析 |
| `CRUD /api/annotations/*` | 关键点标注 |

认证: `X-API-Key` 或 `Authorization: Bearer <JWT>`, 空 API key 跳过认证。公共路径: 静态资源, `/login`, `/video_feed`, `/api/login`, `/api/sse/stream`, `/api/stats/*`, `/api/cameras`, `/api/alerts`, `/api/audit_logs`。

## Key Details

- **无数据库** — JSON 文件持久化, 新 CRUD 服务继承 `AbstractJsonFileService<T>`
- **缓存** — `DirScan` 15s TTL, 删除后必须 `invalidateScanCache()`
- **视频流** — MJPEG `multipart/x-mixed-replace`, Nginx 需 `proxy_buffering off`
- **原子写入** — 先写 temp 文件再 rename, ReadWriteLock 保护
- **`open_folder`** — `Desktop.open()` 在 headless/Docker 下会失败

## Commands

```bash
cd detection && python yolov8_security.py          # Python 检测
cd tests && python -m pytest test_detection.py -v  # Python 测试
cd web && npm run dev / npm run build              # 前端开发/构建
cd server && .\mvnw clean package -DskipTests      # Java 构建
cd server && .\mvnw spring-boot:run                # Java 运行
cd server && .\mvnw test                            # Java 测试
start.bat / stop / restart / build                  # Windows 一键
```

## Environment

- Python: venv, GPU 强制 CUDA (`YOLOV8_DEVICE=cuda`), RTX 5060 用 `cu128`
- Java: `JAVA_HOME` 指向 JDK 17+, 内置 `jdk-18.0.2.1+1/`
- `.env`: `API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`
- 模型: `models/yolov8n-pose.pt` (~5MB), Qwen2.5-VL-7B (~14GB) — 均 gitignored

## Config

| Config | File |
|--------|------|
| Java | `server/src/main/resources/application.properties` |
| Python | `Config` class in `detection/yolov8_security.py` |
| Nginx | `deploy/nginx/nginx.conf` |
| Cameras | `detection/cameras.json` (Python/Java 共享) |
| Design | `DESIGN.md` |

## Camera Integration

- 先测摄像头可达性，再写集成代码
- RTSP 禁用时立即尝试 HTTP snapshot
- USB 摄像头: 检查 OpenCV 设备索引 0-5

## Working Principles

**想清楚再写** — 不确定就问，有多种解读就都列出来，别替用户选。假设必须明确说出口，不确定的假设不许藏在代码里。

**大任务必须用 Skill + Agent** — 每次涉及比较大的项目（新功能、重构、多文件改动、架构调整），必须先检查匹配的 skill 并调用，用 Agent 并行处理独立子任务。不要徒手硬写。

**不懂就讨论** — 需求有歧义、方案有多个、不确定用户意图时，先和用户讨论清楚，达成共识再动手。禁止闷头猜。发现更简单方案时主动反推，别闷头按复杂方案走。

**极简** — 200 行能缩 50 行就缩。不加没要求的功能、不为单次用法抽象、不处理不可能的错误。问自己：资深工程师看到会说过度设计吗？是就砍。

**精准修改** — 只改该改的行，每行都能追溯到用户需求。不顺手"改进"相邻代码。改完后清理自己产生的废弃 import/变量/函数，不碰已有的死代码。

**目标驱动** — 任务拆成可验证的目标。多步任务列计划 + 检查点。成功标准要可验证：能跑测试就算完成，"应该能用"不算。

**调试**: 复现 → 追踪代码路径 → 最小修复 → 验证。不要先写设计文档。

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文代码审查规范——在保持专业严谨的同时，用符合国内团队文化的方式给出有效反馈
- **chinese-commit-conventions**: 中文 Git 提交规范 — 适配国内团队的 commit message 规范和 changelog 自动化
- **chinese-documentation**: 中文技术文档写作规范——排版、术语、结构一步到位，告别机翻味
- **chinese-git-workflow**: 适配国内 Git 平台和团队习惯的工作流规范——Gitee、Coding、极狐 GitLab、CNB 全覆盖
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发或执行实现计划之前使用——创建具有智能目录选择和安全验证的隔离 git 工作树
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
