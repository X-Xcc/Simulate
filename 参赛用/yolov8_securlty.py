# 依赖：
# ultralytics   # 用于YOLO目标检测模型
# opencv-python # 用于视频处理和图像操作
# numpy         # 用于数值计算
# pillow        # 用于绘制中文文字

# 导入必要的库
from email.quoprimime import body_check
from operator import is_
import os                              # 用于文件路径和环境变量操作
import threading                       # 用于多线程处理
from collections import deque          # 用于队列数据结构（日志存储）
from itertools import combinations     # 用于生成组合（检测打架时两两比较）
from concurrent.futures import ThreadPoolExecutor  # 用于异步发送视频帧

# 直接导入，减少不必要的检查
from networkx import max_flow_min_cost, min_cost_flow
from polars import self_dtype
from scipy.datasets import face
from sympy import ordered, per
from ultralytics import YOLO           # 导入YOLOv8模型
import cv2                             # 导入OpenCV库
import time                            # 用于时间戳和计时
import numpy as np                     # 导入NumPy数值计算库
import json                            # 用于读取配置文件
import torch                           # PyTorch深度学习框架
from typing import List, Tuple, Optional  # 用于类型提示
from dataclasses import dataclass, field  # 用于创建数据类
from PIL import ImageFont, ImageDraw, Image  # 用于绘制中文文字

# 快速忽略警告，不进行复杂配置
import warnings                        # 用于处理警告信息

warnings.filterwarnings("ignore")      # 忽略所有警告信息

# ===================== 设备检测 =====================
_USE_GPU = os.environ.get("YOLOV8_DEVICE", "cpu").lower() == "cuda"  # 检查环境变量是否设置使用GPU

print("\n" + "=" * 60)                    # 打印分隔线
print("PyTorch 版本:", torch.__version__)  # 打印PyTorch版本号
print("CUDA 可用:", torch.cuda.is_available())  # 检查CUDA是否可用

if _USE_GPU and torch.cuda.is_available():     # 如果设置使用GPU且CUDA可用
    print("使用设备: 👉 GPU -", torch.cuda.get_device_name(0))  # 打印GPU名称
    print("GPU 显存:", round(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024 / 1024, 1), "GB")  # 打印GPU显存
    torch.backends.cudnn.benchmark = True       # 启用cuDNN加速
    torch.backends.cudnn.enabled = True         # 启用cuDNN
    print("cuDNN benchmark: ✅ 已启用")
else:
    print("使用设备: 👉 CPU 模式")               # 使用CPU模式

# OpenCV CUDA 检测
HAS_CV2_CUDA = False                           # 标记OpenCV是否支持CUDA
try:
    HAS_CV2_CUDA = cv2.cuda.getCudaEnabledDeviceCount() > 0  # 检测OpenCV CUDA
except Exception:
    pass                                        # 如果检测失败则忽略
if HAS_CV2_CUDA:
    print("OpenCV CUDA: ✅ 可用")               # OpenCV CUDA可用
else:
    print("OpenCV CUDA: ❌ 不可用 (resize 走 CPU)")  # OpenCV CUDA不可用
print("=" * 60 + "\n")                         # 打印分隔线
# =====================
# ==================================
# 尝试导入 requests，用于发送视频帧到 web 服务器
try:
    import requests                             # 导入requests库
    HAS_REQUESTS = True                         # 标记requests可用
except ImportError:
    HAS_REQUESTS = False                        # 标记requests不可用
    print("警告: 未安装 requests 库，无法发送视频流到 web 面板")
# GPU 使用率上报
try:
    import pynvml                              # 导入NVIDIA管理库
    pynvml.nvmlInit()                          # 初始化NVML
    _GPU_AVAILABLE = True                       # 标记GPU可用
except Exception:
    _GPU_AVAILABLE = False                      # 标记GPU不可用
# Web 服务器配置
WEB_SERVER_URL = os.environ.get("WEB_SERVER_URL", "http://127.0.0.1:5000")  # Web服务器地址，默认本地5000端口
SEND_FRAME_INTERVAL = 1  # 每1帧发送一次（实时）                          # 发送视频帧的间隔
JPEG_QUALITY = 50  # 降低JPEG质量以减少传输时间（极致性能）                 # JPEG压缩质量
# ===================== 配置区 =====================
class Config:
    """系统配置类，集中管理所有参数"""
    # 路径配置 - 简化，直接使用固定路径结构
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))      # 当前脚本所在目录
    PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)                   # 项目根目录
    MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "yolov8n-pose.pt")  # 模型文件路径
    # 多摄像头支持 - 启动时自动检测可用摄像头
    SOURCES = []  # 启动时由 detect_cameras() 填充             # 摄像头列表
    RESULT_VIDEO_PATH = os.path.join(PROJECT_ROOT, "results", "security_result.mp4")  # 结果视频保存路径
    DATASET_DIR = os.path.join(PROJECT_ROOT, "server", "data")   # 检测数据保存目录
    # 模型参数
    IMG_SIZE = 512                                              # 输入图像大小（像素）
    CONF_THRESH = 0.5                                           # 检测置信度阈值（大于0.5才认为检测到）
    # 设备选择: 通过环境变量 YOLOV8_DEVICE=cuda 启用 GPU，默认 CPU
    DEVICE = "cuda" if os.environ.get("YOLOV8_DEVICE", "cpu").lower() == "cuda" else "cpu"  # 计算设备
    HALF = DEVICE == "cuda"  # CPU 不支持 FP16                   # 是否使用半精度推理
    # TensorRT 加速（首次运行会导出 engine 文件，后续直接加载，2-5x 加速）
    USE_TENSORRT = False  # 设为 True 启用 TensorRT（需要安装 tensorrt）
    # 检测参数
    FIGHTING_THRESHOLD = 0.3                                    # 打架检测阈值
    #有效关键点
    LEN_KEYPOINTS = 10
    # 推理跳帧 — 每N帧推理一次，中间帧复用结果（2=每2帧推理1次，推理开销减半）
    INFERENCE_EVERY = 2                                         # 跳帧推理间隔
    # 跌倒检测时序平滑
    FALL_CONFIRM_FRAMES = 2  # 连续N帧确认跌倒才触发             # 跌倒确认帧数
    # 跌倒检测细粒度阈值（从 thresholds.json 加载，默认值见 _load_thresholds）
    FALL_SCORE_THRESHOLD = 0.4                                  # 跌倒评分阈值
    FALL_MIN_KP_CONF = 0.5                                      # 关键点最小置信度0.3
    FALL_MIN_VALID_KP = 10                                       # 最少有效关键点数量6
    FALL_ASPECT_RATIO_HIGH = 0.85                                # 跌倒长宽比高阈值（宽>高）0.75
    FALL_ASPECT_RATIO_LOW = 0.55                                # 跌倒长宽比低阈值
    FALL_HEAD_HIP_RATIO = 0.0                               # 跌倒头部与臀部位置比例阈值-0.1
    FALL_KNEE_ANGLE_BEND = 90                                   # 膝盖弯曲角度阈值65
    FALL_KNEE_ANGLE_STRAIGHT = 180                             # 膝盖伸直角度阈值160
    FALL_VERTICALITY_RATIO = 0.4                             # 躯干垂直度比例阈值0.6
    FALL_HIP_ANKLE_DIFF = 0.03                                  # 髋部脚踝位置差阈值
    FALL_TRUNK_ANGLE = 45                                       # 躯干倾斜角度阈值60
    FALL_HEAD_GROUND_RATIO = 0.65                               # 头部与地面距离比例阈值
    FALL_MIN_FEATURES = 2                                       # 跌倒判定需要满足的最少特征数
    # 打架检测细粒度阈值
    FIGHT_TRUNK_DISTANCE = 0.15                               # 打架时躯干距离阈值0.3
    FIGHT_BBOX_OVERLAP = 0.1                                  # 人体框重叠度阈值0.6
    FIGHT_ARM_ELBOW_OFFSET = 0.05                               # 手臂肘部抬起阈值0.4
    FIGHT_ARM_WRIST_OFFSET = 0.05                               # 手臂手腕抬起阈值0.6
    # 人员聚集参数（讲稿要求：阈值3人、聚集半径<1.5m、持续≥3s）
    GATHER_THRESHOLD = 3        # 聚集人数阈值                   # 触发聚集的最少人数
    GATHER_RADIUS = 0.08       # 归一化聚集半径（约占画面8%）    # 聚集半径
    GATHER_DURATION = 3.0       # 聚集持续秒数                   # 聚集持续时间要求
    GATHER_CONF_DIVISOR = 8.0   # 聚集置信度归一化除数           # 聚集置信度计算除数
    # 跨帧追踪
    TRACKING_IOU_THRESHOLD = 0.3                                # 跟踪IoU阈值

    # 极端异常行为检测参数（自杀倾向检测）
    SUICIDE_STAY_FRAMES = 90                                    # 高危区域驻留帧数（3秒@30fps）
    SUICIDE_FACE_STATE = 0.7                                    # 面部异常状态阈值
    SUICIDE_HIP_OFF_GROUND = 0.6                                # 臀部离地比例阈值（60%）
    SUICIDE_SCORE_THRESHOLD = 1.0                               # 极端异常行为判定阈值
    SUICIDE_HEIGHT_OFFSET = 0.3                                 # 身高下沉比例阈值

    # 报警参数
    ALERT_COOLDOWN = 5.0                                        # 报警冷却时间（秒）

    # 数据保存参数
    SAVE_INTERVAL = 5                                           # 数据保存间隔（帧）
    SAVE_IMAGE_ON_ACTION = True                                 # 检测到行为时是否保存图像

    # UI参数
    PANEL_WIDTH = 300                                           # 左侧面板宽度
    HEADER_HEIGHT = 60                                          # 顶部标题栏高度
    BANNER_HEIGHT = 40                                          # 报警横幅高度

    # 颜色配置 - 直接定义，减少注释
    COLORS = {
        'bg': (30, 30, 30),           # 背景色（深灰）
        'panel': (45, 45, 45),        # 面板背景色
        'text': (220, 220, 220),      # 文字颜色（浅灰）
        'normal': (0, 255, 0),        # 正常状态颜色（绿色）
        'warning': (0, 165, 255),     # 警告颜色（橙色）
        'danger': (0, 0, 255),        # 危险颜色（红色）
        'leave': (150, 150, 150),     # 离岗颜色（灰色）
        'live_green': (0, 255, 0),    # 直播状态绿色
        'live_red': (0, 0, 255),      # 直播状态红色
        'card_bg': (50, 50, 50),      # 卡片背景色
        'card_border': (60, 60, 60)   # 卡片边框色
    }

    def __init__(self):
        self._load_thresholds()          # 初始化时加载阈值配置

    def _load_thresholds(self):
        """从 thresholds.json 加载阈值，缺失字段保留默认值"""
        config_path = os.path.join(self.SCRIPT_DIR, "thresholds.json")  # 阈值配置文件路径
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)      # 读取配置文件
        except (FileNotFoundError, json.JSONDecodeError):
            return                       # 文件不存在或解析失败则返回

        m = data.get("model", {})        # 获取模型配置
        self.IMG_SIZE = m.get("img_size", self.IMG_SIZE)
        self.CONF_THRESH = m.get("conf_thresh", self.CONF_THRESH)
        self.INFERENCE_EVERY = m.get("inference_every", self.INFERENCE_EVERY)

        f = data.get("fall", {})         # 获取跌倒检测配置
        self.FALL_CONFIRM_FRAMES = f.get("confirm_frames", self.FALL_CONFIRM_FRAMES)
        self.FALL_SCORE_THRESHOLD = f.get("score_threshold", 0.5)
        self.FALL_MIN_KP_CONF = f.get("min_keypoint_conf", 0.5)
        self.FALL_MIN_VALID_KP = f.get("min_valid_keypoints", 5)
        self.FALL_ASPECT_RATIO_HIGH = f.get("aspect_ratio_high", 0.7)
        self.FALL_ASPECT_RATIO_LOW = f.get("aspect_ratio_low", 0.55)
        self.FALL_HEAD_HIP_RATIO = f.get("head_hip_ratio", -0.05)
        self.FALL_KNEE_ANGLE_BEND = f.get("knee_angle_bend", 60)
        self.FALL_KNEE_ANGLE_STRAIGHT = f.get("knee_angle_straight", 170)
        self.FALL_VERTICALITY_RATIO = f.get("verticality_ratio", 0.25)
        self.FALL_HIP_ANKLE_DIFF = f.get("hip_ankle_diff", 0.03)
        self.FALL_TRUNK_ANGLE = f.get("trunk_angle", 40)
        self.FALL_HEAD_GROUND_RATIO = f.get("head_ground_ratio", 0.65)
        self.FALL_MIN_FEATURES = f.get("min_features", 2)

        fi = data.get("fight", {})       # 获取打架检测配置
        self.FIGHTING_THRESHOLD = fi.get("threshold", self.FIGHTING_THRESHOLD)
        self.FIGHT_TRUNK_DISTANCE = fi.get("trunk_distance", 0.15)
        self.FIGHT_BBOX_OVERLAP = fi.get("bbox_overlap", 0.1)
        self.FIGHT_ARM_ELBOW_OFFSET = fi.get("arm_elbow_offset", 0.05)
        self.FIGHT_ARM_WRIST_OFFSET = fi.get("arm_wrist_offset", 0.1)

        g = data.get("gathering", {})    # 获取聚集检测配置
        self.GATHER_THRESHOLD = g.get("threshold", self.GATHER_THRESHOLD)
        self.GATHER_RADIUS = g.get("radius", self.GATHER_RADIUS)
        self.GATHER_DURATION = g.get("duration", self.GATHER_DURATION)
        self.GATHER_CONF_DIVISOR = g.get("confidence_divisor", 8.0)

        t = data.get("tracking", {})     # 获取跟踪配置
        self.TRACKING_IOU_THRESHOLD = t.get("iou_threshold", 0.3)

        a = data.get("alert", {})        # 获取报警配置
        self.ALERT_COOLDOWN = a.get("cooldown", self.ALERT_COOLDOWN)


