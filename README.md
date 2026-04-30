# 监狱智能行为分析系统

实时视频监控智能分析系统，基于 YOLOv8 人体姿态估计，专为监狱/看守所场景设计。自动检测异常行为并报警，支持 OpenCV 桌面端和 Web 管理面板双界面。

## 功能

- **跌倒检测** — 基于多维度特征（长宽比、头部-臀部位置、躯干倾斜角、腿部角度），综合评分判定
- **打架检测** — 通过人体躯干距离、框重叠度、手臂姿态综合研判
- **疲劳检测** — 持续静止超过阈值判定为疲劳；另通过 EAR（眼高宽比）检测闭眼疲劳
- **离岗检测** — 监控区域内无人时触发
- **人员聚集** — 基于密度聚类，阈值 3 人、聚集半径 <1.5m、持续 ≥3s
- **Web 管理面板** — Chart.js 实时统计、MJPEG 视频流、截图浏览与删除
- **Qwen2.5-VL 服务**（可选）— 大模型场景语义分析

## 架构

```
┌──────────────────────┐     ┌──────────────────────────────────┐
│   Camera / Video     │────▶│   Python AI Detection Service    │
│                      │     │   (YOLOv8n-pose, OpenCV)         │
└──────────────────────┘     └──────────┬───────────┬───────────┘
                                        │           │
                          写入 JSON+图片 │           │ HTTP POST 帧
                          到 data/ 目录  │           │ (/api/update_frame)
                                        ▼           ▼
                               ┌────────────────────────┐
                               │  Java Spring Boot      │
                               │  (REST API + MJPEG)    │
                               └───────────┬────────────┘
                                           │
                                           ▼
                               ┌────────────────────────┐
                               │  Web Dashboard          │
                               │  (Thymeleaf + Chart.js) │
                               │  polls /api/stats 每2s  │
                               └────────────────────────┘
```

**数据流**：Python 检测 → 写入 `backend/data/`（JSON + JPG）+ HTTP 推流 → Java 扫描并缓存（2s TTL）→ REST API 响应 → 前端轮询渲染

## 技术栈

| 组件 | 技术 |
|------|------|
| AI 推理 | Python 3.10+, YOLOv8n-pose (Ultralytics), PyTorch |
| 后端 | Java 17, Spring Boot 3.x, Maven (WAR) |
| 前端 | Thymeleaf, Chart.js, MJPEG 流 |
| 反向代理 | Nginx (HTTPS + WebSocket/SSE) |
| 部署 | Docker Compose |
| 可选 | Qwen2.5-VL-7B 大模型视觉分析 (端口 5001) |

## 快速开始

### 前置依赖

- Python 3.10+（推荐 Conda 环境）
- Java 17+（Spring Boot 后端）
- Maven（后端构建）
- Docker & Docker Compose（可选，容器化部署）

### Python 端

```bash
# 安装依赖
pip install ultralytics opencv-python numpy pillow requests

# 运行检测（默认读取摄像头；修改 Config.SOURCE 可切换为视频文件）
cd ai-models
python yolov8_security.py
```

### Java 后端

```bash
# 构建 WAR 包
cd backend
./mvnw clean package -DskipTests

# 运行开发服务器（默认端口 5000）
./mvnw spring-boot:run
```

### 浏览器访问

打开 Web 管理面板：`http://localhost:5000/yolov8-security/`

### Docker 部署

```bash
docker-compose up -d
docker-compose logs -f
```

## 配置

### Python 检测参数 (`ai-models/yolov8_security.py` Config 类)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `SOURCE` | `0` | 视频源（0=摄像头，或视频文件路径） |
| `IMG_SIZE` | `512` | 推理输入尺寸 |
| `CONF_THRESH` | `0.5` | 检测置信度阈值 |
| `FATIGUE_DURATION` | `3` | 静止持续判定疲劳的秒数 |
| `FIGHTING_THRESHOLD` | `0.3` | 打架综合评分阈值 |
| `EYE_AR_THRESHOLD` | `0.2` | EAR 闭眼阈值 |
| `EYE_FATIGUE_FRAMES` | `30` | 连续低 EAR 帧数 |
| `GATHER_THRESHOLD` | `3` | 聚集人数阈值 |
| `GATHER_RADIUS` | `0.08` | 聚集归一化半径 |
| `GATHER_DURATION` | `3.0` | 聚集持续秒数 |
| `ALERT_COOLDOWN` | `5.0` | 报警冷却秒数 |

### Java 后端 (`application.properties`)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `server.port` | `5000` | 后端端口 |
| `app.auth.token` | `default-dev-token` | API 认证 Token |
| `file.upload-dir` | `../data` | 检测数据目录 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_SERVER_URL` | `http://127.0.0.1:5000/yolov8-security` | Web 服务地址 |
| `API_KEY` | — | API 认证密钥 |

## API 端点

所有 API 前缀：`/yolov8-security/`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/stats` | GET | 检测统计 + 行为计数（前端每 2s 轮询） |
| `/api/images` | GET | 截图文件列表 |
| `/api/images/{name}` | GET | 获取截图文件 |
| `/api/delete_all_images` | DELETE | 批量删除检测数据并刷新缓存 |
| `/api/model_info` | GET | YOLO 模型量化信息 |
| `/api/ai/status` | GET | Qwen2.5-VL 服务健康检查 |
| `/api/open_folder` | POST | 打开服务器截图/视频目录 |
| `/video_feed` | GET | MJPEG 实时视频流 |

## 测试

```bash
# Python
cd tests && python -m pytest test_detection.py -v

# Java
cd backend && ./mvnw test
```

## 目录结构

```
├── ai-models/
│   └── yolov8_security.py          # YOLOv8 行为检测主程序
│   └── qwen_vl_service.py          # Qwen2.5-VL 场景分析服务（可选）
├── backend/
│   ├── src/main/java/com/yolov8/security/
│   │   ├── config/                 # AuthFilter, RateLimitFilter, CorsConfig
│   │   ├── controller/             # StatsController, ImageController, VideoStreamController
│   │   ├── service/                # DetectionService, ModelInfoService, PythonScriptService
│   │   └── model/                  # StatsResponse, BehaviorCounts
│   ├── src/main/resources/templates/
│   │   └── index.html              # Web 管理面板（Thymeleaf + Chart.js）
│   ├── Dockerfile
│   └── pom.xml
├── models/
│   └── yolov8n-pose.pt             # YOLOv8 姿态估计模型
├── nginx/
│   └── nginx.conf                  # Nginx 反向代理配置
├── tests/
│   └── test_detection.py           # Python 检测单元测试
├── docker-compose.yml
├── Dockerfile                      # Python 端容器化（可选）
├── environment.yml                 # Conda 环境配置
└── README.md
```

**数据目录**（自动生成）：`backend/data/` — 存储 `detection_*.json` 和 `frame_*.jpg`

## 关键设计

- **无数据库** — Python 写 JSON 文件，Java 定时扫描并缓存（2s TTL）
- **缓存失效** — 删除操作后需调用 `invalidateScanCache()`，否则界面不会立即更新
- **视频流** — MJPEG 通过 `multipart/x-mixed-replace` 推送；Nginx 需关闭 proxy_buffering
- **认证** — `AuthFilter` 验证 `Authorization` 请求头，Token 不匹配返回 401
- **限流** — `RateLimitFilter` 基于令牌桶算法，按 IP 限流