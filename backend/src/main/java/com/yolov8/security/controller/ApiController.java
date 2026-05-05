package com.yolov8.security.controller;

import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.model.DetectionData;
import com.yolov8.security.model.StatsResponse;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.service.CameraConfigService;
import com.yolov8.security.service.DetectionService;
import com.yolov8.security.service.DeviceService;
import com.yolov8.security.service.ModelInfoService;
import com.yolov8.security.service.SettingsService;
import com.yolov8.security.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private static final Logger log = LoggerFactory.getLogger(ApiController.class);
    private final DetectionService detectionService;
    private final ModelInfoService modelInfoService;
    private final VideoStreamController videoStreamController;
    private final AppConfig appConfig;
    private final CameraConfigService cameraConfigService;
    private final SettingsService settingsService;
    private final UserService userService;
    private final DeviceService deviceService;

    public ApiController(DetectionService detectionService, ModelInfoService modelInfoService, VideoStreamController videoStreamController, AppConfig appConfig, CameraConfigService cameraConfigService, SettingsService settingsService, UserService userService, DeviceService deviceService) {
        this.detectionService = detectionService;
        this.modelInfoService = modelInfoService;
        this.videoStreamController = videoStreamController;
        this.appConfig = appConfig;
        this.cameraConfigService = cameraConfigService;
        this.settingsService = settingsService;
        this.userService = userService;
        this.deviceService = deviceService;
    }

    @GetMapping("/stats/summary")
    public ResponseEntity<Map<String, Object>> getStatsSummary() {
        try {
            Map<String, Object> summary = detectionService.getStatsSummary();
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error getting stats summary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<StatsResponse> getStats() {
        try {
            StatsResponse stats = detectionService.getStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error getting stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/detections")
    public ResponseEntity<List<DetectionData>> getDetections() {
        try {
            List<DetectionData> detections = detectionService.getDetections();
            return ResponseEntity.ok(detections);
        } catch (Exception e) {
            log.error("Error getting detections", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/recent_frames")
    public ResponseEntity<List<String>> getRecentFrames() {
        try {
            List<String> frames = detectionService.getRecentFrames();
            return ResponseEntity.ok(frames);
        } catch (Exception e) {
            log.error("Error getting recent frames", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/all_frames")
    public ResponseEntity<List<String>> getAllFrames() {
        try {
            List<String> frames = detectionService.getAllFrames();
            return ResponseEntity.ok(frames);
        } catch (Exception e) {
            log.error("Error getting all frames", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/images")
    public ResponseEntity<Map<String, Object>> getAllImages() {
        try {
            Map<String, Object> result = detectionService.getAllImages();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error getting all images", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/images/{filename}")
    public ResponseEntity<Resource> getImage(@PathVariable String filename) {
        try {
            Path base = Paths.get(appConfig.getFile().getUploadDir()).toAbsolutePath().normalize();
            Path imagePath = base.resolve(filename).normalize();
            if (!imagePath.startsWith(base)) {
                return ResponseEntity.notFound().build();
            }
            if (!Files.exists(imagePath) || !Files.isRegularFile(imagePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(imagePath);
            String lower = filename.toLowerCase();
            MediaType mediaType = lower.endsWith(".png")
                    ? MediaType.IMAGE_PNG
                    : MediaType.IMAGE_JPEG;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            log.error("Error getting image: {}", filename, e);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/monitor_status")
    public ResponseEntity<Map<String, Object>> getMonitorStatus() {
        try {
            Map<String, Object> status = detectionService.getMonitorStatus();
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            log.error("Error getting monitor status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/delete_all_images")
    public ResponseEntity<Map<String, Object>> deleteAllImages() {
        try {
            Map<String, Object> result = detectionService.deleteAllImages();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error deleting images", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/open_folder")
    public ResponseEntity<Map<String, Object>> openFolder(@RequestBody Map<String, String> request) {
        try {
            String folderType = request.get("folder_type");
            Map<String, Object> result = detectionService.openFolder(folderType);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error opening folder", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/update_frame")
    public ResponseEntity<Map<String, Object>> updateFrame(
            @RequestParam("frame") MultipartFile frame,
            @RequestParam(value = "cam", required = false, defaultValue = "0") String cam) {
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(frame.getBytes());
            BufferedImage frameImg = ImageIO.read(bais);
            videoStreamController.updateFrame(frameImg, cam);
            
            Map<String, Object> result = Map.of(
                "status", "success",
                "message", "Frame received"
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error updating frame", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/model_info")
    public ResponseEntity<Map<String, Object>> updateModelInfo(@RequestBody Map<String, Object> modelInfo) {
        try {
            modelInfoService.updateModelInfo(modelInfo);
            Map<String, Object> result = Map.of(
                "status", "success",
                "message", "Model info updated"
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error updating model info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/model_info")
    public ResponseEntity<Map<String, Object>> getModelInfo() {
        try {
            Map<String, Object> modelInfo = modelInfoService.getModelInfo();
            return ResponseEntity.ok(modelInfo);
        } catch (Exception e) {
            log.error("Error getting model info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/system_info")
    public ResponseEntity<Map<String, Object>> getSystemInfo() {
        try {
            Map<String, Object> info = detectionService.getSystemInfo();
            return ResponseEntity.ok(info);
        } catch (Exception e) {
            log.error("Error getting system info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // --- Camera Config endpoints ---

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

    // --- Settings endpoints ---

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<SettingsService.Settings>> getSettings() {
        try {
            SettingsService.Settings settings = settingsService.getSettings();
            return ResponseEntity.ok(ApiResponse.success(settings));
        } catch (Exception e) {
            log.error("Error getting settings", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("读取设置失败: " + e.getMessage()));
        }
    }

    @PostMapping("/settings")
    public ResponseEntity<ApiResponse<SettingsService.Settings>> updateSettings(@RequestBody SettingsService.Settings settings) {
        try {
            settingsService.updateSettings(settings);
            return ResponseEntity.ok(ApiResponse.success("设置已保存", settingsService.getSettings()));
        } catch (Exception e) {
            log.error("Error updating settings", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("保存设置失败: " + e.getMessage()));
        }
    }

    // --- User endpoints ---

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<UserService.User>>> getUsers() {
        try {
            List<UserService.User> users = userService.getAllUsers();
            return ResponseEntity.ok(ApiResponse.success(users));
        } catch (Exception e) {
            log.error("Error getting users", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("读取用户列表失败: " + e.getMessage()));
        }
    }

    @PostMapping("/users")
    public ResponseEntity<ApiResponse<UserService.User>> addUser(@RequestBody UserService.User user) {
        try {
            UserService.User added = userService.addUser(user);
            return ResponseEntity.ok(ApiResponse.success("用户已创建", added));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error adding user", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("创建用户失败: " + e.getMessage()));
        }
    }

    @PutMapping("/users/{username}")
    public ResponseEntity<ApiResponse<UserService.User>> updateUser(
            @PathVariable String username, @RequestBody UserService.User user) {
        try {
            UserService.User updated = userService.updateUser(username, user);
            return ResponseEntity.ok(ApiResponse.success("用户已更新", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating user", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("更新用户失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/users/{username}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteUser(@PathVariable String username) {
        try {
            boolean deleted = userService.deleteUser(username);
            if (deleted) {
                return ResponseEntity.ok(ApiResponse.success("用户已删除", Map.of("deleted", true)));
            } else {
                return ResponseEntity.badRequest().body(ApiResponse.error("用户不存在: " + username));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error deleting user", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("删除用户失败: " + e.getMessage()));
        }
    }

    // --- Device endpoints ---

    @GetMapping("/devices")
    public ResponseEntity<ApiResponse<List<DeviceService.Device>>> getDevices() {
        try {
            List<DeviceService.Device> devices = deviceService.getAllDevices();
            return ResponseEntity.ok(ApiResponse.success(devices));
        } catch (Exception e) {
            log.error("Error getting devices", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("读取设备列表失败: " + e.getMessage()));
        }
    }

    @PostMapping("/devices")
    public ResponseEntity<ApiResponse<DeviceService.Device>> addDevice(@RequestBody DeviceService.Device device) {
        try {
            DeviceService.Device added = deviceService.addDevice(device);
            return ResponseEntity.ok(ApiResponse.success("设备已添加", added));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error adding device", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("添加设备失败: " + e.getMessage()));
        }
    }

    @PutMapping("/devices/{id}")
    public ResponseEntity<ApiResponse<DeviceService.Device>> updateDevice(
            @PathVariable String id, @RequestBody DeviceService.Device device) {
        try {
            DeviceService.Device updated = deviceService.updateDevice(id, device);
            return ResponseEntity.ok(ApiResponse.success("设备已更新", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating device", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("更新设备失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/devices/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteDevice(@PathVariable String id) {
        try {
            boolean deleted = deviceService.deleteDevice(id);
            if (deleted) {
                return ResponseEntity.ok(ApiResponse.success("设备已删除", Map.of("deleted", true)));
            } else {
                return ResponseEntity.badRequest().body(ApiResponse.error("设备不存在: " + id));
            }
        } catch (Exception e) {
            log.error("Error deleting device", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("删除设备失败: " + e.getMessage()));
        }
    }
}
