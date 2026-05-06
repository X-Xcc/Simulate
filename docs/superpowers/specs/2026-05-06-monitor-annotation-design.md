# 设计规格：监控大屏主页化 + 数据标注模块

**日期**: 2026-05-06
**状态**: 待审查
**范围**: 前端重构 + 新增标注模块

---

## 1. 概述

两个核心变更：
1. 将监控大屏（monitor）替代数据看板（index）成为系统主页，连接真实 API
2. 新增独立的数据标注工作台，支持 BBox、关键点、行为标签标注，可导出 YOLO/COCO 训练数据

### 成功标准
- 登录后进入监控大屏，实时显示摄像头画面和检测数据
- 标注页面可浏览已有截帧、审查 AI 检测结果、手动标注新数据
- 标注结果可导出为 YOLO txt 和 COCO json 格式

---

## 2. 页面结构

| 路由 | 模板 | 用途 | 认证 |
|---|---|---|---|
| `/` `/index` | `monitor.html` | 监控大屏（主页） | 公开/登录后 |
| `/login` | `login.html` | 登录页 | 公开 |
| `/admin` | `admin.html` | 后台管理 | 需登录 |
| `/annotate` | `annotate.html` | 数据标注工作台 | 需登录 |

### 导航关系
- 登录成功 → 跳转 `/`（监控大屏）
- 监控大屏侧边栏 → 后台管理 / 数据标注
- 后台管理侧边栏 → 监控大屏 / 数据标注
- 数据标注侧边栏 → 监控大屏 / 后台管理

### 路由变更
- `PageController.java`: 新增 `/annotate` 路由
- `AuthFilter.java`: `PUBLIC_PATHS` 添加 `/annotate`（或保持需登录）
- `login.js`: 登录成功跳转改为 `/yolov8-security/`

---

## 3. 监控大屏重构

### 现状
- `monitor.html` 1731 行，完全模拟数据，不连 API
- `index.html` 1255 行，连接真实 API，有图表/检测记录/设备状态

### 目标
基于 `monitor-enterprise-v2.html` 原型，将 monitor.html 重写为：
- 连接真实 API 替代 Math.random 模拟
- 保留 3×2 摄像头网格 + 右侧边栏布局
- 顶部统计栏从 `/api/stats` 拉取真实数据
- 摄像头面板显示 MJPEG 流 (`/video_feed`)
- 告警列表从 `recentDetections` 过滤有 actions 的记录
- 设备列表从 `/api/cameras` 获取

### API 连接
| 组件 | API | 轮询间隔 |
|---|---|---|
| 顶部统计 | `GET /api/stats/summary` | 2s |
| 摄像头画面 | `GET /video_feed?cam={id}` | MJPEG 持续流 |
| 告警列表 | `GET /api/stats` → `recentDetections` | 5s |
| 设备状态 | `GET /api/cameras` | 10s |

### 设计系统
- 深色主题：`--bg-base: #080c14`, `--bg-surface: #0e1525`
- 主色调：`--accent: #3b82f6`（蓝）, `--green: #22c55e`, `--red: #ef4444`
- 字体：Inter（UI）+ JetBrains Mono（数据）
- 全部 SVG 图标（Lucide 风格），零 emoji
- 玻璃态面板：`backdrop-filter: blur(8px)`

### 模块拆分
monitor.html 的 JS 拆分为独立文件：
- `static/js/monitor.js` — 主逻辑（摄像头网格、API 轮询、告警列表）
- 使用 common.css `[data-theme="dark"]` 暗色主题，页面特定样式用 `<style>` 块

---

## 4. 数据标注模块

### 4.1 页面布局

三栏布局：

