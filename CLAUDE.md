# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

监狱智能行为分析系统 (Prison Intelligent Behavior Analysis System) — real-time security monitoring using YOLOv8 pose estimation. Detects falls, fighting, fatigue, eye fatigue, guard absence, and crowd gathering in prison environments.

## Architecture

Two-component system with dual Python→Java communication paths:

```
Camera/video file → YOLOv8 Pose (Python, detection/yolov8_security.py)
                          │
                          ├──→ writes detection_*.json + frame_*.jpg to server/data/
                          └──→ HTTP POST frames to /api/update_frame (MJPEG stream)

Java Spring Boot (server/) ←── scans server/data/ (DirScan cache, 2s TTL)
                           ←── serves REST API + MJPEG video feed

Web Dashboard ←── polls /api/stats every 2s, /api/camera_config every 10s
```

### Python Detection (`detection/yolov8_security.py`)
- YOLOv8n-pose model for real-time pose estimation
- Detects: 跌倒 (fall), 打架 (fighting), 疲劳 (fatigue/posture), 眼疲劳 (eye fatigue via EAR), 离岗 (leave post), 人员聚集 (crowd gathering)
- `Config` class (line 76) centralizes all parameters: model path, detection thresholds, alert cooldown, UI colors, save intervals, EAR threshold
- Modules: `DetectionModule`, `DataSaver`, `AlertManager`, `UIManager`
- Optional Qwen2.5-VL service (`detection/qwen_vl_service.py`, port 5001) for LLM-based scene analysis
- GPU inference via `YOLOV8_DEVICE=cuda` env var; supports TensorRT acceleration (`USE_TENSORRT`)

### Java Spring Boot Backend (`server/`)
- Spring Boot 3.2.5, Java 18 (target 17), Maven, WAR packaging
- Multi-page Thymeleaf templates: `monitor.html` (dashboard), `login.html`, `admin.html`, `annotate.html`
- Frontend static assets in `web/` served via `WebConfig` resource handlers (`file:../web/css/`, `file:../web/js/`)

### Authentication
- `AuthFilter` accepts **either** `X-API-Key` header **or** `Authorization: Bearer <JWT>` token
- JWT issued by `POST /api/login` via `AuthController` (uses `jjwt` library, HMAC-SHA)
- Public paths: static assets (`/css/**`, `/js/**`), `/login`, `/video_feed`, `/api/login`, and GET-only endpoints `/api/stats`, `/api/stats/summary`, `/api/camera_config`, `/api/cameras`
- Config: `app.api-key` (empty = skip auth in dev), `app.jwt.secret` (from `.env` `JWT_SECRET`)

### Key Services
- `DetectionService` — scans `server/data/` for `detection_*.json` + `frame_*.jpg`. `DirScan` cache with 2s TTL. Must call `invalidateScanCache()` after deletes.
- `AbstractJsonFileService<T>` — base class for JSON-file CRUD with `ReadWriteLock`, atomic writes (temp-file + move). Extended by `UserService`, `DeviceService`.
- `SettingsService` — standalone service for `settings.json` (does NOT extend AbstractJsonFileService)
- `CameraConfigService` — CRUD for `cameras.json` (shared config with Python side)
- `AnnotationService` — keypoint annotation management, YOLO/COCO export
- `RateLimitFilter` — sliding window per-IP (API: 60/60s, video: 5/30s, delete: 3/60s)
- `SecurityHeadersFilter` — CSP, X-Content-Type-Options, X-Frame-Options

### REST API (all under `/yolov8-security/`)

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
| `GET /api/ai/status` | Qwen2.5-VL service health |
| `POST /api/ai/analyze`, `/api/ai/analyze-security`, `/api/ai/batch-analyze` | LLM scene analysis |
| `GET/POST/PUT/DELETE /api/annotations/*` | Keypoint annotation CRUD + YOLO/COCO export |

## Key Implementation Details

