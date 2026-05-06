# 实现计划：监控大屏主页化 + 数据标注模块

**日期**: 2026-05-06
**设计规格**: `docs/superpowers/specs/2026-05-06-monitor-annotation-design.md`
**分支**: main

---

## 前提假设（Premises）

- **P1**: 流水线截帧为主要图片来源（检测到行为时自动保存），上传功能作为补充
- **P2**: <10K 规模，JSON 平面文件存储足够
- **P3**: 自建标注模块（Fabric.js），不集成 Label Studio/CVAT

## 决策审计（CEO Review）

| # | 严重度 | 发现 | 原则 | 决策 |
|---|--------|------|------|------|
| 1 | CRITICAL | backend/data/ 0 张截帧 | Pragmatic | 排查后确认：actions 为空时截帧不保存，逻辑正确。生产环境会正常产生截帧。 |
| 2 | HIGH | /api/stats/summary 和 /api/cameras 可能不存在 | Completeness | Phase 2 中验证并创建缺失端点。 |
| 3 | HIGH | 50K+ 标注时平面文件存储会崩溃 | Pragmatic | 监狱场景 <10K，MVP 可接受。 |
| 4 | HIGH | 两个功能捆绑有范围风险 | Bias toward action | 保持捆绑，分阶段交付：monitor 先于 annotation。 |
| 5 | HIGH | "保留 index.html 为主页"方案未分析 | DRY | 不同用途：index=数据看板，monitor=实时视频。不重复。 |
| 6 | HIGH | 60% 精力在通用标注 vs 40% 核心产品 | Pragmatic | 自建合理：紧密集成检测数据、无外部依赖。范围保持最小。 |
| 7 | MEDIUM | AnnotationService 测试范围 | Completeness | 按计划完整 CRUD + 导出测试。 |
| 8 | MEDIUM | Fabric.js CDN 依赖 | Pragmatic | 内部系统可接受 CDN。添加降级注释。 |
| 9 | MEDIUM | 导出格式边界情况 | Explicit over clever | 严格遵循 YOLO/COCO 规范。 |
| 10 | MEDIUM | 侧边栏导航一致性 | DRY | 3 个页面统一导航组件。 |

## 决策审计（Design Review）

| # | 严重度 | 发现 | 决策 |
|---|--------|------|------|
| 1 | CRITICAL | CSS 变量碎片化（3 套系统） | 扩展 common.css，添加 `[data-theme="dark"]` 暗色主题。 |
| 2 | CRITICAL | admin.html 使用 40+ emoji 图标 | Phase 5 中将 emoji 转为 SVG。 |
| 3 | HIGH | 无 focus 样式 | common.css 中添加 `:focus-visible`。 |
| 4 | HIGH | JetBrains Mono 未导入 | 添加 Google Fonts 导入 + `--font-mono` 变量。 |
| 5 | HIGH | monitor 页面无状态设计 | 添加加载/错误/空状态。 |
| 6 | HIGH | annotation 页面无状态设计 | 添加空列表/未选择/未保存/上传错误状态。 |
| 7 | MEDIUM | annotation 无响应式断点 | ≥1400px 三栏，1024-1399px 折叠，<1024px 标签切换。 |
| 8 | MEDIUM | annotation 主题矛盾 | 使用 common.css + `[data-theme="dark"]`。 |
| 9 | MEDIUM | monitor 侧边栏导航冲突 | 使用顶栏导航，保留网格布局。 |
| 10 | MEDIUM | 标注工具栏位置未指定 | 水平工具栏在画布上方。 |
| 11 | MEDIUM | 快捷键不可发现 | tooltip + `?` 帮助对话框 + 底栏提示。 |
| 12 | LOW | 侧边栏宽度不一致 | 导航 200px，monitor 告警侧边栏 260px。 |
| 13 | LOW | 颜色变量命名不一致 | 统一 `--accent`。 |
| 14 | LOW | webcam/模拟代码移除 | 确认不在范围，处理"无摄像头"空状态。 |

