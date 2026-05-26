import paramiko, os, time, sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.184.128', port=22, username='root', password='123456')

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f"  ERR: {err.strip()}")
    return out.strip()

# Build on remote if no local WAR
local_war = 'D:/yolov8_security/server/target/yolov8-security.war'
if not os.path.exists(local_war):
    print('[0/6] Build WAR on remote...')
    run('cd /opt/yolov8-security/server && mvn clean package -DskipTests -q 2>&1 | tail -5')
    print('  Done')

# 1. Stop nginx + kill port 80
print('[1/7] Stop nginx + port 80...')
run('systemctl stop nginx 2>/dev/null; systemctl disable nginx 2>/dev/null; fuser -k 80/tcp 2>/dev/null; echo ok')
print('  Done')

# 2. Create data-empty dir
print('[2/7] Create data-empty directories...')
run('mkdir -p /opt/yolov8-security/data-empty/detections /opt/yolov8-security/data-empty/frames /opt/yolov8-security/data-empty/db && echo ok')
print('  Done')

# 3. Upload WAR via SFTP
print('[3/7] Upload WAR (28MB)...')
sftp = ssh.open_sftp()
remote_war = '/opt/yolov8-security/server/target/yolov8-security.war'
# Backup old WAR
try:
    sftp.stat(remote_war + '.bak')
except:
    run('cp ' + remote_war + ' ' + remote_war + '.bak')

sftp.put(local_war, remote_war)
print('  WAR uploaded')
sftp.close()

# 4. Upload frontend dist
print('[4/7] Upload frontend dist...')
sftp = ssh.open_sftp()
local_dist = 'D:/yolov8_security/web/dist'
remote_dist = '/opt/yolov8-security/web/dist'

# Remove old assets
run('rm -rf ' + remote_dist + '/assets ' + remote_dist + '/*.html')

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
        print('  ' + (rel + '/' + f if rel != '.' else f))
sftp.close()
print('  Done')

# 5. Create second systemd service for port 5001
print('[5/7] Create port 5001 service...')
svc_lines = [
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
svc_content = '\n'.join(svc_lines)
run("cat > /etc/systemd/system/yolov8-java-5001.service << 'SVCEOF'\n" + svc_content + "\nSVCEOF")
run('systemctl daemon-reload')
run('systemctl enable yolov8-java-5001')
print('  Done')

# 6. Restart services
print('[6/7] Restart services...')
run('systemctl restart yolov8-java')
print('  yolov8-java restarted')
run('systemctl restart yolov8-java-5001')
print('  yolov8-java-5001 started')

time.sleep(5)
print('\n--- Service Status ---')
print(run('systemctl is-active yolov8-java yolov8-java-5001 yolov8-python'))

print('\n--- Ports ---')
print(run('ss -tlnp | grep -E "5000|5001"'))

ssh.close()
print('\nDone!')
