# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

监狱智能行为分析系统 (Prison Intelligent Behavior Analysis System) — real-time security monitoring using YOLOv8 pose estimation. Detects falls, fighting, fatigue, eye fatigue, guard absence, and crowd gathering in prison environments.

## Architecture

Two-component system with no database — flat-file JSON exchange:

```
Camera/Video → Python (YOLOv8 Pose) → detection_*.json + frame_*.jpg → server/data/
                                │                                      │
                                └── HTTP POST JPEG frames ──→ /api/update_frame
                                                                  │
Java Spring Boot ←── DirScan of server/data/ (15s TTL cache)     │
                 ←── SSE push /api/sse/stream (cameras, alerts, system_metrics)
                 ←── MJPEG /video_feed                            │
                                                                  │
React SPA (Vite) ←── REST polling + SSE subscription + MJPEG video
```

### Python Detection (`detection/yolov8_security.py`)
- YOLOv8n-pose model for real-time pose estimation
- Detects: 跌倒 (fall), 打架 (fighting), 疲劳 (fatigue/posture), 眼疲劳 (eye fatigue via EAR), 离岗 (leave post), 人员聚集 (crowd gathering)
- `Config` class (line ~86) centralizes all parameters: model path, `IMG_SIZE=512`, `CONF_THRESH=0.5`, detection thresholds, EAR threshold, head nod params, `INFERENCE_EVERY=2` (frame skip), TensorRT toggle
- Modules: `DetectionModule`, `DataSaver`, `AlertManager`, `UIManager`, `Utils`
- `Utils` has geometry helpers: `calculate_iou()`, `calculate_distance()`, `calculate_angle()`, `calculate_eye_aspect_ratio()`, `detect_head_tilt()`
- Multi-camera via `load_cameras_config()` reading `cameras.json`
- GPU: env var `YOLOV8_DEVICE=cuda`, cuDNN benchmark, optional TensorRT export (`USE_TENSORRT`)
- Frame sending: HTTP POST JPEG (quality=50) to Java backend every frame
- Optional Qwen2.5-VL service (`detection/qwen_vl_service.py`, port 5001) for LLM scene analysis

### Java Spring Boot Backend (`server/`)
- Spring Boot 3.2.5, Java 18 (target 17), Maven WAR, Lombok, jjwt (JWT), bcrypt
- Package: `com.yolov8.security`

**Config classes:**
- `AppConfig.java` — `@ConfigurationProperties(prefix="app")` with nested FileConfig, MonitorConfig, PythonConfig, QwenVLConfig, CleanupConfig
- `AuthFilter.java` — dual auth: `X-API-Key` header OR `Authorization: Bearer <JWT>`. Empty API key skips auth.
- `RateLimitFilter.java` — sliding window per-IP (API: 60/60s, video: 5/30s, delete: 3/60s)
- `SecurityHeadersFilter.java` — CSP, X-Content-Type-Options, X-Frame-Options
- `DataCleanupTask.java` — scheduled cleanup of old detection files

**Controllers (13):** `PageController` (SPA fallback → `index.html`), `ApiController`, `StatsController`, `VideoStreamController` (MJPEG, multi-cam via `?cam=N`), `AuthController`, `UserDeviceController`, `CameraConfigController`, `AnnotationController`, `AlertController`, `AuditLogController`, `SseController`, `QwenVLController`, `SystemMetricsController`

**Services (12):**
- `DetectionService` — scans `server/data/` with `DirScan` cache (15s TTL, `SCAN_CACHE_TTL_MS=15000L`), system info cache (60s TTL), background cache warmer. Must call `invalidateScanCache()` after deletes.
- `AbstractJsonFileService<T>` — base for JSON-file CRUD: `ReadWriteLock`, atomic writes (temp-file + rename), in-memory cache. Extended by `UserService`, `DeviceService`.
- `SettingsService` — standalone (NOT extending AbstractJsonFileService)
- `CameraConfigService` — CRUD for `cameras.json` (shared with Python)
- `AnnotationService` — keypoint annotation management, YOLO/COCO export
- `KanbanEventBus` — SSE event broadcaster for real-time push (standalone class, not extending AbstractJsonFileService)
- Others: `AlertService`, `AuditLogService`, `ModelInfoService`, `PythonScriptService`, `QwenVLService`