# ===================== GPU 上报 =====================
_gpu_session = requests.Session() if HAS_REQUESTS else None  # 创建GPU状态上报的请求会话

def report_gpu_status():
    """上报 GPU 使用率到 Java 后端"""
    if not _GPU_AVAILABLE or not _gpu_session:
        return                                   # GPU不可用或无请求会话则返回
    try:
        handle = pynvml.nvmlDeviceGetHandle(0)   # 获取GPU设备句柄
        gpu_percent = pynvml.nvmlDeviceGetUtilizationRates(handle).gpu  # 获取GPU使用率
        memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)            # 获取内存信息
        gpu_name = pynvml.nvmlDeviceGetName(handle)                     # 获取GPU名称
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode('utf-8')   # 字节转字符串
        _gpu_session.post(                        # 发送POST请求上报GPU状态
            f"{WEB_SERVER_URL}/api/gpu_status",
            json={
                "gpuPercent": gpu_percent,        # GPU使用率
                "gpuMemoryMb": memory_info.used // (1024 * 1024),  # 已用显存（MB）
                "gpuName": gpu_name               # GPU名称
            },
            timeout=1.0                           # 1秒超时
        )
    except Exception:
        pass                                       # 异常静默处理


# ===================== 摄像头自动检测 =====================
def detect_cameras(max_index=5):
    """扫描USB设备索引0~max_index，返回可用摄像头列表"""
    available = []                                # 可用摄像头列表
    print("正在扫描可用摄像头...")
    # Windows 上使用 DirectShow 后端，避免默认后端无法枚举设备
    backend = cv2.CAP_DSHOW if hasattr(cv2, 'CAP_DSHOW') else cv2.CAP_ANY
    for i in range(max_index + 1):                # 遍历摄像头索引
        cap = cv2.VideoCapture(i, backend)        # 尝试打开摄像头
        if cap.isOpened():                        # 摄像头打开成功
            ret, _ = cap.read()                   # 尝试读取一帧
            if ret:                               # 读取成功
                available.append(i)               # 添加到可用列表
                print(f"  ✓ 摄像头 {i} 可用")
            cap.release()                         # 释放摄像头
        else:
            cap.release()                         # 释放摄像头
    if not available:
        print("  ✗ 未检测到任何摄像头")
    else:
        print(f"共检测到 {len(available)} 个摄像头: {available}")
    return available                              # 返回可用摄像头列表


def load_cameras_config(api_base=None):
    """从 Java 后端 API 获取摄像头列表"""
    if api_base is None:
        api_base = os.environ.get("WEB_SERVER_URL", "http://127.0.0.1:5000")  # 默认API地址

    rtsp_host = os.environ.get("GO2RTC_RTSP_HOST", "rtsp://127.0.0.1:8554")   # RTSP服务器地址

    if not HAS_REQUESTS:
        print("requests 库不可用，回退到本地 cameras.json")
        return _load_cameras_config_fallback()    # 回退到本地配置

    try:
        resp = requests.get(f"{api_base}/api/camera_config", timeout=5)  # 请求摄像头配置
        resp.raise_for_status()                   # 检查HTTP状态码
        data = resp.json()                        # 解析JSON响应
        cameras_data = data.get("data", data) if isinstance(data, dict) else data  # 兼容不同返回格式

        cameras = []
        for cam in cameras_data:
            if cam.get("type") == "usb":          # USB摄像头
                cameras.append({
                    "id": cam["id"],
                    "type": "usb",
                    "address": int(cam.get("address", cam.get("port", 0))),
                    "name": cam.get("name", f"Camera {cam['id']}"),
                    "go2rtc_id": cam.get("go2rtcId"),
                })
            elif cam.get("type") == "rtsp":       # RTSP摄像头
                # 从 go2rtc 拉流，不再直接连摄像头
                go2rtc_id = cam.get("go2rtcId", f"cam_{cam['id']}")
                cameras.append({
                    "id": cam["id"],
                    "type": "rtsp",
                    "address": f"{rtsp_host}/{go2rtc_id}",
                    "name": cam.get("name", f"Camera {cam['id']}"),
                    "go2rtc_id": go2rtc_id,
                })
            elif cam.get("type") == "http_snapshot":  # HTTP快照摄像头
                cameras.append({
                    "id": cam["id"],
                    "type": "http_snapshot",
                    "address": cam.get("address", cam.get("httpUrl", "")),
                    "name": cam.get("name", f"Camera {cam['id']}"),
                    "go2rtc_id": cam.get("go2rtcId"),
                })

        print(f"从 API 加载了 {len(cameras)} 个摄像头")
        return cameras

    except Exception as e:
        print(f"从 API 获取摄像头列表失败: {e}")
        # Fallback: 尝试读本地 cameras.json（向后兼容）
        return _load_cameras_config_fallback()


def _load_cameras_config_fallback():
    """回退方案：读本地 cameras.json"""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cameras.json")
    if not os.path.exists(config_path):
        return []                                 # 文件不存在返回空列表
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)                   # 读取配置文件
        cameras = []
        for cam in data.get("cameras", []):
            if cam.get("type") == "rtsp":
                continue                          # fallback 时跳过 RTSP
            cameras.append({
                "id": cam.get("id", ""),
                "type": cam.get("type", "usb"),
                "address": cam.get("address", 0),
                "name": cam.get("name", ""),
                "go2rtc_id": cam.get("go2rtcId"),
            })
        return cameras
    except Exception as e:
        print(f"读取 cameras.json 失败: {e}")
        return []                                 # 读取失败返回空列表


