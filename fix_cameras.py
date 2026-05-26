import json
cams = [
    {
        "id": "cam-10",
        "type": "rtsp",
        "address": "rtsp://admin:asdfgh12@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0",
        "name": "摄像头1-192.168.1.10",
    },
    {
        "id": "cam-11",
        "type": "rtsp",
        "address": "rtsp://admin:ASDFGH12@192.168.1.11:554/cam/realmonitor?channel=1&subtype=0",
        "name": "摄像头2-192.168.1.11",
    },
]
with open("/opt/yolov8-security/detection/cameras.json", "w") as f:
    json.dump({"cameras": cams}, f, ensure_ascii=False, indent=2)
print("Done")
