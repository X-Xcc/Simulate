#!/usr/bin/env python3
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.23.82.186', port=2006, username='root')

# 用 ffmpeg 直接拉 RTSP 流，转成 HTTP FLV
# 海康: rtsp://admin:asdfgh12@192.168.1.64:554/Streaming/Channels/101
# 大华: rtsp://admin:asdfgh12@192.168.1.65:554/cam/realmonitor?channel=1&subtype=0

hik_url = "rtsp://admin:asdfgh12@192.168.1.64:554/Streaming/Channels/101"
dh_url = "rtsp://admin:asdfgh12@192.168.1.65:554/cam/realmonitor?channel=1&subtype=0"

# 杀掉旧进程
ssh.exec_command('pkill -f ffmpeg 2>/dev/null; sleep 1')

# 启动 ffmpeg 拉流
ssh.exec_command(f'nohup ffmpeg -rtsp_transport tcp -i "{hik_url}" -c copy -f flv rtmp://127.0.0.1:1935/hik-01 > /opt/yolov8-security/ffmpeg_hik.log 2>&1 &')
ssh.exec_command(f'nohup ffmpeg -rtsp_transport tcp -i "{dh_url}" -c copy -f flv rtmp://127.0.0.1:1935/dh-01 > /opt/yolov8-security/ffmpeg_dh.log 2>&1 &')

_, o, _ = ssh.exec_command('sleep 3 && ps aux | grep ffmpeg | grep -v grep && echo "---hik---" && tail -5 /opt/yolov8-security/ffmpeg_hik.log && echo "---dh---" && tail -5 /opt/yolov8-security/ffmpeg_dh.log')
print(o.read().decode())

ssh.close()