## 决策审计（Eng Review）

| # | 严重度 | 发现 | 决策 |
|---|--------|------|------|
| 1 | CRITICAL | AbstractJsonFileService 不兼容逐文件存储 | 自定义 AnnotationService，参考 CameraConfigService 模式。 |
| 2 | CRITICAL | /api/annotations/stats 路由冲突 | 非参数路由放在控制器前面。 |
| 3 | HIGH | /api/cameras 返回流 ID 非设备配置 | 前端合并 /api/camera_config + /api/cameras。 |
| 4 | HIGH | 缺少文件上传大小配置 | application.properties 添加 max-file-size=5MB。 |
| 5 | HIGH | 上传路径遍历漏洞 | 文件名清理 + 生成唯一文件名 + 验证扩展名。 |
| 6 | HIGH | 设计规格 CSS 方案矛盾 | 以计划为准：common.css [data-theme="dark"]。 |
| 7 | MEDIUM | 测试模式未指定 | 遵循 @TempDir 模式（CameraConfigServiceTest）。 |
| 8 | MEDIUM | YOLO 导出边界情况 | 缺少关键点降级检测格式；硬编码 COCO skeleton。 |
| 9 | MEDIUM | 2s 轮询 I/O 开销 | 单个共享轮询间隔。 |
| 10 | MEDIUM | DetectionService 扫描子目录 | Files.walk 改为 Files.list。 |
| 11 | LOW | Fabric.js CDN 离线不可用 | 内嵌 fabric.min.js。 |
| 12 | LOW | common.js toast 使用 emoji | 更新为 SVG 图标。 |

## 决策审计（DX Review）

| # | 严重度 | 发现 | 决策 |
|---|--------|------|------|
| 1 | CRITICAL | CSS 变量迁移映射缺失 | 添加变量映射表。 |
| 2 | HIGH | 无 AnnotationController 测试模板 | 添加具体测试大纲。 |
| 3 | HIGH | annotate.css 有但 monitor.css 无 | 两个页面都用独立 CSS 文件。 |
| 4 | HIGH | /api/stats/summary 不存在 | 添加 Phase 2.0 验证端点任务。 |
| 5 | HIGH | 原型未版本控制 | 提交到 docs/prototypes/。 |
| 6 | HIGH | Phase 2 和 5 无依赖顺序 | 重排：Phase 5.1 先于 Phase 2。 |
| 7 | MEDIUM | authFetch 未提及 | annotate.js 使用 Common.authFetch()。 |
| 8 | MEDIUM | Toast SVG 迁移范围 | 内联 SVG + XSS 安全 DOM 创建。 |
| 9 | MEDIUM | AnnotationService 锁策略 | 单个 ReadWriteLock 管理目录。 |
| 10 | MEDIUM | DetectionService 方法名 | 验证确切方法名。 |
| 11 | MEDIUM | Admin emoji 清单 | 添加映射表。 |
| 12 | MEDIUM | Fabric.js 版本 | 固定 5.3.0。 |
| 13 | LOW | data-theme | monitor 始终 dark。 |
| 14 | LOW | annotate.html 引用 common.js | 包含 common.js。 |

---

## 概述

两个核心变更：
1. 将监控大屏（monitor）替代数据看板（index）成为系统主页，连接真实 API
2. 新增独立的数据标注工作台，支持 BBox、关键点、行为标签标注，可导出 YOLO/COCO 训练数据

---

## Phase 0: CSS 整合 + API 验证（Phase 2 的前置依赖）

### 0.1 common.css 暗色主题扩展
- 添加 `[data-theme="dark"]` 暗色主题变量
- 添加 `:focus-visible` 焦点样式
- 添加 JetBrains Mono 导入 + `--font-mono` 变量
- 统一颜色命名：`--accent`（非 `--blue`）