### Frontend (`web/`) — React SPA
- React 19 + React Router 7 + Tailwind CSS v4 (via `@tailwindcss/vite`) + Recharts + Lucide React + Motion + Vite 6
- `src/App.tsx` — 9 page routes + fullscreen monitor: Login, Dashboard, Monitor, MonitorBigScreen (`/monitor/fullscreen`), Alerts, Devices, Evidence, Analysis, Maintenance, Audit. Default `/` redirects to `/monitor`.
- Components: `Layout` (sidebar + topbar), `CameraPanel`, `ErrorBoundary`, `LoadingError`
- `src/lib/api.ts` — REST + SSE client: 30s in-memory cache, request deduplication, auto cache invalidation on mutations, JWT attached to all requests
- `src/lib/auth.tsx` — JWT auth context, `ProtectedRoute` wrapper
- `src/lib/utils.ts` — utility functions
- `src/services/dataService.ts` — SSE subscription and REST call wrapper
- `src/types.ts` — TypeScript interfaces (Camera, Alert, AuditLog, SystemStatus, UserAccount, Settings, etc.)
- `src/index.css` — Tailwind v4 CSS-first config with `@theme` block defining design tokens
- SSE subscription to `/api/sse/stream` with named event types: cameras, alerts, system_metrics, audit_logs, camera_stats. Singleton `EventSource` shared across subscribers.
- Design tokens in `DESIGN.md` — light/dark dual theme, Chinese-first UI
- Legacy JS/CSS in `web/css/` and `web/js/` (from pre-React era, may still be referenced)
- Build: `tsc && vite build` — Spring Boot serves from `file:web/dist/` (dist IS committed, not gitignored)
- Dev: Vite dev server on port 5173, proxies `/api` and `/video_feed` to `localhost:5000`

### Authentication
- `AuthFilter` accepts **either** `X-API-Key` header **or** `Authorization: Bearer <JWT>`
- JWT issued by `POST /api/login` via `AuthController` (jjwt, HMAC-SHA)
- Public paths: static assets (`/css/**`, `/js/**`), `/login`, `/video_feed`, `/api/login`, `/api/sse/stream`, `/api/stats`, `/api/stats/summary`, `/api/camera_config`, `/api/cameras`, `/api/alerts`, `/api/audit_logs`
- Config: `app.api-key` (empty = skip auth in dev), `app.jwt.secret` (from `.env` `JWT_SECRET`)
- Login lockout: 5 failed attempts → 15-minute lockout (client-side in login page)

### REST API (all under `/`)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/stats` | Detection statistics + BehaviorCounts (fall/fight/absent/fatigue/gather) |
| `GET /api/stats/summary` | Aggregated stats summary |
| `GET /api/detections` | Detection list |
| `GET /api/images`, `GET /api/images/{name}` | Screenshot listing/serving |
| `DELETE /api/delete_all_images` | Bulk delete detection data + invalidate cache |
| `GET /api/model_info` | YOLO model quantization info |
| `GET /api/settings`, `PUT /api/settings` | System settings (JSON-persisted) |
| `GET/POST/PUT/DELETE /api/users` | User management (BCrypt passwords) |
| `GET/POST/PUT/DELETE /api/devices` | Device/camera management |
| `GET /api/camera_config`, `PUT /api/camera_config` | Camera config (shared with Python) |
| `GET /api/cameras` | Active camera list |
| `POST /api/login` | JWT authentication (returns token) |
| `POST /api/update_frame` | Receive video frame from Python |
| `GET /video_feed` | MJPEG stream (`multipart/x-mixed-replace`) |
| `GET /api/sse/stream` | SSE real-time events (cameras, alerts, system_metrics, audit_logs) |
| `GET /api/ai/status` | Qwen2.5-VL service health |
| `POST /api/ai/analyze`, `/api/ai/analyze-security`, `/api/ai/batch-analyze` | LLM scene analysis |
| `GET/POST/PUT/DELETE /api/annotations/*` | Keypoint annotation CRUD + YOLO/COCO export |

## Key Implementation Details

