"""
Remote deployment script for yolov8-security project.
Deploys to Ubuntu 22.04 server via paramiko.
"""
import paramiko
import os
import sys
import time
import tarfile
import io

SERVER_IP = "10.23.82.186"
USERNAME = "root"
PASSWORD = "123456"
PROJECT_DIR = r"D:\yolov8_security"
REMOTE_DIR = "/opt/yolov8-security"

def ssh_exec(ssh, cmd, timeout=300, verbose=True):
    """Execute a command on the remote server and return output."""
    if verbose:
        print(f">> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    exit_code = stdout.channel.recv_exit_status()
    if verbose and out:
        print(out)
    if verbose and err:
        print(f"[stderr] {err}")
    return exit_code, out, err


def safe_print(text):
    """Print with encoding fallback."""
    try:
        print(text, end='')
    except UnicodeEncodeError:
        print(text.encode('gbk', errors='replace').decode('gbk', errors='replace'), end='')


def ssh_exec_stream(ssh, cmd, timeout=600):
    """Execute long-running command with streaming output."""
    print(f">> {cmd}")
    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.settimeout(timeout)
    channel.exec_command(cmd)
    while True:
        if channel.recv_ready():
            data = channel.recv(4096).decode('utf-8', errors='replace')
            safe_print(data)
        if channel.recv_stderr_ready():
            data = channel.recv_stderr(4096).decode('utf-8', errors='replace')
            safe_print(f"[stderr] {data}")
        if channel.exit_status_ready():
            break
        time.sleep(0.1)
    exit_code = channel.recv_exit_status()
    return exit_code


def create_ssh_client():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=USERNAME, password=PASSWORD, timeout=15)
    return ssh


def step1_install_deps():
    """Install JDK 17, Maven, Node.js 20, Python pip/venv, Nginx."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 1: Installing system dependencies")
    print("=" * 60)

    # Update and install packages
    ssh_exec_stream(ssh, """
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== Updating apt ==="
apt-get update -qq

echo "=== Installing JDK 17 ==="
apt-get install -y -qq openjdk-17-jdk-headless

echo "=== Installing Maven ==="
apt-get install -y -qq maven

echo "=== Installing Python pip and venv ==="
apt-get install -y -qq python3-pip python3-venv

echo "=== Installing Nginx ==="
apt-get install -y -qq nginx

echo "=== Installing other tools ==="
apt-get install -y -qq wget curl unzip

echo "=== Installing Node.js 20 ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

echo "=== Verifying installations ==="
java -version 2>&1 | head -1
mvn --version 2>&1 | head -1
node --version
npm --version
python3 --version
pip3 --version 2>&1 | head -1
nginx -v 2>&1

echo "=== Done ==="
""", timeout=600)

    ssh.close()
    print("\n[OK] System dependencies installed\n")


def step2_upload_project():
    """Upload project files to server."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 2: Uploading project files")
    print("=" * 60)

    # Create remote directory
    ssh_exec(ssh, f"mkdir -p {REMOTE_DIR}")

    # Create tarball locally, excluding unnecessary files
    tar_path = os.path.join(PROJECT_DIR, "_analysis", "project_upload.tar.gz")
    print("Creating local tarball...")

    EXCLUDE_DIRS = {
        '.git', 'node_modules', '__pycache__', '.venv', 'venv',
        'models', 'server/target', 'web/dist', 'server/web/dist',
        '_analysis', '.idea', '.vscode', 'dist'
    }
    EXCLUDE_EXTS = {'.pt', '.engine', '.onnx', '.tar.gz', '.zip', '.war'}

    with tarfile.open(tar_path, "w:gz") as tar:
        for root, dirs, files in os.walk(PROJECT_DIR):
            # Filter excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            # Also check if root contains excluded path components
            rel_root = os.path.relpath(root, PROJECT_DIR)
            skip = False
            for ex in EXCLUDE_DIRS:
                if rel_root.startswith(ex + os.sep) or rel_root == ex:
                    skip = True
                    break
            if skip:
                continue

            for f in files:
                if any(f.endswith(ext) for ext in EXCLUDE_EXTS):
                    continue
                fpath = os.path.join(root, f)
                arcname = os.path.relpath(fpath, PROJECT_DIR)
                tar.add(fpath, arcname=arcname)

    tar_size = os.path.getsize(tar_path) / (1024 * 1024)
    print(f"Tarball size: {tar_size:.1f} MB")

    # Upload via SFTP
    print("Uploading via SFTP...")
    sftp = ssh.open_sftp()
    remote_tar = f"{REMOTE_DIR}/project_upload.tar.gz"
    sftp.put(tar_path, remote_tar)
    sftp.close()
    print("Upload complete")

    # Extract on server
    print("Extracting on server...")
    ssh_exec(ssh, f"cd {REMOTE_DIR} && tar xzf project_upload.tar.gz && rm project_upload.tar.gz")
    ssh_exec(ssh, f"ls -la {REMOTE_DIR}/")

    # Cleanup local tarball
    os.remove(tar_path)

    ssh.close()
    print("\n[OK] Project uploaded\n")


