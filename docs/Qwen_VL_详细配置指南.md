# Qwen2.5-VL 模型详细配置指南

## 问题分析

当前系统使用的是 Ollama 格式的模型，位于 `D:\AI_Project\Models\blobs`，但这种格式与 transformers 库不兼容，导致模型无法加载。Ollama 是一个本地大语言模型运行工具，它使用自己的模型格式，而 transformers 库需要 Hugging Face 格式的模型。

## 解决方案详细步骤

### 1. 下载正确格式的模型

#### 方法一：使用 git 克隆（推荐）

1. **安装 git**：如果您还没有安装 git，请从 [https://git-scm.com/downloads](https://git-scm.com/downloads) 下载并安装

2. **克隆模型仓库**：
   ```bash
   git clone https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct "D:\AI_Project\Models\Qwen2.5-VL-7B-Instruct"
   ```

   这会将模型下载到 `D:\AI_Project\Models\Qwen2.5-VL-7B-Instruct` 目录

#### 方法二：手动下载

1. 访问 [https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct)
2. 点击页面右上角的 "Download" 按钮
3. 选择 "Download as zip" 或使用 huggingface-cli 工具下载
4. 解压到 `D:\AI_Project\Models\Qwen2.5-VL-7B-Instruct` 目录

### 2. 配置模型路径

1. **打开 qwen_vl_service.py 文件**：
   - 路径：`D:\yolov8_security\code\qwen_vl_service.py`

2. **修改模型路径配置**：
   - 找到以下代码行：
     ```python
     # 直接设置模型路径为用户指定的路径
     os.environ['QWEN_VL_MODEL_PATH'] = 'D:\\AI_Project\\Models\\blobs'
     ```
   - 修改为：
     ```python
     # 直接设置模型路径为用户指定的路径
     os.environ['QWEN_VL_MODEL_PATH'] = 'D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct'
     ```

3. **同时修改 MODEL_PATH 变量**：
   - 找到以下代码行：
     ```python
     MODEL_PATH = os.environ.get("QWEN_VL_MODEL_PATH", "D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct")
     ```
   - 确保路径正确：
     ```python
     MODEL_PATH = os.environ.get("QWEN_VL_MODEL_PATH", "D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct")
     ```

### 3. 安装必要的依赖

1. **打开命令提示符**：
   - 按下 `Win + R`，输入 `cmd`，回车

2. **导航到项目目录**：
   ```bash
   cd D:\yolov8_security
   ```

3. **安装依赖**：
   ```bash
   pip install transformers torch Pillow flask flask-cors
   ```

   如果遇到权限问题，使用管理员权限运行命令提示符，或添加 `--user` 参数：
   ```bash
   pip install --user transformers torch Pillow flask flask-cors
   ```

### 4. 启动服务

1. **导航到 code 目录**：
   ```bash
   cd D:\yolov8_security\code
   ```

2. **启动服务**：
   ```bash
   python qwen_vl_service.py
   ```

3. **查看启动日志**：
   - 服务启动后，会显示类似以下信息：
     ```
     ===========================================================
     Qwen2.5-VL-7B 视觉语言模型服务
     ===========================================================
     正在加载模型: D:\AI_Project\Models\Qwen2.5-VL-7B-Instruct
     使用设备: cuda
     模型加载成功！
     
     启动 HTTP 服务: http://0.0.0.0:5001
     API 端点:
       - GET  /health       健康检查
       - POST /analyze      分析图片（base64）
       - POST /analyze_file 分析上传的图片文件
       - POST /batch_analyze 批量分析图片
     ===========================================================
     * Serving Flask app 'qwen_vl_service'
     * Debug mode: off
     WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
     * Running on all addresses (0.0.0.0)
     * Running on http://127.0.0.1:5001
     * Running on http://10.214.246.102:5001
     Press CTRL+C to quit
     ```

### 5. 验证服务

#### 方法一：使用浏览器验证

1. **打开浏览器**，访问 http://127.0.0.1:5001/health
2. **查看响应**：
   - 正常情况下，会返回类似以下 JSON 响应：
     ```json
     {
       "status": "healthy",
       "model_loaded": true,
       "device": "cuda",
       "model_path": "D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct",
       "message": "服务运行正常，模型加载状态：已加载"
     }
     ```

#### 方法二：使用 curl 验证

1. **打开命令提示符**
2. **运行以下命令**：
   ```bash
   curl http://127.0.0.1:5001/health
   ```
3. **查看响应**：
   - 正常情况下，会返回类似以下 JSON 响应：
     ```json
     {
       "status": "healthy",
       "model_loaded": true,
       "device": "cuda",
       "model_path": "D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct",
       "message": "服务运行正常，模型加载状态：已加载"
     }
     ```

## 故障排除详细指南

### 常见错误及解决方法

#### 1. 模型加载失败

**错误信息**：
```
加载模型失败: Unrecognized processing class in D:\AI_Project\Models . Can't instantiate a processor, a tokenizer, an image processor, a video processor or a feature extractor for this model.
```

**原因**：使用了 Ollama 格式的模型，与 transformers 库不兼容

**解决方法**：
- 从 Hugging Face 下载正确格式的模型
- 确保模型路径指向 Hugging Face 格式的模型目录

#### 2. 依赖缺失

**错误信息**：
```
缺少依赖: No module named 'transformers'
```

**解决方法**：
- 运行 `pip install transformers torch Pillow flask flask-cors` 安装缺失的依赖

#### 3. CUDA 内存不足

**错误信息**：
```
CUDA out of memory
```

**解决方法**：
- 尝试使用 CPU 运行，修改代码中的设备设置：
  ```python
  device = "cpu"  # 强制使用 CPU
  ```
- 或者使用更小的模型，如 Qwen2.5-VL-2B-Instruct

#### 4. 模型路径错误

**错误信息**：
```
错误: 模型路径不存在: D:\AI_Project\Models\Qwen2.5-VL-7B-Instruct
```

**解决方法**：
- 检查模型路径是否正确
- 确保模型已经下载到指定路径
- 检查路径中的反斜杠是否正确（应该使用双反斜杠或单斜杠）

#### 5. 网络问题

**错误信息**：
```
ConnectionError: Could not reach Hugging Face Hub
```

**解决方法**：
- 确保网络连接正常
- 尝试使用代理服务器
- 或者使用已下载的本地模型

## 完整的配置文件

以下是完整的 `qwen_vl_service.py` 配置文件：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Qwen2.5-VL-7B 视觉语言模型服务
提供 HTTP API 接口供 Java 后端调用
"""

import os
import sys

# 修复 OpenMP 库冲突问题
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
os.environ['OMP_NUM_THREADS'] = '1'

# 直接设置模型路径为用户指定的路径
os.environ['QWEN_VL_MODEL_PATH'] = 'D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct'

import json
import base64
import io
from typing import Optional, Dict, Any
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import torch

# 设置模型路径（请根据您的实际路径修改）
MODEL_PATH = os.environ.get("QWEN_VL_MODEL_PATH", "D:\\AI_Project\\Models\\Qwen2.5-VL-7B-Instruct")

app = Flask(__name__)
CORS(app)

# 全局模型实例
model = None
tokenizer = None
processor = None


def load_model():
    """加载 Qwen2.5-VL 模型"""
    global model, tokenizer, processor
    
    try:
        from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
        from qwen_vl_utils import process_vision_info
        
        print(f"正在加载模型: {MODEL_PATH}")
        
        # 加载处理器
        processor = AutoProcessor.from_pretrained(MODEL_PATH, trust_remote_code=True)
        
        # 加载模型
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"使用设备: {device}")
        
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            MODEL_PATH,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
            trust_remote_code=True
        )
        
        if device == "cpu":
            model = model.to(device)
        
        print("模型加载成功！")
        return True
        
    except ImportError as e:
        print(f"缺少依赖: {e}")
        print("请安装: pip install transformers torch Pillow flask flask-cors")
        return False
    except Exception as e:
        print(f"加载模型失败: {e}")
        print("注意：模型加载失败不会影响服务启动，HTTP服务仍会正常运行")
        print("如果您需要使用AI分析功能，请确保模型文件完整且路径正确")
        return False


def analyze_image(image_data: bytes, prompt: str = "描述这张图片") -> str:
    """
    分析图片内容
    
    Args:
        image_data: 图片二进制数据
        prompt: 分析提示词
        
    Returns:
        分析结果文本
    """
    try:
        from qwen_vl_utils import process_vision_info
        
        # 将图片转换为 base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # 构建消息
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "image": f"data:image/jpeg;base64,{image_base64}"
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
        
        # 准备输入
        text = processor.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )
        
        image_inputs, video_inputs = process_vision_info(messages)
        
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt"
        )
        
        # 移动到设备
        device = "cuda" if torch.cuda.is_available() else "cpu"
        inputs = inputs.to(device)
        
        # 生成回答
        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=True,
                temperature=0.7,
                top_p=0.9
            )
        
        # 解码输出
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        
        output_text = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]
        
        return output_text.strip()
        
    except Exception as e:
        return f"分析失败: {str(e)}"


@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'device': 'cuda' if torch.cuda.is_available() else 'cpu',
        'model_path': MODEL_PATH,
        'message': '服务运行正常，模型加载状态：' + ('已加载' if model is not None else '未加载（可能是网络问题或模型路径错误）')
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    分析图片接口
    
    请求体:
    {
        "image": "base64编码的图片",
        "prompt": "分析提示词（可选，默认：描述这张图片）"
    }
    """
    try:
        if model is None:
            return jsonify({
                'status': 'error',
                'message': '模型未加载，请检查模型路径',
                'solution': '请确保使用的是Hugging Face格式的Qwen2.5-VL模型'
            }), 503
        
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'status': 'error',
                'message': '缺少图片数据'
            }), 400
        
        # 解码图片
        image_base64 = data['image']
        image_data = base64.b64decode(image_base64)
        
        # 获取提示词
        prompt = data.get('prompt', '描述这张图片')
        
        # 分析图片
        result = analyze_image(image_data, prompt)
        
        return jsonify({
            'status': 'success',
            'result': result,
            'prompt': prompt
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/analyze_file', methods=['POST'])
def analyze_file():
    """
    分析上传的图片文件接口
    
    请求体:
    - file: 图片文件
    - prompt: 分析提示词（可选，默认：描述这张图片）
    """
    try:
        if model is None:
            return jsonify({
                'status': 'error',
                'message': '模型未加载，请检查模型路径',
                'solution': '请确保使用的是Hugging Face格式的Qwen2.5-VL模型'
            }), 503
        
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'message': '缺少图片文件'
            }), 400
        
        # 获取文件
        file = request.files['file']
        
        # 获取提示词
        prompt = request.form.get('prompt', '描述这张图片')
        
        # 读取文件内容
        image_data = file.read()
        
        # 分析图片
        result = analyze_image(image_data, prompt)
        
        return jsonify({
            'status': 'success',
            'result': result,
            'prompt': prompt
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/batch_analyze', methods=['POST'])
def batch_analyze():
    """
    批量分析图片接口
    
    请求体:
    {
        "images": [
            {
                "image": "base64编码的图片",
                "prompt": "分析提示词（可选，默认：描述这张图片）"
            },
            ...
        ]
    }
    """
    try:
        if model is None:
            return jsonify({
                'status': 'error',
                'message': '模型未加载，请检查模型路径',
                'solution': '请确保使用的是Hugging Face格式的Qwen2.5-VL模型'
            }), 503
        
        data = request.get_json()
        
        if not data or 'images' not in data:
            return jsonify({
                'status': 'error',
                'message': '缺少图片数据'
            }), 400
        
        images = data['images']
        results = []
        
        for item in images:
            try:
                image_base64 = item['image']
                prompt = item.get('prompt', '描述这张图片')
                
                # 解码图片
                image_data = base64.b64decode(image_base64)
                
                # 分析图片
                result = analyze_image(image_data, prompt)
                
                results.append({
                    'status': 'success',
                    'result': result,
                    'prompt': prompt
                })
            except Exception as e:
                results.append({
                    'status': 'error',
                    'message': str(e)
                })
        
        return jsonify({
            'status': 'success',
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


def main():
    """主函数"""
    print("=" * 60)
    print("Qwen2.5-VL-7B 视觉语言模型服务")
    print("=" * 60)
    
    # 加载模型
    if not load_model():
        print("模型加载失败，服务将无法处理请求")
        print("但 HTTP 服务仍会启动，您可以稍后重试加载模型")
    
    # 启动服务
    port = int(os.environ.get('QWEN_VL_PORT', 5001))
    host = os.environ.get('QWEN_VL_HOST', '0.0.0.0')
    
    print(f"\n启动 HTTP 服务: http://{host}:{port}")
    print("API 端点:")
    print(f"  - GET  /health       健康检查")
    print(f"  - POST /analyze      分析图片（base64）")
    print(f"  - POST /analyze_file 分析上传的图片文件")
    print(f"  - POST /batch_analyze 批量分析图片")
    print("=" * 60)
    
    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    main()
```

## 其他注意事项

1. **模型文件大小**：Qwen2.5-VL-7B-Instruct 模型大小约为 6GB，下载需要一定时间和网络带宽

2. **硬件要求**：
   - **GPU 运行**：建议至少 8GB GPU 内存
   - **CPU 运行**：可以运行，但速度会慢很多

3. **服务性能**：
   - 第一次分析图片时会比较慢，因为需要加载模型到内存
   - 后续分析会快很多

4. **安全性**：
   - 这是一个开发服务器，不建议在生产环境中使用
   - 建议在生产环境中使用 WSGI 服务器，如 Gunicorn 或 uWSGI

5. **API 使用示例**：
   - **分析 base64 编码的图片**：
     ```bash
     curl -X POST http://127.0.0.1:5001/analyze \
     -H "Content-Type: application/json" \
     -d '{
       "image": "base64编码的图片",
       "prompt": "描述这张图片"
     }'
     ```

   - **分析上传的图片文件**：
     ```bash
     curl -X POST http://127.0.0.1:5001/analyze_file \
     -F "file=@path/to/image.jpg" \
     -F "prompt=描述这张图片"
     ```

## 总结

按照以上详细步骤，您应该能够成功配置和启动 Qwen2.5-VL 视觉语言模型服务。如果遇到问题，请参考故障排除部分的解决方案。

如果您仍然遇到问题，请提供详细的错误信息，以便我们能够更好地帮助您解决问题。