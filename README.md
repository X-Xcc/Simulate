# YOLOv8 智能安防监控系统

> **一句话介绍**：一个基于 YOLOv8 目标检测 + Qwen VL 大语言模型的智能视频安防系统，可以实时检测视频流中的异常行为并告警。

---

## 目录

- [项目简介](#项目简介)
- [系统架构](#系统架构)
- [部署方式选择](#部署方式选择)
- [方式一：Docker 一键部署（推荐，5分钟搞定）](#方式一docker-一键部署推荐5分钟搞定)
  - [第一步：安装 Docker Desktop](#第一步安装-docker-desktop)
  - [第二步：克隆项目代码](#第二步克隆项目代码)
  - [第三步：配置环境变量](#第三步配置环境变量)
  - [第四步：启动全部服务](#第四步启动全部服务)
  - [第五步：访问系统](#第五步访问系统)
- [方式二：手动部署（适合想深入了解的开发者）](#方式二手动部署适合想深入了解的开发者)
  - [环境准备](#环境准备)
  - [第一步：安装 Java 17](#第一步安装-java-17)
  - [第二步：安装 Python 3.10+](#第二步安装-python-310)
  - [第三步：安装 Maven](#第三步安装-maven)
  - [第四步：克隆项目代码](#第四步克隆项目代码-1)
  - [第五步：安装 Python 依赖](#第五步安装-python-依赖)
  - [第六步：打包后端](#第六步打包后端)
  - [第七步：启动全部服务](#第七步启动全部服务)
- [系统功能](#系统功能)
- [配置文件说明](#配置文件说明)
- [常见问题与解决方案](#常见问题与解决方案)
- [项目目录结构](#项目目录结构)
- [技术支持](#技术支持)

---

## 项目简介

本系统是一个完整的智能安防监控平台，具备以下核心能力：

- **实时目标检测** — 基于 YOLOv8 模型，检测视频中的人员、车辆等目标
- **异常行为识别** — 通过 Qwen VL 多模态大模型分析场景，识别可疑行为
- **Web 管理界面** — 浏览器即可访问，无需安装客户端
- **实时告警** — 检测到异常自动告警，支持保存告警截图

---

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (Chrome/Edge)              │
└─────────────────────┬───────────────────────────────┘
                      │ http://localhost
┌─────────────────────▼───────────────────────────────┐
│              Nginx（静态服务 + 反向代理）              │
│              端口: 80 / 443                          │
└─────────────────────┬───────────────────────────────┘
                      │ 反向代理
┌─────────────────────▼───────────────────────────────┐
│          Spring Boot 后端 (Java 17)                  │
│          端口: 5000                                  │
│  · REST API 接口        · 告警管理                    │
│  · API Key 认证         · 视频流管理                  │
└──────┬────────────────────────┬──────────────────────┘
       │                        │
┌──────▼──────┐        ┌────────▼────────┐
│  YOLOv8     │        │  Qwen VL        │
│  目标检测    │        │  大模型分析      │
│  (Python)   │        │  (Python)       │
│  端口: -    │        │  端口: 5001     │
└─────────────┘        └─────────────────┘
```

---

## 部署方式选择

| 方式 | 适合人群 | 耗时 | 难度 |
|------|---------|------|------|
| **Docker 一键部署** | 所有人（强烈推荐） | 5分钟 | ⭐ |
| 手动部署 | 想修改源码的开发者 | 30分钟 | ⭐⭐⭐ |

---

## 方式一：Docker 一键部署（推荐，5分钟搞定）

> **Docker 是什么？** 简单说，它是一个"打包箱"，把所有运行环境打包在一起，你不需要关心 Java、Python 等环境配置，开箱即用。

### 第一步：安装 Docker Desktop

#### Windows 用户

1. 访问 Docker 官网下载页面：

   **国际版（需要科学上网）：**
   ```
   https://www.docker.com/products/docker-desktop/
   ```

   **或者使用国内镜像源下载（推荐）：**
   ```
   https://hub.docker.com/editions/container-toolbox?edition=community
   ```

2. 下载 **Docker Desktop for Windows**（选择适合你系统的版本，通常是 Windows 11 AMD64）

3. 双击下载好的 `.exe` 安装包，按向导一路安装：
   - 安装过程中如果提示需要开启 **WSL 2**（Windows 子系统），点击确认
   - 如果提示需要开启 **虚拟化（Hyper-V）**，按提示操作并在 BIOS 中启用虚拟化
   - 安装完成后，重启电脑

4. 启动 Docker Desktop：
   - 首次启动会要求你登录 Docker Hub 账号 —— **不需要登录**，点击 "Sign up later!" 跳过即可
   - 接受默认设置，点击 "Finish"

5. 验证安装成功：打开命令提示符（Win+R → 输入 `cmd` → 回车），执行：

   ```bash
   docker --version
   ```

   看到类似输出说明安装成功：
   ```
   Docker version 27.x.x, build xxxxx
   ```

6. **关键一步：配置国内镜像源**（否则拉取镜像会非常慢甚至超时）

   > 由于 Docker Hub 服务器在国外，国内直接拉取镜像会非常慢。必须配置国内镜像加速器。

   **方法一：通过 Docker Desktop 图形界面配置（推荐新手）**

   1. 点击 Docker Desktop 任务栏图标的托盘图标（通常在小箭头里）
   2. 点击齿轮图标 ⚙️ 打开 **Settings**
   3. 在左侧菜单找到 **Docker Engine**（不是 Resources！）
   4. 在右侧 JSON 编辑器中，找到 `"features"` 部分，在 `"registry-mirrors"` 字段添加国内镜像源：

   ```json
   {
     "registry-mirrors": [
       "https://docker.1ms.run",
       "https://docker.xuanyuan.me",
       "https://docker.chenby.cn",
       "https://mirror.ccs.tencentyun.com"
     ],
     "features": {
       "containerd-snapshotter": true
     },
     "metrics": false
   }
   ```

   5. 点击 **"Apply & Restart"** 保存并重启 Docker

   **方法二：通过 docker-compose.yml 直接指定国内镜像**

   如果你不想配置全局镜像源，也可以在项目中的 `docker-compose.yml` 里直接写国内镜像地址。本项目的 docker-compose.yml 已经做了处理，如果你遇到拉取慢的问题，可以参考上面的镜像源手动替换。

   **国内镜像源汇总（如果以上失效，可尝试）：**

   | 镜像源 | 地址 | 说明 |
   |--------|------|------|
   | 1ms | `https://docker.1ms.run` | 速度快，2025年可用 |
   | 玄元 | `https://docker.xuanyuan.me` | 稳定，2025年可用 |
   | chenby | `https://docker.chenby.cn` | 备用 |
   | 腾讯云 | `https://mirror.ccs.tencentyun.com` | 老牌，可能需注册 |
   | 阿里云 | 需登录 https://cr.console.aliyun.com 获取个人专属地址 | 最稳定，需账号 |

   > **阿里云镜像源配置方法（最稳定但需要注册）：**
   > 1. 访问 https://cr.console.aliyun.com （需要阿里云账号，可免费注册）
   > 2. 左侧菜单找到 **镜像中心** → **镜像加速器**
   > 3. 复制你的专属加速器地址，按页面提示配置到 Docker Desktop

7. **验证镜像源是否生效**

   在命令行执行：
   ```bash
   docker pull hello-world
   ```

   如果几秒内下载完成并显示 `Hello from Docker!`，说明配置成功！

#### macOS 用户

1. 访问 https://www.docker.com/products/docker-desktop/ 下载 **Docker Desktop for Mac**
2. 选择适合你芯片的版本（Apple Silicon 或 Intel）
3. 拖拽 `.dmg` 中的 Docker 图标到 Applications 文件夹
4. 启动 Docker Desktop，无需登录，跳过即可
5. 同样需要按照上面的步骤配置国内镜像源
6. 验证：`docker --version`

#### Linux (Ubuntu/Debian) 用户

```bash
# 卸载旧版本（如果有）
sudo apt-get remove docker docker-engine docker.io containerd runc

# 安装依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 配置国内镜像源
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.chenby.cn",
    "https://mirror.ccs.tencentyun.com"
  ]
}
EOF

# 重启 Docker 服务
sudo systemctl daemon-reload
sudo systemctl restart docker

# 验证安装
docker --version
docker pull hello-world
```

### 第二步：克隆项目代码

首先，你需要安装 **Git**（一个代码管理工具）：

**下载 Git：**
```
https://git-scm.com/download/win    # Windows
https://git-scm.com/download/mac    # macOS
```

Windows 用户直接下载 `.exe`，安装时**全选默认选项**即可。

验证 Git 安装：
```bash
git --version
```

接下来克隆本项目：

```bash
# 打开你想存放项目的目录，例如：
cd D:\

# 克隆代码
git clone https://github.com/your-username/yolov8-security.git

# 进入项目目录
cd yolov8-security
```

> **如果你没有 Git 账号或不想用 Git**：
> 1. 访问项目 GitHub 页面
> 2. 点击绿色按钮 **"Code"** → **"Download ZIP"**
> 3. 解压下载的 ZIP 文件到任意目录

### 第三步：配置环境变量

1. 在项目根目录下，复制示例配置文件：

   ```bash
   # Windows
   copy .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

2. 用任意文本编辑器（记事本即可）打开 `.env` 文件，修改以下内容：

   ```
   # API 密钥（默认值可直接使用，生产环境建议修改为一串复杂的随机字符串）
   API_KEY=change-me-in-production
   ```

   > **什么是 API Key？** 就像一把"钥匙"，前端访问后端接口时需要携带这个密钥才能通过验证。本地测试用默认值即可。

### 第四步：启动全部服务

在项目根目录（即 `docker-compose.yml` 所在的目录）打开命令行，执行：

```bash
docker compose up -d
```

命令参数说明：
- `up` — 启动服务
- `-d` — 后台运行（detach），不占用当前终端

**首次运行会发生什么：**
1. Docker 会自动从网络拉取需要的镜像（第一次会比较慢，取决于网速，约 2-10 分钟）
2. 构建后端镜像（需要等待 Maven 下载依赖，约 3-5 分钟）
3. 启动所有容器

> **如果拉取镜像很慢或超时**：请回到第一步第 6 节，确认你是否配置了国内镜像源。

查看服务启动状态：

```bash
docker compose ps
```

正常输出应类似：

```
NAME                STATUS
yolov8-backend      Up
yolov8-nginx        Up
```

查看实时日志（如果服务有问题，看日志能帮你定位）：

```bash
# 查看所有服务日志
docker compose logs -f

# 只查看后端日志
docker compose logs -f backend
```

按 `Ctrl+C` 退出日志查看（不会停止服务）。

### 第五步：访问系统

打开浏览器，访问：

```
http://localhost
```

如果配置了 HTTPS（需要 SSL 证书）：

```
https://localhost
```

---

## 方式二：手动部署（适合想深入了解的开发者）

> 手动部署需要你自己安装和配置所有运行环境。如果你只是想用这个系统，请使用 Docker 方式。

### 环境准备

你需要安装以下三个工具：

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Java (JDK) | 17 或以上 | 运行 Spring Boot 后端 |
| Python | 3.10 或以上 | 运行 YOLOv8 和 Qwen VL 模型 |
| Maven | 3.8 或以上 | 打包 Java 项目 |

### 第一步：安装 Java 17

**方法一：使用 Eclipse Temurin（推荐，免费开源）**

1. 访问 Adoptium 下载页面：
   ```
   https://adoptium.net/temurin/releases/?version=17
   ```

2. 选择你的操作系统（如 Windows x64），下载 `.msi` 安装包

3. 双击安装，建议修改安装路径为不含中文和空格的目录，例如：
   ```
   C:\Program Files\Java\jdk-17
   ```

4. 配置环境变量（Windows）：
   - 右键"此电脑" → "属性" → "高级系统设置" → "环境变量"
   - 在"系统变量"中点击"新建"：
     ```
     变量名：JAVA_HOME
     变量值：C:\Program Files\Java\jdk-17
     ```
   - 找到 `Path` 变量，编辑，添加：
     ```
     %JAVA_HOME%\bin
     ```

5. 验证安装（**重新打开**命令提示符）：
   ```bash
   java -version
   ```
   应显示 `openjdk version "17.x.x"`

**方法二：使用 SDKMAN!（macOS/Linux 推荐）**

```bash
# 安装 SDKMAN!
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# 安装 Java 17
sdk install java 17.0.11-tem
java -version
```

**方法三：使用 scoop（Windows 极简方式）**

如果你安装了 scoop 包管理器：
```bash
scoop install openjdk17
java -version
```

### 第二步：安装 Python 3.10+

1. 访问 Python 官网：
   ```
   https://www.python.org/downloads/
   ```

   **国内镜像源（更快）：**
   ```
   https://mirrors.huaweicloud.com/python/    # 华为云镜像
   https://npmmirror.com/mirrors/python/      # 腾讯云镜像
   ```

2. 下载 **Python 3.10.x** 或 **3.11.x** 安装程序

3. 安装时 **务必勾选**：
   - ✅ **Add Python to PATH**（这一步非常重要！）
   - ✅ pip

4. 验证安装：
   ```bash
   python --version
   ```
   应显示 `Python 3.10.x` 或更高

   > **注意**：如果 `python` 命令不可用但 `python3` 可用，说明是 macOS/Linux 系统，后续命令中的 `python` 替换为 `python3`。

5. **配置 pip 国内镜像源**（否则下载依赖包会非常慢）

   pip 是 Python 的包管理工具，默认从国外源下载。配置国内源后速度提升 10 倍以上。

   ```bash
   # 创建/编辑 pip 配置文件
   # Windows:
   python -m pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

   # macOS / Linux:
   pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
   ```

   **国内 pip 镜像源汇总：**

   | 镜像源 | 地址 | 说明 |
   |--------|------|------|
   | 清华大学 | `https://pypi.tuna.tsinghua.edu.cn/simple` | 最快，推荐 |
   | 阿里云 | `https://mirrors.aliyun.com/pypi/simple/` | 稳定 |
   | 中国科学技术大学 | `https://mirrors.ustc.edu.cn/pypi/web/simple` | 备用 |
   | 华为云 | `https://repo.huaweicloud.com/repository/pypi/simple/` | 备用 |
   | 腾讯云 | `https://mirrors.cloud.tencent.com/pypi/simple/` | 备用 |

   验证镜像源是否生效：
   ```bash
   python -m pip config list
   ```

### 第三步：安装 Maven

**方法一：直接下载（Windows）**

1. 访问 Maven 下载页面：
   ```
   https://maven.apache.org/download.cgi
   ```

   **国内镜像源（更快）：**
   ```
   https://mirrors.tuna.tsinghua.edu.cn/apache/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip  # 清华
   https://mirrors.aliyun.com/apache/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip            # 阿里
   ```

2. 下载 `apache-maven-3.x.x-bin.zip`（Windows）或 `.tar.gz`（macOS/Linux）

3. 解压到任意目录（建议不含中文和空格）：
   ```
   C:\Program Files\Maven\
   ```

4. 配置环境变量：
   - 新建系统变量：
     ```
     变量名：MAVEN_HOME
     变量值：C:\Program Files\Maven
     ```
   - 编辑 `Path` 变量，添加：
     ```
     %MAVEN_HOME%\bin
     ```

5. **配置 Maven 国内镜像源**

   打开（或创建）`%MAVEN_HOME%\conf\settings.xml`，在 `<mirrors>` 标签内添加：

   ```xml
   <mirror>
     <id>aliyunmaven</id>
     <mirrorOf>central</mirrorOf>
     <name>阿里云公共仓库</name>
     <url>https://maven.aliyun.com/repository/public</url>
   </mirror>
   <mirror>
     <id>aliyunmaven-spring</id>
     <mirrorOf>*!</mirrorOf>
     <name>阿里云 Spring 仓库</name>
     <url>https://maven.aliyun.com/repository/spring</url>
   </mirror>
   ```

   > 注意：`<mirrorOf>central</mirrorOf>` 表示只代理 Maven Central。`<mirrorOf>*!spring-plugin</mirrorOf>` 表示代理所有除了 spring-plugin 的仓库。

6. 验证安装：
   ```bash
   mvn -v
   ```
   应显示 Apache Maven 3.x.x 版本信息

**方法二：使用 SDKMAN!（macOS/Linux）**

```bash
sdk install maven
mvn -v
```

**方法三：使用 Homebrew（macOS）**

```bash
brew install maven
mvn -v
```

### 第四步：克隆项目代码

```bash
# 进入你想存放项目的目录
cd D:\projects    # 示例

# 克隆代码
git clone https://github.com/your-username/yolov8-security.git
cd yolov8-security
```

### 第五步：安装 Python 依赖

```bash
# 安装项目所需的 Python 包
# -i 参数指定清华镜像源，加速下载
python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

> **如果 requirements.txt 中没有指定 -i 参数**，你也可以临时指定镜像源：
> ```bash
> python -m pip install -r requirements.txt --index-url https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn
> ```

额外安装 YOLOv8 核心依赖（如果 requirements.txt 未包含）：

```bash
python -m pip install ultralytics -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 第六步：打包后端

```bash
# 进入后端目录
cd backend

# 使用 Maven 打包（会自动下载依赖并编译）
# 首次运行会比较慢（下载依赖），耐心等待
mvn clean package -DskipTests

# 打包成功后，会在 target/ 目录下生成 yolov8-security.war
```

### 第七步：启动全部服务

回到项目根目录，双击运行启动脚本：

```
scripts\start_all.bat
```

该脚本会自动：
1. 检查 Java 和 Python 是否安装
2. 创建必要的目录（data、videos、results、models）
3. 启动 Java 后端服务（端口 5000）
4. 启动 Qwen VL 大模型服务（端口 5001）
5. 启动 YOLOv8 安防监控系统

或者在命令行手动启动（更灵活，方便看日志）：

```bash
# 终端1：启动 Java 后端
cd backend
java -jar target/yolov8-security.war

# 终端2：启动 Qwen VL 服务
cd ai-models
python qwen_vl_service.py

# 终端3：启动 YOLOv8 监控系统
cd ai-models
python yolov8_security.py
```

启动完成后，浏览器访问：
```
http://localhost:5000
```

---

## 系统功能

### 1. 实时视频分析
- 支持摄像头实时流、本地视频文件分析
- YOLOv8 模型实时检测目标（人、车等）
- 检测结果实时叠加在视频画面上

### 2. 智能告警
- Qwen VL 大模型分析检测场景
- 自动识别异常行为并触发告警
- 告警截图自动保存到 `results/` 目录

### 3. Web 管理界面
- 浏览器访问，无需安装客户端
- 查看实时监控画面
- 查看历史告警记录
- API 接口调用管理

---

## 配置文件说明

### `.env` 文件（项目根目录）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `API_KEY` | `change-me-in-production` | 访问后端 API 的认证密钥 |

### `docker-compose.yml`

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `backend` | 自构建 | 5000 | Spring Boot 后端服务 |
| `nginx` | nginx:alpine | 80, 443 | 静态资源服务 + 反向代理 |

### 数据目录映射

Docker 部署时，以下目录会被映射到宿主机，数据持久化保存：

```
项目根目录/
├── data/       # 运行时数据
├── videos/     # 视频文件存储
├── models/     # AI 模型文件
└── results/    # 告警截图和检测结果
```

---

## 常见问题与解决方案

### Q1: Docker 拉取镜像超时 / 很慢

**原因**：Docker Hub 服务器在海外，国内访问慢。

**解决方案**：

1. **配置国内镜像源**（见上方 [第一步第 6 节](#第一步安装-docker-desktop)）
2. 手动拉取镜像并打标签（如果 compose 拉取失败）：
   ```bash
   # 用国内镜像源手动拉取 nginx 镜像
   docker pull mirror.ccs.tencentyun.com/library/nginx:alpine
   docker tag mirror.ccs.tencentyun.com/library/nginx:alpine nginx:alpine
   ```
3. 如果所有镜像源都不可用，可以尝试在 VPN 环境下拉取

### Q2: `docker compose` 命令不存在

**原因**：你的 Docker 版本没有安装 Compose 插件。

**解决方案**：

```bash
# 尝试旧版命令
docker-compose up -d

# 如果 docker-compose 也不存在，安装 Compose 插件：
# Windows: 重新安装 Docker Desktop，确保勾选了 Docker Compose
# Linux:
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Q3: 端口被占用（Port already in use）

**错误信息**：`bind: address already in use` 或 `port is already allocated`

**解决方案**：

```bash
# Windows: 查找占用端口的进程
netstat -ano | findstr :80
netstat -ano | findstr :5000

# 关闭占用端口的进程（替换 PID 为实际进程ID）
taskkill /F /PID <PID>

# macOS / Linux:
lsof -i :80
lsof -i :5000
kill -9 <PID>
```

或者修改 `docker-compose.yml` 中的端口映射，例如将 `"80:80"` 改为 `"8080:80"`。

### Q4: Java 版本不对

**错误信息**：`Unsupported class file major version` 或 `Error: could not open 'C:\Program Files\Java\jre\lib\rt.jar'`

**解决方案**：

```bash
# 检查当前 Java 版本
java -version

# 如果不是 17，检查 JAVA_HOME 环境变量是否指向 JDK 17
echo %JAVA_HOME%    # Windows
echo $JAVA_HOME     # macOS/Linux
```

确保 `java -version` 输出中包含 `17`。

### Q5: Python 依赖安装失败

**错误信息**：`ERROR: Could not find a version that satisfies the requirement xxx`

**解决方案**：

```bash
# 1. 确认使用国内镜像源
python -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 如果仍有包找不到，升级 pip
python -m pip install --upgrade pip

# 3. 如果某个包编译失败（如 torch），尝试用 --no-cache-dir
python -m pip install torch --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple

# 4. torch 有专门的国内镜像源（推荐）：
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

> **PyTorch 国内镜像源**（清华大学）：
> ```bash
> python -m pip install torch torchvision torchaudio --index-url https://pypi.tuna.tsinghua.edu.cn/simple
> ```

### Q6: Maven 下载依赖很慢

**解决方案**：配置阿里云 Maven 镜像源（见上方 [第三步第 5 节](#第三步安装-maven)）

### Q7: YOLOv8 模型文件找不到

**解决方案**：

1. 确认 `models/` 目录下有 YOLOv8 权重文件（`.pt` 文件）
2. 如果没有，首次运行时程序会自动下载（需要联网）
3. 或者手动下载并放入 `models/` 目录：
   ```bash
   # 在 ai-models 目录下执行
   python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```

### Q8: Docker Desktop 启动失败（WSL 2 问题）

**解决方案**：

```bash
# 1. 确保 WSL 2 已安装
wsl --list --verbose

# 2. 如果没有输出，安装 WSL 2
wsl --install

# 3. 升级 WSL
wsl --update

# 4. 重启 WSL
wsl --shutdown

# 5. 确保 BIOS 中已启用虚拟化技术（Virtualization / VT-x / AMD-V）
```

### Q9: 浏览器访问 localhost 无法连接

**排查步骤**：

```bash
# 1. 确认 Docker 容器正在运行
docker compose ps

# 2. 如果 STATUS 不是 Up，查看日志
docker compose logs backend
docker compose logs nginx

# 3. 检查防火墙是否阻止了端口访问
# Windows: 在"Windows  Defender 防火墙"中添加端口例外
# 或者临时关闭防火墙测试

# 4. 检查端口是否在监听
netstat -ano | findstr :80
```

### Q10: 修改 API_KEY 后前端无法访问

**解决方案**：

1. 确保 `.env` 中的 `API_KEY` 值与前端配置一致
2. 修改后需要重启服务：
   ```bash
   docker compose down
   docker compose up -d
   ```

---

## 项目目录结构

```
yolov8-security/
├── backend/                    # Spring Boot 后端
│   ├── src/
│   │   └── main/
│   │       ├── java/           # Java 源代码
│   │       └── resources/      # 配置文件
│   ├── Dockerfile              # 后端 Docker 构建文件
│   └── pom.xml                 # Maven 依赖配置
├── frontend/                   # 前端静态资源（HTML/CSS/JS）
├── ai-models/                  # AI 模型服务
│   ├── yolov8_security.py      # YOLOv8 安防监控主程序
│   └── qwen_vl_service.py      # Qwen VL 大模型服务
├── nginx/                      # Nginx 配置文件
│   └── nginx.conf              # Nginx 配置
├── scripts/                    # 启动/构建脚本
│   ├── build_war.bat           # 打包后端 WAR 包
│   ├── start_all.bat           # 一键启动全部服务
│   └── install_qwen_deps.bat   # 安装 Qwen 依赖
├── data/                       # 运行时数据（Docker 挂载）
├── videos/                     # 视频文件存储（Docker 挂载）
├── models/                     # AI 模型文件（Docker 挂载）
├── results/                    # 告警截图和检测结果（Docker 挂载）
├── .env.example                # 环境变量示例文件
├── docker-compose.yml          # Docker 编排文件（一键部署）
└── requirements.txt            # Python 依赖清单
```

---

## 停止和清理服务

```bash
# 停止所有服务（保留数据）
docker compose down

# 停止并删除所有容器和镜像（彻底清理）
docker compose down -v --rmi local

# 查看 Docker 磁盘占用
docker system df

# 清理未使用的 Docker 资源（释放磁盘空间）
docker system prune -a
```

---

## 技术支持

- 遇到问题请先查阅 [常见问题与解决方案](#常见问题与解决方案)
- 如仍未解决，可以在 GitHub 提 Issue

---

## 更新日志

- **v1.0.0** — 初始版本：YOLOv8 目标检测 + Qwen VL 分析 + Spring Boot 3.2 后端 + Docker Compose 一键部署
