# YOLOv8 检测部分 — 演讲稿（13 分钟）

> **适用场景**：现场写代码演示，面向评委和非技术人员。
> **分工**：人 1，13 分钟，现场写代码。

---

## 1. 开场 + YOLOv8 简介（2min）

大家好，今天我给大家重点讲一下我们这个系统最核心的部分——**AI 是怎么"看懂"摄像头画面的**。

我们用了一个叫 YOLOv8 的 AI 模型。你可能听过"人脸识别"，但 YOLOv8 比那个厉害得多——它不只是认出"这是一个人"，它能看清这个人**身体的每一个关节在哪里、手臂抬多高、腿弯成什么角度**。

### YOLO 是什么？

YOLO 叫 **"You Only Look Once"**——只看一眼就能认出来。不是逐个像素分析，而是像人扫一眼就懂了。

### 我们用的是哪个版本？

我们选的是 **YOLOv8n-pose**，就是 YOLOv8 的"Nano"（纳米）版本。

打个比方：送快递，你用大卡车运一个包裹，运力过剩、油耗又高。我们这个场景不需要超级大的模型，用"小货车"就够了：

| 版本 | 模型大小 | 速度 | 我们选它？ |
|------|---------|------|----------|
| Nano（纳米） | 5MB | 最快 | ✅ 就是这个 |
| Small（小） | 22MB | 快 | 够用但费显存 |
| Medium（中） | 52MB | 中等 | 监狱场景用不着 |
| Large（大） | 87MB | 慢 | 杀鸡用牛刀 |

5MB 的小模型，下载快、加载快、省内存，监狱场景完全够用。

**代码位置：** `detection/yolov8_security.py:90`，模型路径指向 `models/yolov8n-pose.pt`。

```python
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "yolov8n-pose.pt")  # 5MB 小模型
IMG_SIZE = 512         # 输入尺寸 512x512（比标准 640 更小，省算力）
CONF_THRESH = 0.5      # 置信度阈值：低于 50% 的结果不要
DEVICE = "cuda"        # 强制 GPU 加速
HALF = True            # FP16 半精度，显存占用减半
```

---

## 2. 姿态估计原理 — 关键点 + 骨骼连线（2min）

普通的目标检测只告诉你"这里有个框，框里有个人"。但我们用的是 **Pose（姿态估计）** 模式，它会在每个人身上标出 **17 个关键点**：

```
        0 (鼻子)
       / \
      1   2 (眼睛)
     /     \
    3       4 (耳朵)
     \     /
      5---6 (肩膀)
     /     \
    7       8 (肘)
   /         \
  9          10 (手腕)
      |
     11---12 (髋部)
     /       \
   13        14 (膝盖)
   /           \
  15           16 (脚踝)
```

这就像给人**画了一副骨骼 X 光**。每个关键点包含三个值：`[x坐标, y坐标, 置信度]`。

有了这 17 个点的位置，我们就能用数学算出：

- 这个人身体是竖着的（站着）还是横着的（躺倒了）？
- 他的手臂是自然下垂的还是高举过头的（打架）？
- 他的头部是正常平视还是持续低垂的（疲劳）？

**代码位置：** `detection/yolov8_security.py:367`，`KEYPOINT_NAMES` 定义了这 17 个点的名字。

---

## 3. 现场写代码：跌倒检测 3 维加权（4min）— 重点！

> **演讲提示**：这部分是全场重点，要打开编辑器现场写代码。先讲原理，再逐行写。

### 通俗原理

正常站着的人，身体是"竖"的；跌倒的人，身体是"横"的。

但光看"竖还是横"太简单了——人蹲下呢？弯腰捡东西呢？

所以我们用了 **3 个核心维度** 综合判断，每个维度打分，加权求和：

#### 维度 1：包围框长宽比 — 竖着还是横着？

站着的人，人体框是**竖长**的（高 > 宽，比值 0.3~0.5）。
躺倒的人，人体框变**横宽**了（宽 > 高，比值 > 0.7）。

打个比方：人站着像一根筷子竖着放，跌倒就像筷子横过来了。

#### 维度 2：躯干倾斜角 — 身体歪了多少度？

取肩膀中点和髋部中点，连成一条线，算它和垂直轴的夹角。
- 站立：约 0°（躯干竖直）
- 跌倒：约 90°（躯干水平）

#### 维度 3：头臀相对位置 — 头和屁股哪个更低？

正常站立时，头在上方、髋部在下方。
跌倒时，头和屁股差不多在同一水平线上，甚至头更低。

### 现场写代码

> 打开编辑器，创建 `detect_fall` 方法：

