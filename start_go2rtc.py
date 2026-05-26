#!/usr/bin/env python3
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.23.82.186', port=2006, username='root')

# 配置 go2rtc，添加海康摄像头
config = """api:
  listen: ":1984"
rtsp:
  listen: ":8554"
webrtc:
  listen: ":8555"
streams:
  cam_hik-01: rtsp://admin:asdfgh12@192.168.1.64:554/Streaming/Channels/101
  cam_dh-01: rtsp://admin:asdfgh12@192.168.1.65:554/cam/realmonitor?channel=1&subtype=0
"""

sftp = ssh.open_sftp()
sftp.putfo(__import__('io').BytesIO(config.encode()), '/opt/yolov8-security/server/bin/go2rtc.yaml')
sftp.close()

# 杀掉旧进程并启动 go2rtc
ssh.exec_command('pkill -f go2rtc 2>/dev/null; sleep 1')
ssh.exec_command('cd /opt/yolov8-security/server/bin && nohup ./go2rtc > /opt/yolov8-security/go2rtc.log 2>&1 &')

_, o, _ = ssh.exec_command('sleep 2 && ps aux | grep go2rtc | grep -v grep && echo "---streams---" && curl -s http://127.0.0.1:1984/api/streams')
print(o.read().decode())

ssh.close()
print('go2rtc started')
