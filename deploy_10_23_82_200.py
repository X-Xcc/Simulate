#!/usr/bin/env python3
"""Deploy to 10.23.82.200 (Java WAR + frontend dist + restart service)"""
import paramiko, os, time, sys

HOST = '10.23.82.200'
PORT = 22
USER = 'root'
PASS = '123456'  # <- 修改为实际密码

# Optional: deploy via 47 jump host
USE_JUMP = False
JUMP_HOST = '47.96.218.68'
JUMP_PORT = 22
JUMP_USER = 'root'
JUMP_PASS = 'Xj301168'


def get_ssh():
    if USE_JUMP:
        print(f'Connecting via jump {JUMP_HOST} -> {HOST}...')
        import socket, socks
        from sshtunnel import SSHTunnelForwarder
        server = SSHTunnelForwarder(
            (JUMP_HOST, JUMP_PORT),
            ssh_username=JUMP_USER,
            ssh_password=JUMP_PASS,
            remote_bind_address=(HOST, PORT),
        )
        server.start()
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect('127.0.0.1', port=server.local_bind_port, username=USER, password=PASS)
    else:
        print(f'Connecting directly to {HOST}:{PORT}...')
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, port=PORT, username=USER, password=PASS)
    return ssh


def run(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f'  ERR: {err.strip()}')
    return out.strip()


def main():
    ssh = get_ssh()
    print(f'Connected to {HOST}')

    # 1. Stop services
    print('[1/5] Stop existing services...')
    run(ssh, 'systemctl stop yolov8-java 2>/dev/null; systemctl stop yolov8-java-5001 2>/dev/null; fuser -k 5000/tcp 2>/dev/null; fuser -k 5001/tcp 2>/dev/null; echo ok')
    print('  Done')

    # 2. Create dirs
    print('[2/5] Create directories...')
    run(ssh, 'mkdir -p /opt/yolov8-security/server/target /opt/yolov8-security/web/dist /opt/yolov8-security/data-empty/detections /opt/yolov8-security/data-empty/frames /opt/yolov8-security/data-empty/db && echo ok')
    print('  Done')

    # 3. Upload WAR
    print('[3/5] Upload WAR...')
    sftp = ssh.open_sftp()
    local_war = 'D:/yolov8_security/server/target/yolov8-security.war'
    remote_war = '/opt/yolov8-security/server/target/yolov8-security.war'
    if not os.path.exists(local_war):
        print(f'  ERROR: {local_war} not found! Build first.')
        sys.exit(1)
    sftp.put(local_war, remote_war)
    print(f'  WAR uploaded ({os.path.getsize(local_war) / 1024 / 1024:.1f} MB)')
    sftp.close()

    # 4. Upload frontend dist
    print('[4/5] Upload frontend dist...')
    sftp = ssh.open_sftp()
    local_dist = 'D:/yolov8_security/web/dist'
    remote_dist = '/opt/yolov8-security/web/dist'

    # Remove old assets
    run(ssh, f'rm -rf {remote_dist}/assets {remote_dist}/*.html')

    for root, dirs, files in os.walk(local_dist):
        rel = os.path.relpath(root, local_dist)
        if rel == '.':
            remote_dir = remote_dist
        else:
            remote_dir = remote_dist + '/' + rel.replace('\\', '/')
        if rel != '.':
            try:
                sftp.stat(remote_dir)
            except:
                sftp.mkdir(remote_dir)
        for f in files:
            local_file = os.path.join(root, f).replace('\\', '/')
            remote_file = remote_dir + '/' + f
            sftp.put(local_file, remote_file)
            label = f if rel == '.' else rel + '/' + f
            print(f'  {label}')
    sftp.close()
    print('  Done')

    # 5. Setup systemd services
    print('[5/5] Setup systemd services...')

    svc1 = """[Unit]
Description=YOLOv8 Security
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/yolov8-security/server
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar /opt/yolov8-security/server/target/yolov8-security.war --server.port=5000
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"""

    svc2 = """[Unit]
Description=YOLOv8 Security - Port 5001 (Zero Data)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/yolov8-security/server
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
Environment=DATA_DIR=./data-empty
ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar /opt/yolov8-security/server/target/yolov8-security.war --server.port=5001
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target"""

    run(ssh, "cat > /etc/systemd/system/yolov8-java.service << 'SVCEOF'\n" + svc1 + "\nSVCEOF")
    run(ssh, "cat > /etc/systemd/system/yolov8-java-5001.service << 'SVCEOF'\n" + svc2 + "\nSVCEOF")
    run(ssh, 'systemctl daemon-reload')
    run(ssh, 'systemctl enable yolov8-java yolov8-java-5001')
    run(ssh, 'systemctl restart yolov8-java yolov8-java-5001')
    print('  Services restarted')

    time.sleep(5)
    print('\n--- Service Status ---')
    print(run(ssh, 'systemctl is-active yolov8-java yolov8-java-5001 2>/dev/null'))

    print('\n--- Ports ---')
    print(run(ssh, 'ss -tlnp | grep -E "5000|5001"'))

    ssh.close()
    print('\nDone! http://10.23.82.200:5000 and :5001')
    print('Access: http://10.23.82.200:5000/training.html')


if __name__ == '__main__':
    main()