- **Flat-file data exchange (no database)** — Python writes `detection_*.json` and `frame_*.jpg` to `server/data/`, Java's `DetectionService` scans and parses them via Jackson.
- **DetectionService caching** — `DirScan` cache with 2-second TTL (`SCAN_CACHE_TTL_MS = 2000L`). After `DELETE /api/delete_all_images`, `invalidateScanCache()` must be called.
- **StatsResponse aggregation** — `BehaviorCounts` POJO tracks fall, fight, absent, fatigue, gather. Recent detections capped at 50, all detections at 200.
- **Video streaming** — `VideoStreamController` serves MJPEG via `multipart/x-mixed-replace`; supports multi-camera (`?cam=0`, `?cam=1`). Nginx proxies with `proxy_buffering off` and `proxy_cache off`.
- **Auth** — `AuthFilter` checks `X-API-Key` header OR `Authorization: Bearer <JWT>`. Empty `app.api-key` skips auth in dev.
- **Rate limiting** — `RateLimitFilter` uses sliding window counters per IP.
- **AbstractJsonFileService** — generic JSON-file CRUD with in-memory caching, `ReadWriteLock`, and atomic writes. New CRUD services should extend this.
- **Login lockout** — 5 failed attempts triggers 15-minute lockout (client-side in `login.js`).
- **open_folder** — uses `java.awt.Desktop.open()` — will fail in headless/Docker without X11.

## Environment

- Python: Use venv (NOT conda)
- PyTorch: CUDA 12.8 for RTX 5060, install via Tsinghua mirror: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128`
- GPU inference is MANDATORY — always force CUDA device, never default to CPU or frame-skipping
- JAVA_HOME must be set before running any Java commands
- Always clean stale compiled files in `target/classes/` after editing source files — the dashboard won't reflect changes otherwise

## Key Commands

```bash
# Python detection
cd detection && python yolov8_security.py

# Python tests (single test: -k "test_name")
cd tests && python -m pytest test_detection.py -v

# Java build (WAR)
cd server && .\mvnw clean package -DskipTests

# Java dev server
cd server && .\mvnw spring-boot:run

# Java tests
cd server && .\mvnw test

# Docker
cd deploy && docker-compose up -d
cd deploy && docker-compose down
cd deploy && docker-compose logs -f

# Windows one-click
start.bat              # Start all (clean → build → run)
start.bat stop         # Stop all services
start.bat restart      # Restart
start.bat build        # Build WAR only
```

## Startup

- Use `start.bat` with correct ordering: clean stale files FIRST, then build, then start services
- Watch for path escaping issues in .bat files (trailing backslashes)
- After editing any source file, rebuild or manually copy to `target/classes/` before restarting

## Config

- Python: `Config` class in `detection/yolov8_security.py` (line 76)
- Java: `application.properties` + `AppConfig.java`
  - `app.api-key` — API key auth (empty = skip)
  - `app.jwt.secret` — JWT signing key (from `.env`)
  - `server.port=5000` — backend port
  - `app.file.upload-dir=./data` — where DetectionService scans
- Nginx: `deploy/nginx/nginx.conf` — SSL, reverse proxy, SPA fallback
- `.env` — `API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`

## Frontend Rules

- All dashboard data must come from real backend APIs, never mock/placeholder data
- AuthFilter allows static assets (`/css/**`, `/js/**`, `/images/**`) and some GET API endpoints without auth
- Frontend uses `authFetch()` (in `js/common.js`) which handles 401 redirects and stale token cleanup
- No separate frontend build — CSS/JS files in `web/` are served directly by Spring Boot resource handlers

## Camera Integration

- Always test camera reachability FIRST before building any integration code
- RTSP may be disabled on some cameras — if RTSP fails, try HTTP snapshot endpoint immediately
- USB camera detection: check device indices 0-5 with OpenCV, clarify which is external vs built-in

## Model Files

- YOLOv8n-pose: `models/yolov8n-pose.pt` (pose estimation, ~5MB)
- Qwen2.5-VL-7B: Optional multimodal model for advanced scene analysis (~14GB)
- Models are gitignored — user must download manually

## Important Notes

- No database — all data stored as flat JSON files in `server/data/`
- Python reads from `videos/test_video.mp4` by default; change `Config.SOURCE` to `0` for live camera
- Java tests use JUnit 5 with `@TempDir` for isolated file I/O — no mocking framework
- Qwen VL service (port 5001) is entirely optional; the system works without it

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health

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