```python
def detect_fall(self, keypoints):
    """
    跌倒检测 — 3维加权评分
    keypoints: 17个关键点，每个 = [x, y, confidence]
    """
    # 取出关键坐标
    nose = keypoints[0]           # 鼻子
    left_shoulder = keypoints[5]  # 左肩
    right_shoulder = keypoints[6] # 右肩
    left_hip = keypoints[11]      # 左髋
    right_hip = keypoints[12]     # 右髋

    # 肩膀中点、髋部中点
    shoulder_center = (left_shoulder[:2] + right_shoulder[:2]) / 2
    hip_center = (left_hip[:2] + right_hip[:2]) / 2

    # 人体框
    valid_pts = keypoints[keypoints[:, 2] > 0.3][:, :2]
    min_x, min_y = valid_pts.min(axis=0)
    max_x, max_y = valid_pts.max(axis=0)
    width = max_x - min_x
    height = max_y - min_y

    fall_score = 0.0

    # === 维度1: 长宽比 (权重 0.35) ===
    # 站着: 高>宽, aspect≈0.3-0.5; 躺倒: 宽>高, aspect>0.7
    aspect_ratio = width / height if height > 0 else 0
    if aspect_ratio > 0.7:
        fall_score += 0.35

    # === 维度2: 躯干倾斜角 (权重 0.35) ===
    # 肩-髋连线与垂直轴的夹角，站立≈0°, 跌倒≈90°
    import math
    dx = shoulder_center[0] - hip_center[0]
    dy = shoulder_center[1] - hip_center[1]
    trunk_angle = abs(math.degrees(math.atan2(dx, -dy)))  # 与垂直轴夹角
    if trunk_angle > 55:
        fall_score += 0.35

    # === 维度3: 头臀相对位置 (权重 0.30) ===
    # 正常: nose_y < hip_y (头在上); 跌倒: nose_y ≈ hip_y 或头更低
    head_y = nose[1]
    hip_y = hip_center[1]
    head_hip_ratio = (head_y - hip_y) / height if height > 0 else 0
    # 正常站立时 head_hip_ratio > 0 (头在上), 跌倒时接近 0 或负
    if head_hip_ratio < 0.1:
        fall_score += 0.30

    # 综合判断: 分数 > 0.5 判定跌倒
    is_fall = fall_score > 0.5
    return is_fall, fall_score
```

> **讲的时候可以说**："你看，三个维度各有权重，最后加总。不是所有条件都满足才报警，但综合分数够高就判定跌倒。这比拍脑袋猜靠谱多了。"

### 其余 5 个辅助维度

除了上面 3 个核心维度，我们还有 5 个辅助维度，用于提高精度：

| 辅助维度 | 原理 |
|---------|------|
| 腿部角度 | 髋-膝-踝夹角，站立≈170°，跌倒蜷缩≈40° |
| 踝髋差 | 脚踝和髋部的 Y 坐标差，站着差距大，躺下差距小 |
| 脚踝水平差 | 左右脚踝的 Y 坐标差，跌倒时两脚可能不在同一水平 |
| 关键点置信度 | AI 对自己判断有多大把握，看得清的帧更可信 |
| 头部地面比 | 头离画面底部的距离，躺倒时头接近"地面" |

**关键创新：时序平滑**——不是看一帧就报警，而是连续 2 帧以上都判定跌倒，才真正报警。避免了人偶尔弯腰被误报。

---

## 4. 现场写代码：打架检测 + 聚集检测（3min）

> **演讲提示**：继续在编辑器里写。

### 打架检测

打架有三个特征：
1. 两个人**靠得很近**（躯干距离小）
2. 两个人的**身体框有重叠**
3. 两个人**手臂都抬起来了**

```python
def detect_fighting(self, keypoints_list, bboxes):
    """
    打架检测 — 三人组合评分
    遍历每一对人，打分判断是否在打架
    """
    from itertools import combinations

    fighting_persons = set()

    for (i, kp1), (j, kp2) in combinations(enumerate(keypoints_list), 2):
        # 躯干中心点
        center1 = (kp1[5][:2] + kp1[6][:2] + kp1[11][:2] + kp1[12][:2]) / 4
        center2 = (kp2[5][:2] + kp2[6][:2] + kp2[11][:2] + kp2[12][:2]) / 4

        fight_score = 0.0

        # 1. 躯干距离近 (权重 0.4)
        dist = np.linalg.norm(center1 - center2)
        if dist < 100:   # 归一化后 < 阈值
            fight_score += 0.4

        # 2. 人体框重叠度高 (权重 0.3)
        iou = calculate_iou(bboxes[i], bboxes[j])
        if iou > 0.1:
            fight_score += 0.3

        # 3. 手臂抬起 (权重 0.3)
        arm1_raised = kp1[7][1] < kp1[5][1] or kp1[9][1] < kp1[5][1]  # 肘/腕高于肩
        arm2_raised = kp2[7][1] < kp2[5][1] or kp2[9][1] < kp2[5][1]
        if arm1_raised and arm2_raised:
            fight_score += 0.3

        if fight_score > 0.3:
            fighting_persons.add(i)
            fighting_persons.add(j)

    return fighting_persons
```

> **讲的时候可以说**："打架的特征很明显——两个人靠得特别近，身体框都重叠了，而且手臂都举起来了。三个条件打分加起来，超过阈值就是打架。"

### 聚集检测

聚集用**距离聚类 + 时间确认**：