### 0.2 CSS 变量迁移映射（monitor.html → common.css dark）

| monitor.html | common.css `[data-theme="dark"]` |
|---|---|
| `--bg: #04070f` | `--bg: #080c14`（使用原型色值） |
| `--card: #080d1c` | `--card-bg: #0e1525` |
| `--border: rgba(30,50,80,0.5)` | `--border: #1e293b` |
| `--text: #d8e4f0` | `--text-primary: #e2e8f0` |
| `--text2: #8aa0b8` | `--text-secondary: #94a3b8` |
| `--blue: #1a6fff` | `--accent: #3b82f6` |
| `--green: #00e896` | `--green: #22c55e` |
| `--red: #ff3b5c` | `--red: #ef4444` |

### 0.3 API 端点验证
- 验证 `GET /api/stats` 返回格式，决定是否需要创建 `/api/stats/summary`
- 验证 `GET /api/camera_config` 返回设备元数据
- 验证 `GET /api/cameras` 返回在线状态

---

## Phase 1: 路由与认证变更

### 1.1 PageController 路由调整
- `PageController.java`: `/` 和 `/index` 指向 `monitor` 模板
- 新增 `/annotate` 路由指向 `annotate` 模板

### 1.2 AuthFilter 更新
- `AuthFilter.java`: `PUBLIC_PATHS` 中将 `/monitor` 加入公开路径（与 `/index` 同级）
- `/annotate` 保持需登录保护

### 1.3 登录跳转
- `login.js`: 登录成功后跳转改为 `/yolov8-security/`

---

## Phase 2: 监控大屏重构（依赖 Phase 0）

### 2.1 基于原型重写 monitor.html
- 参考 `docs/prototypes/monitor-enterprise-v2.html`（已提交到版本控制）
- 使用 common.css `[data-theme="dark"]`，`<html data-theme="dark">` 始终深色
- 页面特定样式放 `static/css/monitor.css`（新增文件）
- 保留 3×2 摄像头网格 + 右侧边栏布局
- 全部 SVG 图标，零 emoji
- 添加状态设计：摄像头离线占位、统计加载骨架、告警空状态、API 错误 toast

### 2.2 连接真实 API
- 顶部统计：`GET /api/stats`（或 `/api/stats/summary`，取决于 Phase 0.3 验证结果），2s 轮询（单个共享定时器）
- 摄像头画面：`<img src="/video_feed?cam={id}">`，MJPEG 持续流
- 告警列表：`GET /api/stats` → `recentDetections` 过滤有 actions 的记录，5s 轮询
- 设备状态：前端合并 `GET /api/camera_config`（设备元数据）+ `GET /api/cameras`（在线状态），10s 轮询

### 2.3 JS 模块拆分
- 创建 `static/js/monitor.js`：摄像头网格渲染、API 轮询、告警列表、设备列表
- 顶栏导航（非左侧边栏），保留网格布局宽度

### 2.4 清理旧代码
- 删除所有 Math.random 模拟逻辑（32 处）
- 删除 Canvas 绘制相关代码（改用 MJPEG img 标签）
- 删除 webcam 相关代码
- 处理"无摄像头"空状态（引导文字 + 设备配置链接）

---

## Phase 3: 数据标注后端

### 3.1 AnnotationData 模型
- 创建 `AnnotationData.java`
- 字段：`imageFilename`, `imageWidth`, `imageHeight`, `annotator`, `annotatedAt`, `status`, `labels`, `bboxes`, `keypoints`

### 3.2 AnnotationService
- 自定义服务（不继承 AbstractJsonFileService），参考 CameraConfigService 的 ReadWriteLock 模式
- 单个 ReadWriteLock 管理整个 annotations 目录（读操作加读锁，写操作加写锁）
- 存储目录结构：
  ```
  backend/data/
    detection_*.json    (DetectionService 扫描)
    frame_*.jpg         (DetectionService 扫描)
    annotations/        (AnnotationService，DetectionService 不扫描)
    uploads/            (AnnotationService 上传，DetectionService 不扫描)
  ```
