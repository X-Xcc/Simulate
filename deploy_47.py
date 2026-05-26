#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""部署到 47.96.218.68"""

import paramiko, os, time, sys

HOST = '47.96.218.68'
PORT = 22
USER = 'root'
PASS = 'Xj301168'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f"  ERR: {err.strip()}")
    return out.strip()

# 1. Stop existing services
print('[1/5] Stop existing services...')
run('systemctl stop yolov8-java 2>/dev/null; systemctl stop yolov8-java-5001 2>/dev/null; systemctl disable yolov8-java 2>/dev/null; systemctl disable yolov8-java-5001 2>/dev/null; fuser -k 5000/tcp 2>/dev/null; fuser -k 5001/tcp 2>/dev/null; echo ok')
print('  Done')

# 2. Create dirs
print('[2/5] Create directories...')
run('mkdir -p /opt/yolov8-security/server/target /opt/yolov8-security/web/dist /opt/yolov8-security/data-empty/detections /opt/yolov8-security/data-empty/frames /opt/yolov8-security/data-empty/db && echo ok')
print('  Done')

# 3. Upload WAR
print('[3/5] Upload WAR (28MB)...')
sftp = ssh.open_sftp()
local_war = 'D:/yolov8_security/server/target/yolov8-security.war'
remote_war = '/opt/yolov8-security/server/target/yolov8-security.war'
sftp.put(local_war, remote_war)
print('  WAR uploaded')
sftp.close()

# 4. Upload frontend dist
print('[4/5] Upload frontend dist...')
sftp = ssh.open_sftp()
local_dist = 'D:/yolov8_security/web/dist'
remote_dist = '/opt/yolov8-security/web/dist'

for root, dirs, files in os.walk(local_dist):
    rel = os.path.relpath(root, local_dist)
    if rel == '.':
        remote_dir = remote_dist
    else:
        remote_dir = remote_dist + '/' + rel
    try:
        sftp.stat(remote_dir)
    except:
        sftp.mkdir(remote_dir)
    for f in files:
        local_file = os.path.join(root, f).replace('\\', '/')
        remote_file = remote_dir + '/' + f
        sftp.put(local_file, remote_file)
        print(f'  {rel}/{f}' if rel != '.' else f)
sftp.close()
print('  Done')

# 5. Create systemd services
print('[5/5] Create systemd services...')

# Main service (5000)
svc1_lines = [
    '[Unit]',
    'Description=YOLOv8 Security',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    'User=root',
    'WorkingDirectory=/opt/yolov8-security/server',
    'Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64',
    'ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar /opt/yolov8-security/server/target/yolov8-security.war --server.port=5000',
    'Restart=on-failure',
    'RestartSec=10',
    'StandardOutput=journal',
    'StandardError=journal',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
]
run("cat > /etc/systemd/system/yolov8-java.service << 'SVCEOF'\n" + '\n'.join(svc1_lines) + "\nSVCEOF")

# 5001 service (zero data)
svc2_lines = [
    '[Unit]',
    'Description=YOLOv8 Security - Port 5001 (Zero Data)',
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    'User=root',
    'WorkingDirectory=/opt/yolov8-security/server',
    'Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64',
    'Environment=DATA_DIR=./data-empty',
    'ExecStart=/usr/bin/java -Xms256m -Xmx512m -jar /opt/yolov8-security/server/target/yolov8-security.war --server.port=5001',
    'Restart=on-failure',
    'RestartSec=10',
    'StandardOutput=journal',
    'StandardError=journal',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
]
run("cat > /etc/systemd/system/yolov8-java-5001.service << 'SVCEOF'\n" + '\n'.join(svc2_lines) + "\nSVCEOF")

run('systemctl daemon-reload')
run('systemctl enable yolov8-java yolov8-java-5001')
run('systemctl restart yolov8-java yolov8-java-5001')
print('  Done')

time.sleep(5)
print('\n--- Service Status ---')
print(run('systemctl is-active yolov8-java yolov8-java-5001 2>/dev/null || echo "checking..."'))

print('\n--- Ports ---')
print(run('ss -tlnp | grep -E "5000|5001"'))

ssh.close()
print('\nDone! http://47.96.218.68:5000 and :5001')
