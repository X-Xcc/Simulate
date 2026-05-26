#!/usr/bin/env python3
import json
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BIN_DIR = ROOT / "server" / "bin"
GO2RTC_EXE = BIN_DIR / "go2rtc.exe"
GO2RTC_YAML = BIN_DIR / "go2rtc.yaml"

# 后端数据库里的 go2rtc_id 是 cam_<cameraId>，前端会请求 /ui.html?src=cam_cam-10。
# 这里必须使用同样的 stream id，否则 go2rtc 返回 404。
STREAMS = {
    "cam_cam-10": "rtsp://admin:asdfgh12@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0",
    "cam_cam-11": "rtsp://admin:ASDFGH12@192.168.1.11:554/cam/realmonitor?channel=1&subtype=0",
}


def build_config() -> str:
    lines = [
        "api:",
        '  listen: ":1984"',
        "rtsp:",
        '  listen: ":8554"',
        "webrtc:",
        '  listen: ":8555"',
        "streams:",
    ]
    for stream_id, rtsp_url in STREAMS.items():
        lines.append(f"  {stream_id}: {rtsp_url}")
    return "\n".join(lines) + "\n"


def request_json(url: str):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    if not GO2RTC_EXE.exists():
        raise FileNotFoundError(
            f"找不到 {GO2RTC_EXE}，请先下载 Windows 版 go2rtc 并放到 server/bin/go2rtc.exe"
        )

    BIN_DIR.mkdir(parents=True, exist_ok=True)
    GO2RTC_YAML.write_text(build_config(), encoding="utf-8")

    subprocess.run(
        ["taskkill", "/F", "/IM", "go2rtc.exe"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )

    log_path = ROOT / "go2rtc.log"
    log_file = log_path.open("w", encoding="utf-8")
    subprocess.Popen(
        [str(GO2RTC_EXE), "-config", str(GO2RTC_YAML)],
        cwd=str(BIN_DIR),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )

    for _ in range(20):
        try:
            streams = request_json("http://127.0.0.1:1984/api/streams")
            print(json.dumps(streams, ensure_ascii=False, indent=2))
            print("go2rtc started")
            for stream_id in STREAMS:
                print(f"{stream_id}: http://127.0.0.1:1984/ui.html?src={stream_id}")
            return
        except Exception:
            time.sleep(0.5)

    raise RuntimeError(f"go2rtc 启动后未响应，请查看日志: {log_path}")


if __name__ == "__main__":
    main()
