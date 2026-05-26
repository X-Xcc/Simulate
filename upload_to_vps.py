import paramiko
import os
import time

HOST = '47.96.218.68'
PORT = 22
USER = 'root'
PASS = 'Xj301168'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS)
print(f'Connected to {HOST}')

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f'  ERR: {err.strip()}')
    return out.strip()

# 1. Create web root
print('[1/4] Create web root...')
run('mkdir -p /var/www/yolov8-dist && echo ok')

# 2. Stop existing nginx/processes on port 80
print('[2/4] Stop services on port 80...')
run('fuser -k 80/tcp 2>/dev/null; systemctl stop nginx 2>/dev/null; echo ok')

# 3. Upload dist via SFTP
print('[3/4] Upload dist...')
sftp = ssh.open_sftp()
local_dist = 'D:/yolov8_security/web/dist'
remote_dist = '/var/www/yolov8-dist'

# Remove old files
run(f'rm -rf {remote_dist}/*')

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
        print(f'  {(rel + "/" + f if rel != "." else f)}')
sftp.close()
print('  Upload done')

# 4. Setup nginx
print('[4/4] Setup nginx...')
nginx_conf = """server {
    listen 80;
    server_name _;

    root /var/www/yolov8-dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://10.23.82.186:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
    }

    location /video_feed {
        proxy_pass http://10.23.82.186:5000;
        proxy_set_header Host $host;
        proxy_buffering off;
    }
}
"""
run('mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled')
run(f"cat > /etc/nginx/sites-available/yolov8-dist << 'NGINXEOF'\n{nginx_conf}\nNGINXEOF")
run('rm -f /etc/nginx/sites-enabled/yolov8-dist')
run('ln -sf /etc/nginx/sites-available/yolov8-dist /etc/nginx/sites-enabled/yolov8-dist')
run('nginx -t')
run('systemctl restart nginx')
print('  nginx restarted')

time.sleep(2)
print('\n--- Service Status ---')
print(run('systemctl is-active nginx'))
print(run('ss -tlnp | grep ":80"'))
print(run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/'))

ssh.close()
print('\nDone! Access: http://47.96.218.68')
