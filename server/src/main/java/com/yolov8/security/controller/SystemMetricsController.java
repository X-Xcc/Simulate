package com.yolov8.security.controller;

import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.service.CameraConfigService;
import com.yolov8.security.service.DetectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.lang.management.ManagementFactory;
import java.util.*;

@RestController
@RequestMapping("/api")
public class SystemMetricsController {

    private static volatile double latestGpuPercent = 0;
    private static volatile long lastFrameUpdate = 0;

    private final CameraConfigService cameraConfigService;
    private final DetectionService detectionService;

    public SystemMetricsController(CameraConfigService cameraConfigService, DetectionService detectionService) {
        this.cameraConfigService = cameraConfigService;
        this.detectionService = detectionService;
    }

    public static void updateGpuPercent(double gpuPercent) {
        latestGpuPercent = gpuPercent;
    }

    public static void notifyFrameReceived() {
        lastFrameUpdate = System.currentTimeMillis();
    }

    public static double getLatestGpuPercent() { return latestGpuPercent; }
    public static long getLastFrameUpdate() { return lastFrameUpdate; }

    @GetMapping("/system_metrics")
    public ApiResponse<Map<String, Object>> getMetrics() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            com.sun.management.OperatingSystemMXBean os =
                (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
            m.put("cpuPercent", Math.round(os.getSystemCpuLoad() * 100));
            long total = os.getTotalPhysicalMemorySize();
            long free = os.getFreePhysicalMemorySize();
            m.put("memoryPercent", Math.round((double)(total - free) / total * 100));
            java.io.File root = new java.io.File(".");
            long totalD = root.getTotalSpace();
            m.put("diskPercent", Math.round((double)(totalD - root.getUsableSpace()) / totalD * 100));
        } catch (Exception e) {
            m.put("cpuPercent", 0);
            m.put("memoryPercent", 0);
            m.put("diskPercent", 0);
        }
        m.put("gpuPercent", latestGpuPercent);

        boolean yoloHealthy = (System.currentTimeMillis() - lastFrameUpdate) < 30000;
        List<Map<String, String>> services = new ArrayList<>();
        services.add(Map.of("name", "API Server", "status", "Running"));
        services.add(Map.of("name", "YOLOv8 Service", "status", yoloHealthy ? "Running" : "Warning"));
        services.add(Map.of("name", "Stream Gateway", "status", "Running"));
        m.put("services", services);
        m.put("version", "v2.4.1-stable");
        m.put("engine", "YOLOv8n-Pose");
        m.put("coreEngine", "TensorRT 8.6");

        // Uptime
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        long days = uptimeMs / 86400000;
        long hours = (uptimeMs % 86400000) / 3600000;
        long minutes = (uptimeMs % 3600000) / 60000;
        m.put("uptime", days + "d " + hours + "h " + minutes + "m");

        // Camera stats
        try {
            var cameras = cameraConfigService.getAllCameras();
            m.put("totalDevices", cameras.size());
            long onlineCount = cameras.stream()
                .filter(c -> (System.currentTimeMillis() - lastFrameUpdate) < 30000)
                .count();
            m.put("onlineDevices", (int) onlineCount);
        } catch (Exception e) {
            m.put("totalDevices", 0);
            m.put("onlineDevices", 0);
        }
        m.put("activeModels", 1);
        m.put("totalModels", 1);

        // Detection stats
        try {
            var sysInfo = detectionService.getSystemInfo();
            m.put("dataDirSizeMb", sysInfo.dataDirSizeMb());
            m.put("detectionCount", sysInfo.detectionCount());
            m.put("imageCount", sysInfo.imageCount());
        } catch (Exception e) {
            m.put("dataDirSizeMb", 0);
            m.put("detectionCount", 0);
            m.put("imageCount", 0);
        }

        return ApiResponse.success(m);
    }
}
