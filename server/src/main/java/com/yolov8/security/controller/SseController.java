package com.yolov8.security.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.service.AlertService;
import com.yolov8.security.service.AuditLogService;
import com.yolov8.security.service.CameraConfigService;
import com.yolov8.security.service.KanbanEventBus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
public class SseController {

    private final Set<SseEmitter> emitters = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper;
    private final ObjectMapper compactMapper;
    private final CameraConfigService cameraConfigService;
    private final AlertService alertService;
    private final AuditLogService auditLogService;
    private final VideoStreamController videoStreamController;

    public SseController(ObjectMapper objectMapper, CameraConfigService cameraConfigService,
                         AlertService alertService, AuditLogService auditLogService,
                         VideoStreamController videoStreamController) {
        this.objectMapper = objectMapper;
        this.compactMapper = objectMapper.copy();
        this.compactMapper.disable(com.fasterxml.jackson.databind.SerializationFeature.INDENT_OUTPUT);
        this.cameraConfigService = cameraConfigService;
        this.alertService = alertService;
        this.auditLogService = auditLogService;
        this.videoStreamController = videoStreamController;

        // Subscribe to event bus
        KanbanEventBus.subscribe((eventType, data) -> broadcast(eventType, data));

        // Periodic system_metrics + camera_stats push (2s)
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sse-metrics-pusher");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(() -> {
            try {
                var metrics = collectSystemMetrics();
                broadcast("system_metrics", metrics);
                broadcast("camera_stats", videoStreamController.getCameraStats());
            } catch (Exception ignored) {}
        }, 2, 2, TimeUnit.SECONDS);
    }

    @GetMapping(value = "/api/sse/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError((e) -> emitters.remove(emitter));

        // Send initial data snapshot
        try {
            sendEvent(emitter, "cameras", cameraConfigService.getAllCameras());
            sendEvent(emitter, "alerts", alertService.getAllAlerts());
            sendEvent(emitter, "audit_logs", auditLogService.getAllLogs());
            sendEvent(emitter, "system_metrics", collectSystemMetrics());
        } catch (Exception e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    private void broadcast(String eventType, Object data) {
        String json;
        try {
            json = compactMapper.writeValueAsString(data);
        } catch (Exception e) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name(eventType).data(json));
            } catch (IOException e) {
                emitters.remove(emitter);
            }
        }
    }

    private void sendEvent(SseEmitter emitter, String eventType, Object data) throws IOException {
        String json = compactMapper.writeValueAsString(data);
        emitter.send(SseEmitter.event().name(eventType).data(json));
    }

    @SuppressWarnings("all")
    private Map<String, Object> collectSystemMetrics() {
        try {
            com.sun.management.OperatingSystemMXBean osBean =
                    (com.sun.management.OperatingSystemMXBean) java.lang.management.ManagementFactory.getOperatingSystemMXBean();
            java.io.File root = java.io.File.listRoots().length > 0 ? java.io.File.listRoots()[0] : new java.io.File(".");

            double cpuPercent = Math.round(osBean.getSystemCpuLoad() * 100);
            long total = osBean.getTotalPhysicalMemorySize();
            long free = osBean.getFreePhysicalMemorySize();
            double memoryPercent = Math.round((double)(total - free) / total * 100);
            double diskPercent = Math.round((double) (root.getTotalSpace() - root.getUsableSpace()) / root.getTotalSpace() * 100);

            boolean yoloHealthy = (System.currentTimeMillis() - SystemMetricsController.getLastFrameUpdate()) < 30000;
            return Map.of(
                "cpuPercent", cpuPercent,
                "memoryPercent", memoryPercent,
                "diskPercent", diskPercent,
                "gpuPercent", SystemMetricsController.getLatestGpuPercent(),
                "version", "v2.4.1-stable",
                "engine", "Spring Boot + YOLOv8",
                "services", java.util.List.of(
                    java.util.Map.of("name", "API Server", "status", "Running"),
                    java.util.Map.of("name", "YOLOv8 Service", "status", yoloHealthy ? "Running" : "Warning"),
                    java.util.Map.of("name", "Stream Gateway", "status", "Running")
                )
            );
        } catch (Exception e) {
            return Map.of(
                "cpuPercent", 0, "memoryPercent", 0, "diskPercent", 0,
                "gpuPercent", 0, "version", "unknown", "engine", "unknown",
                "services", java.util.List.of()
            );
        }
    }
}
