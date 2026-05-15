# 依赖：
# ultralytics
# opencv-python
# numpy
# pillow

# 导入必要的库
import os
import threading
from collections import deque
from itertools import combinations
from concurrent.futures import ThreadPoolExecutor

# 直接导入，减少不必要的检查
from ultralytics import YOLO
import cv2
import time
import numpy as np
import json
import torch
from typing import List, Tuple, Optional
from dataclasses import dataclass, field
from PIL import ImageFont, ImageDraw, Image

# 快速忽略警告，不进行复杂配置
import warnings

warnings.filterwarnings("ignore")

# ===================== 设备检测 =====================
_USE_GPU = os.environ.get("YOLOV8_DEVICE", "cpu").lower() == "cuda"

print("\n" + "=" * 60)
print("PyTorch 版本:", torch.__version__)
print("CUDA 可用:", torch.cuda.is_available())

if _USE_GPU and torch.cuda.is_available():
    print("使用设备: 👉 GPU -", torch.cuda.get_device_name(0))
    print("GPU 显存:", round(torch.cuda.get_device_properties(0).total_memory / 1024 / 1024 / 1024, 1), "GB")
    torch.backends.cudnn.benchmark = True
    torch.backends.cudnn.enabled = True
    print("cuDNN benchmark: ✅ 已启用")
else:
    print("使用设备: 👉 CPU 模式")

# OpenCV CUDA 检测
HAS_CV2_CUDA = False
try:
    HAS_CV2_CUDA = cv2.cuda.getCudaEnabledDeviceCount() > 0
except Exception:
    pass

if HAS_CV2_CUDA:
    print("OpenCV CUDA: ✅ 可用")
else:
    print("OpenCV CUDA: ❌ 不可用 (resize 走 CPU)")
print("=" * 60 + "\n")
# =====================
# ==================================

# 尝试导入 requests，用于发送视频帧到 web 服务器
try:
    import requests

    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("警告: 未安装 requests 库，无法发送视频流到 web 面板")

# GPU 使用率上报
try:
    import pynvml
    pynvml.nvmlInit()
    _GPU_AVAILABLE = True
except Exception:
    _GPU_AVAILABLE = False

# Web 服务器配置
WEB_SERVER_URL = os.environ.get("WEB_SERVER_URL", "http://127.0.0.1:5000")
SEND_FRAME_INTERVAL = 1  # 每1帧发送一次（实时）
JPEG_QUALITY = 50  # 降低JPEG质量以减少传输时间（极致性能）


# ===================== 配置区 =====================
class Config:
    """系统配置类，集中管理所有参数"""
    # 路径配置 - 简化，直接使用固定路径结构
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
    MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "yolov8n-pose.pt")
    # 多摄像头支持 - 启动时自动检测可用摄像头
    SOURCES = []  # 启动时由 detect_cameras() 填充
    RESULT_VIDEO_PATH = os.path.join(PROJECT_ROOT, "results", "security_result.mp4")
    DATASET_DIR = os.path.join(PROJECT_ROOT, "server", "data")

    # 模型参数
    IMG_SIZE = 512
    CONF_THRESH = 0.5
    # 设备选择: 通过环境变量 YOLOV8_DEVICE=cuda 启用 GPU，默认 CPU
    DEVICE = "cuda" if os.environ.get("YOLOV8_DEVICE", "cpu").lower() == "cuda" else "cpu"
    HALF = DEVICE == "cuda"  # CPU 不支持 FP16
    # TensorRT 加速（首次运行会导出 engine 文件，后续直接加载，2-5x 加速）
    USE_TENSORRT = False  # 设为 True 启用 TensorRT（需要安装 tensorrt）

    # 检测参数
    FIGHTING_THRESHOLD = 0.3
    # 推理跳帧 — 每N帧推理一次，中间帧复用结果（2=每2帧推理1次，推理开销减半）
    INFERENCE_EVERY = 2
    # 跌倒检测时序平滑
    FALL_CONFIRM_FRAMES = 2  # 连续N帧确认跌倒才触发
    # 跌倒检测细粒度阈值（从 thresholds.json 加载，默认值见 _load_thresholds）
    FALL_SCORE_THRESHOLD = 0.5
    FALL_MIN_KP_CONF = 0.5
    FALL_MIN_VALID_KP = 5
    FALL_ASPECT_RATIO_HIGH = 0.7
    FALL_ASPECT_RATIO_LOW = 0.55
    FALL_HEAD_HIP_RATIO = -0.05
    FALL_KNEE_ANGLE_BEND = 60
    FALL_KNEE_ANGLE_STRAIGHT = 170
    FALL_VERTICALITY_RATIO = 0.25
    FALL_HIP_ANKLE_DIFF = 0.03
    FALL_TRUNK_ANGLE = 40
    FALL_HEAD_GROUND_RATIO = 0.65
    FALL_MIN_FEATURES = 2
    # 打架检测细粒度阈值
    FIGHT_TRUNK_DISTANCE = 0.15
    FIGHT_BBOX_OVERLAP = 0.1
    FIGHT_ARM_ELBOW_OFFSET = 0.05
    FIGHT_ARM_WRIST_OFFSET = 0.1
    # 人员聚集参数（讲稿要求：阈值3人、聚集半径<1.5m、持续≥3s）
    GATHER_THRESHOLD = 3        # 聚集人数阈值
    GATHER_RADIUS = 0.08       # 归一化聚集半径（约占画面8%，实际按像素换算）
    GATHER_DURATION = 3.0       # 聚集持续秒数
    GATHER_CONF_DIVISOR = 8.0   # 聚集置信度归一化除数
    # 跨帧追踪
    TRACKING_IOU_THRESHOLD = 0.3

    # 报警参数
    ALERT_COOLDOWN = 5.0

    # 数据保存参数
    SAVE_INTERVAL = 5
    SAVE_IMAGE_ON_ACTION = True

    # UI参数
    PANEL_WIDTH = 300
    HEADER_HEIGHT = 60
    BANNER_HEIGHT = 40

    # 颜色配置 - 直接定义，减少注释
    COLORS = {
        'bg': (30, 30, 30),
        'panel': (45, 45, 45),
        'text': (220, 220, 220),
        'normal': (0, 255, 0),
        'warning': (0, 165, 255),
        'danger': (0, 0, 255),
        'leave': (150, 150, 150),
        'live_green': (0, 255, 0),
        'live_red': (0, 0, 255),
        'card_bg': (50, 50, 50),
        'card_border': (60, 60, 60)
    }

    def __init__(self):
        self._load_thresholds()

    def _load_thresholds(self):
        """从 thresholds.json 加载阈值，缺失字段保留默认值"""
        config_path = os.path.join(self.SCRIPT_DIR, "thresholds.json")
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return

        m = data.get("model", {})
        self.IMG_SIZE = m.get("img_size", self.IMG_SIZE)
        self.CONF_THRESH = m.get("conf_thresh", self.CONF_THRESH)
        self.INFERENCE_EVERY = m.get("inference_every", self.INFERENCE_EVERY)

        f = data.get("fall", {})
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

        fi = data.get("fight", {})
        self.FIGHTING_THRESHOLD = fi.get("threshold", self.FIGHTING_THRESHOLD)
        self.FIGHT_TRUNK_DISTANCE = fi.get("trunk_distance", 0.15)
        self.FIGHT_BBOX_OVERLAP = fi.get("bbox_overlap", 0.1)
        self.FIGHT_ARM_ELBOW_OFFSET = fi.get("arm_elbow_offset", 0.05)
        self.FIGHT_ARM_WRIST_OFFSET = fi.get("arm_wrist_offset", 0.1)

        g = data.get("gathering", {})
        self.GATHER_THRESHOLD = g.get("threshold", self.GATHER_THRESHOLD)
        self.GATHER_RADIUS = g.get("radius", self.GATHER_RADIUS)
        self.GATHER_DURATION = g.get("duration", self.GATHER_DURATION)
        self.GATHER_CONF_DIVISOR = g.get("confidence_divisor", 8.0)

        t = data.get("tracking", {})
        self.TRACKING_IOU_THRESHOLD = t.get("iou_threshold", 0.3)

        a = data.get("alert", {})
        self.ALERT_COOLDOWN = a.get("cooldown", self.ALERT_COOLDOWN)


