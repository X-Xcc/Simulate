package com.yolov8.security.service;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.repository.CameraRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class CameraConfigService {

    private static final Logger log = LoggerFactory.getLogger(CameraConfigService.class);
    private final CameraRepository repository;
    private final ObjectMapper objectMapper;
    private final Go2rtcService go2rtcService;
    private final Path camerasJsonPath;
    private final AtomicBoolean migrated = new AtomicBoolean(false);

    public CameraConfigService(CameraRepository repository, ObjectMapper objectMapper,
                               Go2rtcService go2rtcService, AppConfig appConfig) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.go2rtcService = go2rtcService;
        this.camerasJsonPath = Paths.get(appConfig.getPython().getScriptPath()).getParent().resolve("cameras.json");
    }

    @PostConstruct
    public void init() {
        migrateFromJson();
    }

    public Path getCamerasJsonPath() {
        return camerasJsonPath;
    }

    public List<Camera> getAllCameras() {
        return repository.findAll();
    }

    public Camera getCameraById(String id) {
        return repository.findById(id);
    }

    public Camera addCamera(Camera camera) {
        String validationError = validateCamera(camera, false);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }
        if (camera.getId() == null || camera.getId().isEmpty()) {
            camera.setId("cam" + System.currentTimeMillis());
        }
        if (repository.existsById(camera.getId())) {
            throw new IllegalArgumentException("摄像头ID已存在: " + camera.getId());
        }
        String go2rtcId = "cam_" + camera.getId();
        repository.insert(camera, go2rtcId);
        // 联动 go2rtc: rtsp 类型摄像头自动添加流
        if ("rtsp".equals(camera.getType()) && go2rtcService.isApiAvailable()) {
            try {
                go2rtcService.addStream(go2rtcId, String.valueOf(camera.getAddress()));
            } catch (Exception e) {
                log.warn("go2rtc 添加流失败 (摄像头已保存): {}", e.getMessage());
            }
        }
        return camera;
    }

    public Camera updateCamera(String id, Camera camera) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("摄像头不存在: " + id);
        }
        String validationError = validateCamera(camera, true);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }
        camera.setId(id);
        repository.update(camera);
        // 同步 go2rtc 流
        if ("rtsp".equals(camera.getType()) && go2rtcService.isApiAvailable()) {
            String go2rtcId = repository.findGo2rtcIdById(id);
            if (go2rtcId != null) {
                try {
                    go2rtcService.removeStream(go2rtcId);
                    go2rtcService.addStream(go2rtcId, String.valueOf(camera.getAddress()));
                } catch (Exception e) {
                    log.warn("更新 go2rtc 流失败: {}", id, e);
                }
            }
        }
        return camera;
    }

    public boolean deleteCamera(String id) {
        boolean exists = repository.existsById(id);
        if (exists) {
            // 删除前先获取 go2rtcId 用于清理流
            String go2rtcId = repository.findGo2rtcIdById(id);
            repository.deleteById(id);
            // 联动 go2rtc 删除流
            if (go2rtcId != null && go2rtcService.isApiAvailable()) {
                try {
                    go2rtcService.removeStream(go2rtcId);
                } catch (Exception e) {
                    log.warn("go2rtc 删除流失败 (摄像头已删除): {}", e.getMessage());
                }
            }
        }
        return exists;
    }

    private void migrateFromJson() {
        if (!migrated.compareAndSet(false, true)) return;
        if (!Files.exists(camerasJsonPath)) return;
        if (!repository.findAll().isEmpty()) return;
        try {
            CamerasWrapper wrapper = objectMapper.readValue(camerasJsonPath.toFile(), CamerasWrapper.class);
            for (Camera c : wrapper.getCameras()) {
                try {
                    addCamera(c);
                } catch (Exception e) {
                    log.warn("迁移摄像头失败: {}", c.getId(), e);
                }
            }
            log.info("从 cameras.json 迁移了 {} 个摄像头", wrapper.getCameras().size());
        } catch (IOException e) {
            log.error("迁移 cameras.json 失败", e);
        }
    }

    private String validateCamera(Camera camera, boolean isUpdate) {
        if (camera.getType() == null || camera.getType().isEmpty()) {
            return "摄像头类型不能为空";
        }
        if (!camera.getType().equals("usb") && !camera.getType().equals("rtsp") && !camera.getType().equals("http_snapshot")) {
            return "摄像头类型必须是 usb、rtsp 或 http_snapshot";
        }
        if (camera.getAddress() == null) {
            return "摄像头地址不能为空";
        }
        if (camera.getType().equals("usb")) {
            if (camera.getAddress() instanceof String) {
                try {
                    Integer.parseInt((String) camera.getAddress());
                } catch (NumberFormatException e) {
                    return "USB摄像头地址必须是整数";
                }
            } else if (!(camera.getAddress() instanceof Integer)) {
                return "USB摄像头地址必须是整数";
            }
        } else {
            if (!(camera.getAddress() instanceof String) || ((String) camera.getAddress()).isEmpty()) {
                return "RTSP/HTTP摄像头地址必须是非空字符串";
            }
        }
        if (camera.getName() == null || camera.getName().isEmpty()) {
            return "摄像头名称不能为空";
        }
        return null;
    }

    // --- Inner classes ---

    public static class CamerasWrapper {
        private List<Camera> cameras = new ArrayList<>();

        public List<Camera> getCameras() { return cameras; }
        public void setCameras(List<Camera> cameras) { this.cameras = cameras; }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Camera {
        private String id;
        private String type;
        private Object address;
        private String name;
        @JsonAlias("user")
        private String username;
        private String password;
        private String brand;
        private String model;
        private String ip;
        private int port = 554;
        private int channel = 1;
        private String status = "offline";
        private boolean enabled = true;
        private String go2rtcId;

        public Camera() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Object getAddress() { return address; }
        public void setAddress(Object address) { this.address = address; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getBrand() { return brand; }
        public void setBrand(String brand) { this.brand = brand; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getIp() { return ip; }
        public void setIp(String ip) { this.ip = ip; }
        public int getPort() { return port; }
        public void setPort(int port) { this.port = port; }
        public int getChannel() { return channel; }
        public void setChannel(int channel) { this.channel = channel; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getGo2rtcId() { return go2rtcId; }
        public void setGo2rtcId(String go2rtcId) { this.go2rtcId = go2rtcId; }
    }
}
