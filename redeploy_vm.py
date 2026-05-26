import paramiko, os, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.23.82.186', port=2006, username='root', password='123456')

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f"  {err.strip()}")
    return out.strip()

# Upload WAR
print('[1/4] Upload WAR...')
sftp = ssh.open_sftp()
local = 'D:/yolov8_security/server/target/yolov8-security.war'
remote = '/opt/yolov8-security/server/target/yolov8-security.war'
sftp.put(local, remote)
sftp.close()
print('  Done')

# Upload frontend
print('[2/4] Upload frontend dist...')
sftp = ssh.open_sftp()
run('rm -rf /opt/yolov8-security/web/dist/assets /opt/yolov8-security/web/dist/*.html')
local_dist = 'D:/yolov8_security/web/dist'
remote_dist = '/opt/yolov8-security/web/dist'
for root, dirs, files in os.walk(local_dist):
    rel = os.path.relpath(root, local_dist)
    remote_dir = remote_dist if rel == '.' else remote_dist + '/' + rel
    if rel != '.':
        try:
            sftp.stat(remote_dir)
        except:
            sftp.mkdir(remote_dir)
    for f in files:
        src = os.path.join(root, f).replace('\\', '/')
        dst = remote_dir + '/' + f
        sftp.put(src, dst)
        tag = f if rel == '.' else rel + '/' + f
        print('  ' + tag)
sftp.close()
print('  Done')

# Ensure data-empty
print('[3/4] Ensure data-empty dirs...')
run('mkdir -p /opt/yolov8-security/data-empty/detections /opt/yolov8-security/data-empty/frames /opt/yolov8-security/data-empty/db')
print('  Done')

# Restart
print('[4/4] Restart services...')
run('systemctl restart yolov8-java')
run('systemctl restart yolov8-java-5001')
time.sleep(10)

out = run('systemctl is-active yolov8-java yolov8-java-5001')
print('\n--- Status ---')
print(out)
out = run('ss -tlnp | grep -E "5000|5001"')
print('\n--- Ports ---')
print(out)

# Test
import urllib.request
try:
    resp = urllib.request.urlopen('http://10.23.82.186:5000/analysis', timeout=5)
    print('\n5000/analysis: HTTP ' + str(resp.status))
except Exception as e:
    print('\n5000/analysis: ' + str(e))

try:
    resp = urllib.request.urlopen('http://10.23.82.186:5001/analysis', timeout=5)
    print('5001/analysis: HTTP ' + str(resp.status))
except Exception as e:
    print('5001/analysis: ' + str(e))

ssh.close()
print('\nDone!')
