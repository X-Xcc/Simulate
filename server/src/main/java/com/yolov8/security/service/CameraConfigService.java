package com.yolov8.security.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Service
public class CameraConfigService {

    private static final Logger log = LoggerFactory.getLogger(CameraConfigService.class);
    private final AppConfig appConfig;
    private final ObjectMapper objectMapper;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    public CameraConfigService(AppConfig appConfig, ObjectMapper objectMapper) {
        this.appConfig = appConfig;
        this.objectMapper = objectMapper;
    }

    public Path getCamerasJsonPath() {
        return Paths.get(appConfig.getPython().getScriptPath()).getParent().resolve("cameras.json");
    }

    public List<Camera> getAllCameras() {
        lock.readLock().lock();
        try {
            CamerasWrapper wrapper = readConfig();
            return wrapper != null ? wrapper.getCameras() : new ArrayList<>();
        } finally {
            lock.readLock().unlock();
        }
    }

    public Camera getCameraById(String id) {
        lock.readLock().lock();
        try {
            CamerasWrapper wrapper = readConfig();
            if (wrapper == null) return null;
            return wrapper.getCameras().stream()
                    .filter(c -> c.getId().equals(id))
                    .findFirst().orElse(null);
        } finally {
            lock.readLock().unlock();
        }
    }

    public Camera addCamera(Camera camera) {
        lock.writeLock().lock();
        try {
            CamerasWrapper wrapper = readConfig();
            if (wrapper == null) {
                wrapper = new CamerasWrapper();
                wrapper.setCameras(new ArrayList<>());
            }

            // Validate
            String validationError = validateCamera(camera, false);
            if (validationError != null) {
                throw new IllegalArgumentException(validationError);
            }

            // Auto-generate ID if not provided
            if (camera.getId() == null || camera.getId().isEmpty()) {
                camera.setId(generateId(wrapper.getCameras()));
            }

            // Check duplicate ID
            boolean exists = wrapper.getCameras().stream()
                    .anyMatch(c -> c.getId().equals(camera.getId()));
            if (exists) {
                throw new IllegalArgumentException("摄像头ID已存在: " + camera.getId());
            }

            wrapper.getCameras().add(camera);
            writeConfig(wrapper);
            return camera;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public Camera updateCamera(String id, Camera camera) {
        lock.writeLock().lock();
        try {
            CamerasWrapper wrapper = readConfig();
            if (wrapper == null) {
                throw new IllegalArgumentException("摄像头配置文件不存在");
            }

            int index = -1;
            for (int i = 0; i < wrapper.getCameras().size(); i++) {
                if (wrapper.getCameras().get(i).getId().equals(id)) {
                    index = i;
                    break;
                }
            }
            if (index == -1) {
                throw new IllegalArgumentException("摄像头不存在: " + id);
            }

            // Validate
            String validationError = validateCamera(camera, true);
            if (validationError != null) {
                throw new IllegalArgumentException(validationError);
            }

            camera.setId(id); // preserve original ID
            wrapper.getCameras().set(index, camera);
            writeConfig(wrapper);
            return camera;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public boolean deleteCamera(String id) {
        lock.writeLock().lock();
        try {
            CamerasWrapper wrapper = readConfig();
            if (wrapper == null) return false;

            boolean removed = wrapper.getCameras().removeIf(c -> c.getId().equals(id));
            if (removed) {
                writeConfig(wrapper);
            }
            return removed;
        } finally {
            lock.writeLock().unlock();
        }
    }

    private CamerasWrapper readConfig() {
        Path path = getCamerasJsonPath();
        if (!Files.exists(path)) {
            return null;
        }
        try {
            return objectMapper.readValue(path.toFile(), CamerasWrapper.class);
        } catch (IOException e) {
            log.error("Failed to read cameras.json", e);
            return null;
        }
    }

    private void writeConfig(CamerasWrapper wrapper) throws RuntimeException {
        Path path = getCamerasJsonPath();
        Path tmpPath = path.getParent().resolve("cameras.json.tmp");
        try {
            Files.createDirectories(path.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tmpPath.toFile(), wrapper);
            Files.move(tmpPath, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to write cameras.json", e);
            throw new RuntimeException("写入摄像头配置失败: " + e.getMessage());
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
            if (!(camera.getAddress() instanceof Integer)) {
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

    private String generateId(List<Camera> cameras) {
        int maxNum = -1;
        for (Camera c : cameras) {
            String id = c.getId();
            if (id != null && id.startsWith("cam")) {
                try {
                    int num = Integer.parseInt(id.substring(3));
                    if (num > maxNum) maxNum = num;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return "cam" + (maxNum + 1);
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
        private String user;
        private String password;

        public Camera() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Object getAddress() { return address; }
        public void setAddress(Object address) { this.address = address; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getUser() { return user; }
        public void setUser(String user) { this.user = user; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}