# ===================== 工具函数 =====================
class Utils:
    """工具函数类"""
    # 静态变量：缓存可用字体路径，避免重复IO操作
    _AVAILABLE_FONT_PATH = None
    # 缓存字体对象（key = font size），避免每次 draw 都重新加载字体文件
    _FONT_CACHE = {}
    # 线程锁，保护共享缓存
    _cache_lock = threading.Lock()

    # YOLOv8 Pose 关键点索引
    KEYPOINT_NAMES = {
        0: 'nose', 1: 'left_eye', 2: 'right_eye', 3: 'left_ear', 4: 'right_ear',
        5: 'left_shoulder', 6: 'right_shoulder', 7: 'left_elbow', 8: 'right_elbow',
        9: 'left_wrist', 10: 'right_wrist', 11: 'left_hip', 12: 'right_hip',
        13: 'left_knee', 14: 'right_knee', 15: 'left_ankle', 16: 'right_ankle'
    }

    @classmethod
    def _get_available_font_path(cls) -> str:
        """获取可用的字体路径，缓存结果"""
        if cls._AVAILABLE_FONT_PATH is None:
            # 兼容不同系统的字体路径
            font_paths = [
                r"C:\Windows\Fonts\simhei.ttf",  # 黑体
                r"C:\Windows\Fonts\simsun.ttc",  # 宋体
                r"C:\Windows\Fonts\msyh.ttc",  # 微软雅黑
                r"C:\Windows\Fonts\msyhbd.ttc",  # 微软雅黑粗体
                r"C:\Windows\Fonts\simkai.ttf",  # 楷体
                r"C:\Windows\Fonts\simli.ttf",  # 隶书
                r"C:\Windows\Fonts\simfang.ttf",  # 仿宋
                r"C:\Windows\Fonts\STXINGKA.TTF",  # 行楷
                r"C:\Windows\Fonts\STKAITI.TTF",  # 楷体
                r"C:\Windows\Fonts\STSONG.TTF",  # 宋体
                r"C:\Windows\Fonts\STZHONGS.TTF",  # 黑体
                r"C:\Windows\Fonts\microsoftyahei.ttf",  # 微软雅黑
                r"C:\Windows\Fonts\yahei.ttf",  # 雅黑
                "/System/Library/Fonts/PingFang.ttc",  # macOS
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
                "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",  # Linux中文
                "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"  # Linux中文
            ]

            # 寻找可用的字体
            for path in font_paths:
                if os.path.exists(path):
                    cls._AVAILABLE_FONT_PATH = path
                    break
        return cls._AVAILABLE_FONT_PATH

    @staticmethod
    def _get_cached_font(size: int):
        """获取或创建指定大小的缓存字体（线程安全）"""
        if size not in Utils._FONT_CACHE:           # 如果该大小字体不在缓存中
            with Utils._cache_lock:                  # 获取线程锁
                if size not in Utils._FONT_CACHE:     # 双重检查
                    font_path = Utils._get_available_font_path()
                    if font_path is None:
                        Utils._FONT_CACHE[size] = ImageFont.load_default()  # 使用默认字体
                    else:
                        try:
                            Utils._FONT_CACHE[size] = ImageFont.truetype(font_path, size, encoding="utf-8")
                        except (OSError, IOError):
                            Utils._FONT_CACHE[size] = ImageFont.load_default()
        return Utils._FONT_CACHE[size]               # 返回字体对象

    # 批量文字渲染缓冲区（线程安全，每个线程独立）
    _tls = threading.local()

    @classmethod
    def begin_text_batch(cls, img: np.ndarray) -> ImageDraw.Draw:
        """开始批量文字渲染 — 只做一次 BGR→RGB→PIL 转换"""
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # OpenCV的BGR转RGB
        cls._tls._pil_buffer = Image.fromarray(img_rgb)  # 转为PIL图像缓存
        return ImageDraw.Draw(cls._tls._pil_buffer)      # 返回绘图对象

    @classmethod
    def end_text_batch(cls, img: np.ndarray) -> np.ndarray:
        """结束批量文字渲染 — 只做一次 PIL→RGB→BGR 转换"""
        buf = getattr(cls._tls, '_pil_buffer', None)      # 获取缓存的PIL图像
        if buf is None:
            return img                                    # 无缓存直接返回原图
        result = cv2.cvtColor(np.array(buf), cv2.COLOR_RGB2BGR)  # PIL转OpenCV格式
        cls._tls._pil_buffer = None                       # 清空缓存
        return result

    @staticmethod
    def draw_text_cn_batch(draw: ImageDraw.Draw, text: str, pos: Tuple[int, int],
                           size: int = 30, color: Tuple[int, int, int] = (255, 255, 255)) -> None:
        """批量模式绘制文字 — 不做颜色转换，直接画在 PIL buffer 上"""
        font = Utils._get_cached_font(size)               # 获取缓存字体
        draw.text(pos, text, font=font, fill=color)      # 在缓存图像上绘制文字

    @staticmethod
    def draw_text_cn(img: np.ndarray, text: str, pos: Tuple[int, int],
                     size: int = 30, color: Tuple[int, int, int] = (255, 255, 255)) -> np.ndarray:
        """绘制中文文本（单次调用兼容模式）"""
        try:
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)  # BGR转RGB
            img_pil = Image.fromarray(img_rgb)              # 转PIL图像
            draw = ImageDraw.Draw(img_pil)                  # 创建绘图对象
            font = Utils._get_cached_font(size)             # 获取字体
            draw.text(pos, text, font=font, fill=color)     # 绘制文字
            img_bgr = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)  # RGB转回BGR
            return img_bgr
        except (OSError, IOError, ValueError) as e:
            print(f"中文绘制失败: {e}")
            return img                                    # 失败返回原图

    @staticmethod
    def calculate_distance(p1: np.ndarray, p2: np.ndarray) -> float:
        """计算两个关键点之间的欧氏距离"""
        dx = float(p1[0]) - float(p2[0])              # x坐标差
        dy = float(p1[1]) - float(p2[1])              # y坐标差
        return np.sqrt(dx * dx + dy * dy)              # 欧氏距离公式

    @staticmethod
    def calculate_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """计算三个点形成的夹角（p2为顶点）"""
        # 转换为向量
        v1 = np.array([float(p1[0]) - float(p2[0]), float(p1[1]) - float(p2[1])])  # p2到p1的向量
        v2 = np.array([float(p3[0]) - float(p2[0]), float(p3[1]) - float(p2[1])])  # p2到p3的向量

        # 计算夹角余弦值
        norm_v1 = np.linalg.norm(v1)                  # 向量1的模
        norm_v2 = np.linalg.norm(v2)                  # 向量2的模
        if norm_v1 == 0 or norm_v2 == 0:
            return 0.0                                # 零向量返回0

        cos_angle = np.dot(v1, v2) / (norm_v1 * norm_v2)  # 余弦值
        return np.arccos(np.clip(cos_angle, -1.0, 1.0)) * 180 / np.pi  # 转角度

    @staticmethod
    def get_body_center(keypoints: np.ndarray) -> Optional[np.ndarray]:
        """获取人体躯干中心（胸部位置）"""
        if len(keypoints) >= 13:
            # 基于胸部/肩部关键点计算中心（左肩、右肩、左髋、右髋）
            return np.mean(keypoints[[5, 6, 11, 12], :2], axis=0)
        return None

    @staticmethod
    def calculate_overlap(bbox1: List[float], bbox2: List[float], img_shape: Tuple[int, int]) -> float:
        """计算两个人体框的重叠度"""
        # 转换为像素坐标
        h, w = img_shape[:2]
        bbox1_pixel = [bbox1[0] * w, bbox1[1] * h, bbox1[2] * w, bbox1[3] * h]
        bbox2_pixel = [bbox2[0] * w, bbox2[1] * h, bbox2[2] * w, bbox2[3] * h]

        # 计算交集区域
        x1 = max(bbox1_pixel[0], bbox2_pixel[0])
        y1 = max(bbox1_pixel[1], bbox2_pixel[1])
        x2 = min(bbox1_pixel[2], bbox2_pixel[2])
        y2 = min(bbox1_pixel[3], bbox2_pixel[3])

        if x2 < x1 or y2 < y1:
            return 0.0                                # 无交集

        # 计算交集面积
        intersection = (x2 - x1) * (y2 - y1)
        # 计算并集面积
        area1 = (bbox1_pixel[2] - bbox1_pixel[0]) * (bbox1_pixel[3] - bbox1_pixel[1])
        area2 = (bbox2_pixel[2] - bbox2_pixel[0]) * (bbox2_pixel[3] - bbox2_pixel[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0  # 返回交并比

    @staticmethod
    def calculate_iou(bbox1, bbox2) -> float:
        """计算两个归一化 [x1,y1,x2,y2] 框的 IoU（无需 img_shape）"""
        x1 = max(float(bbox1[0]), float(bbox2[0]))    # 交集左上角x
        y1 = max(float(bbox1[1]), float(bbox2[1]))    # 交集左上角y
        x2 = min(float(bbox1[2]), float(bbox2[2]))    # 交集右下角x
        y2 = min(float(bbox1[3]), float(bbox2[3]))    # 交集右下角y
        inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)  # 交集面积
        area1 = (float(bbox1[2]) - float(bbox1[0])) * (float(bbox1[3]) - float(bbox1[1]))
        area2 = (float(bbox2[2]) - float(bbox2[0])) * (float(bbox2[3]) - float(bbox2[1]))
        union = area1 + area2 - inter                 # 并集面积
        return inter / union if union > 0 else 0.0    # IoU值

    @staticmethod
    def generate_timestamp() -> str:
        """生成带毫秒的时间戳"""
        ms = int(time.time() * 1000) % 1000           # 获取毫秒部分
        return f"{time.strftime('%Y%m%d_%H%M%S')}_{ms:03d}"  # 格式：年月日_时分秒_毫秒

    _scratch_img = None                               # 临时图像用于测量文字
    _scratch_draw = None                              # 临时绘图对象

    @staticmethod
    def measure_text_size(text: str, font_size: int) -> Tuple[int, int]:
        """测量文本尺寸（线程安全）"""
        try:
            with Utils._cache_lock:
                if Utils._scratch_img is None:
                    Utils._scratch_img = Image.new('RGB', (100, 100))  # 创建临时图像
                    Utils._scratch_draw = ImageDraw.Draw(Utils._scratch_img)
            font = Utils._get_cached_font(font_size)
            with Utils._cache_lock:
                text_bbox = Utils._scratch_draw.textbbox((0, 0), text, font=font)
                return int(text_bbox[2] - text_bbox[0]), int(text_bbox[3] - text_bbox[1])  # 返回宽高
        except (OSError, IOError, AttributeError):
            return 80, 20                             # 失败返回默认尺寸


# ===================== 检测结果封装 =====================
@dataclass
class DetectionResult:
    """detect_security_actions 的返回值封装"""
    actions: List[str] = field(default_factory=list)           # 检测到的行为列表（如["跌倒", "打架"]）
    person_count: int = 0                                    # 检测到的人数
    fighting_persons: List[int] = field(default_factory=list) # 打架人员的索引列表
    prev_centers: List[Optional[np.ndarray]] = field(default_factory=list)  # 上一帧的人体中心位置
    last_move_times: List[float] = field(default_factory=list)  # 上次移动时间
    action_confidences: dict = field(default_factory=dict)    # 行为置信度字典
    gather_start_times: dict = field(default_factory=dict)    # 聚集开始时间
    prev_bboxes: list = field(default_factory=list)           # 上一帧的边界框
    fall_confirm_counts: List[int] = field(default_factory=list)  # 跌倒确认帧数


# ===================== 检测模块 =====================
class DetectionModule:
    """行为检测模块 - 检测跌倒、打架、聚集等行为"""

    def __init__(self, config: Config):
        self.config = config                                  # 保存配置对象

    def detect_fall(self, keypoints: np.ndarray) -> Tuple[bool, float]:
        """基于多维度特征检测跌倒行为 - 优化版本，返回检测结果和置信度"""
        if len(keypoints) < 17:
            return False, 0.0                                 # 关键点数量不足，直接返回未跌倒

        # 1. 计算人体包围框的长宽比（跌倒时宽>高）
        valid_kp = keypoints[keypoints[:, 2] > self.config.FALL_MIN_KP_CONF]  # 筛选置信度足够的关键点
        if len(valid_kp) < self.config.FALL_MIN_VALID_KP:
            return False, 0.0                                 # 有效关键点不足

        min_x, max_x = valid_kp[:, 0].min(), valid_kp[:, 0].max()  # 最小最大x坐标
        min_y, max_y = valid_kp[:, 1].min(), valid_kp[:, 1].max()  # 最小最大y坐标

        height = max_y - min_y
        if height == 0:
            return False, 0.0                                 # 防止除零错误

        aspect_ratio = (max_x - min_x) / height               # 计算宽高比

        # 2. 头部与臀部的相对位置（跌倒时头部可能低于臀部）
        head_y = keypoints[0][1]  # 鼻子Y坐标（关键点0是鼻子）
        hip_y = (keypoints[11][1] + keypoints[12][1]) / 2  # 髋部Y坐标（关键点11,12是左右髋）
        head_hip_ratio = (head_y - hip_y) / height

        # 3. 腿部角度分析（跌倒时腿部弯曲角度异常）
        left_knee_angle = Utils.calculate_angle(keypoints[11], keypoints[13], keypoints[15])  # 左膝角度
        right_knee_angle = Utils.calculate_angle(keypoints[12], keypoints[14], keypoints[16]) # 右膝角度

        # 4. 躯干垂直度（跌倒时躯干水平）
        shoulder_y = (keypoints[5][1] + keypoints[6][1]) / 2   # 肩部Y坐标
        verticality_ratio = abs(hip_y - shoulder_y) / height   # 躯干垂直比例

        # 5. 脚踝与髋部的相对位置
        hip_ankle_diff = hip_y - (keypoints[15][1] + keypoints[16][1]) / 2  # 髋部脚踝Y坐标差

        # 6. 计算躯干倾斜角度（更准确的姿态判断）
        shoulder_center = (keypoints[5][:2] + keypoints[6][:2]) / 2  # 肩部中心
        hip_center = (keypoints[11][:2] + keypoints[12][:2]) / 2    # 髋部中心
        trunk_vector = shoulder_center - hip_center                  # 躯干向量

        trunk_norm = np.linalg.norm(trunk_vector)
        trunk_angle = np.arccos(
            np.clip(-trunk_vector[1] / trunk_norm, -1.0, 1.0)) * 180 / np.pi if trunk_norm > 0 else 0  # 躯干角度

        # 7. 头部与地面的相对位置（归一化坐标中 head_y 本身就是比例）
        head_ground_ratio = head_y

        # 8. 关键点置信度加权（新增特征）
        confidence_score = np.mean(keypoints[:, 2])             # 所有关键点的平均置信度

        # 综合评分（各项特征加权 - 调整阈值以提高检测率）
        fall_score = 0
        required_features = 0

        # 特征1：长宽比（归一化坐标下，站立者 ~0.3-0.5，躺卧者 >0.7）
        if aspect_ratio > self.config.FALL_ASPECT_RATIO_HIGH:
            fall_score += 0.25
            required_features += 1
        elif aspect_ratio > self.config.FALL_ASPECT_RATIO_LOW:
            fall_score += 0.1

        # 特征2：头部低于臀部（调整阈值）
        if head_hip_ratio < self.config.FALL_HEAD_HIP_RATIO:
            fall_score += 0.2
            required_features += 1

        # 特征3：腿部角度（放松一点，坐着时也可能弯曲）
        if (left_knee_angle < self.config.FALL_KNEE_ANGLE_BEND or left_knee_angle > self.config.FALL_KNEE_ANGLE_STRAIGHT) and \
                (right_knee_angle < self.config.FALL_KNEE_ANGLE_BEND or right_knee_angle > self.config.FALL_KNEE_ANGLE_STRAIGHT):
            fall_score += 0.15

        # 特征4：躯干垂直度（调整阈值）
        if verticality_ratio < self.config.FALL_VERTICALITY_RATIO:
            fall_score += 0.15
            required_features += 1

        # 特征5：脚踝位置
        if hip_ankle_diff > self.config.FALL_HIP_ANKLE_DIFF:
            fall_score += 0.1

        # 特征6：躯干倾斜角度（新增，关键特征）
        if trunk_angle > self.config.FALL_TRUNK_ANGLE:
            fall_score += 0.15
            required_features += 1

        # 特征7：头部接近地面（归一化坐标）
        if head_ground_ratio > self.config.FALL_HEAD_GROUND_RATIO:
            fall_score += 0.1

        # 特征8：关键点置信度
        fall_score *= confidence_score

        # 综合判定：必须满足多个条件才判定为跌倒
        is_fall = fall_score > self.config.FALL_SCORE_THRESHOLD and required_features >= self.config.FALL_MIN_FEATURES
        return is_fall, fall_score

    def _is_arm_raised(self, keypoints: np.ndarray) -> bool:
        """检测手臂是否抬起（用于打架检测）"""
        if len(keypoints) < 17:
            return False                                        # 关键点不足
        shoulder_y = (keypoints[5][1] + keypoints[6][1]) / 2    # 肩部Y坐标
        elbow_y = (keypoints[7][1] + keypoints[8][1]) / 2      # 肘部Y坐标
        wrist_y = (keypoints[9][1] + keypoints[10][1]) / 2     # 手腕Y坐标
        # 如果肘部或手腕高于肩部一定距离，认为手臂抬起
        return (elbow_y < shoulder_y - self.config.FIGHT_ARM_ELBOW_OFFSET) or (wrist_y < shoulder_y - self.config.FIGHT_ARM_WRIST_OFFSET)

    def detect_fighting(self, keypoints_list: List[np.ndarray], bboxes: List[List[float]],
                        img_shape: Tuple[int, int]) -> Tuple[bool, List[int]]:
        """基于躯干数据检测打架行为"""
        if len(keypoints_list) < 2:
            return False, []                                    # 至少需要2个人

        h, w = img_shape[:2]
        max_dim = max(w, h)                                     # 图像最大维度
        fighting_persons = set()                                # 打架人员集合

        # 遍历每对人体（两两比较）
        for (i, kp1), (j, kp2) in combinations(enumerate(keypoints_list), 2):
            # 获取躯干中心
            center1 = Utils.get_body_center(kp1)
            center2 = Utils.get_body_center(kp2)

            if center1 is None or center2 is None:
                continue                                        # 无法获取中心则跳过

            # 综合判定
            fight_score = 0

            # 1. 计算躯干中心距离（归一化）- 距离近可能在打架
            if Utils.calculate_distance(center1, center2) / max_dim < self.config.FIGHT_TRUNK_DISTANCE:
                fight_score += 0.4

            # 2. 计算人体框重叠度 - 重叠可能在打架
            if Utils.calculate_overlap(bboxes[i], bboxes[j], img_shape) > self.config.FIGHT_BBOX_OVERLAP:
                fight_score += 0.3

            # 3. 检测手臂是否抬起（打架时通常手臂抬起）
            if self._is_arm_raised(kp1) and self._is_arm_raised(kp2):
                fight_score += 0.3

            if fight_score > self.config.FIGHTING_THRESHOLD:
                # 记录打架人员的索引
                fighting_persons.add(i)
                fighting_persons.add(j)

        return len(fighting_persons) > 0, list(fighting_persons)

    def detect_extreme_abnormal(self, keypoints: np.ndarray, person_id: int, 
                                prev_states: dict, face_state: float = 0.0) -> Tuple[bool, float]:
        """检测极端异常行为（自杀倾向）- 三个特征缺一不可
        极端异常行为和跌倒不一样：跌倒是突然的，极端异常是持续的异常姿态
        
        三个核心特征：
        1. 高危驻留：人员处于窗户/栅栏/房梁等高危区域且停留超3秒
        2. 面部异常：面部神态异常扭曲泛红
        3. 臀下悬空：人体整体下沉低于正常身高，臀部离地悬空
        
        参数：
            keypoints: 人体关键点数组
            person_id: 人员ID（用于跨帧追踪状态）
            prev_states: 人员状态字典（包含驻留时间等）
            face_state: 面部状态值（0-1，越高越异常）
        
        返回：(是否检测到极端异常, 异常评分)
        """
        if len(keypoints) < 17:
            return False, 0.0                                     # 关键点不足，无法判定
        
        # 初始化评分
        suicide_score = 0.0
        if person_id in prev_states:
            stay_time = prev_states[person_id].get("stay_time,3")
            if stay_time > self.config.SUICIDE_STAY_FRAMES
            suicide_score += 0.4
        if face_state > self.config.SUICIDE_FACE_STATE
            suicide_score += 0.3
        valid_kp = keypoints[keypoints[:,2] > self.config.FALL_MIN_KP_CONF]
        if len(valid_kp) > 4
            hip_y = (keypoints[11][1] = keypoints[12][1])
            min_y = valid_kp[:,1].min
            max_y = valid_kp[:,1].max
            height = max_y -min_y 

            if height > 0 
            hip_off_ground = (max_y - min_y)
            body_center_y = (min_y + max_y)
            height_offset = body_center_y < 0.5
            if height_offset and hip_off_ground >self.config.SUICIDE_HIP_OFF_GROUND
                suicide_score += 0.75
            is_extreme_abnormal = suicide_score >self.config.SUICIDE_SCORE_THRESHOLD
            return is_extreme_abnormal , suicide_score
    def detect_gathering(self, keypoints_list: List[np.ndarray],
                         img_shape: Tuple[int, int],
                         gather_start_times: Optional[dict]) -> Tuple[bool, int, float]:
        """检测人员聚集行为
        讲稿标准：聚集半径<1.5m、持续≥3s、人数阈值≥3人
        返回：(是否聚集, 聚集人数, 聚集置信度)
        """
        #筛选关键点，>4，髋部平均垂直位置，最高低点整体身高，增加身高合法性
        #计算出臀部离地比例，重心垂直位置，<0.5判高危，重心上移+臀部离地最后判断，+0.75
        #三维度1.0
        n = len(keypoints_list)
        if n < self.config.GATHER_THRESHOLD:
            return False, 0, 0.0                               # 人数不足，直接返回未聚集

        h, w = img_shape[:2]
        max_dim = max(w, h)                                    # 图像最大维度

        # 聚类：找出彼此距离在阈值内的人员
        clusters = []

        for i, kp_i in enumerate(keypoints_list):
            center_i = Utils.get_body_center(kp_i)
            if center_i is None:
                continue                                       # 无法获取中心则跳过
            cluster = [i]                                      # 新建一个簇，包含当前人
            for j, kp_j in enumerate(keypoints_list):
                if j <= i:
                    continue                                   # 避免重复比较
                center_j = Utils.get_body_center(kp_j)
                if center_j is None:
                    continue
                # 归一化距离（除以图像最大维度）
                dist = Utils.calculate_distance(center_i, center_j) / max_dim
                if dist < self.config.GATHER_RADIUS:
                    cluster.append(j)                          # 距离在阈值内则加入同一簇
            clusters.append(cluster)

        # 取最大聚集簇
        if not clusters:
            return False, 0, 0.0
        best_cluster = max(clusters, key=len)                  # 找人数最多的簇
        gather_count = len(best_cluster)                       # 聚集人数

        if gather_count < self.config.GATHER_THRESHOLD:
            return False, 0, 0.0                               # 聚集人数不足

        # 计算聚集持续时间
        current_time = time.time()
        cluster_key = tuple(sorted(best_cluster))              # 用排序后的索引作为簇的标识
        if gather_start_times is None:
            gather_start_times = {}

        if cluster_key in gather_start_times:
            # 之前就在聚集中，保持开始时间不变
            pass
        else:
            # 新聚集，记录开始时间
            gather_start_times[cluster_key] = current_time

        start_time = gather_start_times.get(cluster_key, current_time)
        duration = current_time - start_time                   # 聚集持续时长

        confidence = min(gather_count / self.config.GATHER_CONF_DIVISOR, 1.0)  # 人数越多置信度越高

        is_gathering = duration >= self.config.GATHER_DURATION  # 持续时间够长才算聚集
        return is_gathering, gather_count, confidence

    def detect_security_actions(self, pose_results: List, prev_centers: Optional[List[np.ndarray]],
                                last_move_times: Optional[List[float]],
                                gather_start_times: Optional[dict] = None,
                                prev_bboxes: Optional[List] = None,
                                fall_confirm_counts: Optional[List[int]] = None) -> DetectionResult:
        """检测所有安全行为，支持多人检测（IoU 跟踪 + 时序平滑）"""
        detected_actions = set()                                # 检测到的行为集合
        person_count = 0                                        # 人数
        keypoints_list = []                                     # 关键点列表
        bboxes = []                                             # 边界框列表
        img_shape = None                                        # 图像形状
        new_gather_start_times = gather_start_times if gather_start_times is not None else {}
        fighting_persons = []                                   # 打架人员列表
        action_confidences = {}                                 # 行为置信度

        for r in pose_results:
            if r.keypoints is None:
                continue                                        # 无关键点则跳过

            img_shape = r.orig_img.shape                         # 原始图像形状
            keypoints = r.keypoints.data                         # 关键点数据
            person_count = len(keypoints)                        # 人数

            # 收集关键点和边界框
            current_bboxes = []
            for i, kp in enumerate(keypoints):
                kp_np = kp.cpu().numpy() if hasattr(kp, 'cpu') else kp  # 转为numpy数组
                keypoints_list.append(kp_np)

                if len(r.boxes) > i:
                    bbox = (
                        r.boxes[i].xyxy[0].cpu().numpy()
                        if hasattr(r.boxes[i].xyxy[0], 'cpu')
                        else r.boxes[i].xyxy[0]
                    )
                    normalized_bbox = bbox / [img_shape[1], img_shape[0], img_shape[1], img_shape[0]]  # 归一化
                    bboxes.append(normalized_bbox)
                    current_bboxes.append(normalized_bbox)
                else:
                    current_bboxes.append(None)

            # === IoU 人体跟踪：匹配前后帧的同一个人 ===
            new_prev_centers = [None] * person_count            # 新的上一帧中心位置
            new_last_move_times = [time.time()] * person_count  # 新的上次移动时间
            new_fall_confirm_counts = [0] * person_count        # 新的跌倒确认计数
            new_prev_bboxes_list = [None] * person_count        # 新的上一帧边界框

            if prev_bboxes and len(prev_bboxes) > 0 and current_bboxes:
                # 计算 IoU 矩阵（当前帧与上一帧边界框的重叠度）
                n_new = len(current_bboxes)
                n_prev = len(prev_bboxes)
                iou_matrix = np.zeros((n_new, n_prev))          # IoU矩阵
                for ni in range(n_new):
                    if current_bboxes[ni] is None:
                        continue
                    for pi in range(n_prev):
                        if prev_bboxes[pi] is None:
                            continue
                        iou_matrix[ni, pi] = Utils.calculate_iou(current_bboxes[ni], prev_bboxes[pi])

                # 贪心匹配：找出IoU最大的配对
                matched_new = set()                             # 已匹配的当前帧索引
                matched_prev = set()                            # 已匹配的上一帧索引
                while len(matched_new) < n_new and len(matched_prev) < n_prev:
                    best_iou, best_ni, best_pi = 0.0, -1, -1
                    for ni in range(n_new):
                        if ni in matched_new:
                            continue
                        for pi in range(n_prev):
                            if pi in matched_prev:
                                continue
                            if iou_matrix[ni, pi] > best_iou:
                                best_iou, best_ni, best_pi = iou_matrix[ni, pi], ni, pi
                    if best_iou < self.config.TRACKING_IOU_THRESHOLD:
                        break                                   # IoU太小，停止匹配
                    matched_new.add(best_ni)
                    matched_prev.add(best_pi)
                    # 转移跟踪状态：将上一帧的状态传递到当前帧
                    if prev_centers and best_pi < len(prev_centers):
                        new_prev_centers[best_ni] = prev_centers[best_pi]
                    if last_move_times and best_pi < len(last_move_times):
                        new_last_move_times[best_ni] = last_move_times[best_pi]
                    if fall_confirm_counts and best_pi < len(fall_confirm_counts):
                        new_fall_confirm_counts[best_ni] = fall_confirm_counts[best_pi]

            # 逐人检测
            for i, kp_np in enumerate(keypoints_list):
                new_prev_bboxes_list[i] = current_bboxes[i] if i < len(current_bboxes) else None

                # 跌倒检测（带时序平滑，连续多帧确认）
                is_fall, fall_confidence = self.detect_fall(kp_np)
                if is_fall:
                    new_fall_confirm_counts[i] += 1              # 增加确认计数
                    if new_fall_confirm_counts[i] >= self.config.FALL_CONFIRM_FRAMES:
                        detected_actions.add("跌倒")              # 连续多帧确认后才判定跌倒
                        action_confidences["跌倒"] = fall_confidence
                else:
                    new_fall_confirm_counts[i] = 0               # 检测不到跌倒则重置计数

            # 打架检测（需要至少2人）
            if person_count >= 2 and img_shape is not None:
                is_fighting, fight_persons = self.detect_fighting(keypoints_list, bboxes, img_shape)
                if is_fighting:
                    detected_actions.add("打架")
                    fighting_persons = fight_persons
                    action_confidences["打架"] = 1.0

            # 离岗检测（画面中无人）
            if person_count == 0:
                detected_actions.add("离岗")
                action_confidences["离岗"] = 1.0

            # 人员聚集检测（需要至少2人）
            if person_count >= 2 and img_shape is not None:
                is_gathering, gather_count, gather_conf = self.detect_gathering(
                    keypoints_list, img_shape, new_gather_start_times
                )
                if is_gathering:
                    detected_actions.add("人员聚集")
                    action_confidences["人员聚集"] = gather_conf

        return DetectionResult(
            actions=list(detected_actions),
            person_count=person_count,
            fighting_persons=fighting_persons,
            prev_centers=new_prev_centers,
            last_move_times=new_last_move_times,
            action_confidences=action_confidences,
            gather_start_times=new_gather_start_times,
            prev_bboxes=new_prev_bboxes_list,
            fall_confirm_counts=new_fall_confirm_counts,
        )


# ===================== 数据保存模块 =====================
class DataSaver:
    """数据保存模块 - 批量写入优化"""

    ACTION_PRIORITY = ["打架", "跌倒", "离岗", "人员聚集"]       # 行为优先级

    def __init__(self, config: Config):
        self.config = config
        os.makedirs(os.path.dirname(config.RESULT_VIDEO_PATH), exist_ok=True)  # 创建视频目录
        os.makedirs(config.DATASET_DIR, exist_ok=True)                         # 创建数据集目录
        self._pending_detections = []                                         # 待写入的数据队列
        self._last_flush_time = time.time()                                   # 上次写入时间
        self._flush_interval = 5.0  # 每 5 秒批量写入一次

    def save_detection_data(self, actions: List[str], person_count: int, fps: float, frame_count: int,
                            camera_name: str = None, camera_id: str = None) -> str:
        """保存检测数据（始终写入，保证趋势图有数据），返回时间戳"""
        timestamp = Utils.generate_timestamp()

        detection_data = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),  # 时间戳
            "person_count": person_count,                    # 人数
            "actions": actions or [],                        # 检测到的行为
            "frame_count": frame_count,                      # 帧数
            "fps": fps,                                      # 帧率
            "image_filename": f"frame_{timestamp}.jpg" if actions else None,  # 图像文件名
            "camera_name": camera_name,                      # 摄像头名称
            "camera_id": camera_id                           # 摄像头ID
        }

        self._pending_detections.append((timestamp, detection_data))  # 添加到队列

        now = time.time()
        if now - self._last_flush_time >= self._flush_interval:
            self._flush()                                    # 达到时间间隔则批量写入

        return timestamp

    def _get_target_dir(self, actions: List[str]) -> str:
        """按 ACTION_PRIORITY 优先级确定目标子文件夹"""
        for action in self.ACTION_PRIORITY:
            if action in actions:
                target = os.path.join(self.config.DATASET_DIR, action)
                os.makedirs(target, exist_ok=True)
                return target
        return self.config.DATASET_DIR

    def _flush(self):
        """批量写入待处理的检测数据"""
        if not self._pending_detections:
            return

        for timestamp, data in self._pending_detections:
            try:
                target_dir = self._get_target_dir(data.get("actions", []))
                json_path = os.path.join(target_dir,
                                        f"detection_{timestamp}.json")
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            except OSError as e:
                print(f"保存检测数据失败: {e}")

        self._pending_detections.clear()                    # 清空队列
        self._last_flush_time = time.time()                 # 更新写入时间

    def save_frame_image(self, frame: np.ndarray, actions: List[str], timestamp: str) -> None:
        """保存帧图像（仅当检测到行为时）"""
        if actions and self.config.SAVE_IMAGE_ON_ACTION:
            try:
                target_dir = self._get_target_dir(actions)
                frame_path = os.path.join(target_dir, f"frame_{timestamp}.jpg")
                cv2.imwrite(frame_path, frame)
            except OSError as e:
                print(f"保存帧图像失败: {e}")

    def flush_remaining(self):
        """进程退出前刷新所有待写数据"""
        self._flush()