# ===================== GPU 上报 =====================
_gpu_session = requests.Session() if HAS_REQUESTS else None

def report_gpu_status():
    """上报 GPU 使用率到 Java 后端"""
    if not _GPU_AVAILABLE or not _gpu_session:
        return
    try:
        handle = pynvml.nvmlDeviceGetHandle(0)
        gpu_percent = pynvml.nvmlDeviceGetUtilizationRates(handle).gpu
        memory_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        gpu_name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(gpu_name, bytes):
            gpu_name = gpu_name.decode('utf-8')
        _gpu_session.post(
            f"{WEB_SERVER_URL}/api/gpu_status",
            json={
                "gpuPercent": gpu_percent,
                "gpuMemoryMb": memory_info.used // (1024 * 1024),
                "gpuName": gpu_name
            },
            timeout=1.0
        )
    except Exception:
        pass


# ===================== 摄像头自动检测 =====================
def detect_cameras(max_index=5):
    """扫描USB设备索引0~max_index，返回可用摄像头列表"""
    available = []
    print("正在扫描可用摄像头...")
    # Windows 上使用 DirectShow 后端，避免默认后端无法枚举设备
    backend = cv2.CAP_DSHOW if hasattr(cv2, 'CAP_DSHOW') else cv2.CAP_ANY
    for i in range(max_index + 1):
        cap = cv2.VideoCapture(i, backend)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append(i)
                print(f"  ✓ 摄像头 {i} 可用")
            cap.release()
        else:
            cap.release()
    if not available:
        print("  ✗ 未检测到任何摄像头")
    else:
        print(f"共检测到 {len(available)} 个摄像头: {available}")
    return available


