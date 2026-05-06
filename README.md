# 监狱智能行为分析系统

> 一个给监狱/看守所使用的 AI 视频监控系统，可以自动检测异常行为并报警。

本系统通过摄像头实时监控画面，利用 AI 自动识别**跌倒、打架、疲劳瞌睡、人员离岗、人群聚集**等异常行为，并在电脑屏幕上显示报警信息。同时提供 Web 网页管理面板，方便远程查看监控画面和数据统计。

---

## 目录

- [这个系统能做什么](#这个系统能做什么)
- [系统长什么样](#系统长什么样)
- [运行原理（简单版）](#运行原理简单版)
- [你需要准备什么](#你需要准备什么)
- [一步步教你运行](#一步步教你运行)
  - [方法一：手动运行（推荐新手）](#方法一手动运行推荐新手)
  - [方法二：Docker 一键运行](#方法二docker-一键运行)
- [打开网页管理面板](#打开网页管理面板)
- [常见问题](#常见问题)
- [目录结构说明](#目录结构说明)
- [高级设置（如果你想调整参数）](#高级设置如果你想调整参数)

---

## 这个系统能做什么

| 功能 | 说明 |
|------|------|
| 🚶 **跌倒检测** | 老人或犯人摔倒时自动报警 |
| 👊 **打架检测** | 检测到两人以上激烈肢体接触时报警 |
| 😴 **疲劳检测** | 检测到人长时间不动（可能在打瞌睡）时提醒；也能检测闭眼疲劳 |
| 🚪 **离岗检测** | 监控区域内长时间没人时报警 |
| 👥 **人员聚集** | 检测到 3 人以上聚在一起超过 3 秒时提醒 |
| 🖥️ **桌面端界面** | 运行 Python 程序后弹出一个窗口，实时显示检测画面 |
| 🌐 **Web 管理面板** | 浏览器打开网页，可查看实时视频流、统计图表、历史截图 |

---

## 系统长什么样

### 桌面端界面（OpenCV 窗口）

运行 Python 程序后，会弹出一个名为 "Security Detection System" 的窗口：
- 左侧是状态面板，显示当前人数、检测到的行为、最近日志
- 主画面中，人体会被框出来，异常行为会标红
- 顶部有 LIVE 状态灯（正常绿色、报警红色）
- 右上角显示实时 FPS（每秒处理帧数）

### Web 管理面板

浏览器打开 `http://localhost:5000/yolov8-security/` 后：
- 实时监控视频流（MJPEG 格式）
- 行为统计柱状图/折线图
- 历史截图浏览
- 一键删除所有截图数据

---

## 运行原理（简单版）

```
摄像头/视频文件 ──→ Python AI 检测程序 ──→ 在屏幕上显示检测结果
                        │
                        ├──→ 把检测结果保存为 JSON 文件
                        ├──→ 把截图保存为 JPG 图片
                        └──→ 把视频画面发送给 Java 后端

Java 后端 ──→ 读取 JSON 和图片 ──→ 提供网页 API ──→ 浏览器展示
```

简单说：**Python 负责 AI 检测**，**Java 负责网页服务**，两者通过文件 + 网络通信。

---

## 你需要准备什么

### 基础要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Windows 10/11、Linux、macOS |
| 摄像头 | 一个可用的 USB 摄像头或网络摄像头（没有也可以，可以用视频文件测试） |
| Python | 3.8 ~ 3.11 版本（推荐 3.10） |
| Java | JDK 17 或更高版本 |
| 内存 | 至少 4GB（推荐 8GB+） |
| 硬盘 | 至少 2GB 可用空间 |

### 没有摄像头怎么办？

系统默认使用摄像头。如果没有摄像头，可以改成播放视频文件：
1. 打开 `ai-models/yolov8_security.py`
2. 找到 `SOURCE = 0` 这一行（约第 64 行）
3. 改成 `SOURCE = "videos/test_video.mp4"`（把视频文件放在 `videos/` 文件夹里）
4. 如果没有视频文件，程序会自动创建一个测试画面

### 不想装 Java 怎么办？

可以用 Docker 运行 Java 后端（见下文 Docker 部署方式），只需要安装 Docker 即可。

---

## 一步步教你运行

### 方法一：手动运行（推荐新手）

#### 第 1 步：下载 YOLOv8 模型文件

系统需要一个 AI 模型文件才能工作。下载 `yolov8n-pose.pt`（大约 5MB）：
- 下载地址：https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n-pose.pt
- 下载后放到项目根目录下的 `models/` 文件夹里
- 最终路径应该是：`models/yolov8n-pose.pt`

> 如果 `models/` 文件夹不存在，请手动创建一个。

#### 第 2 步：安装 Python 环境

**如果你有 Conda（推荐）：**

```bash
# 用项目提供的环境配置文件一键创建环境
conda env create -f environment.yml

# 激活环境
conda activate yolov8-security
```

**如果你没有 Conda（用 pip 安装）：**

```bash
# 直接用 pip 安装所需库
pip install ultralytics opencv-python numpy pillow requests
```

> pip 安装慢的话可以加国内镜像：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ultralytics opencv-python numpy pillow requests`

#### 第 3 步：运行 Python AI 检测程序

```bash
# 进入 AI 模型目录
cd ai-models

# 运行检测程序
python yolov8_security.py
```

如果一切正常，会弹出一个窗口，显示摄像头画面，并实时检测人体和行为。

> **注意：** 程序默认调用摄像头（设备 0）。如果你的摄像头是笔记本自带摄像头，通常就是 0。如果是外接摄像头，可能需要改成 1 或 2。

#### 第 4 步：安装 Java 并启动后端（可选，用于 Web 面板）

**安装 Java 17+：**

从 https://adoptium.net/ 下载 Temurin JDK 17 或更高版本，安装即可。

安装后打开命令行验证：
```bash
java -version
# 应该显示类似 "openjdk version "17.0.x" 的信息
```

**构建并运行后端：**

```bash
# 进入 backend 目录
cd backend

# 构建项目（第一次运行需要下载依赖，会慢一些）
./mvnw clean package -DskipTests

# 启动后端服务
./mvnw spring-boot:run
```

看到类似 `Tomcat started on port(s): 5000` 的日志，说明启动成功。

> Windows 上如果 `./mvnw` 报错，请用 `mvnw.cmd clean package -DskipTests`

---

### 方法二：Docker 一键运行

> 需要先安装 Docker Desktop（https://www.docker.com/products/docker-desktop/）

```bash
# 一键启动所有服务
docker-compose up -d

# 查看运行日志
docker-compose logs -f

# 停止所有服务
docker-compose down
```

---

## 打开网页管理面板

当 Java 后端启动成功后，打开浏览器访问：

```
http://localhost:5000/yolov8-security/
```

Web 面板包含：
- **实时监控** — 查看摄像头实时画面（MJPEG 视频流）
- **统计图表** — 各类行为的发生次数统计
- **历史截图** — 查看 AI 检测到异常时自动保存的截图
- **数据管理** — 一键清理所有截图和检测数据

---

## 常见问题

### Q：程序提示 "CUDA 不可用" / "使用 CPU"

这是正常的。CUDA 需要 NVIDIA 显卡，如果没有独立 NVIDIA 显卡，程序会自动使用 CPU 运行，速度会慢一些，但功能完全一样。如果用的是 NVIDIA 显卡，可以安装 CUDA 工具包来加速。

### Q：弹出窗口但看不到画面

摄像头可能被其他程序占用了（如微信、Zoom 等）。关闭其他使用摄像头的程序，重新运行。

### Q：报错 "ModuleNotFoundError: No module named 'ultralytics'"

依赖没装全。重新运行：
```bash
pip install ultralytics opencv-python numpy pillow requests
```

### Q：Web 面板打不开

确认 Java 后端已经启动成功。检查命令行是否有报错，以及是否显示了 `Tomcat started on port(s): 5000`。

### Q：画面很卡怎么办？

可以降低画质来提高速度。打开 `ai-models/yolov8_security.py`，找到 `Config` 类，把 `IMG_SIZE = 512` 改成 `IMG_SIZE = 320`（数字越小越快，但精度会降低）。

### Q：不想每次开摄像头，想用视频文件测试？

找到 `Config` 类中的 `SOURCE = 0`，改成视频文件路径即可，例如 `SOURCE = "videos/test.mp4"`。把视频文件放到项目根目录下的 `videos/` 文件夹里。

---

## 目录结构说明

```
yolov8_security/                        # 项目根目录
│
├── ai-models/                          # Python AI 检测程序
│   └── yolov8_security.py              #   ★ 主程序（运行这个文件）
│   └── qwen_vl_service.py              #   可选：大模型场景分析服务
│
├── backend/                            # Java 后端（提供 Web 服务）
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/.../config/        #   配置类（认证、限流等）
│   │   │   ├── java/.../controller/    #   API 接口
│   │   │   ├── java/.../service/       #   业务逻辑
│   │   │   └── resources/templates/
│   │   │       └── index.html          #   ★ Web 管理面板页面
│   │   └── test/                       #   测试代码
│   ├── Dockerfile                      #   后端容器化配置
│   ├── pom.xml                         #   Maven 项目配置
│   └── mvnw / mvnw.cmd                 #   Maven 构建工具
│
├── models/                             # AI 模型文件（需要自己下载）
│   └── yolov8n-pose.pt                 #   ★ YOLOv8 姿态估计模型
│
├── nginx/
│   └── nginx.conf                      #   Nginx 反向代理配置
│
├── tests/                              # Python 测试
│   └── test_detection.py
│
├── backend/data/                       # ★ 自动生成：检测数据存放目录
│   ├── detection_20250101_120000.json  #   检测结果（JSON 格式）
│   └── frame_20250101_120000.jpg       #   异常截图
│
├── results/                            # 自动生成：录制的检测视频
├── videos/                             # 放你自己的测试视频文件
│
├── docker-compose.yml                  # Docker 一键部署配置
├── environment.yml                     # Conda 环境配置
└── README.md                           # 本文件
```

---

## 高级设置（如果你想调整参数）

打开 `ai-models/yolov8_security.py`，找到 `class Config`（约第 57 行），可以修改以下参数：

| 参数名 | 默认值 | 说明 | 怎么调 |
|--------|--------|------|--------|
| `SOURCE` | `0` | 视频来源。`0`=摄像头，或填视频文件路径 | 没摄像头就改文件路径 |
| `IMG_SIZE` | `512` | AI 识别的图片清晰度 | 卡顿就改小（320），想更准改大（640） |
| `CONF_THRESH` | `0.5` | 检测置信度，越高要求越严格 | 误报多就调高（0.6），漏报多就调低（0.4） |
| `FATIGUE_DURATION` | `3` | 人静止多久算疲劳（秒） | 想宽松点就改大（5） |
| `GATHER_THRESHOLD` | `3` | 最少几个人算聚集 | 要求严就改小（2），宽松就改大（5） |
| `GATHER_DURATION` | `3.0` | 聚持续多久才报警（秒） | 路过的人多就改大（5） |
| `ALERT_COOLDOWN` | `5.0` | 同一种报警最短间隔（秒） | 不想频繁报警就改大（10） |

---

## 技术细节（给开发者看）

| 组件 | 使用的技术 |
|------|-----------|
| AI 检测 | Python + YOLOv8n-pose（Ultralytics）+ PyTorch |
| 后端服务 | Java 17 + Spring Boot 3.x |
| Web 前端 | Thymeleaf + Chart.js |
| 视频流 | MJPEG（`multipart/x-mixed-replace`） |
| 反向代理 | Nginx |
| 容器化 | Docker + Docker Compose |
| 数据存储 | 无数据库，使用 JSON 文件（在 `backend/data/` 目录） |

### 数据怎么传输的

Python 和 Java 之间通过两种方式通信：
1. **文件方式**：Python 把检测结果写成 `.json` 文件，把截图存为 `.jpg` 文件，都放在 `backend/data/` 文件夹。Java 每隔 2 秒扫描一次这个文件夹。
2. **网络方式**：Python 直接把每一帧画面通过 HTTP 发送给 Java。

### API 接口

如果你要自己写程序读取检测数据，可以调用以下接口（所有接口前缀 `/yolov8-security/`）：

| 方法 | 接口地址 | 作用 |
|------|----------|------|
| GET | `/api/status` | 系统状态（监控是否运行中、模型信息） |
| GET | `/api/recent` | 最近 20 条检测记录 |
| GET | `/api/stats` | 检测统计数据（Web 页面每 2 秒调一次） |
| GET | `/api/images` | 获取所有截图列表 |
| GET | `/api/images/{文件名}` | 获取某张截图 |
| DELETE | `/api/delete_all_images` | 删除所有截图和检测数据 |
| POST | `/api/alert` | 手动触发报警 |
| POST | `/api/update_frame` | 接收 Python 发送的视频帧 |
| POST | `/api/model_info` | 接收模型量化信息 |
| POST | `/api/qwen/analyze` | 发送图片给 Qwen VL 分析 |
| GET | `/api/stream` | SSE 视频帧流 |
| GET | `/video_feed` | MJPEG 实时视频流地址 |
| GET/PUT | `/api/settings` | 系统设置（JSON 持久化） |
| GET/POST/PUT/DELETE | `/api/users` | 用户管理（JSON 持久化） |
| GET/POST/PUT/DELETE | `/api/devices` | 设备/摄像头管理（JSON 持久化） |

### 认证

- `AuthFilter` 检查请求头 `Authorization` 是否匹配 `app.auth.token` 配置
- `application.properties` 设置 `app.auth.token=${API_KEY:default-dev-token}`
- 如果 token 为空则跳过认证

### 关键路径映射

以下路径必须保持一致，否则系统无法正常工作：

| 组件 | 配置项 / 变量 | 必须指向 |
|------|--------------|---------|
| Java 读取检测 JSON | `app.file.upload-dir` | 包含 `detection_*.json` 的目录 |
| Python 写入检测 JSON | `Config.DATASET_DIR` | `PROJECT_ROOT/backend/data` |
| Python 可执行文件 | `app.python.executable` | 有效的 python / python.exe |
| YOLO 脚本路径 | `app.python.script.path` | `ai-models/yolov8_security.py` |
| 模型权重 | `Config.MODEL_PATH` | `models/yolov8n-pose.pt` |
| 视频输出 | `Config.RESULT_VIDEO_PATH` | `results/security_result.mp4` |

### Python 脚本关键配置

`ai-models/yolov8_security.py` 中的关键变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEB_SERVER_URL` | `http://127.0.0.1:5000/yolov8-security` | Java 后端地址（可通过环境变量覆盖） |
| `Config.DATASET_DIR` | `PROJECT_ROOT/backend/data` | 检测结果写入目录 |
| `Config.MODEL_PATH` | `PROJECT_ROOT/models/yolov8n-pose.pt` | YOLO 模型路径 |
| `Config.SOURCE` | `PROJECT_ROOT/videos/test_video.mp4` | 视频源（`0`=摄像头，或文件路径） |