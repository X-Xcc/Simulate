package com.yolov8.security.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.*;

@RestController
@RequestMapping("/api")
public class SystemMetricsController {

    private static volatile double latestGpuPercent = 0;
    private static volatile long lastFrameUpdate = 0;

    public static void updateGpuPercent(double gpuPercent) {
        latestGpuPercent = gpuPercent;
    }

    public static void notifyFrameReceived() {
        lastFrameUpdate = System.currentTimeMillis();
    }

    public static double getLatestGpuPercent() { return latestGpuPercent; }
    public static long getLastFrameUpdate() { return lastFrameUpdate; }

    @GetMapping("/system_metrics")
    public Map<String, Object> getMetrics() {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            com.sun.management.OperatingSystemMXBean os =
                (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
            m.put("cpuPercent", Math.round(os.getSystemCpuLoad() * 100));
            long total = os.getTotalPhysicalMemorySize();
            long free = os.getFreePhysicalMemorySize();
            m.put("memoryPercent", Math.round((double)(total - free) / total * 100));
            File root = new File(".");
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
        return m;
    }
}
