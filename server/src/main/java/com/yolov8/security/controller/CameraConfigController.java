package com.yolov8.security.controller;

import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.service.CameraConfigService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CameraConfigController {

    private static final Logger log = LoggerFactory.getLogger(CameraConfigController.class);
    private final CameraConfigService cameraConfigService;

    public CameraConfigController(CameraConfigService cameraConfigService) {
        this.cameraConfigService = cameraConfigService;
    }

    @GetMapping("/camera_config")
    public ResponseEntity<ApiResponse<List<CameraConfigService.Camera>>> getCameraConfig() {
        try {
            List<CameraConfigService.Camera> cameras = cameraConfigService.getAllCameras();
            return ResponseEntity.ok(ApiResponse.success(cameras));
        } catch (Exception e) {
            log.error("Error getting camera config", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("读取摄像头配置失败: " + e.getMessage()));
        }
    }

    @PostMapping("/camera_config")
    public ResponseEntity<ApiResponse<CameraConfigService.Camera>> addCamera(@RequestBody CameraConfigService.Camera camera) {
        try {
            CameraConfigService.Camera added = cameraConfigService.addCamera(camera);
            return ResponseEntity.ok(ApiResponse.success("摄像头已添加", added));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error adding camera", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("添加摄像头失败: " + e.getMessage()));
        }
    }

    @PutMapping("/camera_config/{id}")
    public ResponseEntity<ApiResponse<CameraConfigService.Camera>> updateCamera(
            @PathVariable String id, @RequestBody CameraConfigService.Camera camera) {
        try {
            CameraConfigService.Camera updated = cameraConfigService.updateCamera(id, camera);
            return ResponseEntity.ok(ApiResponse.success("摄像头已更新", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating camera", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("更新摄像头失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/camera_config/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteCamera(@PathVariable String id) {
        try {
            boolean deleted = cameraConfigService.deleteCamera(id);
            if (deleted) {
                return ResponseEntity.ok(ApiResponse.success("摄像头已删除", Map.of("deleted", true)));
            } else {
                return ResponseEntity.badRequest().body(ApiResponse.error("摄像头不存在: " + id));
            }
        } catch (Exception e) {
            log.error("Error deleting camera", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("删除摄像头失败: " + e.getMessage()));
        }
    }
}