```python
def detect_gathering(self, keypoints_list, gather_start_times):
    """
    聚集检测 — 距离聚类 + 3秒时间确认
    """
    # 第一步: 聚类 — 谁和谁站得近
    centers = []
    for kp in keypoints_list:
        center = (kp[5][:2] + kp[6][:2] + kp[11][:2] + kp[12][:2]) / 4
        centers.append(center)

    # 简单聚类: 彼此距离 < 阈值的归为一簇
    clusters = []
    for i, c_i in enumerate(centers):
        cluster = [i]
        for j, c_j in enumerate(centers):
            if i != j and np.linalg.norm(c_i - c_j) < 80:  # 画面 8% 范围内
                cluster.append(j)
        clusters.append(cluster)

    best_cluster = max(clusters, key=len)
    gather_count = len(set(best_cluster))  # 去重

    # 第二步: 时间确认 — 持续 ≥3 秒
    if gather_count >= 3:
        now = time.time()
        duration = now - gather_start_times.get("main", now)
        if duration >= 3.0:
            return True, gather_count

    return False, 0
```

> **讲的时候可以说**："聚集检测就像找人群——先看谁和谁站得近，近的人归为一组，最大的那组超过 3 个人，并且持续 3 秒以上，就判定为聚集。不会因为有人刚好路过就误报。"

---

## 5. 统一入口 + 时序平滑 + DataSaver（2min）

### 统一入口

上面写的检测函数，最终统一由 `detect_security_actions()` 调用：

```python
def detect_security_actions(self, results, prev_centers, ...):
    """统一入口 — 一帧进来，6种检测全部跑一遍"""
    keypoints_list = extract_keypoints(results)   # 提取所有人关键点
    bboxes = extract_bboxes(results)              # 提取所有人边框

    actions = set()

    # 逐个检测
    for kp, bbox in zip(keypoints_list, bboxes):
        is_fall, score = self.detect_fall(kp)
        if is_fall:
            actions.add("跌倒")

    fighting = self.detect_fighting(keypoints_list, bboxes)
    if fighting:
        actions.add("打架")

    if len(keypoints_list) == 0:
        actions.add("离岗")

    is_gather, count = self.detect_gathering(keypoints_list, ...)
    if is_gather:
        actions.add("聚集")

    return {"actions": list(actions), "person_count": len(keypoints_list)}
```

### 时序平滑

跌倒不是看一帧就报警——而是**连续 2 帧以上**都判定跌倒，才真正报警。

```python
# 跌倒帧计数器（跨帧追踪）
if is_fall:
    fall_confirm_counts[person_id] += 1
    if fall_confirm_counts[person_id] >= 2:  # 连续2帧确认
        actions.add("跌倒")
else:
    fall_confirm_counts[person_id] = 0       # 重置
```

### DataSaver — 结果怎么送出去

检测完不是只在内存里，要存成文件给 Java 后端读：

```python
# detection/yolov8_security.py:962 — DataSaver
detection_data = {
    "timestamp": "2026-05-18 14:30:25",
    "person_count": 3,
    "actions": ["打架"],
    "image_filename": "frame_xxx.jpg",
    "fps": 15.2
}
with open(f"detection_{timestamp}.json", 'w') as f:
    json.dump(detection_data, f, ensure_ascii=False, indent=2)
```

Java 后端每 15 秒扫描一次这个目录，发现新的 JSON 文件就解析、推送到前端。

从摄像头拍到画面，到网页弹出报警，整个过程不到 **2 秒**。

---

## 总结

三句话记住 YOLOv8 检测部分：

1. **看骨架**：YOLOv8 在每个人身上标出 17 个关键点，画出人体骨架
2. **判行为**：跌倒 3 维加权（长宽比 + 倾斜角 + 头臀位），打架 3 条件评分（距离 + 重叠 + 抬手），聚集聚类 + 3 秒确认
3. **快又省**：5MB 小模型，跳帧推理省一半，GPU 加速快 10 倍

谢谢大家。

---

## 代码位置速查表

| 干什么 | 在哪 | 第几行 |
|--------|------|--------|
| 模型加载 | `detection/yolov8_security.py` | 1279-1300 |
| GPU 检测配置 | `detection/yolov8_security.py` | 97-102 |
| 17 个关键点定义 | `detection/yolov8_security.py` | 367 |
| 跌倒检测（8 维特征） | `detection/yolov8_security.py` | 595-696 |
| 打架检测 | `detection/yolov8_security.py` | 712-751 |
| 聚集检测 | `detection/yolov8_security.py` | 758-820 |
| 离岗检测 | `detection/yolov8_security.py` | 934-937 |
| 时序平滑（跌倒确认帧） | `detection/yolov8_security.py` | 920 |
| 统一入口 | `detection/yolov8_security.py` | 827-942 |
| DataSaver 数据保存 | `detection/yolov8_security.py` | 962 |
| 报警管理 | `detection/yolov8_security.py` | 1042 |
| 跳帧推理 | `detection/yolov8_security.py` | 108, 1587 |
| 帧发送到后端 | `detection/yolov8_security.py` | 1399, 1736 |