def load_cameras_config(config_path=None):
    """从 cameras.json 加载摄像头配置。

    Returns:
        list[dict]: 摄像头列表，每个元素包含 id, type, address, name。
                    如果文件不存在或解析失败，返回空列表。
    """
    if config_path is None:
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cameras.json")

    if not os.path.exists(config_path):
        return []

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"警告: 读取 cameras.json 失败: {e}")
        return []

    cameras = data.get("cameras", [])
    valid = []
    for cam in cameras:
        if not isinstance(cam, dict):
            continue
        if "type" not in cam or "address" not in cam:
            print(f"警告: 跳过无效摄像头配置（缺少 type 或 address）: {cam}")
            continue
        # 跳过RTSP — 由Java MJPEG代理处理，Python只管USB
        if cam.get("type") == "rtsp":
            continue
        # 确保有 id 和 name 默认值
        cam.setdefault("id", f"cam{len(valid)}")
        cam.setdefault("name", str(cam["address"]))
        valid.append(cam)

    return valid


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
        """Get or create a cached font for the given size (thread-safe)"""
        if size not in Utils._FONT_CACHE:
            with Utils._cache_lock:
                if size not in Utils._FONT_CACHE:
                    font_path = Utils._get_available_font_path()
                    if font_path is None:
                        Utils._FONT_CACHE[size] = ImageFont.load_default()
                    else:
                        try:
                            Utils._FONT_CACHE[size] = ImageFont.truetype(font_path, size, encoding="utf-8")
                        except (OSError, IOError):
                            Utils._FONT_CACHE[size] = ImageFont.load_default()
        return Utils._FONT_CACHE[size]

    # 批量文字渲染缓冲区（线程安全）
    _tls = threading.local()

    @classmethod
    def begin_text_batch(cls, img: np.ndarray) -> ImageDraw.Draw:
        """开始批量文字渲染 — 只做一次 BGR→RGB→PIL 转换"""
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        cls._tls._pil_buffer = Image.fromarray(img_rgb)
        return ImageDraw.Draw(cls._tls._pil_buffer)

    @classmethod
    def end_text_batch(cls, img: np.ndarray) -> np.ndarray:
        """结束批量文字渲染 — 只做一次 PIL→RGB→BGR 转换"""
        buf = getattr(cls._tls, '_pil_buffer', None)
        if buf is None:
            return img
        result = cv2.cvtColor(np.array(buf), cv2.COLOR_RGB2BGR)
        cls._tls._pil_buffer = None
        return result

    @staticmethod
    def draw_text_cn_batch(draw: ImageDraw.Draw, text: str, pos: Tuple[int, int],
                           size: int = 30, color: Tuple[int, int, int] = (255, 255, 255)) -> None:
        """批量模式绘制文字 — 不做颜色转换，直接画在 PIL buffer 上"""
        font = Utils._get_cached_font(size)
        draw.text(pos, text, font=font, fill=color)

    @staticmethod
    def draw_text_cn(img: np.ndarray, text: str, pos: Tuple[int, int],
                     size: int = 30, color: Tuple[int, int, int] = (255, 255, 255)) -> np.ndarray:
        """绘制中文文本（单次调用兼容模式）"""
        try:
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)
            draw = ImageDraw.Draw(img_pil)
            font = Utils._get_cached_font(size)
            draw.text(pos, text, font=font, fill=color)
            img_bgr = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
            return img_bgr
        except (OSError, IOError, ValueError) as e:
            print(f"中文绘制失败: {e}")
            return img

    @staticmethod
    def calculate_distance(p1: np.ndarray, p2: np.ndarray) -> float:
        """计算两个关键点之间的欧氏距离"""
        dx = float(p1[0]) - float(p2[0])
        dy = float(p1[1]) - float(p2[1])
        return np.sqrt(dx * dx + dy * dy)

    @staticmethod
    def calculate_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
        """计算三个点形成的夹角（p2为顶点）"""
        # 转换为向量
        v1 = np.array([float(p1[0]) - float(p2[0]), float(p1[1]) - float(p2[1])])
        v2 = np.array([float(p3[0]) - float(p2[0]), float(p3[1]) - float(p2[1])])

        # 计算夹角余弦值
        norm_v1 = np.linalg.norm(v1)
        norm_v2 = np.linalg.norm(v2)
        if norm_v1 == 0 or norm_v2 == 0:
            return 0.0

        cos_angle = np.dot(v1, v2) / (norm_v1 * norm_v2)
        return np.arccos(np.clip(cos_angle, -1.0, 1.0)) * 180 / np.pi

    @staticmethod
    def get_body_center(keypoints: np.ndarray) -> Optional[np.ndarray]:
        """获取人体躯干中心（胸部位置）"""
        if len(keypoints) >= 13:
            # 基于胸部/肩部关键点计算中心
            return np.mean(keypoints[[5, 6, 11, 12], :2], axis=0)
        return None

    @staticmethod
    def calculate_overlap(bbox1: List[float], bbox2: List[float], img_shape: Tuple[int, int]) -> float:
        """计算两个人体框的重叠度"""
        # 转换为像素坐标
        h, w = img_shape[:2]
        bbox1_pixel = [bbox1[0] * w, bbox1[1] * h, bbox1[2] * w, bbox1[3] * h]
        bbox2_pixel = [bbox2[0] * w, bbox2[1] * h, bbox2[2] * w, bbox2[3] * h]

        # 计算交集
        x1 = max(bbox1_pixel[0], bbox2_pixel[0])
        y1 = max(bbox1_pixel[1], bbox2_pixel[1])
        x2 = min(bbox1_pixel[2], bbox2_pixel[2])
        y2 = min(bbox1_pixel[3], bbox2_pixel[3])

        if x2 < x1 or y2 < y1:
            return 0.0

        # 计算交集面积
        intersection = (x2 - x1) * (y2 - y1)
        # 计算并集面积
        area1 = (bbox1_pixel[2] - bbox1_pixel[0]) * (bbox1_pixel[3] - bbox1_pixel[1])
        area2 = (bbox2_pixel[2] - bbox2_pixel[0]) * (bbox2_pixel[3] - bbox2_pixel[1])
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

    @staticmethod
    def calculate_iou(bbox1, bbox2) -> float:
        """计算两个归一化 [x1,y1,x2,y2] 框的 IoU（无需 img_shape）"""
        x1 = max(float(bbox1[0]), float(bbox2[0]))
        y1 = max(float(bbox1[1]), float(bbox2[1]))
        x2 = min(float(bbox1[2]), float(bbox2[2]))
        y2 = min(float(bbox1[3]), float(bbox2[3]))
        inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        area1 = (float(bbox1[2]) - float(bbox1[0])) * (float(bbox1[3]) - float(bbox1[1]))
        area2 = (float(bbox2[2]) - float(bbox2[0])) * (float(bbox2[3]) - float(bbox2[1]))
        union = area1 + area2 - inter
        return inter / union if union > 0 else 0.0

    @staticmethod
    def generate_timestamp() -> str:
        """生成带毫秒的时间戳"""
        ms = int(time.time() * 1000) % 1000
        return f"{time.strftime('%Y%m%d_%H%M%S')}_{ms:03d}"

    _scratch_img = None
    _scratch_draw = None

    @staticmethod
    def measure_text_size(text: str, font_size: int) -> Tuple[int, int]:
        """测量文本尺寸（线程安全）"""
        try:
            with Utils._cache_lock:
                if Utils._scratch_img is None:
                    Utils._scratch_img = Image.new('RGB', (100, 100))
                    Utils._scratch_draw = ImageDraw.Draw(Utils._scratch_img)
            font = Utils._get_cached_font(font_size)
            with Utils._cache_lock:
                text_bbox = Utils._scratch_draw.textbbox((0, 0), text, font=font)
                return int(text_bbox[2] - text_bbox[0]), int(text_bbox[3] - text_bbox[1])
        except (OSError, IOError, AttributeError):
            return 80, 20