# ===================== 报警模块 =====================
class AlertManager:
    """报警管理模块"""

    def __init__(self, config: Config):
        self.config = config
        self.last_alert_time = 0.0                          # 上次报警时间（用于冷却）

    def check_and_trigger_alert(self, actions: List[str], frame: np.ndarray) -> Tuple[np.ndarray, bool]:
        """检查是否需要触发报警"""
        is_alarm = "跌倒" in actions or "打架" in actions     # 跌倒和打架需要报警
        alert_triggered = False

        if is_alarm:
            current_time = time.time()
            if current_time - self.last_alert_time > self.config.ALERT_COOLDOWN:
                # 触发报警（绘制报警横幅）
                frame = self._draw_alert_banner(frame)
                self.last_alert_time = current_time          # 更新报警时间
                alert_triggered = True
            else:
                # 仍在冷却期内，不触发新报警，但继续显示报警横幅
                frame = self._draw_alert_banner(frame)

        return frame, alert_triggered

    def _draw_alert_banner(self, img: np.ndarray) -> np.ndarray:
        """绘制报警横幅 — 使用批量文字渲染，避免重复颜色转换"""
        banner_height = self.config.BANNER_HEIGHT
        banner = np.full((banner_height, img.shape[1], 3), self.config.COLORS['danger'], dtype=np.uint8)  # 创建红色横幅背景

        alert_text = "⚠ 危险行为检测中 ⚠"
        text_size = 20
        text_width, _ = Utils.measure_text_size(alert_text, text_size)
        text_x = (img.shape[1] - text_width) // 2              # 居中对齐

        # 使用批量模式，只做一次 BGR→RGB→PIL→BGR 转换
        draw = Utils.begin_text_batch(banner)
        Utils.draw_text_cn_batch(draw, alert_text, (text_x, 5), text_size, (255, 255, 255))
        banner = Utils.end_text_batch(banner)
        return np.vstack((banner, img))                        # 横幅放在图像顶部


