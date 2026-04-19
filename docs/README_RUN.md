# YOLOv8 安防监控系统快速启动指南

## 系统架构

本系统由三个主要组件组成：

1. **Java后端服务** - 提供Web界面和API接口
2. **Qwen VL服务** - 提供视觉语言模型分析能力
3. **YOLOv8安防监控系统** - 提供实时视频分析和行为检测

## 快速启动

### 1. 环境准备

- **Java 8** 或更高版本
- **Python 3.8** 或更高版本
- **CUDA环境**（推荐，用于GPU加速）
- **模型文件**：
  - YOLOv8模型：`models/yolov8n-pose.pt`
  - Qwen VL模型：请设置`QWEN_VL_MODEL_PATH`环境变量

### 2. 安装依赖

```bash
# 安装Python依赖
pip install ultralytics opencv-python numpy pillow requests flask flask-cors torch transformers

# 安装Java依赖（如果需要构建War包）
mvn clean package
```

### 3. 启动系统

**方法一：使用快速启动脚本（推荐）**

```bash
# 运行快速启动脚本
start_all.bat
```

**方法二：手动启动各个服务**

1. **启动Java后端服务**
   ```bash
   java -jar target/yolov8-security.war
   ```

2. **启动Qwen VL服务**
   ```bash
   set QWEN_VL_MODEL_PATH=D:\AI_Project\Models
   python code\qwen_vl_service.py
   ```

3. **启动YOLOv8安防监控系统**
   ```bash
   python code\yolov8_security.py
   ```

## 服务地址

- **Java后端服务**：http://localhost:8080
- **Qwen VL服务**：http://localhost:5001
- **YOLOv8安防监控系统**：本地窗口运行

## 系统功能

- **实时视频分析**：支持摄像头或视频文件输入
- **行为检测**：
  - 跌倒检测
  - 打架检测
  - 疲劳检测
  - 离岗检测
- **可视化界面**：实时显示检测结果和系统状态
- **数据存储**：保存检测结果和关键帧
- **Web视频流**：将视频流发送到Web面板

## 配置说明

### 环境变量

- `QWEN_VL_MODEL_PATH`：Qwen VL模型路径
- `WEB_SERVER_URL`：Web服务器地址（默认：http://127.0.0.1:5000/yolov8-security）
- `QWEN_VL_PORT`：Qwen VL服务端口（默认：5001）
- `QWEN_VL_HOST`：Qwen VL服务主机（默认：0.0.0.0）

### 配置文件

- **YOLOv8配置**：在`code/yolov8_security.py`中的`Config`类中修改
- **Qwen VL配置**：在`code/qwen_vl_service.py`中修改

## 故障排除

1. **模型加载失败**：
   - 检查模型路径是否正确
   - 确保模型文件存在

2. **视频源无法打开**：
   - 检查视频文件路径
   - 确保摄像头连接正常

3. **服务启动失败**：
   - 检查端口是否被占用
   - 检查依赖是否安装正确

4. **性能问题**：
   - 尝试使用GPU加速
   - 调整`IMG_SIZE`参数减小分辨率

## 退出系统

- 在YOLOv8安防监控系统窗口中按`Enter`键退出
- 关闭Java后端服务和Qwen VL服务窗口

## 注意事项

- 首次运行时会自动创建必要的目录
- 请确保有足够的磁盘空间存储视频和检测数据
- 对于实时监控，建议使用GPU加速以获得更好的性能
