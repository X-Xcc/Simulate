# 看板重构设计规格

> 日期: 2026-05-05
> 状态: 待用户审查
> 范围: index.html + monitor.html + admin.html 全重构，模块化拆分，接真实数据

## 1. 背景与动机

当前三个看板页面（index.html 1251行、monitor.html 1731行、admin.html 727行）存在以下系统性问题：

- **代码大量重复**：CSS 设计系统（~150行）、JS 工具函数（authFetch/toast/modal/theme/clock）在三个文件中几乎逐字复制
- **monitor.html 完全是模拟数据**：1731行代码全部用 Math.random() 生成假数据，零真实 API 连接
- **XSS 风险**：innerHTML 直接注入 API 数据，escAttr 辅助函数模式脆弱
- **admin.html 安全问题**：明文密码存 localStorage，设置不下发后端，设备管理是假数据，导出功能损坏
- **无模块系统**：所有 CSS/JS 内联在单文件中，无关注点分离

## 2. 目标

1. 提取共享代码到 static 目录，消除三个页面的重复
2. 按功能拆分 JS 模块，每个文件职责单一
3. monitor.html 接入真实 MJPEG 视频流 + API 数据
4. 修复 admin.html 的安全漏洞和功能缺陷
5. 消除 XSS 风险

## 3. 非目标

- 不引入前端框架（Vue/React）或构建工具
- 不加 WebSocket/SSE（轮询 2s 够用）
- 不加数据库（保持 flat-file 架构）
- 不做响应式移动端适配

## 4. 文件结构

```
backend/src/main/resources/
├── static/
│   ├── css/
│   │   ├── common.css              ← 新增：共享设计系统
│   │   └── login.css               ← 保留不动
│   └── js/
│       ├── common.js               ← 新增：共享工具函数
│       ├── chart-module.js         ← 新增：Chart.js 图表逻辑
│       ├── detection-module.js     ← 新增：检测记录+导出+图片查看
│       ├── alert-module.js         ← 新增：报警管理+ticker+声音
│       ├── monitor-module.js       ← 新增：摄像头面板+MJPEG流+实时统计
│       └── admin-module.js         ← 新增：设置/用户/设备/数据管理
├── templates/
│   ├── index.html                  ← 重构：~400行
│   ├── monitor.html                ← 重写：~500行
│   ├── admin.html                  ← 重构：~350行
│   └── login.html                  ← 保留不动
```

## 5. 共享层设计

### 5.1 common.css (~200行)

从三个页面提取统一的 CSS 设计系统：

```css
:root {
  --primary: #4f8cff;
  --danger: #ff4d4f;
  --success: #52c41a;
  --warning: #faad14;
  --bg: #f5f7fa;
  --card: #fff;
  --text: #222;
  --text2: #666;
  --border: #e8e8e8;
}
[data-theme="dark"] {
  --bg: #141414;
  --card: #1f1f1f;
  --text: #e0e0e0;
  --text2: #aaa;
  --border: #333;
}
```

包含：布局（sidebar + main-content grid）、通用组件（.card, .badge, .modal, .toast, .table, .form-input, .btn）、响应式断点（800px sidebar 折叠）。

### 5.2 common.js (~150行)

导出到 `window.Common`：

| 方法 | 功能 |
|------|------|
| `authFetch(url, opts)` | 带 Authorization header 的 fetch 封装 |
| `toast(msg, type)` | 右上角通知弹窗 |
| `openModal(id)` / `closeModal(id)` | 模态框开关 |
| `setTxt(id, text)` | 安全 textContent 设置（替代 innerHTML，防 XSS） |
| `escHtml(str)` | HTML 转义 |
| `themeToggle()` | 暗色模式切换 + localStorage 持久化 |
| `startClock(id)` | 右上角时钟 |
| `initSidebar()` | 侧边栏高亮 + 折叠逻辑 |

**关键安全变更**：所有页面必须用 `setTxt()` 替代 `innerHTML` 设置用户可见文本。需要 HTML 结构的地方用 `escHtml()` 转义后拼接。

### 5.3 页面引入方式

```html
<link rel="stylesheet" href="/yolov8-security/css/common.css">
<script src="/yolov8-security/js/common.js"></script>
<script src="/yolov8-security/js/xxx-module.js"></script>
```

## 6. 页面模块设计

### 6.1 index.html — 主看板

**引用**：common + chart-module + detection-module + alert-module

**保留的 HTML 结构**：
- 侧边栏导航
- 视频流区（MJPEG `<img>` + 摄像头切换）
- 6 个统计卡片（今日检测、跌倒、打架、疲劳、离岗、聚集）
- 图表容器 div（折线图 + 饼图）
- 检测记录表格容器
- 报警历史表格容器
- 系统状态区

**模块职责**：

