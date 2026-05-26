"""Clean deploy to remote 47.96.218.68"""
import paramiko, time, os

HOST = "47.96.218.68"
USER = "root"
PASS = "Xj301168"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=22, username=USER, password=PASS)

def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode(errors="replace").strip()

# Stop
print("[1/5] Stop...")
run("fuser -k 5000/tcp 2>/dev/null; fuser -k 5001/tcp 2>/dev/null; sleep 2; echo ok")
print("  Done")

# Clean
print("[2/5] Clean old dist...")
run("rm -rf /opt/yolov8-security/web/dist/*")
print("  Done")

# Upload WAR
print("[3/5] Upload WAR...")
sftp = ssh.open_sftp()
sftp.put(r"D:\yolov8_security\server\target\yolov8-security.war", "/opt/yolov8-security/app.war")
sftp.close()
print("  Done")

# Upload dist
print("[4/5] Upload dist...")
sftp = ssh.open_sftp()
local_dist = r"D:\yolov8_security\web\dist"
remote_dist = "/opt/yolov8-security/web/dist"
for root, dirs, files in os.walk(local_dist):
    rel = os.path.relpath(root, local_dist)
    remote_dir = os.path.join(remote_dist, rel).replace("\\", "/")
    try:
        sftp.stat(remote_dir)
    except:
        sftp.mkdir(remote_dir)
    for f in files:
        sftp.put(os.path.join(root, f), remote_dir + "/" + f)
sftp.close()
print("  Done")

# Restart
print("[5/5] Restart...")
run("nohup /usr/lib/jvm/java-18-openjdk-amd64/bin/java -Xms256m -Xmx1g -jar /opt/yolov8-security/app.war --spring.config.additional-location=file:/opt/yolov8-security/application.properties > /opt/yolov8-security/app.log 2>&1 &")
time.sleep(12)

# Verify
import urllib.request
req = urllib.request.Request("http://47.96.218.68:5000/")
resp = urllib.request.urlopen(req)
print(f"/: HTTP {resp.status}")

req = urllib.request.Request("http://47.96.218.68:5000/training")
resp = urllib.request.urlopen(req)
print(f"/training: HTTP {resp.status}")

ssh.close()
print("Done! http://47.96.218.68:5000/training")
