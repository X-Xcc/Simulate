# YOLOv8 Security Monitor - Spring Boot 版本

这是一个基于 Spring Boot 的 YOLOv8 安全监控系统，已从 Flask 迁移到 Java Web。

## 项目结构

```
yolov8_security/
├── src/
│   └── main/
│       ├── java/com/yolov8/security/
│       │   ├── YoloV8SecurityApplication.java    # 主应用类
│       │   ├── config/                            # 配置类
│       │   ├── controller/                        # REST API 控制器
│       │   ├── model/                             # 数据模型
│       │   └── service/                           # 业务服务
│       └── resources/
│           ├── application.properties              # 应用配置
│           └── templates/
│               └── index.html                     # 前端页面
├── pom.xml                                         # Maven 配置
└── code/
    └── yolov8_security.py                         # Python YOLOv8 检测脚本
```

## 环境要求

- JDK 17 或更高版本
- Maven 3.6+
- Python 3.8+（用于 YOLOv8 检测）
- Tomcat 9.0+ 或其他 Servlet 3.1+ 容器

## 构建和打包

### 1. 编译项目

```bash
mvn clean compile
```

### 2. 运行测试

```bash
mvn test
```

### 3. 打包成 WAR 文件

```bash
mvn clean package
```

打包完成后，WAR 文件位于：
```
target/yolov8-security.war
```

## 部署方式

### 方式一：部署到 Tomcat

1. 将 `target/yolov8-security.war` 复制到 Tomcat 的 `webapps` 目录
2. 启动 Tomcat
3. 访问 `http://localhost:8080/yolov8-security/`

### 方式二：使用 Spring Boot 内置服务器运行

```bash
mvn spring-boot:run
```

或直接运行 JAR：

```bash
java -jar target/yolov8-security.war
```

### 方式三：使用 Maven 插件运行

```bash
mvn spring-boot:run
```

## 配置说明

### application.properties 配置项

```properties
# 服务器配置
server.port=5000
server.servlet.context-path=/

# 文件目录配置
file.upload-dir=./data
file.video-dir=./videos
file.model-dir=./models
file.result-dir=./results

# 监控配置
monitor.timeout=300
monitor.max-recent-detections=20
monitor.max-recent-frames=5

# Python 脚本配置
python.script.path=./code/yolov8_security.py
python.executable=python
```

## API 接口

### 统计数据
- `GET /api/stats` - 获取统计数据

### 检测数据
- `GET /api/detections` - 获取所有检测数据
- `GET /api/recent_frames` - 获取最近的图片
- `GET /api/all_frames` - 获取所有检测图片
- `GET /api/images` - 获取所有图片列表
- `GET /api/images/{filename}` - 获取指定图片
- `DELETE /api/delete_all_images` - 删除所有检测图片

### 监控状态
- `GET /api/monitor_status` - 获取监控在线状态

### 模型信息
- `GET /api/model_info` - 获取模型量化信息
- `POST /api/model_info` - 更新模型量化信息

### 其他
- `POST /api/open_folder` - 打开指定文件夹
- `POST /api/update_frame` - 接收视频帧
- `GET /video_feed` - 实时视频流

## 从 Flask 迁移的变更

### 主要变更

1. **框架**: Flask (Python) → Spring Boot (Java)
2. **构建工具**: PyInstaller → Maven
3. **打包格式**: EXE → WAR
4. **部署方式**: 独立运行 → Servlet 容器部署

### API 兼容性

所有 REST API 接口保持与原 Flask 版本兼容，前端无需修改。

### Python 集成

YOLOv8 检测功能仍使用 Python 实现，Java 通过 ProcessBuilder 调用 Python 脚本。

## 故障排除

### 构建失败

1. 确保已安装 JDK 17+
2. 检查 Maven 版本是否为 3.6+
3. 清理并重新构建：`mvn clean install`

### 部署失败

1. 检查 Tomcat 版本是否为 9.0+
2. 确保 Java 版本与编译版本一致
3. 查看日志文件获取详细错误信息

### Python 脚本调用失败

1. 确保 Python 已安装并在 PATH 中
2. 检查 `python.script.path` 配置是否正确
3. 确保已安装所有 Python 依赖（ultralytics, opencv-python 等）

## 开发说明

### 添加新的 API 接口

1. 在 `controller` 包中创建新的控制器类
2. 在 `service` 包中实现业务逻辑
3. 在 `model` 包中定义数据模型

### 修改配置

编辑 `src/main/resources/application.properties` 文件。

## 许可证

本项目基于原 Flask 版本迁移而来，保留原有许可证。
