# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

监狱智能行为分析系统 (Prison Intelligent Behavior Analysis System) — real-time security monitoring using YOLOv8 pose estimation. Detects falls, fighting, fatigue, eye fatigue, guard absence, and crowd gathering in prison environments.

## Project Architecture

This is a YOLOv8 security analysis system with a Java Spring Boot backend and HTML/JS dashboard frontend. Pipeline: Camera (RTSP/HTTP) → Python YOLOv8 detection → JSON/JPG output → Java API → Dashboard. The dashboard communicates with the backend via REST polling.

## Architecture

Two-component system with dual Python→Java communication paths:

### 1. Python AI Detection (`detection/yolov8_security.py`)
- YOLOv8n-pose model for real-time pose estimation
- Detects: 跌倒 (fall), 打架 (fighting), 疲劳 (fatigue/posture), 眼疲劳 (eye fatigue via EAR), 离岗 (leave post), 人员聚集 (crowd gathering)
- OpenCV-based video processing with UI overlay (OpenCV window)
- **Dual communication to Java backend**:
  - (a) Saves detection JSON (`detection_*.json`) + frame images (`frame_*.jpg`) to `server/data/` directory for Java to scan
  - (b) HTTP POST frames to `/api/update_frame` for real-time MJPEG stream
- Modules: `DetectionModule` (behavior detection), `DataSaver`, `AlertManager`, `UIManager`
- Optional Qwen2.5-VL service (`detection/qwen_vl_service.py`, port 5001) for LLM-based scene analysis

### 2. Java Spring Boot Backend (`server/`)
- Spring Boot 3.x, Java 17, Maven (WAR packaging)
- Serves web dashboard (Thymeleaf template at `src/main/resources/templates/index.html`, ~2200 lines with Chart.js)
- REST API endpoints under `/yolov8-security/`:
  - `GET /api/stats` — detection statistics + behavior counts (polled every 2s by dashboard)
  - `GET /api/images` + `GET /api/images/{name}` — screenshot listing/serving
  - `DELETE /api/delete_all_images` — bulk delete detection data + invalidate cache
  - `GET /api/model_info` — YOLO model quantization info
  - `GET /api/ai/status` — Qwen2.5-VL service health check
  - `POST /api/open_folder` — open screenshots/videos folder on server via `java.awt.Desktop`
  - `GET /video_feed` — MJPEG video stream (`multipart/x-mixed-replace`)
  - `GET/PUT /api/settings` — system settings (JSON-persisted via SettingsService)
  - `GET/POST/PUT/DELETE /api/users` — user management (JSON-persisted via UserService)
  - `GET/POST/PUT/DELETE /api/devices` — device/camera management (JSON-persisted via DeviceService)
- Services: `DetectionService` (cached file scanning), `ModelInfoService`, `PythonScriptService`, `QwenVLService`, `SettingsService`, `UserService`, `DeviceService`
- Service base class: `AbstractJsonFileService<T>` — generic JSON-file-backed CRUD service with in-memory cache, auto-save, and `getDataDir()`/`getFileName()` template methods. All new services extend this.
- Filters: `AuthFilter` (token-based API auth), `RateLimitFilter`, `CorsConfig`
- Nginx reverse proxy (`nginx/nginx.conf`): HTTPS redirect, WebSocket/SSE proxying for video feed, SPA fallback
- Frontend static assets (`web/` directory, served via WebConfig resource handlers):
  - `css/main.css` — global styles (sidebar, header, theme variables)
  - `css/monitor.css`, `css/admin.css`, `css/users.css` — page-specific styles
  - `js/common.js` — shared utilities (API calls, toast notifications, sidebar loader)
  - `js/monitor.js` — dashboard polling, video feed, Chart.js charts
  - `js/admin.js` — admin page logic
  - `js/users.js` — user management page logic
  - `js/devices.js` — device management page logic

### Communication Flow
```
Camera/video file → YOLOv8 Pose (Python)
                              → writes JSON + images to server/data/  ←──┐
                              → HTTP POST frames to Java backend           │
                                                                         │
                              ←── Java scans data/ directory ────────────┘
                              ←── Java serves REST API + MJPEG stream
                              ←── Web dashboard polls /api/stats every 2s
```

