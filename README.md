# EverBright - 监狱智能行为分析系统

基于 YOLOv8 + Qwen2.5-VL 的实时安防监控平台，支持跌倒、打架、疲劳、离岗等异常行为检测，并提供 Web 可视化看板。

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
| Java 后端 | Spring Boot 3.2.x, Java 17 | 5000 | Web 服务、API 接口、视频流 |
| Qwen VL 服务 | Flask + Qwen2.5-VL-7B | 5001 | 视觉语言模型分析 |
| YOLOv8 检测 | Python + Ultralytics | 本地 | 实时视频分析与行为检测 |
| 前端 | 原生 HTML/JS + Chart.js | - | 实时监控看板 (Thymeleaf) |
| Nginx | nginx:alpine | 80/443 | 反向代理 + HTTPS (生产) |

### 检测能力

- **跌倒检测** - 人员异常倒地行为识别
- **打架检测** - 肢体冲突行为识别
- **疲劳检测** - 长时间静止/打瞌睡识别
- **离岗检测** - 关键岗位人员缺席识别

## 快速开始

### 环境要求

- **Java 17+**
- **Python 3.8+**
- **Maven 3.6+**
- **CUDA 11.8/12.1** (推荐，用于 GPU 加速)

### 安装依赖

```bash
# 1. 安装 Python 依赖
pip install ultralytics opencv-python numpy pillow torch

# 2. 安装 Qwen VL 依赖 (可选)
pip install transformers accelerate qwen-vl-utils

# PyTorch 安装 (根据 GPU 选择)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

> 也可使用一键脚本: `scripts\install_qwen_deps.bat`

### 本地开发模式

```bash
# 方式一: 一键启动所有服务
scripts\start_all.bat

# 方式二: 手动分步启动

# 1. 构建后端
cd backend
mvn clean package
cd ..

# 2. 启动 Java 后端
java -jar backend/target/yolov8-security.war

# 3. 启动 Qwen VL 服务 (可选)
cd ai-models
python qwen_vl_service.py

# 4. 启动 YOLOv8 检测
cd ai-models
python yolov8_security.py
```

**访问地址**: http://localhost:5000/yolov8-security

### Docker Compose 部署

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env 设置 API_KEY

# 2. 准备 TLS 证书
# 将证书放入 nginx/ssl/ 目录:
#   nginx/ssl/cert.pem
#   nginx/ssl/key.pem

# 3. 构建并启动
docker compose up --build
```

**访问地址**: https://localhost

## 目录结构

```
├── backend/                  # Java 后端 (Spring Boot 3.2.x)
│   ├── src/main/java/        # Java 源码
│   ├── src/main/resources/   # 配置文件
│   ├── Dockerfile            # Docker 镜像构建
│   └── pom.xml
├── frontend/                 # 前端静态资源
│   └── index.html            # 实时监控看板
├── ai-models/                # AI 模型与脚本
│   ├── yolov8_security.py    # YOLOv8 检测脚本
│   └── qwen_vl_service.py    # Qwen VL HTTP 服务
├── models/                   # 模型权重文件
│   └── yolov8n-pose.pt       # YOLOv8 姿态估计模型
├── nginx/                    # Nginx 配置
│   ├── nginx.conf            # 反向代理 + TLS
│   └── ssl/                  # TLS 证书目录
├── scripts/                  # 便捷脚本
│   ├── start_all.bat         # 一键启动所有服务
│   ├── build_war.bat         # 构建 WAR 包
│   ├── deploy.bat            # 部署脚本
│   └── install_qwen_deps.bat # 安装 Qwen 依赖
├── docker-compose.yml        # Docker Compose 编排
├── .env.example              # 环境变量模板
└── README.md
```

## 配置说明

### Java 后端 (application.properties)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `server.port` | 服务端口 | `5000` |
| `server.servlet.context-path` | 应用路径 | `/yolov8-security` |
| `app.api-key` | API 认证密钥 | 空(本地开发跳过) |
| `app.file.upload-dir` | 截图存储目录 | `./data` |
| `app.file.video-dir` | 视频存储目录 | `./videos` |
| `app.file.model-dir` | 模型文件目录 | `./models` |
| `app.python.script.path` | YOLOv8 检测脚本路径 | `./ai-models/yolov8_security.py` |
| `app.python.executable` | Python 可执行文件 | `python` |
| `app.qwenVl.service-url` | Qwen VL 服务地址 | `http://127.0.0.1:5001` |
| `app.qwenVl.model-path` | Qwen VL 模型路径 | `./models/Qwen2.5-VL-7B-Instruct` |

### Docker 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `API_KEY` | API 认证密钥 | `your-secret-key` |
| `SPRING_PROFILES_ACTIVE` | Spring 配置环境 | `docker` |

## API 接口

### Java 后端 API (`/yolov8-security`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 统计数据 (检测次数、行为分类) |
| GET | `/api/images` | 获取所有截图列表 |
| GET | `/api/images/{name}` | 获取单张图片 |
| DELETE | `/api/delete_all_images` | 删除所有截图和检测记录 |
| POST | `/api/open_folder` | 打开文件资源管理器 |
| GET | `/api/model_info` | YOLOv8 模型信息 |
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
| POST | `/analyze_file` | 图片分析 (文件上传) |
| POST | `/batch_analyze` | 批量图片分析 |

> **认证**: 生产环境下需在请求头中添加 `X-API-Key: {your-api-key}`

## HTTPS 证书配置

使用 Let's Encrypt 免费证书:

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 将证书复制到 nginx/ssl/ 目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 模型加载失败 | 检查模型路径是否正确，确保使用 HuggingFace 格式的模型 |
| 视频源无法打开 | 检查摄像头设备号或视频文件路径 |
| 端口被占用 | 修改 `application.properties` 中的 `server.port` |
| 性能不足 | 使用 GPU 加速，或降低 `IMG_SIZE` 分辨率 |
| CORS 错误 | 检查 CorsConfig 配置，确认请求来源 |
| API Key 401 错误 | 确认请求头携带正确的 `X-API-Key` |

## 技术栈

- **后端**: Spring Boot 3.2.x, Java 17
- **前端**: 原生 HTML/CSS/JS, Chart.js
- **AI**: YOLOv8 (Ultralytics), Qwen2.5-VL-7B
- **部署**: Docker Compose, Nginx
- **模板引擎**: Thymeleaf

## License

Private
