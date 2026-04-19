# YOLOv8 Real-Time Security Monitoring System

<div align="center">

![Version](https://img.shields.io/badge/Version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/Python-3.10+-green.svg)
![Java](https://img.shields.io/badge/Java-17+-orange.svg)
![License](https://img.shields.io/badge/License-MIT-red.svg)

A comprehensive real-time security monitoring system based on **YOLOv8** with multi-person pose detection, behavior recognition (falls, fights, fatigue), and AI-powered analysis using **Qwen2.5-VL**.

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Architecture](#architecture)

</div>

---

## ✨ Features

### 🎯 Core Detection Capabilities
- **Multi-Person Pose Detection** - Simultaneous detection and tracking of multiple people
- **Behavior Recognition**
  - 🔴 Fall Detection - Identify dangerous falls in real-time
  - ⚔️ Fight Detection - Detect altercations and violent behavior
  - 😴 Fatigue Detection - Monitor worker alertness and fatigue
  - 📍 Loitering Detection - Track suspicious loitering behavior

### 🤖 AI Features
- **Qwen2.5-VL Integration** - Advanced visual reasoning and scene understanding
- **Real-time Analysis** - Sub-second processing for live video streams
- **Batch Processing** - Support for multiple video sources simultaneously

### 🔧 Technical Highlights
- **Full Stack Solution** - Backend (Java/Spring Boot) + Frontend (Web) + AI (Python)
- **Docker Support** - Easy deployment with containerization
- **RESTful API** - Well-documented REST endpoints for integration
- **Responsive Dashboard** - Real-time monitoring interface with live video, statistics, and alerts

---

## 🚀 Quick Start

### Prerequisites
- **Java** 17 or higher
- **Python** 3.10 or higher
- **pip** package manager

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/X-Xcc/EverBright-Security.git
cd EverBright-Security
```

2. **Install Python dependencies**
```bash
pip install -r requirements.txt
```

3. **One-Click Start (Windows)**
```bash
scripts/start_all.bat
```

### Manual Startup

**Terminal 1: Backend Service**
```bash
cd backend
mvn clean package
java -jar target/yolov8-security.war
# Access at http://localhost:8080/yolov8-security
```

**Terminal 2: Qwen VL Service**
```bash
cd ai-models
python qwen_vl_service.py
# Service running at http://localhost:5001
```

**Terminal 3: YOLOv8 Monitoring**
```bash
cd ai-models
python yolov8_security.py
```

---

## 📋 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Frontend (Dashboard)                  │
│                        (index.html)                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────▼────────────────────────────────────┐
│         Backend Service (Spring Boot - Port 8080)            │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │ REST API     │ Page Render  │ Video Stream │             │
│  │ Controller   │ Controller   │ Controller   │             │
│  └──────────────┴──────────────┴──────────────┘             │
│                         ▲                                    │
└─────┬──────────────────┼──────────────────────┬─────────────┘
      │                  │                      │
      │ REST API         │ File I/O            │ REST API
      │ (Detection)      │ (Videos/Results)    │ (Qwen)
      ▼                  ▼                      ▼
  ┌──────────────────────────────┐    ┌──────────────┐
  │   AI Models (Python)         │    │  Qwen VL     │
  │  ┌────────────────────────┐  │    │  Service     │
  │  │ YOLOv8 Detection       │  │    │ (Port 5001)  │
  │  │ • Pose Detection       │  │    │              │
  │  │ • Behavior Recognition │  │    │ Advanced AI  │
  │  │ • Multi-person Tracking│  │    │ Analysis     │
  │  └────────────────────────┘  │    └──────────────┘
  └──────────────────────────────┘
```

---

## 📁 Project Structure

```
yolov8_security/
├── ai-models/                          # AI Model Services
│   ├── yolov8_security.py             # Core detection & behavior recognition
│   ├── qwen_vl_service.py             # Qwen VL API service
│   └── .README
│
├── backend/                            # Java Backend Service
│   ├── config/                         # Spring configurations (CORS, Jackson, Web)
│   ├── controller/                     # REST API endpoints
│   ├── model/                          # Data models
│   ├── service/                        # Business logic
│   ├── application.properties          # Local config
│   ├── application-docker.properties   # Docker config
│   ├── pom.xml                        # Maven configuration
│   └── .README
│
├── frontend/                           # Web Dashboard
│   ├── index.html                     # Real-time monitoring interface
│   └── .README
│
├── docs/                               # Documentation
│   ├── README_JAVA.md                 # Java backend guide
│   ├── README_RUN.md                  # Running & deployment guide
│   ├── Qwen_VL_详细配置指南.md        # Qwen model configuration
│   ├── 部署指南.md                    # Deployment guide
│   └── .README
│
├── models/                             # Pre-trained Models
│   ├── yolov8n-pose.pt                # YOLOv8 nano pose detection model
│   └── .README
│
├── scripts/                            # Automation Scripts
│   ├── start_all.bat                  # Start all services
│   ├── build_war.bat                  # Build WAR package
│   ├── deploy.bat                     # Deploy application
│   └── .README
│
├── requirements.txt                    # Python dependencies
└── README.md                          # This file
```

---

## 🔗 API Endpoints

### Video & Detection API
```
GET  /yolov8-security/api/video/stream     # Video stream endpoint
GET  /yolov8-security/api/detection/latest # Get latest detections
GET  /yolov8-security/api/stats            # Get system statistics
POST /yolov8-security/api/detection/save   # Save detection data
```

### Qwen VL API
```
POST /analyze                # Analyze base64 encoded image
POST /analyze_file          # Analyze uploaded image file
POST /batch_analyze         # Batch analyze multiple images
GET  /health               # Service health check
```

### Dashboard
```
http://localhost:8080/yolov8-security
http://localhost:5000              # Docker deployment
```

---

## 📚 Documentation

Detailed documentation available in the `docs/` folder:

- **[Java Backend Guide](docs/README_JAVA.md)** - Backend architecture and development
- **[Running & Deployment](docs/README_RUN.md)** - How to run and deploy the system
- **[Qwen Model Configuration](docs/Qwen_VL_详细配置指南.md)** - Detailed Qwen setup
- **[Deployment Guide](docs/部署指南.md)** - Step-by-step deployment instructions

Each module also has a `.README` file with specific implementation details.

---

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build the backend
cd backend
mvn clean package -DskipTests

# Build Docker image
docker build -t yolov8-security .

# Run container
docker run -p 5000:5000 -p 5001:5001 \
  -e QWEN_VL_MODEL_PATH=/app/models \
  yolov8-security
```

---

## 📊 Performance Metrics

- **Detection Speed**: ~33ms per frame (YOLOv8 Nano on GPU)
- **Supported Resolution**: 640x480 to 1920x1080
- **FPS**: 15-30 FPS (depending on model and hardware)
- **Memory Usage**: ~2GB (with GPU acceleration)
- **Concurrent Users**: 10+ simultaneous viewers

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Spring Boot, Java 17+ | REST API, Service orchestration |
| **Frontend** | HTML5, CSS3, JavaScript | Real-time dashboard |
| **AI/ML** | YOLOv8, PyTorch, Transformers | Object detection & behavior recognition |
| **Vision AI** | Qwen2.5-VL | Advanced scene understanding |
| **Build** | Maven | Java project build |
| **Runtime** | Docker | Containerization |

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙋 Support

- 📖 Check the [documentation](docs/) folder for detailed guides
- 🐛 Report bugs via [GitHub Issues](https://github.com/X-Xcc/EverBright-Security/issues)
- 💬 Discussions and Q&A in [GitHub Discussions](https://github.com/X-Xcc/EverBright-Security/discussions)

---

## 🌟 Acknowledgments

- [YOLOv8](https://github.com/ultralytics/yolov8) - Object detection framework
- [Qwen](https://github.com/QwenLM/Qwen2.5-VL) - Vision-language model
- [Spring Boot](https://spring.io/projects/spring-boot) - Java framework
- [PyTorch](https://pytorch.org/) - Deep learning framework

---

<div align="center">

Made with ❤️ by X-Xcc

[⭐ Star on GitHub](https://github.com/X-Xcc/EverBright-Security)

</div>