| 模块 | 职责 | 轮询 |
|------|------|------|
| chart-module.js | 趋势折线图（分/时/日）+ 行为分布饼图，从 `/api/stats` 取数据 | 2s |
| detection-module.js | 检测记录表格 + 筛选 + CSV 导出 + 图片灯箱 | 随 stats 更新 |
| alert-module.js | 报警历史表 + 处理/撤销 + ticker 横幅 + Web Audio 声音 | 随 stats 更新 |

### 6.2 monitor.html — 监控中心

**引用**：common + monitor-module.js

**核心改造**：
- 删除全部 Canvas 模拟代码（~600行）
- 每个摄像头 panel 用 `<img src="/video_feed">` 显示 MJPEG 流
- 轮询 `/api/stats` 获取检测数据，覆盖到 panel overlay（人数、报警类型、置信度）
- 报警 sidebar 从 API 数据驱动
- 保留 panel 聚焦/全屏、alert ticker

**Panel HTML 结构**：
```html
<div class="cam-panel" data-camera="zone_a">
  <img class="cam-feed" src="/yolov8-security/video_feed" loading="lazy">
  <div class="cam-overlay">
    <span class="cam-name">A区</span>
    <span class="cam-status online"></span>
    <span class="cam-count">人数: --</span>
    <span class="cam-fps">-- fps</span>
  </div>
  <div class="cam-alert" hidden>
    <span class="alert-icon">⚠</span>
    <span class="alert-type"></span>
  </div>
</div>
```

**性能优化**：IntersectionObserver 懒加载，不可见的 panel 不拉 MJPEG 流。

### 6.3 admin.html — 管理后台

**引用**：common + admin-module.js

**四个 Tab 功能**：

| Tab | 当前问题 | 修复方案 |
|-----|----------|----------|
| 系统设置 | localStorage only | POST/GET `/api/settings` 下发后端写 settings.json |
| 用户管理 | 明文密码 localStorage | 密码 bcrypt 哈希，存 data/users.json，CRUD API |
| 设备管理 | 硬编码假数据 | 读写 data/devices.json，完整 CRUD |
| 数据管理 | 导出跳首页 | 真 CSV 导出 + 修复 open_folder |

## 7. 后端变更

### 7.1 新增 API 端点

```
POST /api/settings              保存检测参数
GET  /api/settings              读取检测参数

GET  /api/users                 用户列表（密码脱敏）
POST /api/users                 创建用户（bcrypt 哈希）
PUT  /api/users/{id}            更新用户
DELETE /api/users/{id}          删除用户（admin 不可删）

GET  /api/devices               设备列表
POST /api/devices               添加设备
PUT  /api/devices/{id}          更新设备
DELETE /api/devices/{id}        删除设备
```

### 7.2 新增 Service 类

| 类 | 文件 | 职责 |
|----|------|------|
| SettingsService | service/SettingsService.java | 读写 data/settings.json，提供检测参数默认值 |
| UserService | service/UserService.java | 读写 data/users.json，bcrypt 哈希/验证，admin 用户保护 |
| DeviceService | service/DeviceService.java | 读写 data/devices.json |

### 7.3 文件存储

```
backend/data/
├── detection_*.json        ← 已有
├── frame_*.jpg             ← 已有
├── settings.json           ← 新增
├── users.json              ← 新增
└── devices.json            ← 新增
```

### 7.4 StatsResponse 变更

```java
// 新增字段
private List<AlertEvent> alertEvents;

public static class AlertEvent {
    private String type;        // fall/fight/fatigue/absent/gather
    private String camera;      // 摄像头ID
    private long timestamp;
    private String severity;    // high/medium/low
    private String imageUrl;
}
```

### 7.5 新增依赖

```xml
<dependency>
    <groupId>at.favre.lib</groupId>
    <artifactId>bcrypt</artifactId>
    <version>0.10.2</version>
</dependency>
```

## 8. 实施顺序

| 阶段 | 内容 | 可并行 |
|------|------|--------|
| 1 | common.css + common.js 提取，三页面接入验证 | ✓ |
| 2 | SettingsService / UserService / DeviceService + API | ✓ |
| 3 | index.html 重构：拆模块，修 XSS | |
| 4 | monitor.html 重写：删 Canvas 模拟，接 MJPEG + 真实数据 | |
| 5 | admin.html 重构：密码哈希、设置下发、设备 CRUD、导出 | |

阶段 1 和 2 可并行。阶段 3-5 依赖阶段 1。

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 6 路 MJPEG 并发浏览器卡顿 | IntersectionObserver 懒加载，不可见 panel 不拉流 |
| JS 模块加载顺序依赖 | HTML 中 script 标签按依赖顺序排列 |
| 老用户 localStorage 数据丢失 | 首次加载提示迁移或忽略，非关键数据 |
| bcrypt 性能 | cost factor 10，用户量少无影响 |

## 10. 安全修复清单

- [ ] 所有 innerHTML 注入改为 setTxt() / escHtml()
- [ ] 用户密码 bcrypt 哈希存储
- [ ] admin 用户不可删除保护
- [ ] API 输入验证（用户名/密码长度、设备名格式）
