#!/usr/bin/env python3
import paramiko, io

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.23.82.186', port=2006, username='root')

content = '{"cameras":[{"id":"cam-10","type":"rtsp","address":"rtsp://admin:asdfgh12@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0","name":"大华摄像头-10"},{"id":"cam-11","type":"rtsp","address":"rtsp://admin:ASDFGH12@192.168.1.11:554/Streaming/Channels/101","name":"海康摄像头-11"},{"id":"0","type":"usb","address":0,"name":"USB摄像头"},{"id":"hik-01","type":"rtsp","address":"rtsp://admin:asdfgh12@192.168.1.64:554/Streaming/Channels/101","name":"海康球机-A区"},{"id":"dh-01","type":"rtsp","address":"rtsp://admin:CHANGE_ME@192.168.1.65:554/cam/realmonitor?channel=1&subtype=0","name":"大华枪机-B区"}]}'

sftp = ssh.open_sftp()
sftp.putfo(io.BytesIO(content.encode()), '/opt/yolov8-security/detection/cameras.json')
sftp.close()
ssh.close()
print('Done')