# ===================== UI模块 =====================
class UIManager:
    """UI绘制管理模块 - 负责绘制所有界面元素"""

    def __init__(self, config: Config):
        self.config = config

    def draw_header(self, img: np.ndarray, is_alarm: bool, draw=None) -> np.ndarray:
        """绘制顶部标题栏"""
        header_height = self.config.HEADER_HEIGHT
        header = np.full((header_height, img.shape[1], 3), self.config.COLORS['panel'], dtype=np.uint8)  # 标题栏背景

        # 绘制左侧标题
        header = Utils.draw_text_cn(header, "AI SECURITY SYSTEM", (20, 15), 24, self.config.COLORS['text'])

        live_color = self.config.COLORS['live_red'] if is_alarm else self.config.COLORS['live_green']  # 报警时红色，正常时绿色
        cv2.circle(header, (img.shape[1] - 120, 30), 8, live_color, -1)                               # 绘制圆形指示灯
        header = Utils.draw_text_cn(header, "LIVE", (img.shape[1] - 100, 15), 20, self.config.COLORS['text'])

        return np.vstack((header, img))                        # 标题栏放在图像顶部

    def draw_card(self, img: np.ndarray, title: str, content: List, pos: Tuple[int, int],
                  width: int, height: int) -> np.ndarray:
        """绘制卡片UI"""
        x, y = pos

        # 绘制卡片背景
        cv2.rectangle(img, (x, y), (x + width, y + height), self.config.COLORS['card_bg'], -1)

        # 绘制卡片边框
        cv2.rectangle(img, (x, y), (x + width, y + height), self.config.COLORS['card_border'], 2)

        # 绘制卡片标题
        img = Utils.draw_text_cn(img, title, (x + 10, y + 20), 18, self.config.COLORS['text'])

        # 绘制卡片内容（支持带颜色的文本）
        for i, line in enumerate(content):
            if isinstance(line, tuple):
                # 带颜色的文本
                text, color = line
                img = Utils.draw_text_cn(img, text, (x + 15, y + 50 + i * 30), 14, color)
            else:
                # 普通文本
                img = Utils.draw_text_cn(img, line, (x + 15, y + 50 + i * 30), 14, self.config.COLORS['text'])

        return img

    def draw_behavior_badge(self, img: np.ndarray, behavior: str, confidence: float, pos: Tuple[int, int]) -> Tuple[np.ndarray, int]:
        """绘制行为标签，显示置信度"""
        # 根据行为类型选择颜色
        if behavior == "跌倒":
            color = self.config.COLORS['danger']               # 红色
        elif behavior == "打架":
            color = self.config.COLORS['warning']              # 橙色
        elif behavior == "离岗":
            color = self.config.COLORS['leave']                # 紫色
        else:
            color = self.config.COLORS['normal']               # 绿色

        text = f"  {behavior} {confidence:.2f}  "
        text_width, _ = Utils.measure_text_size(text, 16)

        x, y = pos
        rect_height = 30
        cv2.rectangle(img, (x, y), (x + text_width + 10, y + rect_height), color, -1)  # 背景
        cv2.rectangle(img, (x, y), (x + text_width + 10, y + rect_height), (0, 0, 0), 1)  # 边框

        img = Utils.draw_text_cn(img, text, (x + 5, y + 5), 16, self.config.COLORS['bg'])
        return img, text_width + 20                            # 返回图片和标签宽度

    def draw_fps(self, img: np.ndarray, fps: float) -> np.ndarray:
        """绘制FPS卡片（右上角显示帧率）"""
        card_width = 120
        card_height = 40
        x = img.shape[1] - card_width - 10                     # 右上角位置
        y = 10

        # 绘制卡片背景和边框
        cv2.rectangle(img, (x, y), (x + card_width, y + card_height), self.config.COLORS['panel'], -1)
        cv2.rectangle(img, (x, y), (x + card_width, y + card_height), self.config.COLORS['card_border'], 1)

        # 绘制FPS文本
        fps_text = f"{fps:.1f} FPS"
        cv2.putText(img, fps_text, (x + 10, y + 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, self.config.COLORS['text'], 2)

        return img

    def draw_left_panel(self, img: np.ndarray, person_count: int, actions: List[str], logs: List[str], action_confidences: dict) -> np.ndarray:
        """绘制左侧状态面板 — 批量文字渲染，只做一次 PIL 转换"""
        panel_width = self.config.PANEL_WIDTH
        panel_height = img.shape[0]

        panel = np.full((panel_height, panel_width, 3), self.config.COLORS['panel'], dtype=np.uint8)  # 面板背景

        # 先用 OpenCV 画所有矩形（快，不需要 PIL）
        # 状态卡片背景
        cv2.rectangle(panel, (10, 50), (panel_width - 10, 170), self.config.COLORS['card_bg'], -1)
        cv2.rectangle(panel, (10, 50), (panel_width - 10, 170), self.config.COLORS['card_border'], 2)
        # 行为标签卡片背景
        cv2.rectangle(panel, (10, 180), (panel_width - 10, 330), self.config.COLORS['card_bg'], -1)
        cv2.rectangle(panel, (10, 180), (panel_width - 10, 330), self.config.COLORS['card_border'], 2)
        # 日志卡片背景
        cv2.rectangle(panel, (10, 340), (panel_width - 10, 590), self.config.COLORS['card_bg'], -1)
        cv2.rectangle(panel, (10, 340), (panel_width - 10, 590), self.config.COLORS['card_border'], 2)

        # 绘制行为标签矩形背景
        behavior_x = 20
        behavior_y = 230
        for action in actions:
            confidence = action_confidences.get(action, 0.0)
            color = self.config.COLORS.get('normal', (0, 255, 0))
            if action == "跌倒": color = self.config.COLORS['danger']
            elif action == "打架": color = self.config.COLORS['warning']
            elif action == "离岗": color = self.config.COLORS['leave']
            text = f"  {action} {confidence:.2f}  "
            tw, _ = Utils.measure_text_size(text, 16)
            cv2.rectangle(panel, (behavior_x, behavior_y), (behavior_x + tw + 10, behavior_y + 30), color, -1)
            cv2.rectangle(panel, (behavior_x, behavior_y), (behavior_x + tw + 10, behavior_y + 30), (0, 0, 0), 1)
            behavior_x += tw + 20
            if behavior_x > panel_width - 120:                 # 换行
                behavior_x = 20
                behavior_y += 40

        # === 批量文字渲染：一次 PIL 转换 ===
        draw = Utils.begin_text_batch(panel)

        # 面板标题
        Utils.draw_text_cn_batch(draw, "SYSTEM STATUS", (20, 20), 20, self.config.COLORS['text'])

        # 状态信息
        status = "正常"
        status_color = self.config.COLORS['normal']
        if "跌倒" in actions or "打架" in actions:
            status = "警告"
            status_color = self.config.COLORS['warning']
        Utils.draw_text_cn_batch(draw, "状态信息", (20, 70), 18, self.config.COLORS['text'])
        Utils.draw_text_cn_batch(draw, f"People: {person_count}", (25, 100), 14, self.config.COLORS['text'])
        Utils.draw_text_cn_batch(draw, f"状态: {status}", (25, 130), 14, status_color)

        # 行为标签文字
        Utils.draw_text_cn_batch(draw, "行为检测", (20, 200), 18, self.config.COLORS['text'])
        bx = 25
        by = 235
        for action in actions:
            confidence = action_confidences.get(action, 0.0)
            Utils.draw_text_cn_batch(draw, f"  {action} {confidence:.2f}  ", (bx + 5, by + 5), 16, self.config.COLORS['bg'])
            tw, _ = Utils.measure_text_size(f"  {action} {confidence:.2f}  ", 16)
            bx += tw + 20
            if bx > panel_width - 120:
                bx = 25
                by += 40

        # 日志文字（只显示最近5条）
        Utils.draw_text_cn_batch(draw, "最近日志", (20, 360), 18, self.config.COLORS['text'])
        log_y = 390
        for log in list(logs)[-5:]:
            Utils.draw_text_cn_batch(draw, log, (25, log_y - 5), 14, self.config.COLORS['text'])
            log_y += 30

        # 一次转换回 OpenCV
        panel = Utils.end_text_batch(panel)

        return np.hstack((panel, img))                         # 面板放在图像左侧

    def draw_exit_hint(self, img: np.ndarray) -> np.ndarray:
        """绘制退出提示（右下角）"""
        return Utils.draw_text_cn(
            img,
            "按 Enter 退出系统",
            (img.shape[1] - 250, img.shape[0] - 30),
            20,
            self.config.COLORS['text']
        )


# ===================== 主程序 =====================
class SecurityMonitor:
    """安防监控主程序 - 协调所有模块工作"""

    def __init__(self):
        self.config = Config()                                  # 创建配置对象

        # 从 Java API 加载摄像头配置，回退到本地 cameras.json
        self.config.SOURCES = load_cameras_config()
        self._go2rtc_available = self._check_go2rtc()
        if not self.config.SOURCES:
            print("未找到 cameras.json 或配置为空，回退到 USB 摄像头自动检测...")
            usb_cams = detect_cameras(max_index=5)
            self.config.SOURCES = [{"id": f"cam{i}", "type": "usb", "address": i, "name": f"USB摄像头{i}"} for i in usb_cams]

        # 初始化各个模块
        self.detection_module = DetectionModule(self.config)    # 行为检测模块
        self.data_saver = DataSaver(self.config)                # 数据保存模块
        self.alert_manager = AlertManager(self.config)          # 报警管理模块
        self.ui_manager = UIManager(self.config)                # UI绘制模块

        # 加载模型 — 优先使用 TensorRT 加速
        if self.config.USE_TENSORRT:
            # TensorRT 导出（首次慢，后续 2-5x 加速）
            engine_path = self.config.MODEL_PATH.replace('.pt', f'_trt_{self.config.IMG_SIZE}.engine')
            if os.path.exists(engine_path):
                print(f"加载 TensorRT engine: {engine_path}")
                self.model = YOLO(engine_path)
            else:
                print("首次运行：导出 TensorRT engine（约需 1-2 分钟）...")
                base_model = YOLO(self.config.MODEL_PATH)
                base_model.export(format='engine', imgsz=self.config.IMG_SIZE, half=True, device=self.config.DEVICE)
                self.model = YOLO(engine_path)
                print("TensorRT 导出完成 ✅")
        else:
            self.model = YOLO(self.config.MODEL_PATH)           # 直接加载PyTorch模型

        # GPU 预热 — 第一次推理最慢，提前跑掉
        print("GPU 预热中...")
        dummy = np.zeros((self.config.IMG_SIZE, self.config.IMG_SIZE, 3), dtype=np.uint8)  # 创建空白图像
        self.model(dummy, imgsz=self.config.IMG_SIZE, device=self.config.DEVICE,
                   half=self.config.HALF, verbose=False)
        print("GPU 预热完成 ✅")

        # 是否启用 web 视频流
        self.enable_web_stream = HAS_REQUESTS

        # 创建请求会话（连接复用，提高性能）
        self.session = requests.Session() if HAS_REQUESTS else None

        # 调整帧大小以减少传输数据量 - 16:9比例，适合观看
        self.web_stream_width = 960  # 发送到web的帧宽度
        self.web_stream_height = 540  # 发送到web的帧高度 (16:9)

        # 多摄像头线程控制
        self._stop_event = threading.Event()                    # 停止事件
        self._threads = []                                      # 线程列表

        # 异步帧发送线程池（不阻塞主循环）
        self._frame_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="frame_sender") if HAS_REQUESTS else None
        self._pending_frames = 0  # 待处理帧计数，防止队列无限增长
        self._frame_lock = threading.Lock()                     # 线程锁

    def _check_go2rtc(self):
        """检查 go2rtc 是否可用（用于RTSP摄像头拉流）"""
        go2rtc_api = os.environ.get("GO2RTC_API", "http://127.0.0.1:1984")
        if not HAS_REQUESTS:
            return False
        try:
            resp = requests.get(f"{go2rtc_api}/api", timeout=2)
            if resp.status_code == 200:
                print("go2rtc 可用")
                return True
        except Exception:
            pass
        print("go2rtc 不可用，RTSP 摄像头可能无法拉流")
        return False

    def _init_video_source(self, source=0):
        """初始化视频源（摄像头或视频文件）"""
        cap = None
        try:
            # Windows 上使用 DirectShow 后端，避免默认后端无法打开摄像头
            backend = cv2.CAP_DSHOW if hasattr(cv2, 'CAP_DSHOW') else cv2.CAP_ANY
            cap = cv2.VideoCapture(source, backend)
            if not cap.isOpened():
                print(f"视频源 {source} 打开失败")
                return True, None, 1280, 720

            # 设置摄像头参数（MJPG格式，1280x720分辨率，30fps）
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 30)

            # 获取实际的摄像头分辨率
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return False, cap, frame_width, frame_height
        except Exception as e:
            print(f"初始化视频源 {source} 时出错: {e}")
            return True, None, 1280, 720

    def _init_video_writer(self):
        """初始化视频写入器（保存检测结果视频）"""
        new_frame_width = self.frame_width + self.config.PANEL_WIDTH    # 加上左侧面板宽度
        new_frame_height = self.frame_height + self.config.HEADER_HEIGHT  # 加上顶部标题栏高度

        # 确保输出目录存在
        results_dir = os.path.dirname(self.config.RESULT_VIDEO_PATH)
        os.makedirs(results_dir, exist_ok=True)

        # 使用MP4兼容的编码器
        # type: ignore[attr-defined]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        # type: ignore[arg-type]
        out = cv2.VideoWriter(self.config.RESULT_VIDEO_PATH, fourcc, 30.0,
                               (new_frame_width, new_frame_height), isColor=True)

        # 检查视频写入器是否成功打开
        if not out.isOpened():
            print("警告：视频写入器初始化失败，将不会保存视频")
            out = None
        else:
            print(f"视频写入器初始化成功，输出路径: {self.config.RESULT_VIDEO_PATH}")
            print(f"视频尺寸: {new_frame_width}x{new_frame_height}")

        return out, (new_frame_width, new_frame_height)

    def send_frame_to_web(self, frame: np.ndarray, cam: str = "0") -> bool:
        """发送原始视频帧到 web 服务器 - 支持多摄像头"""
        if not self.enable_web_stream or self.session is None:
            return False

        try:
            # 调整帧大小以减少数据量（压缩到960x540）
            frame_resized = cv2.resize(frame, (self.web_stream_width, self.web_stream_height))

            # 压缩帧为 JPEG，使用较低质量以提高速度
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            _, img_encoded = cv2.imencode('.jpg', frame_resized, encode_params)

            # 使用连接池发送 POST 请求，附带摄像头ID
            response = self.session.post(
                f"{WEB_SERVER_URL}/api/update_frame",
                files={'frame': ('frame.jpg', img_encoded.tobytes(), 'image/jpeg')},
                data={'cam': cam},
                timeout=0.5
            )
            return response.status_code == 200
        except Exception:
            # 发送失败静默处理（不报错）
            return False

    def report_model_info(self):
        """向 Java 后端报告模型信息"""
        if not HAS_REQUESTS:
            return
        try:
            model_size = 0
            try:
                model_size = os.path.getsize(self.config.MODEL_PATH) / 1024 / 1024  # 转换为MB
            except OSError:
                pass
            info = {
                "precision": "FP16" if Config.HALF else "FP32",   # 精度
                "device": Config.DEVICE,                           # 设备
                "model_size_mb": round(model_size, 1),            # 模型大小
                "total_layers": 0,                                # 总层数
                "conv_layers": 0,                                 # 卷积层数
                "quantized_layers": 0,                            # 量化层数
                "gpu_available": Config.DEVICE == "cuda",         # 是否有GPU
                "half_precision": Config.HALF                     # 是否半精度
            }
            requests.post(
                f"{WEB_SERVER_URL}/api/model_info",
                json=info,
                timeout=2
            )
        except Exception:
            pass  # 静默失败（不报错）

    def run(self):
        """主运行循环 - 多摄像头模式"""
        sources = self.config.SOURCES
        if not sources:
            print("没有可用的摄像头，退出。")
            return

        print(f"\n系统启动，共 {len(sources)} 个摄像头: {sources}")
        print("按 Enter 退出系统\n")
        if self.enable_web_stream:
            print(f"视频流将发送到: {WEB_SERVER_URL}")

        # 启动时报告模型信息给后端
        self.report_model_info()

        # 为每个摄像头启动独立线程（并发处理）
        self._threads = []
        for cam_config in sources:
            t = threading.Thread(target=self._run_camera_thread, args=(cam_config,), daemon=True)
            t.start()
            self._threads.append(t)

        # 主线程等待退出信号
        try:
            while not self._stop_event.is_set():
                time.sleep(0.5)                                # 轮询间隔
        except KeyboardInterrupt:
            print("\n收到中断信号，正在停止...")
            self._stop_event.set()

        # 等待所有线程结束（最多等待3秒）
        for t in self._threads:
            t.join(timeout=3)

        cv2.destroyAllWindows()                                # 关闭所有窗口
        print("系统已退出")

    def _get_frame_from_cap(self, cap, use_static, test_image):
        """从视频捕获对象获取视频帧"""
        if use_static:
            return test_image.copy(), use_static               # 返回静态图像
        try:
            ret, frame = cap.read()                           # 读取一帧
            if not ret:
                print("无法获取视频帧，切换到静态图像模式...")
                return test_image.copy(), True
            return frame, False
        except Exception as e:
            print(f"读取视频帧时出错: {e}")
            return test_image.copy(), True

    def _fetch_http_snapshot(self, url, session):
        """通过 HTTP 获取单帧快照，返回 (frame, success)"""
        try:
            resp = session.get(url, timeout=5)
            if resp.status_code == 200 and len(resp.content) > 100:
                img_array = np.frombuffer(resp.content, dtype=np.uint8)
                frame = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                if frame is not None:
                    return frame, True
        except Exception:
            pass
        return None, False

    def _run_camera_thread(self, cam_config):
        """单个摄像头的检测循环（在线程中运行）"""
        cam_str = cam_config["id"]
        source = cam_config["address"]
        cam_name = cam_config["name"]
        cam_type = cam_config["type"]
        print(f"[{cam_name}] 线程启动，类型: {cam_type}，地址: {source}")

        # HTTP 快照模式：不使用 cv2.VideoCapture
        if cam_type == "http_snapshot":
            snapshot_url = source
            user = cam_config.get("user", "admin")
            password = cam_config.get("password", "")
            http_session = requests.Session()
            http_session.auth = (user, password)
            # 试取一帧验证连接
            test_frame, ok = self._fetch_http_snapshot(snapshot_url, http_session)
            if ok:
                frame_height, frame_width = test_frame.shape[:2]
                print(f"[{cam_name}] HTTP 快照连接成功，分辨率: {frame_width}x{frame_height}")
            else:
                print(f"[{cam_name}] HTTP 快照连接失败，跳过该摄像头: {snapshot_url}")
                return
            cap = None
            use_static = False
            test_image = np.zeros((frame_height, frame_width, 3), dtype=np.uint8)
        else:
            # USB / RTSP 模式（使用OpenCV的VideoCapture）
            print(f"[{cam_name}] 正在初始化视频源 {source}...", flush=True)
            use_static, cap, frame_width, frame_height = self._init_video_source(source)
            print(f"[{cam_name}] 初始化完成: use_static={use_static}, cap={cap is not None}, {frame_width}x{frame_height}", flush=True)
            if use_static:
                print(f"[{cam_name}] 摄像头连接失败，跳过该摄像头", flush=True)
                return

        if use_static:
            test_image = np.zeros((720, 1280, 3), dtype=np.uint8)
            cv2.putText(test_image, f"{cam_name}", (400, 360), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        else:
            test_image = np.zeros((720, 1280, 3), dtype=np.uint8)

        # 每个摄像头独立的请求会话
        session = requests.Session() if HAS_REQUESTS else None

        # 状态变量（用于跟踪人员）
        prev_centers = []                                     # 上一帧的人体中心位置
        last_move_times = []                                  # 上次移动时间
        gather_start_times = {}                               # 聚集开始时间
        prev_bboxes = []                                      # 上一帧的边界框
        fall_confirm_counts = []                              # 跌倒确认计数
        logs = deque(maxlen=20)                               # 日志队列（最多20条）
        prev_actions = []                                     # 上一帧的行为
        frame_count = 0                                       # 帧计数器
        start_time = time.time()                              # 开始时间
        last_model_info_time = time.time()                    # 上次报告模型信息时间

        # 跳帧推理 — 缓存上一次推理结果（提高帧率）
        cached_results = None
        cached_actions = []
        cached_person_num = 0
        cached_fighting_persons = []
        cached_action_confidences = {}
        inference_every = max(1, self.config.INFERENCE_EVERY)

        # 窗口名（每个摄像头独立窗口）
        window_name = f"Camera {cam_str}"

        try:
            print(f"[{cam_name}] 进入主循环, cap={cap is not None}, use_static={use_static}", flush=True)
            while not self._stop_event.is_set():
                # 1. 读取帧（根据摄像头类型选择读取方式）
                if cam_type == "http_snapshot" and not use_static:
                    frame, ok = self._fetch_http_snapshot(snapshot_url, http_session)
                    if not ok:
                        print(f"[{cam_name}] HTTP 快照获取失败，切换到静态图像模式")
                        use_static = True
                        frame = test_image.copy()
                else:
                    frame, use_static = self._get_frame_from_cap(cap, use_static, test_image)
                    if use_static and cap is not None:
                        cap.release()                         # 释放视频捕获对象
                        cap = None
                frame_count += 1

                # 2. 模型推理（跳帧：每 inference_every 帧推理一次）
                if frame_count % inference_every == 1 or cached_results is None:
                    results = self.model(
                        frame,
                        imgsz=self.config.IMG_SIZE,
                        conf=self.config.CONF_THRESH,
                        device=self.config.DEVICE,
                        half=self.config.HALF,
                        batch=False
                    )

                    # 3. 检测行为（跌倒、打架、聚集、离岗）
                    det = self.detection_module.detect_security_actions(
                        results, prev_centers, last_move_times, gather_start_times,
                        prev_bboxes, fall_confirm_counts
                    )
                    actions = det.actions
                    person_num = det.person_count
                    fighting_persons = det.fighting_persons
                    prev_centers = det.prev_centers
                    last_move_times = det.last_move_times
                    action_confidences = det.action_confidences
                    gather_start_times = det.gather_start_times
                    prev_bboxes = det.prev_bboxes
                    fall_confirm_counts = det.fall_confirm_counts

                    # 缓存结果（用于跳帧复用）
                    cached_results = results
                    cached_actions = actions
                    cached_person_num = person_num
                    cached_fighting_persons = fighting_persons
                    cached_action_confidences = action_confidences
                else:
                    # 复用缓存结果（跳过推理，直接使用上一次结果）
                    results = cached_results
                    actions = cached_actions
                    person_num = cached_person_num
                    fighting_persons = cached_fighting_persons
                    action_confidences = cached_action_confidences

                # 4. 可视化关键点（绘制骨架）
                frame_out = results[0].plot() if results and len(results) > 0 else frame.copy()

                # 5. 框选打架人员（红色框）
                if "打架" in actions and results and len(results) > 0:
                    self._draw_fighting_persons(results[0], fighting_persons, frame_out)

                # 7. 绘制人员聚集框（黄色框）
                if "人员聚集" in actions and results and len(results) > 0:
                    all_kp = []
                    for r in results:
                        if r.keypoints is not None:
                            for kp in r.keypoints.data:
                                all_kp.append(kp.cpu().numpy() if hasattr(kp, 'cpu') else kp)
                    if len(all_kp) >= self.config.GATHER_THRESHOLD:
                        self._draw_gathering_persons(results[0], all_kp, frame_out)

                # 8. 发送帧到 web（异步，不阻塞主循环，队列上限3帧）
                if frame_count % SEND_FRAME_INTERVAL == 0 and session is not None and self._frame_executor is not None:
                    with self._frame_lock:
                        can_submit = self._pending_frames < 3      # 限制队列大小
                        if can_submit:
                            self._pending_frames += 1
                    if can_submit:
                        future = self._frame_executor.submit(self._send_frame_session, frame.copy(), cam_str, session, person_num)
                        future.add_done_callback(lambda _: self._release_frame_slot())

                # 9. 日志（记录新检测到的行为）
                current_time_str = time.strftime("%H:%M:%S")
                for action in actions:
                    if action not in prev_actions:
                        log_entry = f"[{current_time_str}] [CAM-{cam_str}] {action}"
                        logs.append(log_entry)
                prev_actions = actions.copy()

                # 10. 计算FPS（帧率）
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                # 11. 每60秒报告模型信息（仅摄像头0负责，避免重复）
                now = time.time()
                if cam_str == "0" and now - last_model_info_time > 60:
                    self.report_model_info()
                    last_model_info_time = now

                # 11b. 每5秒上报GPU使用率（仅摄像头0负责）
                if cam_str == "0" and frame_count % (max(1, int(fps)) * 5) == 0:
                    report_gpu_status()

                # 12. 绘制UI（标题栏、报警横幅、左侧面板、FPS等）
                is_alarm = "跌倒" in actions or "打架" in actions
                frame_out = self._draw_ui(frame_out, is_alarm, actions, logs, action_confidences, person_num, fps)

                # 13. 显示（仅在前台终端模式时显示GUI窗口）
                show_gui = os.isatty(0)
                if show_gui:
                    cv2.imshow(window_name, frame_out)

                # 14. 保存检测数据（仅第一个摄像头负责，避免重复保存）
                if cam_str == self.config.SOURCES[0]["id"] and frame_count % self.config.SAVE_INTERVAL == 0:
                    timestamp = self.data_saver.save_detection_data(actions, person_num, fps, frame_count,
                                                                     camera_name=cam_name, camera_id=cam_str)
                    if actions:
                        self.data_saver.save_frame_image(frame, actions, timestamp)

                # 15. 检查退出（仅在前台终端模式时）
                if show_gui:
                    key = cv2.waitKey(1) & 0xFF
                    if key == 13:                                 # Enter键退出
                        print(f"[摄像头 {cam_str}] 收到退出信号，停止所有摄像头...")
                        self._stop_event.set()
                        break

        except Exception as e:
            print(f"[摄像头 {cam_str}] 线程异常: {e}")
        finally:
            if cap is not None:
                cap.release()                                     # 释放视频捕获对象
            if session is not None:
                session.close()                                   # 关闭请求会话
            print(f"[摄像头 {cam_str}] 线程结束")

    def _release_frame_slot(self):
        """释放帧发送槽位（线程安全）"""
        with self._frame_lock:
            self._pending_frames = max(0, self._pending_frames - 1)

    def _send_frame_session(self, frame, cam, session, person_count=0):
        """使用指定会话发送帧到web服务器（支持 GPU resize）"""
        try:
            if HAS_CV2_CUDA:
                # GPU 加速 resize（更快）
                gpu_frame = cv2.cuda_GpuMat()
                gpu_frame.upload(frame)
                gpu_resized = cv2.cuda.resize(gpu_frame, (self.web_stream_width, self.web_stream_height))
                frame_resized = gpu_resized.download()
            else:
                frame_resized = cv2.resize(frame, (self.web_stream_width, self.web_stream_height))
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
            _, img_encoded = cv2.imencode('.jpg', frame_resized, encode_params)
            session.post(
                f"{WEB_SERVER_URL}/api/update_frame",
                files={'frame': ('frame.jpg', img_encoded.tobytes(), 'image/jpeg')},
                data={'cam': cam, 'person_count': str(person_count)},
                timeout=0.5
            )
        except Exception:
            pass                                                  # 静默失败

    def _draw_fighting_persons(self, result, fighting_persons, frame_out):
        """框选打架人员（红色边框）"""
        try:
            if result.boxes is not None:
                for i in fighting_persons:
                    if i < len(result.boxes):
                        bbox = result.boxes[i].xyxy[0].cpu().numpy() if hasattr(result.boxes[i].xyxy[0], 'cpu') else result.boxes[i].xyxy[0]
                        x1, y1, x2, y2 = map(int, bbox)
                        # 绘制红色边框（3像素宽）
                        cv2.rectangle(frame_out, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        # 绘制"打架"标签
                        cv2.putText(frame_out, "打架", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        except Exception as e:
            print(f"框选打架人员失败: {e}")

    def _draw_gathering_persons(self, result, keypoints_list, frame_out):
        """用黄色框选聚集人员"""
        try:
            n = len(keypoints_list)
            if n < self.config.GATHER_THRESHOLD:
                return
            h, w = frame_out.shape[:2]
            max_dim = max(w, h)
            # 找聚集簇（聚类算法）
            clusters = []
            used = [False] * n
            for i in range(n):
                if used[i]:
                    continue
                center_i = Utils.get_body_center(keypoints_list[i])
                if center_i is None:
                    continue
                cluster = [i]
                used[i] = True
                for j in range(i + 1, n):
                    if used[j]:
                        continue
                    center_j = Utils.get_body_center(keypoints_list[j])
                    if center_j is None:
                        continue
                    dist = Utils.calculate_distance(center_i, center_j) / max_dim
                    if dist < self.config.GATHER_RADIUS:
                        cluster.append(j)
                        used[j] = True
                clusters.append(cluster)
            best = max(clusters, key=len) if clusters else []      # 找人数最多的簇
            if len(best) < self.config.GATHER_THRESHOLD:
                return
            # 取最外圈（计算边界框）
            xs = [Utils.get_body_center(keypoints_list[i])[0] * w for i in best]
            ys = [Utils.get_body_center(keypoints_list[i])[1] * h for i in best]
            if not xs:
                return
            min_x, max_x = int(min(xs)), int(max(xs))
            min_y, max_y = int(min(ys)), int(max(ys))
            pad = 20                                              # 边框padding
            cv2.rectangle(frame_out, (min_x - pad, min_y - pad), (max_x + pad, max_y + pad),
                         (0, 255, 255), 3)                       # 黄色边框
            label = f"人员聚集 {len(best)}人"
            cv2.putText(frame_out, label, (min_x - pad, min_y - pad - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        except Exception as e:
            print(f"绘制聚集人员失败: {e}")

    def _draw_ui(self, frame_out, is_alarm, actions, logs, action_confidences, person_num, fps):
        """绘制UI — 优化：批量文字渲染"""
        # 标题栏（独立区域，单独处理）
        frame_out = self.ui_manager.draw_header(frame_out, is_alarm)

        # 报警横幅（如果有跌倒或打架）
        frame_out, _ = self.alert_manager.check_and_trigger_alert(actions, frame_out)

        # FPS 卡片背景（OpenCV 画矩形，快）
        card_w, card_h = 120, 40
        fx = frame_out.shape[1] - card_w - 10
        cv2.rectangle(frame_out, (fx, 10), (fx + card_w, 50), self.config.COLORS['panel'], -1)
        cv2.rectangle(frame_out, (fx, 10), (fx + card_w, 50), self.config.COLORS['card_border'], 1)

        # 左侧面板（内部已批量渲染）
        frame_out = self.ui_manager.draw_left_panel(frame_out, person_num, actions, logs, action_confidences)

        # === 主帧剩余文字批量渲染 ===
        draw = Utils.begin_text_batch(frame_out)
        # FPS 文字
        Utils.draw_text_cn_batch(draw, f"{fps:.1f} FPS", (fx + 10, 35), 20, self.config.COLORS['text'])
        # 退出提示
        Utils.draw_text_cn_batch(draw, "按 Enter 退出系统",
                                  (frame_out.shape[1] - 250, frame_out.shape[0] - 30), 20, self.config.COLORS['text'])
        frame_out = Utils.end_text_batch(frame_out)

        return frame_out


# ===================== 程序入口 =====================
if __name__ == "__main__":
    monitor = SecurityMonitor()                                  # 创建安防监控对象
    monitor.run()                                                # 启动监控
    suicide_score = 0.0
        if person_id in prev_states:
            stay_time = prev_states[person_id].get("stay_time", 3)
            if stay_time > self.config.SUICIDE_STAY_FRAMES:
                suicide_score += 0.4                              
        if face_state > self.config.SUICIDE_FACE_STATE:
            suicide_score += 0.3                                  
        valid_kp = keypoints[keypoints[:, 2] > self.config.FALL_MIN_KP_CONF]
        if len(valid_kp) >= 4:
            hip_y = (keypoints[11][1] + keypoints[12][1]) / 2     
            min_y = valid_kp[:, 1].min()                           
            max_y = valid_kp[:, 1].max()                           
            height = max_y - min_y
            
            if height > 0:
                hip_off_ground = (max_y - hip_y) / height
                body_center_y = (min_y + max_y) / 2
                height_offset = body_center_y > 0.5                
                
                if height_offset and hip_off_ground > self.config.SUICIDE_HIP_OFF_GROUND:
                    suicide_score += 0.75                         
        is_extreme_abnormal = suicide_score >= self.config.SUICIDE_SCORE_THRESHOLD
        return is_extreme_abnormal, suicide_score