- **No database** — all persistence is JSON files on disk. `AbstractJsonFileService` provides `ReadWriteLock`-protected atomic writes (write temp, then rename). New CRUD services should extend this.
- **DetectionService caching** — `DirScan` with 15-second TTL. After `DELETE /api/delete_all_images`, `invalidateScanCache()` must be called.
- **StatsResponse aggregation** — `BehaviorCounts` POJO tracks fall, fight, absent, fatigue, gather. Recent detections capped at 50, all detections at 200.
- **Video streaming** — MJPEG via `multipart/x-mixed-replace`; multi-camera (`?cam=0`, `?cam=1`). Nginx must use `proxy_buffering off` and `proxy_cache off`.
- **SSE real-time push** — `KanbanEventBus` broadcasts to `SseController`. Frontend subscribes via singleton `EventSource` with named event types. Auto-reconnect on disconnect.
- **Frontend API layer** — `api.ts` in-memory 30s cache with request deduplication for GETs. Cache auto-invalidated on mutations. JWT token attached automatically.
- **open_folder** — uses `java.awt.Desktop.open()` — fails in headless/Docker without X11.

## Key Commands

```bash
# Python detection
cd detection && python yolov8_security.py

# Python tests (single: -k "test_name")
cd tests && python -m pytest test_detection.py -v

# Frontend dev server (proxies to localhost:5000)
cd web && npm run dev

# Frontend build (outputs to web/dist/)
cd web && npm run build

# Java build (WAR)
cd server && .\mvnw clean package -DskipTests

# Java dev server
cd server && .\mvnw spring-boot:run

# Java tests
cd server && .\mvnw test

# Docker
cd deploy && docker-compose up -d / down / logs -f

# Windows one-click
start.bat              # clean → build → run
start.bat stop / restart / build
```

## Build & Verification

After editing source files, always rebuild and verify:
- **Java**: `cd server && .\mvnw clean package -DskipTests`, then `spring-boot:run` or copy WAR
- **Frontend**: `cd web && npm run build` — Spring Boot serves from `file:web/dist/`
- **Python**: no build step, just restart detection process
- **Always** test the affected endpoint/UI before reporting success

## Environment

- Python: venv (NOT conda)
- PyTorch: CUDA 12.8 for RTX 5060: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128`
- GPU inference is MANDATORY — always force CUDA, never CPU fallback or frame-skipping
- `JAVA_HOME` must point to JDK 17+ before any Java commands
- Bundled JDK 18 in `jdk-18.0.2.1+1/` for zero-setup Windows deployment
- `.env` — `API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`

## Config Locations

| Config | File | Key Settings |
|--------|------|--------------|
| Java app | `server/src/main/resources/application.properties` | port=5000, JWT, API key, Qwen VL URL, cleanup retention |
| Python | `Config` class in `detection/yolov8_security.py` | MODEL_PATH, IMG_SIZE=512, CONF_THRESH=0.5, DEVICE via env |
| Nginx | `deploy/nginx/nginx.conf` | SSL, reverse proxy, SPA fallback, proxy_buffering off |
| Cameras | `detection/cameras.json` | Shared between Python and Java |
| Design | `DESIGN.md` | Color tokens, typography, spacing (light/dark/login themes) |

## Debugging Philosophy

When user asks to debug or fix specific issue:
- Reproduce error → trace exact code path → apply smallest targeted fix → verify
- Do NOT create design documents or broad exploration first
- Skip over-engineering — user wants concrete fixes, not process

## Platform-Specific Notes

Windows batch scripts (.bat):
- Avoid Chinese chars in echo statements (cmd parsing issues)
- Handle path escaping: trailing backslashes, spaces, quoted arguments
- Test scripts explicitly after changes — encoding/path bugs need 2-3 rounds

## Camera Integration

- Always test camera reachability FIRST before building integration code
- RTSP may be disabled on some cameras — if RTSP fails, try HTTP snapshot endpoint immediately
- USB camera: check device indices 0-5 with OpenCV, clarify which is external vs built-in

## Model Files

- YOLOv8n-pose: `models/yolov8n-pose.pt` (pose estimation, ~5MB)
- Qwen2.5-VL-7B: Optional multimodal model (~14GB)
- Models are gitignored — user must download manually

## Skill routing

When user's request matches an available skill, invoke it via the Skill tool. Key routing:
- Product ideas, brainstorming → invoke /office-hours
- Architecture → invoke /plan-eng-review
- Bugs, errors, "why is this broken" → invoke /investigate
- Code review → invoke /review
- Test site, find bugs → invoke /qa
- Ship, deploy, create PR → invoke /ship
- Security audit → invoke /cso

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
