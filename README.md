# EverBright - YOLOv8 安防智能监控系统

基于 **YOLOv8 + Qwen2.5-VL** 的实时安防监控平台，支持跌倒、打架、疲劳、离岗等异常行为检测，并提供 Web 可视化看板和 AI 图像分析功能。

> ⚠️ 重要提示：使用前请先同步最新代码。
>
> ```powershell
> cd D:\yolov8_security
> git pull origin main
> git reset --hard origin/main
> git pull origin main
> ```
>
> 这样可确保你使用的是最新修复和配置，以避免版本差异导致的问题。

## 目录导航

- [系统功能](#系统功能)
- [系统架构](#系统架构)
- [运行环境](#运行环境)
- [快速开始](#快速开始)
- [Docker Compose 部署](#docker-compose-部署)
- [目录结构](#目录结构)
- [配置说明](#配置说明)
- [API 接口](#api-接口)
- [Qwen VL 服务 API](#qwen-vl-服务-api)
- [故障排除](#故障排除)
- [技术栈](#技术栈)
- [License](#license)

---

## 系统功能

### 核心检测能力
- **跌倒检测**：实时识别危险跌倒行为
- **打架检测**：检测肢体冲突与暴力行为
- **疲劳检测**：监测长时间静止、打瞌睡等疲劳状态
- **离岗检测**：识别关键岗位人员缺席或异常离岗
- **多人姿态检测**：支持多人同时检测与分析

### AI 功能
- **Qwen2.5-VL 视觉语言分析**：提供图像理解、场景判断与安全分析
- **实时报警与统计**：可视化看板展示检测结果与趋势
- **批量分析**：支持多张图片/帧批量处理

### 技术亮点
- Java 后端 + Python AI 脚本 + Web 前端的全栈方案
- 支持 GPU 加速的 YOLOv8 实时推理
- RESTful API 便利接入与二次开发
- Docker Compose + Nginx 支持生产级部署

---

## 系统架构

```
┌──────────────────────────────────────────────────┐
│                  Nginx (HTTPS)                     │
│         前端静态资源 + API 反向代理 + TLS          │
└──────────────┬───────────────────────┬────────────┘
               │                       │
       ┌───────▼────────┐   ┌─────────▼────────┐
       │  前端 (SPA)     │   │  Java 后端       │
       │  (Spring Boot)  │   │  (Spring Boot    │
       │                 │   │   3.2.x)         │
       └─────────────────┘   │  Port: 5000      │
                             │  /yolov8-security │
                             └───┬──────────┬────┘
                                 │          │
                       ┌─────────▼──┐  ┌───▼────────┐
                       │ YOLOv8 检测 │  │ Qwen2.5-VL │
                       │ Python     │  │ 视觉语言    │
                       │ 行为分析   │  │ 模型分析    │
                       └────────────┘  │ Port: 5001 │
                                       └────────────┘
```

### 核心组件

| 组件 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| Java 后端 | Spring Boot 3.2.x, Java 17 | 5000 | 提供 Web 页面、REST API 和视频流 |
| Qwen VL 服务 | Flask + Qwen2.5-VL-7B | 5001 | 视觉语言模型图像分析 |
| YOLOv8 检测 | Python + Ultralytics | 本地 | 实时视频分析与行为检测 |
| 前端 | 原生 HTML/JS + Chart.js | - | 实时监控可视化页面 |
| Nginx | nginx:alpine | 80/443 | 反向代理 + TLS 支持 |

---

## 运行环境

- **操作系统**：Windows 10/11
- **Java**：JDK 17+
- **Python**：3.8+（推荐使用 Conda/Anaconda）
- **Maven**：3.6+
- **CUDA**：11.8 / 12.1（推荐用于 GPU 加速）
- **Git**：用于代码同步

---

## 快速开始

### 1. 同步最新代码

```powershell
cd D:\yolov8_security
git pull origin main
git reset --hard origin/main
git pull origin main
```

### 2. 安装 Python 依赖

```powershell
pip install -r requirements.txt
```

如果需要手动安装依赖：

```powershell
pip install ultralytics opencv-python numpy Pillow torch torchvision torchaudio flask flask-cors
```

### 3. 构建 Java 后端

```powershell
cd backend
mvn clean package
cd ..
```

### 4. 启动服务

#### 方式一：一键启动（推荐）

```powershell
scripts\start_all.bat
```

#### 方式二：手动启动

1. 启动 Java 后端：

```powershell
cd backend
java -jar target/yolov8-security.war
```

2. 启动 Qwen VL 服务（可选）：

```powershell
cd ai-models
python qwen_vl_service.py
```

3. 启动 YOLOv8 检测：

```powershell
cd ai-models
python yolov8_security.py
```

#### 访问地址

- Java 后端页面：`http://localhost:5000/yolov8-security`
- Qwen VL 服务：`http://localhost:5001`

---

## Docker Compose 部署

1. 复制环境变量文件：

```powershell
copy .env.example .env
```

2. 编辑 `.env`，设置 `API_KEY` 等参数。

3. 配置 TLS 证书：

将证书文件放入 `nginx/ssl/`：
- `nginx/ssl/cert.pem`
- `nginx/ssl/key.pem`

4. 启动容器：

```powershell
docker compose up --build
```

访问：`https://localhost`

---

## 目录结构

```text
├── backend/                  # Java 后端 (Spring Boot)
│   ├── src/main/java/        # Java 源码
│   ├── src/main/resources/   # 配置文件和模板
│   ├── Dockerfile            # 后端镜像构建
│   └── pom.xml               # Maven 配置
├── frontend/                 # 前端静态资源
│   └── index.html            # 监控页面
├── ai-models/                # AI 脚本与服务
│   ├── yolov8_security.py    # YOLOv8 检测脚本
│   └── qwen_vl_service.py    # Qwen VL HTTP 服务
├── models/                   # 模型文件
│   └── yolov8n-pose.pt       # YOLOv8 姿态模型
├── nginx/                    # Nginx 配置与证书
│   ├── nginx.conf            # 反向代理配置
│   └── ssl/                  # TLS 证书目录
├── scripts/                  # 启动与部署脚本
│   ├── start_all.bat
│   ├── build_war.bat
│   ├── deploy.bat
│   └── install_qwen_deps.bat
├── docker-compose.yml        # Docker Compose 编排
├── .env.example              # 环境变量模板
└── README.md                 # 项目说明
```

---

## 配置说明

### Java 后端配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `server.port` | 服务端口 | `5000` |
| `server.servlet.context-path` | 应用路径 | `/yolov8-security` |
| `app.api-key` | API 认证密钥 | 空(本地开发可跳过) |
| `app.file.upload-dir` | 截图存储目录 | `./data` |
| `app.file.video-dir` | 视频存储目录 | `./videos` |
| `app.file.model-dir` | 模型文件目录 | `./models` |
| `app.python.script.path` | YOLOv8 检测脚本 | `./ai-models/yolov8_security.py` |
| `app.python.executable` | Python 可执行文件 | `python` |
| `app.qwenVl.service-url` | Qwen VL 服务地址 | `http://127.0.0.1:5001` |
| `app.qwenVl.model-path` | Qwen VL 模型路径 | `./models/Qwen2.5-VL-7B-Instruct` |

### Docker 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `API_KEY` | API 认证密钥 | `your-secret-key` |
| `SPRING_PROFILES_ACTIVE` | Spring 配置环境 | `docker` |

---

## API 接口

### Java 后端 API (`/yolov8-security`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/images` | 获取截图列表 |
| GET | `/api/images/{name}` | 获取单张图片 |
| DELETE | `/api/delete_all_images` | 删除所有截图 |
| POST | `/api/open_folder` | 打开文件夹 |
| GET | `/api/model_info` | 获取模型信息 |
| GET | `/video_feed` | MJPEG 视频流 |
| GET | `/api/ai/status` | Qwen VL 服务状态 |
| POST | `/api/ai/analyze` | 图片分析 (Base64) |
| POST | `/api/ai/analyze-security` | 安全图片分析 |
| POST | `/api/ai/batch-analyze` | 批量图片分析 |

### Qwen VL 服务 API (`:5001`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/analyze` | 图片分析 (Base64) |
| POST | `/analyze_file` | 图片文件分析 |
| POST | `/batch_analyze` | 批量图片分析 |

> 生产环境下请在请求头中添加 `X-API-Key: {your-api-key}`。

---

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 模型加载失败 | 检查 `models/` 目录，确认权重文件存在并路径正确 |
| 视频源无法打开 | 检查摄像头、视频文件路径或设备号是否正确 |
| 端口被占用 | 修改 `server.port` 或 Docker Compose 中的端口映射 |
| 性能不足 | 使用 GPU 加速、降低分辨率或使用更小模型 |
| CORS 错误 | 检查 `CorsConfig` 配置并确认前端请求来源合法 |
| API Key 401 | 确认请求头携带正确的 `X-API-Key` |
| 代码不一致 | 先执行 `git pull origin main` 并重启服务 |

---

## 技术栈

- 后端：Spring Boot 3.2.x、Java 17
- 前端：原生 HTML/CSS/JS、Chart.js
- AI：YOLOv8 (Ultralytics)、Qwen2.5-VL
- 部署：Docker Compose、Nginx
- 模板：Thymeleaf

---

## License

Private
