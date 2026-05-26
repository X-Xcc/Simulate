import json
cams = [{"id": "hik-01", "type": "rtsp", "address": "rtsp://admin:asdfgh12@10.23.82.200:554/Streaming/Channels/101", "name": "HikCamera"}]
with open("/opt/yolov8-security/detection/cameras.json", "w") as f:
    json.dump({"cameras": cams}, f)
print("Done")