```
┌─────────────────────────────────────────────────────────────┐
│  顶栏：面包屑 / 图片名 / 标注进度 / 保存 / 导出按钮          │
├────────┬──────────────────────────────────┬─────────────────┤
│ 左栏   │        中栏                       │   右栏          │
│ 200px  │        flex                       │   280px         │
│        │                                  │                 │
│ 图片   │   Fabric.js Canvas               │  标注属性面板     │
│ 列表   │   (BBox / 关键点绘制)             │  - 行为标签勾选   │
│        │                                  │  - 坐标编辑      │
│ 缩略图 │   工具栏：BBox / 关键点 / 选择    │  - 删除按钮      │
│ +状态  │   / 缩放 / 撤销 / 删除            │                 │
│        │                                  │                 │
│ [上传] │                                  │                 │
├────────┴──────────────────────────────────┴─────────────────┤
│  底栏：快捷键提示 / 缩放比例 / 图片尺寸 / 标注数量            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 标注模式

**BBox 模式** (`B` 键)：
- 拖拽画矩形框
- 画完自动弹出行为标签选择（跌倒/打架/疲劳/离岗/聚集，可多选）
- 框上显示类别标签
- 选中后可拖拽移动、拖拽边角调整大小

**关键点模式** (`K` 键)：
- 17 个 COCO 关键点：鼻子、左右眼、左右耳、左右肩、左右肘、左右手、左右髋、左右膝、左右脚
- 点击画布按顺序打点
- 显示骨架连线
- 每个点可拖拽调整

**选择模式** (`V` 键)：
- 点击选中已有标注
- Delete 删除、拖拽移动

### 4.3 AI 检测审查

打开已有截帧时：
1. 自动加载 `detection_*.json` 中的 `actions` 和 `boxes`
2. AI 检测框用虚线边框 + "AI" 标记渲染
3. 用户可确认（转为人工标注）、修正（调整框/标签）、删除、新增

### 4.4 图片上传

- 左栏底部"上传"按钮 + 拖拽上传
- 支持 jpg/png，单张最大 5MB
- 上传至 `backend/data/uploads/`
- 调用 `POST /api/annotations/upload`

### 4.5 数据模型

标注文件存储在 `backend/data/annotations/`，每张图片一个 JSON：

```json
{
  "imageFilename": "frame_1714987200.jpg",
  "imageWidth": 1920,
  "imageHeight": 1080,
  "annotator": "admin",
  "annotatedAt": "2026-05-06T14:30:00",
  "status": "reviewed",
  "labels": ["fall"],
  "bboxes": [
    {
      "id": "bbox_1",
      "x": 0.35,
      "y": 0.22,
      "width": 0.12,
      "height": 0.45,
      "labels": ["fall"],
      "confidence": 0.95,
      "source": "ai"
    }
  ],
  "keypoints": [
    {
      "id": "kp_1",
      "personId": "bbox_1",
      "points": [
        {"name": "nose", "x": 0.41, "y": 0.25, "visible": 1},
        {"name": "left_eye", "x": 0.40, "y": 0.24, "visible": 1}
      ]
    }
  ]
}
```

坐标归一化 (0-1)，`source` 标记 `"ai"` 或 `"human"`。

`status` 字段：
- `"unlabeled"` — 未标注
- `"ai_pending"` — AI 检测待审查
- `"reviewed"` — 已审查/已标注

### 4.6 后端 API

`AnnotationService` 自定义服务（不继承 AbstractJsonFileService），参考 CameraConfigService 的 ReadWriteLock 模式，每张图片一个 JSON 文件。

注意：非参数路由（/stats, /export）必须放在 {imageFilename} 路由前面，避免 Spring MVC 路由冲突。

| 端点 | 方法 | 用途 |
|---|---|---|
| `GET /api/annotations` | GET | 列出所有标注 |
| `GET /api/annotations/{imageFilename}` | GET | 获取某张图片的标注 |
| `PUT /api/annotations/{imageFilename}` | PUT | 保存/更新标注 |
| `DELETE /api/annotations/{imageFilename}` | DELETE | 删除标注 |
| `GET /api/annotations/stats` | GET | 标注统计 |
| `POST /api/annotations/upload` | POST | 上传新图片 |
| `GET /api/annotations/export?format=yolo` | GET | 导出 YOLO zip |
| `GET /api/annotations/export?format=coco` | GET | 导出 COCO json |

### 4.7 导出格式

**YOLO Detection**（每图一个 .txt）：
```
0 0.41 0.475 0.12 0.45
```

**YOLO Keypoints**：
```
0 0.41 0.475 0.12 0.45 0.41 0.25 2 0.40 0.24 2 ...
```

**COCO JSON**：
```json
{
  "images": [{"id": 1, "file_name": "frame_xxx.jpg", "width": 1920, "height": 1080}],
  "annotations": [{"id": 1, "image_id": 1, "category_id": 0, "bbox": [...], "keypoints": [...], "num_keypoints": 17}],
  "categories": [{"id": 0, "name": "fall", "keypoints": ["nose","left_eye",...], "skeleton": [[0,1],[0,2],...]}]
}
```

行为类别映射：
| ID | 英文 | 中文 |
|---|---|---|
| 0 | fall | 跌倒 |
| 1 | fight | 打架 |
| 2 | fatigue | 疲劳 |
| 3 | absent | 离岗 |
| 4 | crowd | 聚集 |

---

## 5. 技术依赖

### 新增前端依赖
- **Fabric.js 5.x** — 画布引擎，CDN 引入（~200KB gzipped）
- 无其他新增依赖

### 复用现有组件
- `common.css` — 共享样式，通过 `[data-theme="dark"]` 支持暗色主题（monitor 和 annotate 使用暗色，admin 使用亮色）
- `common.js` — API 调用工具、toast 通知（toast 图标使用 SVG）
- 模态框、表单组件 — 复用 admin.html 模式
- `CameraConfigService` ReadWriteLock 模式 — AnnotationService 参考

---

## 6. 不在范围内

- 不修改 Python 检测模块（ai-models/yolov8_security.py）
- 不修改现有 API 端点（只新增）
- 不修改登录/认证逻辑（只改跳转路径）
- 不引入数据库（保持 flat-file JSON）
- 不实现多人协作标注
- 不实现主动学习（active learning）流程

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 大量截帧时图片列表加载慢 | 标注体验差 | 分页加载 + 缩略图懒加载 |
| Fabric.js 大图片性能 | 画布卡顿 | 图片缩放到画布尺寸，不加载原图 |
| 标注文件过多 | 文件系统压力 | 按日期分目录存储 |
| COCO 导出格式兼容性 | 训练框架不认 | 严格遵循 COCO 1.0 规范 |
