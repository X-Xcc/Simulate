"""
YOLOv8 Pose 模型训练脚本
用法:
    python train_pose.py                          # 默认参数
    python train_pose.py --epochs 200 --batch 16  # 自定义
    python train_pose.py --device cpu             # CPU 训练
"""
import argparse
import os
import sys

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser(description="YOLOv8 Pose 模型训练")
    parser.add_argument("--data", default="datasets/pose_data.yaml", help="数据集配置文件路径")
    parser.add_argument("--epochs", type=int, default=100, help="训练轮数")
    parser.add_argument("--batch", type=int, default=8, help="批次大小")
    parser.add_argument("--imgsz", type=int, default=640, help="输入图片尺寸")
    parser.add_argument("--lr", type=float, default=0.01, help="初始学习率")
    parser.add_argument("--device", default="0", help="GPU 编号，无 GPU 写 cpu")
    parser.add_argument("--workers", type=int, default=4, help="数据加载线程数")
    args = parser.parse_args()

    # 检查数据集配置
    if not os.path.exists(args.data):
        print(f"错误: 数据集配置不存在: {args.data}")
        print("请先准备数据集，目录结构:")
        print("  datasets/pose/")
        print("  ├── images/train/   # 训练图片")
        print("  ├── images/val/     # 验证图片")
        print("  ├── labels/train/   # 训练标注 (.txt)")
        print("  └── labels/val/     # 验证标注 (.txt)")
        sys.exit(1)

    # 检查预训练权重
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    pretrained = os.path.join(project_root, "models", "yolov8n-pose.pt")

    if not os.path.exists(pretrained):
        print(f"错误: 预训练权重不存在: {pretrained}")
        print("ultralytics 会自动下载 yolov8n-pose.pt")
        pretrained = "yolov8n-pose.pt"

    print(f"预训练权重: {pretrained}")
    print(f"数据集配置: {args.data}")
    print(f"训练参数: epochs={args.epochs}, batch={args.batch}, "
          f"imgsz={args.imgsz}, lr={args.lr}, device={args.device}")

    model = YOLO(pretrained)

    results = model.train(
        data=args.data,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        lr0=args.lr,
        device=args.device,
        workers=args.workers,
        save=True,
        val=True,
        project=os.path.join(project_root, "runs", "pose"),
        name="train",
        exist_ok=True,
    )

    # 输出最佳权重路径
    best_path = os.path.join(project_root, "runs", "pose", "train", "weights", "best.pt")
    if os.path.exists(best_path):
        print(f"\n训练完成!")
        print(f"最佳权重: {best_path}")
        print(f"替换模型: copy {best_path} {pretrained}")
    else:
        print("\n训练完成，但未找到 best.pt，请检查训练日志")


if __name__ == "__main__":
    main()
