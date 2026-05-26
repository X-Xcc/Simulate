import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('47.96.218.68', port=22, username='root', password='Xj301168')

def run(cmd):
    s, o, e = ssh.exec_command(cmd)
    return o.read().decode() + e.read().decode()

print('=== Config file content (hex dump of first 200 bytes) ===')
print(run("xxd /www/server/panel/vhost/nginx/yolov8-dist.conf | head -20"))
print()
print('=== Include check ===')
print(run('grep -r "yolov8-dist" /www/server/nginx/conf/nginx.conf'))
print()
print('=== nginx -T (full config) ===')
# Get the first 100 lines of nginx -T to see what config nginx actually loaded
output = run('nginx -T 2>&1')
for line in output.split('\n'):
    if 'yolov8' in line.lower() or 'server_name' in line.lower() or 'root' in line.lower():
        print(line)

ssh.close()