## Environment Setup

## Environment
- Python: Use venv (NOT conda)
- PyTorch: CUDA 12.8 for RTX 5060, install via Tsinghua mirror: `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128`
- GPU inference is MANDATORY — always force CUDA device, never default to CPU or frame-skipping
- JAVA_HOME must be set before running any Java commands
- Always clean stale compiled files in target/classes/ after editing source files — the dashboard won't reflect changes otherwise

## Startup
- Use start.bat with correct ordering: clean stale files FIRST, then build, then start services
- Watch for path escaping issues in .bat files (trailing backslashes)
- After editing any source file, rebuild or manually copy to target/classes/ before restarting

## Key Commands

### Python Detection
```bash
cd detection && python yolov8_security.py
```

### Tests
```bash
# Python tests
cd tests && python -m pytest test_detection.py -v
cd tests && python -m pytest test_detection.py -v -k "test_name"

# Java tests
cd server && .\mvnw test
```

### Java Backend
```bash
cd server && .\mvnw clean package -DskipTests     # Build WAR
cd server && .\mvnw spring-boot:run               # Run dev server
cd server && .\mvnw test                           # Run tests
```

### Docker
```bash
docker-compose up -d
docker-compose down
docker-compose logs -f
```

## Key Implementation Details

- **Flat-file data exchange (no database)** — Python writes `detection_*.json` and `frame_*.jpg` to `server/data/`, Java's `DetectionService` scans and parses them via Jackson. This is the primary data flow.
- **DetectionService caching** — `DirScan` cache with 2-second TTL (`SCAN_CACHE_TTL_MS = 2000L`). After `DELETE /api/delete_all_images`, `invalidateScanCache()` must be called or deletes won't be visible immediately.
- **StatsResponse aggregation** — `BehaviorCounts` POJO tracks fall, fight, absent, fatigue, gather. Recent detections capped at 50, all detections at 200.
- **Video streaming** — `VideoStreamController` serves MJPEG via `multipart/x-mixed-replace`; frames are read from disk (written by Python), not generated on-the-fly. Nginx proxies this with `proxy_buffering off` and `proxy_cache off`.
- **Auth** — `AuthFilter` checks `Authorization` header against `app.auth.token` (default from `.env` `API_KEY`). Token mismatch returns 401.
- **Rate limiting** — `RateLimitFilter` uses token bucket per IP.
- **AbstractJsonFileService** — base class for SettingsService, UserService, DeviceService. Provides `getAll()`, `getById()`, `save()`, `delete()` with in-memory caching and auto-persistence to `server/data/` as flat JSON files. New CRUD services should extend this.
- **Python Config class** (`detection/yolov8_security.py`, line 56) centralizes all parameters: model path, detection thresholds, alert cooldown, UI colors, save intervals, EAR threshold for eye fatigue.

## Config

- Python: `Config` class in `detection/yolov8_security.py` (line 56)
- Java: `application.properties` + `AppConfig.java`
  - `app.auth.token=${API_KEY:default-dev-token}` — API auth token
  - `server.port=5000` — backend port
  - `file.upload-dir=../data` — where DetectionService scans for data
- Nginx: `nginx/nginx.conf` — SSL certs, reverse proxy, SPA fallback
- Web server URL: env var `WEB_SERVER_URL` (default: `http://127.0.0.1:5000/yolov8-security`)

## Model Files

- YOLOv8n-pose: `models/yolov8n-pose.pt` (pose estimation, ~5MB ONNX/PyTorch)
- Qwen2.5-VL-7B: Optional multimodal model for advanced scene analysis (~14GB)

## Important Notes

- No database — all detection data is stored as flat JSON files in `server/data/`
- The Python script reads from a video file (`videos/test_video.mp4`) by default; change `Config.SOURCE` to `0` for live camera
- Java tests use JUnit 5 with `@TempDir` for isolated file I/O testing — no mocking framework
- The web UI is a single Thymeleaf template with embedded CSS/JS using Chart.js (no separate frontend build)
- `open_folder` endpoint uses `java.awt.Desktop.open()` — will fail in headless/Docker environments without X11
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

