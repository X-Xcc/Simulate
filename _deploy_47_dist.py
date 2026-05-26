#!/usr/bin/env python3
"""Deploy frontend dist to 47.96.218.68 (nginx on port 80)"""
import paramiko, os

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

local_dist = 'D:/yolov8_security/web/dist'
remote_dist = '/var/www/yolov8-dist'

print('[1/3] Clean old dist...')
run(f'rm -rf {remote_dist}/*')
print('  Done')

print('[2/3] Upload dist...')
sftp = ssh.open_sftp()
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

print('[3/3] Verify...')
print(run('ls -la /var/www/yolov8-dist/training.html'))
code = run('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/training.html')
print(f'HTTP status: {code}')

ssh.close()
print('\nDone! http://47.96.218.68/training.html')
