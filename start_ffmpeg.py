#!/usr/bin/env python3
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

STREAMS = {
    "cam-10": "rtsp://admin:asdfgh12@192.168.1.10:554/cam/realmonitor?channel=1&subtype=0",
    "cam-11": "rtsp://admin:ASDFGH12@192.168.1.11:554/cam/realmonitor?channel=1&subtype=0",
}


def main() -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError("本机 PATH 中找不到 ffmpeg，请先安装 ffmpeg 或把 ffmpeg.exe 加入 PATH")

    subprocess.run(
        ["taskkill", "/F", "/IM", "ffmpeg.exe"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )

    for stream_id, rtsp_url in STREAMS.items():
        log_path = LOG_DIR / f"ffmpeg_{stream_id}.log"
        log_file = log_path.open("w", encoding="utf-8")
        subprocess.Popen(
            [
                ffmpeg,
                "-rtsp_transport",
                "tcp",
                "-i",
                rtsp_url,
                "-c",
                "copy",
                "-f",
                "rtsp",
                f"rtsp://127.0.0.1:8554/{stream_id}",
            ],
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        print(f"started ffmpeg {stream_id}, log: {log_path}")

    time.sleep(3)
    subprocess.run(["tasklist", "/FI", "IMAGENAME eq ffmpeg.exe"], check=False)


if __name__ == "__main__":
    main()