# ===================== 检测结果封装 =====================
@dataclass
class DetectionResult:
    """detect_security_actions 的返回值封装"""
    actions: List[str] = field(default_factory=list)
    person_count: int = 0
    fighting_persons: List[int] = field(default_factory=list)
    prev_centers: List[Optional[np.ndarray]] = field(default_factory=list)
    last_move_times: List[float] = field(default_factory=list)
    action_confidences: dict = field(default_factory=dict)
    gather_start_times: dict = field(default_factory=dict)
    prev_bboxes: list = field(default_factory=list)
    fall_confirm_counts: List[int] = field(default_factory=list)


# ===================== 检测模块 =====================
class DetectionModule:
    """行为检测模块"""

    def __init__(self, config: Config):
        self.config = config

    def detect_fall(self, keypoints: np.ndarray) -> Tuple[bool, float]:
        """基于多维度特征检测跌倒行为 - 优化版本，返回检测结果和置信度"""
        if len(keypoints) < 17:
            return False, 0.0

        # 1. 计算人体包围框的长宽比（跌倒时宽>高）
        valid_kp = keypoints[keypoints[:, 2] > self.config.FALL_MIN_KP_CONF]
        if len(valid_kp) < self.config.FALL_MIN_VALID_KP:
            return False, 0.0

        min_x, max_x = valid_kp[:, 0].min(), valid_kp[:, 0].max()
        min_y, max_y = valid_kp[:, 1].min(), valid_kp[:, 1].max()

        height = max_y - min_y
        if height == 0:
            return False, 0.0

        aspect_ratio = (max_x - min_x) / height

        # 2. 头部与臀部的相对位置（跌倒时头部可能低于臀部）
        head_y = keypoints[0][1]  # 鼻子Y坐标
        hip_y = (keypoints[11][1] + keypoints[12][1]) / 2  # 髋部Y坐标
        head_hip_ratio = (head_y - hip_y) / height

        # 3. 腿部角度分析（跌倒时腿部弯曲角度异常）
        left_knee_angle = Utils.calculate_angle(keypoints[11], keypoints[13], keypoints[15])
        right_knee_angle = Utils.calculate_angle(keypoints[12], keypoints[14], keypoints[16])

        # 4. 躯干垂直度（跌倒时躯干水平）
        shoulder_y = (keypoints[5][1] + keypoints[6][1]) / 2
        verticality_ratio = abs(hip_y - shoulder_y) / height

        # 5. 脚踝与髋部的相对位置
        hip_ankle_diff = hip_y - (keypoints[15][1] + keypoints[16][1]) / 2

        # 6. 计算躯干倾斜角度（更准确的姿态判断）
        shoulder_center = (keypoints[5][:2] + keypoints[6][:2]) / 2
        hip_center = (keypoints[11][:2] + keypoints[12][:2]) / 2
        trunk_vector = shoulder_center - hip_center

        trunk_norm = np.linalg.norm(trunk_vector)
        trunk_angle = np.arccos(
            np.clip(-trunk_vector[1] / trunk_norm, -1.0, 1.0)) * 180 / np.pi if trunk_norm > 0 else 0

        # 7. 头部与地面的相对位置（归一化坐标中 head_y 本身就是比例）
        head_ground_ratio = head_y

        # 8. 关键点置信度加权（新增特征）
        confidence_score = np.mean(keypoints[:, 2])

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
        """检测手臂是否抬起"""
        if len(keypoints) < 10:
            return False
        shoulder_y = (keypoints[5][1] + keypoints[6][1]) / 2
        elbow_y = (keypoints[7][1] + keypoints[8][1]) / 2
        wrist_y = (keypoints[9][1] + keypoints[10][1]) / 2
        return (elbow_y < shoulder_y - self.config.FIGHT_ARM_ELBOW_OFFSET) or (wrist_y < shoulder_y - self.config.FIGHT_ARM_WRIST_OFFSET)

    def detect_fighting(self, keypoints_list: List[np.ndarray], bboxes: List[List[float]],
                        img_shape: Tuple[int, int]) -> Tuple[bool, List[int]]:
        """基于躯干数据检测打架行为"""
        if len(keypoints_list) < 2:
            return False, []

        h, w = img_shape[:2]
        max_dim = max(w, h)
        fighting_persons = set()

        # 遍历每对人体
        for (i, kp1), (j, kp2) in combinations(enumerate(keypoints_list), 2):
            # 获取躯干中心
            center1 = Utils.get_body_center(kp1)
            center2 = Utils.get_body_center(kp2)

            if center1 is None or center2 is None:
                continue

            # 综合判定
            fight_score = 0

            # 1. 计算躯干中心距离（归一化）
            if Utils.calculate_distance(center1, center2) / max_dim < self.config.FIGHT_TRUNK_DISTANCE:
                fight_score += 0.4

            # 2. 计算人体框重叠度
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

    def detect_gathering(self, keypoints_list: List[np.ndarray],
                         img_shape: Tuple[int, int],
                         gather_start_times: Optional[dict]) -> Tuple[bool, int, float]:
        """检测人员聚集行为
        讲稿标准：聚集半径<1.5m、持续≥3s、人数阈值≥3人
        返回：(是否聚集, 聚集人数, 聚集置信度)
        """
        n = len(keypoints_list)
        if n < self.config.GATHER_THRESHOLD:
            return False, 0, 0.0

        h, w = img_shape[:2]
        max_dim = max(w, h)

        # 聚类：找出彼此距离在阈值内的人员
        clusters = []

        for i, kp_i in enumerate(keypoints_list):
            center_i = Utils.get_body_center(kp_i)
            if center_i is None:
                continue
            cluster = [i]
            for j, kp_j in enumerate(keypoints_list):
                if j <= i:
                    continue
                center_j = Utils.get_body_center(kp_j)
                if center_j is None:
                    continue
                # 归一化距离
                dist = Utils.calculate_distance(center_i, center_j) / max_dim
                if dist < self.config.GATHER_RADIUS:
                    cluster.append(j)
            clusters.append(cluster)

        # 取最大聚集簇
        if not clusters:
            return False, 0, 0.0
        best_cluster = max(clusters, key=len)
        gather_count = len(best_cluster)

        if gather_count < self.config.GATHER_THRESHOLD:
            return False, 0, 0.0

        # 计算聚集持续时间
        current_time = time.time()
        cluster_key = tuple(sorted(best_cluster))
        if gather_start_times is None:
            gather_start_times = {}

        if cluster_key in gather_start_times:
            # 之前就在聚集中，保持开始时间不变
            pass
        else:
            # 新聚集，记录开始时间
            gather_start_times[cluster_key] = current_time

        start_time = gather_start_times.get(cluster_key, current_time)
        duration = current_time - start_time

        confidence = min(gather_count / self.config.GATHER_CONF_DIVISOR, 1.0)  # 人数越多置信度越高

        is_gathering = duration >= self.config.GATHER_DURATION
        return is_gathering, gather_count, confidence

    def detect_security_actions(self, pose_results: List, prev_centers: Optional[List[np.ndarray]],
                                last_move_times: Optional[List[float]],
                                gather_start_times: Optional[dict] = None,
                                prev_bboxes: Optional[List] = None,
                                fall_confirm_counts: Optional[List[int]] = None) -> DetectionResult:
        """检测所有安全行为，支持多人检测（IoU 跟踪 + 时序平滑）"""
        detected_actions = set()
        person_count = 0
        keypoints_list = []
        bboxes = []
        img_shape = None
        new_gather_start_times = gather_start_times if gather_start_times is not None else {}
        fighting_persons = []
        action_confidences = {}

        for r in pose_results:
            if r.keypoints is None:
                continue

            img_shape = r.orig_img.shape
            keypoints = r.keypoints.data
            person_count = len(keypoints)

            # 收集关键点和边界框
            current_bboxes = []
            for i, kp in enumerate(keypoints):
                kp_np = kp.cpu().numpy() if hasattr(kp, 'cpu') else kp
                keypoints_list.append(kp_np)

                if len(r.boxes) > i:
                    bbox = (
                        r.boxes[i].xyxy[0].cpu().numpy()
                        if hasattr(r.boxes[i].xyxy[0], 'cpu')
                        else r.boxes[i].xyxy[0]
                    )
                    normalized_bbox = bbox / [img_shape[1], img_shape[0], img_shape[1], img_shape[0]]
                    bboxes.append(normalized_bbox)
                    current_bboxes.append(normalized_bbox)
                else:
                    current_bboxes.append(None)

            # === IoU 人体跟踪：匹配前后帧 ===
            new_prev_centers = [None] * person_count
            new_last_move_times = [time.time()] * person_count
            new_fall_confirm_counts = [0] * person_count
            new_prev_bboxes_list = [None] * person_count

            if prev_bboxes and len(prev_bboxes) > 0 and current_bboxes:
                # 计算 IoU 矩阵
                n_new = len(current_bboxes)
                n_prev = len(prev_bboxes)
                iou_matrix = np.zeros((n_new, n_prev))
                for ni in range(n_new):
                    if current_bboxes[ni] is None:
                        continue
                    for pi in range(n_prev):
                        if prev_bboxes[pi] is None:
                            continue
                        iou_matrix[ni, pi] = Utils.calculate_iou(current_bboxes[ni], prev_bboxes[pi])

                # 贪心匹配
                matched_new = set()
                matched_prev = set()
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
                        break
                    matched_new.add(best_ni)
                    matched_prev.add(best_pi)
                    # 转移跟踪状态
                    if prev_centers and best_pi < len(prev_centers):
                        new_prev_centers[best_ni] = prev_centers[best_pi]
                    if last_move_times and best_pi < len(last_move_times):
                        new_last_move_times[best_ni] = last_move_times[best_pi]
                    if fall_confirm_counts and best_pi < len(fall_confirm_counts):
                        new_fall_confirm_counts[best_ni] = fall_confirm_counts[best_pi]

            # 逐人检测
            for i, kp_np in enumerate(keypoints_list):
                new_prev_bboxes_list[i] = current_bboxes[i] if i < len(current_bboxes) else None

                # 跌倒检测（带时序平滑）
                is_fall, fall_confidence = self.detect_fall(kp_np)
                if is_fall:
                    new_fall_confirm_counts[i] += 1
                    if new_fall_confirm_counts[i] >= self.config.FALL_CONFIRM_FRAMES:
                        detected_actions.add("跌倒")
                        action_confidences["跌倒"] = fall_confidence
                else:
                    new_fall_confirm_counts[i] = 0

            # 打架检测
            if person_count >= 2 and img_shape is not None:
                is_fighting, fight_persons = self.detect_fighting(keypoints_list, bboxes, img_shape)
                if is_fighting:
                    detected_actions.add("打架")
                    fighting_persons = fight_persons
                    action_confidences["打架"] = 1.0

            # 离岗检测
            if person_count == 0:
                detected_actions.add("离岗")
                action_confidences["离岗"] = 1.0

            # 人员聚集检测
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

    ACTION_PRIORITY = ["打架", "跌倒", "离岗", "人员聚集"]

    def __init__(self, config: Config):
        self.config = config
        os.makedirs(os.path.dirname(config.RESULT_VIDEO_PATH), exist_ok=True)
        os.makedirs(config.DATASET_DIR, exist_ok=True)
        self._pending_detections = []
        self._last_flush_time = time.time()
        self._flush_interval = 5.0  # 每 5 秒批量写入一次

    def save_detection_data(self, actions: List[str], person_count: int, fps: float, frame_count: int,
                            camera_name: str = None, camera_id: str = None) -> str:
        """保存检测数据（始终写入，保证趋势图有数据），返回时间戳"""
        timestamp = Utils.generate_timestamp()

        detection_data = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "person_count": person_count,
            "actions": actions or [],
            "frame_count": frame_count,
            "fps": fps,
            "image_filename": f"frame_{timestamp}.jpg" if actions else None,
            "camera_name": camera_name,
            "camera_id": camera_id
        }

        self._pending_detections.append((timestamp, detection_data))

        now = time.time()
        if now - self._last_flush_time >= self._flush_interval:
            self._flush()

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

        self._pending_detections.clear()
        self._last_flush_time = time.time()

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
        self.last_alert_time = 0.0

    def check_and_trigger_alert(self, actions: List[str], frame: np.ndarray) -> Tuple[np.ndarray, bool]:
        """检查是否需要触发报警"""
        is_alarm = "跌倒" in actions or "打架" in actions
        alert_triggered = False

        if is_alarm:
            current_time = time.time()
            if current_time - self.last_alert_time > self.config.ALERT_COOLDOWN:
                # 触发报警
                frame = self._draw_alert_banner(frame)
                self.last_alert_time = current_time
                alert_triggered = True
            else:
                # 仍在冷却期内，仅绘制报警横幅
                frame = self._draw_alert_banner(frame)

        return frame, alert_triggered

    def _draw_alert_banner(self, img: np.ndarray) -> np.ndarray:
        """绘制报警横幅 — 使用批量文字渲染，避免重复颜色转换"""
        banner_height = self.config.BANNER_HEIGHT
        banner = np.full((banner_height, img.shape[1], 3), self.config.COLORS['danger'], dtype=np.uint8)

        alert_text = "⚠ 危险行为检测中 ⚠"
        text_size = 20
        text_width, _ = Utils.measure_text_size(alert_text, text_size)
        text_x = (img.shape[1] - text_width) // 2

        # 使用批量模式，只做一次 BGR→RGB→PIL→BGR 转换
        draw = Utils.begin_text_batch(banner)
        Utils.draw_text_cn_batch(draw, alert_text, (text_x, 5), text_size, (255, 255, 255))
        banner = Utils.end_text_batch(banner)
        return np.vstack((banner, img))

    # ===================== UI模块 =====================