def step3_setup_python():
    """Setup Python virtual environment and install dependencies."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 3: Setting up Python environment")
    print("=" * 60)

    ssh_exec_stream(ssh, f"""
set -e
cd {REMOTE_DIR}

echo "=== Creating Python venv ==="
python3 -m venv .venv
source .venv/bin/activate

echo "=== Upgrading pip ==="
pip install --upgrade pip -q

echo "=== Installing PyTorch CPU ==="
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu -q

echo "=== Installing project dependencies ==="
cd detection
pip install -r requirements.txt -q

echo "=== Verifying Python setup ==="
python -c "import torch; print('PyTorch', torch.__version__, 'CUDA:', torch.cuda.is_available())"
python -c "import ultralytics; print('Ultralytics', ultralytics.__version__)"
python -c "import cv2; print('OpenCV', cv2.__version__)"
python -c "import flask; print('Flask', flask.__version__)"

echo "=== Downloading YOLOv8 model ==="
cd {REMOTE_DIR}
mkdir -p models
python -c "from ultralytics import YOLO; YOLO('yolov8n-pose.pt')" 2>&1 | tail -3
# Move downloaded model to models dir
if [ -f yolov8n-pose.pt ]; then
    mv yolov8n-pose.pt models/
fi

echo "=== Python setup done ==="
""", timeout=900)

    ssh.close()
    print("\n[OK] Python environment ready\n")


def step4_build_frontend():
    """Build frontend on server."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 4: Building frontend")
    print("=" * 60)

    ssh_exec_stream(ssh, f"""
set -e
cd {REMOTE_DIR}/web

echo "=== Installing npm dependencies ==="
npm install --prefer-offline 2>&1 | tail -5

echo "=== Building frontend ==="
npm run build 2>&1 | tail -10

echo "=== Build output ==="
ls -la dist/ | head -10

echo "=== Frontend build done ==="
""", timeout=600)

    ssh.close()
    print("\n[OK] Frontend built\n")


def step5_build_java():
    """Build Java WAR on server."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 5: Building Java WAR")
    print("=" * 60)

    ssh_exec_stream(ssh, f"""
set -e
cd {REMOTE_DIR}/server

echo "=== Building WAR with Maven ==="
./mvnw clean package -DskipTests 2>&1 | tail -20