- 每张图片一个 JSON 文件
- 提供 CRUD + 统计 + 导出方法

### 3.3 AnnotationController
- 8 个 API 端点（见设计规格 4.6）
- 非参数路由（/stats, /export）放在 {imageFilename} 路由前面，避免路由冲突
- 图片上传：`POST /api/annotations/upload`，存储到 `backend/data/uploads/`
- 上传安全：文件名清理 + 生成唯一文件名（upload_{timestamp}_{random}.jpg）+ 验证 .jpg/.png 扩展名
- 导出：`GET /api/annotations/export?format=yolo|coco`

### 3.4 配置更新
- `application.properties` 添加 `spring.servlet.multipart.max-file-size=5MB`
- `DetectionService.scanUploadDirectory()` 改 `Files.walk` 为 `Files.list`，避免扫描 annotations/uploads 子目录

### 3.5 导出格式实现
- YOLO Detection：每图一个 .txt，`class_id cx cy w h`
- YOLO Keypoints：`class_id cx cy w h kp1_x kp1_y kp1_visible ...`
- COCO JSON：严格遵循 COCO 1.0 规范，硬编码 skeleton 连接数据
- 边界情况：缺少关键点时降级为检测格式；可见性标志 0=未标注/1=遮挡/2=可见

### 3.6 测试
- AnnotationService：JUnit 5 + @TempDir + 手动 AppConfig（匹配 CameraConfigServiceTest 模式）
- AnnotationController 测试大纲：
  ```java
  @WebMvcTest(AnnotationController.class)
  @Import(AuthFilter.class)
  class AnnotationControllerTest {
      @Autowired MockMvc mvc;
      @MockBean AnnotationService annotationService;
      // GET /api/annotations → 返回列表
      // GET /api/annotations/{name} → 返回数据
      // GET /api/annotations/{name} → 404
      // PUT /api/annotations/{name} → 保存
      // GET /api/annotations/stats → 返回统计
      // GET /api/annotations/export?format=yolo → 返回 zip
      // POST /api/annotations/upload → 拒绝 >5MB
      // POST /api/annotations/upload → 文件名清理
  }
  ```

---

## Phase 4: 数据标注前端

### 4.1 annotate.html 模板
- 包含 common.js（authFetch、toast、escHtml、主题支持）
- 使用 common.css `[data-theme="dark"]`，页面特定样式放 `annotate.css`
- 三栏布局：图片列表（200px）+ 画布（flex）+ 标注面板（280px）
- 顶栏：面包屑 / 图片名 / 标注进度 / 保存 / 导出
- 底栏：快捷键提示 / 缩放比例 / 图片尺寸 / 标注数量
- 响应式：≥1400px 三栏，1024-1399px 折叠图片列表，<1024px 标签切换
- 状态设计：空图片列表（上传提示）、未选择画布（引导文字）、未保存警告、上传错误提示

### 4.2 Fabric.js 画布
- 内嵌 Fabric.js 5.3.0 到 `static/js/fabric.min.js`（确保离线可用）
- 水平工具栏在画布上方，激活态用 accent 背景色
- BBox 模式：拖拽画矩形，画完弹出标签选择
- 关键点模式：17 个 COCO 关键点，点击打点，骨架连线
- 选择模式：选中、拖拽、删除
- 快捷键：B/K/V/Delete/Ctrl+Z
- 快捷键可发现性：工具栏按钮 tooltip + `?` 帮助对话框 + 底栏提示

### 4.3 AI 检测审查
- 打开截帧时自动加载对应 detection_*.json
- AI 检测框用虚线边框 + "AI" 标记渲染
- 支持确认、修正、删除、新增操作

