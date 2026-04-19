package com.yolov8.security.controller;

import com.yolov8.security.service.QwenVLService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class QwenVLController {

    private static final Logger log = LoggerFactory.getLogger(QwenVLController.class);
    private final QwenVLService qwenVLService;
    
    public QwenVLController(QwenVLService qwenVLService) {
        this.qwenVLService = qwenVLService;
    }

    /**
     * 检查 AI 服务状态
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        boolean isHealthy = qwenVLService.isHealthy();
        Map<String, Object> result = new HashMap<>();
        result.put("status", isHealthy ? "online" : "offline");
        result.put("message", isHealthy ? "AI 服务正常运行" : "AI 服务未启动或模型未加载");
        return ResponseEntity.ok(result);
    }

    /**
     * 分析图片（Base64）
     */
    @PostMapping("/analyze")
    public ResponseEntity<Map<String, Object>> analyzeImage(@RequestBody Map<String, String> request) {
        try {
            String base64Image = request.get("image");
            String prompt = request.getOrDefault("prompt", "描述这张图片");

            if (base64Image == null || base64Image.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("status", "error");
                error.put("message", "缺少图片数据");
                return ResponseEntity.badRequest().body(error);
            }

            String result = qwenVLService.analyzeImage(base64Image, prompt);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("result", result);
            response.put("prompt", prompt);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("分析图片失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 分析检测到的安全图片
     */
    @PostMapping("/analyze-security")
    public ResponseEntity<Map<String, Object>> analyzeSecurityImage(@RequestBody Map<String, Object> request) {
        try {
            String imagePath = (String) request.get("imagePath");
            @SuppressWarnings("unchecked")
            List<String> actions = (List<String>) request.get("actions");

            if (imagePath == null || imagePath.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("status", "error");
                error.put("message", "缺少图片路径");
                return ResponseEntity.badRequest().body(error);
            }

            String result = qwenVLService.analyzeSecurityImage(imagePath, actions);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("result", result);
            response.put("imagePath", imagePath);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("分析安全图片失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * 批量分析图片
     */
    @PostMapping("/batch-analyze")
    public ResponseEntity<Map<String, Object>> batchAnalyzeImages(@RequestBody Map<String, Object> request) {
        try {
            @SuppressWarnings("unchecked")
            List<String> images = (List<String>) request.get("images");
            String prompt = (String) request.getOrDefault("prompt", "描述这张图片");

            if (images == null || images.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("status", "error");
                error.put("message", "缺少图片数据");
                return ResponseEntity.badRequest().body(error);
            }

            List<Map<String, Object>> results = qwenVLService.batchAnalyzeImages(images, prompt);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("results", results);
            response.put("total", images.size());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("批量分析图片失败", e);
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