class UIManager:
    """UI绘制管理模块"""

    def __init__(self, config: Config):
        self.config = config

    def draw_header(self, img: np.ndarray, is_alarm: bool, draw=None) -> np.ndarray:
        """绘制顶部标题栏"""
        header_height = self.config.HEADER_HEIGHT
        header = np.full((header_height, img.shape[1], 3), self.config.COLORS['panel'], dtype=np.uint8)

        # 绘制左侧标题
        header = Utils.draw_text_cn(header, "AI SECURITY SYSTEM", (20, 15), 24, self.config.COLORS['text'])

        live_color = self.config.COLORS['live_red'] if is_alarm else self.config.COLORS['live_green']
        cv2.circle(header, (img.shape[1] - 120, 30), 8, live_color, -1)
        header = Utils.draw_text_cn(header, "LIVE", (img.shape[1] - 100, 15), 20, self.config.COLORS['text'])

        return np.vstack((header, img))

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

        # 绘制卡片内容
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
        if behavior == "跌倒":
            color = self.config.COLORS['danger']
        elif behavior == "打架":
            color = self.config.COLORS['warning']
        elif behavior == "离岗":
            color = self.config.COLORS['leave']
        else:
            color = self.config.COLORS['normal']

        text = f"  {behavior} {confidence:.2f}  "
        text_width, _ = Utils.measure_text_size(text, 16)

        x, y = pos
        rect_height = 30
        cv2.rectangle(img, (x, y), (x + text_width + 10, y + rect_height), color, -1)
        cv2.rectangle(img, (x, y), (x + text_width + 10, y + rect_height), (0, 0, 0), 1)

        img = Utils.draw_text_cn(img, text, (x + 5, y + 5), 16, self.config.COLORS['bg'])
        return img, text_width + 20

    def draw_fps(self, img: np.ndarray, fps: float) -> np.ndarray:
        """绘制FPS卡片"""
        # FPS卡片位置（右上角）
        card_width = 120
        card_height = 40
        x = img.shape[1] - card_width - 10
        y = 10

        # 绘制卡片背景
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

        panel = np.full((panel_height, panel_width, 3), self.config.COLORS['panel'], dtype=np.uint8)

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

        # 行为标签矩形
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
            if behavior_x > panel_width - 120:
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

        # 日志文字
        Utils.draw_text_cn_batch(draw, "最近日志", (20, 360), 18, self.config.COLORS['text'])
        log_y = 390
        for log in list(logs)[-5:]:
            Utils.draw_text_cn_batch(draw, log, (25, log_y - 5), 14, self.config.COLORS['text'])
            log_y += 30

        # 一次转换回 OpenCV
        panel = Utils.end_text_batch(panel)

        return np.hstack((panel, img))

    def draw_exit_hint(self, img: np.ndarray) -> np.ndarray:
        """绘制退出提示"""
        return Utils.draw_text_cn(
            img,
            "按 Enter 退出系统",
            (img.shape[1] - 250, img.shape[0] - 30),
            20,
            self.config.COLORS['text']
        )