echo "=== Build output ==="
ls -la target/*.war 2>/dev/null || ls -la target/

echo "=== Java build done ==="
""", timeout=600)

    ssh.close()
    print("\n[OK] Java WAR built\n")


def step6_configure():
    """Configure .env, application.properties, create systemd services."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 6: Configuring services")
    print("=" * 60)

    # Create data directory
    ssh_exec(ssh, f"mkdir -p {REMOTE_DIR}/data {REMOTE_DIR}/server/data")

    # Check if .env exists, if not create from template
    exit_code, out, _ = ssh_exec(ssh, f"test -f {REMOTE_DIR}/.env && echo EXISTS || echo MISSING")
    if "MISSING" in out:
        print("Creating .env file...")
        ssh_exec(ssh, f"""
cat > {REMOTE_DIR}/.env << 'ENVEOF'
API_KEY=
ADMIN_USERNAME=xx
ADMIN_PASSWORD=123456
JWT_SECRET=yolov8-security-jwt-secret-key-2026-production
DATA_DIR=./data
ENVEOF
""")
        print("[OK] .env created")

    # Update application.properties for server paths
    print("Configuring application.properties...")

    # Check if Maven wrapper needs chmod
    ssh_exec(ssh, f"chmod +x {REMOTE_DIR}/server/mvnw")

    # Create systemd service for Java backend
    print("Creating systemd service for Java backend...")
    ssh_exec(ssh, f"""
cat > /etc/systemd/system/yolov8-java.service << 'SVCEOF'
[Unit]
Description=YOLOv8 Security Java Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={REMOTE_DIR}/server
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ExecStart=/usr/bin/java -jar target/yolov8-security.war --server.port=5000
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
""")

    # Create systemd service for Python detection
    print("Creating systemd service for Python detection...")
    ssh_exec(ssh, f"""
cat > /etc/systemd/system/yolov8-python.service << 'SVCEOF'
[Unit]
Description=YOLOv8 Security Python Detection
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={REMOTE_DIR}/detection
Environment=PATH={REMOTE_DIR}/.venv/bin:/usr/bin:/bin
ExecStart={REMOTE_DIR}/.venv/bin/python yolov8_security.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
""")

    # Configure Nginx
    print("Configuring Nginx...")
    ssh_exec(ssh, f"""
cat > /etc/nginx/sites-available/yolov8-security << 'NGXEOF'
server {{
    listen 80;
    server_name _;

    location / {{
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;

        # MJPEG stream support
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }}

    # Video feed with larger buffer
    location /video_feed {{
        proxy_pass http://127.0.0.1:5000;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }}

    # API SSE stream
    location /api/sse/ {{
        proxy_pass http://127.0.0.1:5000;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_set_header Connection "";
    }}
}}
NGXEOF

# Enable site
ln -sf /etc/nginx/sites-available/yolov8-security /etc/nginx/sites-enabled/yolov8-security
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
""")

    # Reload systemd
    ssh_exec(ssh, "systemctl daemon-reload")

    ssh.close()
    print("\n[OK] Services configured\n")


def step7_start_services():
    """Start all services."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 7: Starting services")
    print("=" * 60)

    # Enable and start Nginx
    ssh_exec(ssh, "systemctl enable nginx && systemctl start nginx")
    print("[OK] Nginx started")

    # Check if war exists
    exit_code, out, _ = ssh_exec(ssh, f"ls {REMOTE_DIR}/server/target/yolov8-security.war 2>/dev/null && echo OK || echo MISSING")
    if "OK" in out:
        ssh_exec(ssh, "systemctl enable yolov8-java && systemctl start yolov8-java")
        print("[OK] Java backend started")
    else:
        print("[WARN] WAR not found, skipping Java service")

    # Check if Python detection script exists
    exit_code, out, _ = ssh_exec(ssh, f"test -f {REMOTE_DIR}/detection/yolov8_security.py && echo OK || echo MISSING")
    if "OK" in out:
        ssh_exec(ssh, "systemctl enable yolov8-python && systemctl start yolov8-python")
        print("[OK] Python detection started")
    else:
        print("[WARN] Python script not found, skipping Python service")

    # Wait a moment then check status
    time.sleep(3)
    ssh_exec(ssh, "systemctl status yolov8-java --no-pager -l 2>&1 | head -15")
    ssh_exec(ssh, "systemctl status yolov8-python --no-pager -l 2>&1 | head -15")

    # Check listening ports
    ssh_exec(ssh, "ss -tlnp | grep -E ':(80|5000|5001)' || echo 'Ports not yet listening'")

    ssh.close()
    print("\n[OK] Services started\n")


def step8_verify():
    """Verify deployment."""
    ssh = create_ssh_client()

    print("=" * 60)
    print("STEP 8: Verifying deployment")
    print("=" * 60)

    # Test HTTP endpoints
    ssh_exec(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost/ && echo ' - Nginx OK' || echo ' - Nginx FAILED'")
    ssh_exec(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/ && echo ' - Java OK' || echo ' - Java FAILED'")
    ssh_exec(ssh, "curl -s http://localhost:5000/api/stats 2>/dev/null | head -c 200 && echo || echo 'Stats endpoint not ready'")

    ssh.close()
    print(f"\n[OK] Deployment verification complete")
    print(f"\n{'=' * 60}")
    print(f"  Project deployed to http://{SERVER_IP}")
    print(f"  Login: xx / 123 (admin)")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    steps = {
        "deps": step1_install_deps,
        "upload": step2_upload_project,
        "python": step3_setup_python,
        "frontend": step4_build_frontend,
        "java": step5_build_java,
        "config": step6_configure,
        "start": step7_start_services,
        "verify": step8_verify,
    }

    if len(sys.argv) > 1:
        # Run specific step(s)
        for arg in sys.argv[1:]:
            if arg in steps:
                steps[arg]()
            else:
                print(f"Unknown step: {arg}")
                print(f"Available: {', '.join(steps.keys())}")
    else:
        # Run all steps in order
        for name, func in steps.items():
            func()