### 4.4 图片列表
- 左栏显示已有截帧 + 上传的新图
- 缩略图 + 文件名 + 标注状态图标
- 支持拖拽上传

### 4.5 标注属性面板
- 右栏：行为标签勾选、坐标编辑、删除按钮
- 选中框/关键点时显示属性

### 4.6 JS 模块
- 创建 `static/js/annotate.js`：画布逻辑、API 调用、图片列表、属性面板
- 所有 API 调用使用 `Common.authFetch()`，用户反馈使用 `Common.toast()`

---

## Phase 5: 侧边栏导航统一 + emoji 转 SVG

### 5.1 统一导航结构
- admin 和 annotate 页面：左侧边栏导航（200px）
- monitor 页面：顶栏导航（保留网格布局宽度）
- 统一包含：监控大屏 / 后台管理 / 数据标注
- 使用 SVG 图标，风格一致

### 5.2 admin.html emoji 转 SVG
- 将 admin.html 中 40+ 个 emoji 图标替换为 Lucide 风格 SVG
- 映射表：
  | Emoji | Lucide Icon | 用途 |
  |---|---|---|
  | shield | `shield` | Logo |
  | gear | `settings` | 系统设置 |
  | person | `user` | 用户管理 |
  | floppy disk | `database` | 数据管理 |
  | camera | `video` | 设备管理 |
  | chart | `bar-chart-2` | 仪表盘 |
  | desktop | `monitor` | 监控大屏 |

### 5.3 common.js toast SVG 化
- 将 common.js toast() 中的 Unicode emoji 替换为内联 SVG（16x16 Lucide 风格）
- 使用 DOM 创建（非 innerHTML）保持 XSS 安全

---

## 文件清单

### 新增文件
| 文件 | 用途 |
|---|---|
| `backend/src/main/java/.../model/AnnotationData.java` | 标注数据模型 |
| `backend/src/main/java/.../service/AnnotationService.java` | 标注服务 |
| `backend/src/main/java/.../controller/AnnotationController.java` | 标注 API |
| `backend/src/test/java/.../AnnotationServiceTest.java` | 标注服务测试 |
| `backend/src/test/java/.../AnnotationControllerTest.java` | 标注控制器测试 |
| `backend/src/main/resources/templates/annotate.html` | 标注页面模板 |
| `backend/src/main/resources/static/js/monitor.js` | 监控大屏 JS |
| `backend/src/main/resources/static/js/annotate.js` | 标注页面 JS |
| `backend/src/main/resources/static/js/fabric.min.js` | Fabric.js 5.x 内嵌（离线可用） |
| `backend/src/main/resources/static/css/annotate.css` | 标注页面特定样式 |
| `backend/src/main/resources/static/css/monitor.css` | 监控大屏特定样式 |
| `docs/prototypes/monitor-enterprise-v2.html` | 监控大屏原型（版本控制） |

### 修改文件
| 文件 | 变更 |
|---|---|
| `backend/src/main/java/.../controller/PageController.java` | 路由调整 |
| `backend/src/main/java/.../config/AuthFilter.java` | 公开路径更新 |
| `backend/src/main/resources/templates/monitor.html` | 完全重写 |
| `backend/src/main/resources/static/js/login.js` | 跳转路径 |
| `backend/src/main/resources/templates/admin.html` | 侧边栏导航 + emoji 转 SVG |
| `backend/src/main/resources/static/css/common.css` | 暗色主题 + focus 样式 + JetBrains Mono |
| `backend/src/main/resources/static/js/common.js` | toast() emoji 转 SVG |
| `backend/src/main/resources/application.properties` | multipart max-file-size=5MB |
| `backend/src/main/java/.../service/DetectionService.java` | Files.walk → Files.list |

---

## 不在范围内

- 不修改 Python 检测模块
- 不修改现有 API 端点（只新增）
- 不引入数据库
- 不实现多人协作标注
- 不实现主动学习流程