# ===================== 主程序 =====================
class SecurityMonitor:
    """安防监控主程序"""

    def __init__(self):
        self.config = Config()

        # 从 cameras.json 加载摄像头配置，不存在时回退到 USB 自动检测
        self.config.SOURCES = load_cameras_config()
        if not self.config.SOURCES:
            print("未找到 cameras.json 或配置为空，回退到 USB 摄像头自动检测...")
            usb_cams = detect_cameras(max_index=5)
            self.config.SOURCES = [{"id": f"cam{i}", "type": "usb", "address": i, "name": f"USB摄像头{i}"} for i in usb_cams]

        self.detection_module = DetectionModule(self.config)
        self.data_saver = DataSaver(self.config)
        self.alert_manager = AlertManager(self.config)
        self.ui_manager = UIManager(self.config)

        # 加载模型 — 强制 GPU
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
            self.model = YOLO(self.config.MODEL_PATH)

        # GPU 预热 — 第一次推理最慢，提前跑掉
        print("GPU 预热中...")
        dummy = np.zeros((self.config.IMG_SIZE, self.config.IMG_SIZE, 3), dtype=np.uint8)
        self.model(dummy, imgsz=self.config.IMG_SIZE, device=self.config.DEVICE,
                   half=self.config.HALF, verbose=False)
        print("GPU 预热完成 ✅")

        # 是否启用 web 视频流
        self.enable_web_stream = HAS_REQUESTS

        # 创建请求会话（连接复用）
        self.session = requests.Session() if HAS_REQUESTS else None

        # 调整帧大小以减少传输数据量 - 16:9比例，适合观看
        self.web_stream_width = 960  # 发送到web的帧宽度
        self.web_stream_height = 540  # 发送到web的帧高度 (16:9)

        # 多摄像头线程控制
        self._stop_event = threading.Event()
        self._threads = []

        # 异步帧发送线程池（不阻塞主循环）
        self._frame_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="frame_sender") if HAS_REQUESTS else None
        self._pending_frames = 0  # 待处理帧计数，防止队列无限增长
        self._frame_lock = threading.Lock()

    def _init_video_source(self, source=0):
        """初始化视频源"""
        cap = None
        try:
            # Windows 上使用 DirectShow 后端，避免默认后端无法打开摄像头
            backend = cv2.CAP_DSHOW if hasattr(cv2, 'CAP_DSHOW') else cv2.CAP_ANY
            cap = cv2.VideoCapture(source, backend)
            if not cap.isOpened():
                print(f"视频源 {source} 打开失败")
                return True, None, 1280, 720

            # 设置摄像头参数
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 30)

            # 获取摄像头分辨率
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return False, cap, frame_width, frame_height
        except Exception as e:
            print(f"初始化视频源 {source} 时出错: {e}")
            return True, None, 1280, 720

    def _init_video_writer(self):
        """初始化视频写入器"""
        new_frame_width = self.frame_width + self.config.PANEL_WIDTH
        new_frame_height = self.frame_height + self.config.HEADER_HEIGHT

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
            # 调整帧大小以减少数据量
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
            # 发送失败静默处理
            return False

    def report_model_info(self):
        """向 Java 后端报告模型信息"""
        if not HAS_REQUESTS:
            return
        try:
            model_size = 0
            try:
                model_size = os.path.getsize(self.config.MODEL_PATH) / 1024 / 1024
            except OSError:
                pass
            info = {
                "precision": "FP16" if Config.HALF else "FP32",
                "device": Config.DEVICE,
                "model_size_mb": round(model_size, 1),
                "total_layers": 0,
                "conv_layers": 0,
                "quantized_layers": 0,
                "gpu_available": Config.DEVICE == "cuda",
                "half_precision": Config.HALF
            }
            requests.post(
                f"{WEB_SERVER_URL}/api/model_info",
                json=info,
                timeout=2
            )
        except Exception:
            pass  # 静默失败

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

        # 启动时报告模型信息
        self.report_model_info()

        # 为每个摄像头启动独立线程
        self._threads = []
        for cam_config in sources:
            t = threading.Thread(target=self._run_camera_thread, args=(cam_config,), daemon=True)
            t.start()
            self._threads.append(t)

        # 主线程等待退出信号
        try:
            while not self._stop_event.is_set():
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\n收到中断信号，正在停止...")
            self._stop_event.set()

        # 等待所有线程结束
        for t in self._threads:
            t.join(timeout=3)

        cv2.destroyAllWindows()
        print("系统已退出")

    def _get_frame_from_cap(self, cap, use_static, test_image):
        """从指定摄像头获取视频帧"""
        if use_static:
            return test_image.copy(), use_static
        try:
            ret, frame = cap.read()
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
            # USB / RTSP 模式
            use_static, cap, frame_width, frame_height = self._init_video_source(source)
            if use_static:
                print(f"[{cam_name}] 摄像头连接失败，跳过该摄像头")
                return

        if use_static:
            test_image = np.zeros((720, 1280, 3), dtype=np.uint8)
            cv2.putText(test_image, f"{cam_name}", (400, 360), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        else:
            test_image = np.zeros((720, 1280, 3), dtype=np.uint8)

        # 每个摄像头独立的会话
        session = requests.Session() if HAS_REQUESTS else None

        # 状态变量
        prev_centers = []
        last_move_times = []
        gather_start_times = {}
        prev_bboxes = []
        fall_confirm_counts = []
        logs = deque(maxlen=20)
        prev_actions = []
        frame_count = 0
        start_time = time.time()
        last_model_info_time = time.time()

        # 跳帧推理 — 缓存上一次推理结果
        cached_results = None
        cached_actions = []
        cached_person_num = 0
        cached_fighting_persons = []
        cached_action_confidences = {}
        inference_every = max(1, self.config.INFERENCE_EVERY)

        # 窗口名（每个摄像头独立窗口）
        window_name = f"Camera {cam_str}"

        try:
            while not self._stop_event.is_set():
                # 1. 读取帧
                if cam_type == "http_snapshot" and not use_static:
                    frame, ok = self._fetch_http_snapshot(snapshot_url, http_session)
                    if not ok:
                        print(f"[{cam_name}] HTTP 快照获取失败，切换到静态图像模式")
                        use_static = True
                        frame = test_image.copy()
                else:
                    frame, use_static = self._get_frame_from_cap(cap, use_static, test_image)
                    if use_static and cap is not None:
                        cap.release()
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

                    # 3. 检测行为
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

                    # 缓存结果
                    cached_results = results
                    cached_actions = actions
                    cached_person_num = person_num
                    cached_fighting_persons = fighting_persons
                    cached_action_confidences = action_confidences
                else:
                    # 复用缓存结果
                    results = cached_results
                    actions = cached_actions
                    person_num = cached_person_num
                    fighting_persons = cached_fighting_persons
                    action_confidences = cached_action_confidences

                # 4. 可视化关键点
                frame_out = results[0].plot() if results and len(results) > 0 else frame.copy()

                # 5. 框选打架人员
                if "打架" in actions and results and len(results) > 0:
                    self._draw_fighting_persons(results[0], fighting_persons, frame_out)

                # 7. 绘制人员聚集框
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
                        can_submit = self._pending_frames < 3
                        if can_submit:
                            self._pending_frames += 1
                    if can_submit:
                        future = self._frame_executor.submit(self._send_frame_session, frame.copy(), cam_str, session, person_num)
                        future.add_done_callback(lambda _: self._release_frame_slot())

                # 9. 日志
                current_time_str = time.strftime("%H:%M:%S")
                for action in actions:
                    if action not in prev_actions:
                        log_entry = f"[{current_time_str}] [CAM-{cam_str}] {action}"
                        logs.append(log_entry)
                prev_actions = actions.copy()

                # 10. FPS
                elapsed = time.time() - start_time
                fps = frame_count / elapsed if elapsed > 0 else 0

                # 11. 每60秒报告模型信息（仅摄像头0负责）
                now = time.time()
                if cam_str == "0" and now - last_model_info_time > 60:
                    self.report_model_info()
                    last_model_info_time = now

                # 11b. 每5秒上报GPU使用率（仅摄像头0负责）
                if cam_str == "0" and frame_count % (max(1, int(fps)) * 5) == 0:
                    report_gpu_status()

                # 12. 绘制UI
                is_alarm = "跌倒" in actions or "打架" in actions
                frame_out = self._draw_ui(frame_out, is_alarm, actions, logs, action_confidences, person_num, fps)

                # 13. 显示（仅在前台终端模式时显示GUI）
                show_gui = os.isatty(0)
                if show_gui:
                    cv2.imshow(window_name, frame_out)

                # 14. 保存检测数据（仅第一个摄像头负责，避免重复）
                if cam_str == self.config.SOURCES[0]["id"] and frame_count % self.config.SAVE_INTERVAL == 0:
                    timestamp = self.data_saver.save_detection_data(actions, person_num, fps, frame_count,
                                                                     camera_name=cam_name, camera_id=cam_str)
                    if actions:
                        self.data_saver.save_frame_image(frame, actions, timestamp)

                # 15. 检查退出（仅在前台终端模式时）
                if show_gui:
                    key = cv2.waitKey(1) & 0xFF
                    if key == 13:
                        print(f"[摄像头 {cam_str}] 收到退出信号，停止所有摄像头...")
                        self._stop_event.set()
                        break

        except Exception as e:
            print(f"[摄像头 {cam_str}] 线程异常: {e}")
        finally:
            if cap is not None:
                cap.release()
            if session is not None:
                session.close()
            print(f"[摄像头 {cam_str}] 线程结束")

    def _release_frame_slot(self):
        """释放帧发送槽位"""
        with self._frame_lock:
            self._pending_frames = max(0, self._pending_frames - 1)

    def _send_frame_session(self, frame, cam, session, person_count=0):
        """使用指定会话发送帧到web服务器（支持 GPU resize）"""
        try:
            if HAS_CV2_CUDA:
                # GPU 加速 resize
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
            pass

    def _draw_fighting_persons(self, result, fighting_persons, frame_out):
        """框选打架人员"""
        try:
            if result.boxes is not None:
                for i in fighting_persons:
                    if i < len(result.boxes):
                        bbox = result.boxes[i].xyxy[0].cpu().numpy() if hasattr(result.boxes[i].xyxy[0], 'cpu') else result.boxes[i].xyxy[0]
                        x1, y1, x2, y2 = map(int, bbox)
                        # 绘制红色边框
                        cv2.rectangle(frame_out, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        # 绘制标签
                        cv2.putText(frame_out, "打架", (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        except Exception as e:
            print(f"框选打架人员失败: {e}")

    def _draw_gathering_persons(self, result, keypoints_list, frame_out):
        """用黄色圆弧框选聚集人员"""
        try:
            n = len(keypoints_list)
            if n < self.config.GATHER_THRESHOLD:
                return
            h, w = frame_out.shape[:2]
            max_dim = max(w, h)
            # 找聚集簇
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
            best = max(clusters, key=len) if clusters else []
            if len(best) < self.config.GATHER_THRESHOLD:
                return
            # 取最外圈
            xs = [Utils.get_body_center(keypoints_list[i])[0] * w for i in best]
            ys = [Utils.get_body_center(keypoints_list[i])[1] * h for i in best]
            if not xs:
                return
            min_x, max_x = int(min(xs)), int(max(xs))
            min_y, max_y = int(min(ys)), int(max(ys))
            pad = 20
            cv2.rectangle(frame_out, (min_x - pad, min_y - pad), (max_x + pad, max_y + pad),
                         (0, 255, 255), 3)
            label = f"人员聚集 {len(best)}人"
            cv2.putText(frame_out, label, (min_x - pad, min_y - pad - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        except Exception as e:
            print(f"绘制聚集人员失败: {e}")

    def _draw_ui(self, frame_out, is_alarm, actions, logs, action_confidences, person_num, fps):
        """绘制UI — 优化：批量文字渲染"""
        # 标题栏（独立区域，单独处理）
        frame_out = self.ui_manager.draw_header(frame_out, is_alarm)

        # 报警横幅
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
    monitor = SecurityMonitor()
    monitor.run()