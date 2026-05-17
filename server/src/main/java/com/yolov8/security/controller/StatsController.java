package com.yolov8.security.controller;

import com.yolov8.security.model.Alert;
import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.model.DetectionData;
import com.yolov8.security.model.StatsResponse;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.config.DataCleanupTask;
import com.yolov8.security.service.AlertService;
import com.yolov8.security.service.CameraConfigService;
import com.yolov8.security.service.DetectionService;
import com.yolov8.security.service.KanbanEventBus;
import com.yolov8.security.service.ModelInfoService;
import com.yolov8.security.service.PythonScriptService;
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
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class StatsController {

    private static final Logger log = LoggerFactory.getLogger(StatsController.class);
    private final RestTemplate restTemplate = new RestTemplate();

    private static final java.util.Map<String, String> ALARM_TYPE_MAP = java.util.Map.of(
        "fight", "打架",
        "fall", "跌倒",
        "suicide", "自杀",
        "gathering", "异常聚集"
    );
    private final DetectionService detectionService;
    private final ModelInfoService modelInfoService;
    private final VideoStreamController videoStreamController;
    private final AppConfig appConfig;
    private final AlertService alertService;
    private final CameraConfigService cameraConfigService;
    private final DataCleanupTask dataCleanupTask;
    private final PythonScriptService pythonScriptService;

    public StatsController(DetectionService detectionService, ModelInfoService modelInfoService,
                           VideoStreamController videoStreamController, AppConfig appConfig,
                           AlertService alertService, CameraConfigService cameraConfigService,
                           DataCleanupTask dataCleanupTask, PythonScriptService pythonScriptService) {
        this.detectionService = detectionService;
        this.modelInfoService = modelInfoService;
        this.videoStreamController = videoStreamController;
        this.appConfig = appConfig;
        this.alertService = alertService;
        this.cameraConfigService = cameraConfigService;
        this.dataCleanupTask = dataCleanupTask;
        this.pythonScriptService = pythonScriptService;
    }

    @GetMapping("/stats/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatsSummary() {
        try {
            List<Alert> alerts = alertService.getAllAlerts();
            String today = java.time.LocalDate.now().toString();
            String yesterday = java.time.LocalDate.now().minusDays(1).toString();
            String[] behaviors = {"打架", "跌倒", "离岗", "人员聚集"};

            // Count today & yesterday per behavior
            Map<String, Integer> todayCounts = new LinkedHashMap<>();
            Map<String, Integer> yesterdayCounts = new LinkedHashMap<>();
            for (String b : behaviors) {
                todayCounts.put(b, 0);
                yesterdayCounts.put(b, 0);
            }

            for (Alert a : alerts) {
                if (a.getTime() == null) continue;
                String date = a.getTime().substring(0, 10);
                String type = a.getType();
                if (today.equals(date)) {
                    todayCounts.merge(type, 1, Integer::sum);
                } else if (yesterday.equals(date)) {
                    yesterdayCounts.merge(type, 1, Integer::sum);
                }
            }

            // behaviorCounts = today's counts
            Map<String, Integer> behaviorCounts = new LinkedHashMap<>();
            int total = 0;
            for (String b : behaviors) {
                int count = todayCounts.getOrDefault(b, 0);
                behaviorCounts.put(b, count);
                total += count;
            }

            // compare = today vs yesterday with change %
            Map<String, Object> compare = new LinkedHashMap<>();
            for (String b : behaviors) {
                int t = todayCounts.getOrDefault(b, 0);
                int y = yesterdayCounts.getOrDefault(b, 0);
                double change = y > 0 ? ((double)(t - y) / y * 100) : (t > 0 ? 100.0 : 0.0);
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("today", t);
                item.put("yesterday", y);
                item.put("change", Math.round(change * 10.0) / 10.0);
                compare.put(b, item);
            }

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("behaviorCounts", behaviorCounts);
            summary.put("total", total);
            summary.put("compare", compare);

            return ResponseEntity.ok(ApiResponse.success(summary));
        } catch (Exception e) {
            log.error("Error getting stats summary", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<StatsResponse>> getStats() {
        try {
            StatsResponse stats = detectionService.getStats();
            return ResponseEntity.ok(ApiResponse.success(stats));
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

    @GetMapping("/images/{folder}/{filename}")
    public ResponseEntity<Resource> getImageInFolder(@PathVariable String folder,
                                                      @PathVariable String filename) {
        try {
            Path base = Paths.get(appConfig.getFile().getUploadDir()).toAbsolutePath().normalize();
            String fullPath = folder + "/" + filename;
            Path imagePath = base.resolve(fullPath).normalize();
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
            log.error("Error getting image: {}/{}", folder, filename, e);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/monitor_status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMonitorStatus() {
        try {
            Map<String, Object> status = detectionService.getMonitorStatus();
            return ResponseEntity.ok(ApiResponse.success(status));
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

    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupOldFiles() {
        try {
            dataCleanupTask.cleanOldFiles();
            return ResponseEntity.ok(Map.of("status", "success", "message", "Cleanup triggered"));
        } catch (Exception e) {
            log.error("Manual cleanup failed", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
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
            @RequestParam(value = "cam", required = false, defaultValue = "0") String cam,
            @RequestParam(value = "person_count", required = false, defaultValue = "0") int personCount) {
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(frame.getBytes());
            BufferedImage frameImg = ImageIO.read(bais);
            videoStreamController.updateFrame(frameImg, cam, personCount);
            SystemMetricsController.notifyFrameReceived();

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

    @PostMapping("/gpu_status")
    public ResponseEntity<Map<String, Object>> updateGpuStatus(@RequestBody Map<String, Object> gpuData) {
        try {
            Object gpuPercent = gpuData.get("gpuPercent");
            if (gpuPercent instanceof Number) {
                SystemMetricsController.updateGpuPercent(((Number) gpuPercent).doubleValue());
            }
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (Exception e) {
            log.error("Error updating GPU status", e);
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
    public ResponseEntity<ApiResponse<Map<String, Object>>> getModelInfo() {
        try {
            Map<String, Object> modelInfo = modelInfoService.getModelInfo();
            return ResponseEntity.ok(ApiResponse.success(modelInfo));
        } catch (Exception e) {
            log.error("Error getting model info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/system_info")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSystemInfo() {
        try {
            Map<String, Object> info = detectionService.getSystemInfo();
            return ResponseEntity.ok(ApiResponse.success(info));
        } catch (Exception e) {
            log.error("Error getting system info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv() {
        try {
            List<DetectionData> detections = detectionService.getDetections();
            StringBuilder csv = new StringBuilder();
            csv.append("timestamp,person_count,actions,fps,image_filename\n");
            for (DetectionData det : detections) {
                csv.append(String.format("\"%s\",%d,\"%s\",%.1f,\"%s\"\n",
                    det.getTimestamp(),
                    det.getPersonCount(),
                    det.getActions() != null ? String.join(";", det.getActions()) : "",
                    det.getFps(),
                    det.getImageFilename() != null ? det.getImageFilename() : ""
                ));
            }
            byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=detections.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
        } catch (Exception e) {
            log.error("导出CSV失败", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/stats/trend")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTrendStats(@RequestParam(defaultValue = "day") String range) {
        int dataPoints = "week".equals(range) ? 7 : "month".equals(range) ? 30 : 24;
        String labelFormat = "day".equals(range) ? "HH:00" : "MM-dd";
        java.time.format.DateTimeFormatter labelFmt = java.time.format.DateTimeFormatter.ofPattern(labelFormat);
        java.time.format.DateTimeFormatter parseFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        // Initialize 4 behavior buckets
        List<String> labels = new ArrayList<>();
        String[] behaviorTypes = {"打架", "跌倒", "离岗", "人员聚集"};
        java.util.Map<String, java.util.Map<String, Integer>> behaviorBuckets = new java.util.LinkedHashMap<>();
        for (String type : behaviorTypes) {
            java.util.Map<String, Integer> bucket = new java.util.LinkedHashMap<>();
            for (int i = dataPoints - 1; i >= 0; i--) {
                java.time.LocalDateTime point = now.minusHours("day".equals(range) ? i : i * 24L);
                String label = point.format(labelFmt);
                bucket.put(label, 0);
            }
            behaviorBuckets.put(type, bucket);
        }
        labels.addAll(behaviorBuckets.get(behaviorTypes[0]).keySet());

        // Aggregate from alerts (spread across the day, not just recent detection files)
        try {
            List<Alert> alerts = alertService.getAllAlerts();
            for (Alert alert : alerts) {
                try {
                    java.time.LocalDateTime alertTime = java.time.LocalDateTime.parse(alert.getTime(), parseFmt);
                    String bucket = alertTime.format(labelFmt);
                    if (alertTime.isAfter(now.minusHours("day".equals(range) ? dataPoints : dataPoints * 24L))) {
                        String type = alert.getType();
                        java.util.Map<String, Integer> behBucket = behaviorBuckets.get(type);
                        if (behBucket != null && behBucket.containsKey(bucket)) {
                            behBucket.merge(bucket, 1, Integer::sum);
                        }
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.warn("Failed to aggregate trend data from alerts", e);
        }

        // Build per-behavior data lists
        java.util.Map<String, List<Integer>> dataByBehavior = new java.util.LinkedHashMap<>();
        for (String type : behaviorTypes) {
            dataByBehavior.put(type, new ArrayList<>(behaviorBuckets.get(type).values()));
        }

        return ResponseEntity.ok(ApiResponse.success(Map.of("labels", labels, "data", dataByBehavior)));
    }

    @GetMapping("/stats/regional")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getRegionalStats() {
        try {
            List<Alert> alerts = alertService.getAllAlerts();
            Map<String, Long> counts = new LinkedHashMap<>();
            for (Alert a : alerts) {
                String name = a.getCameraName() != null ? a.getCameraName() : "未知";
                counts.merge(name, 1L, Long::sum);
            }
            List<Map<String, Object>> result = new ArrayList<>();
            String[] colors = {"#0051ae", "#0058be", "#bf8700", "#7c4dff", "#c2c6d6"};
            int i = 0;
            for (var entry : counts.entrySet()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", entry.getKey());
                item.put("value", entry.getValue());
                item.put("color", colors[i % colors.length]);
                result.add(item);
                i++;
            }
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Error getting regional stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stats/compare")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatsCompare() {
        try {
            Map<String, Object> compare = detectionService.getCompareData();
            return ResponseEntity.ok(ApiResponse.success(compare));
        } catch (Exception e) {
            log.error("Error getting compare data", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stats/fps")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFpsStats() {
        try {
            Map<String, Object> fps = detectionService.getFpsStats();
            return ResponseEntity.ok(ApiResponse.success(fps));
        } catch (Exception e) {
            log.error("Error getting FPS stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/evidence/list")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getEvidenceList(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String camera,
            @RequestParam(required = false) String type,
            @RequestParam(required = false, name = "actions_only") String actionsOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<DetectionData> allDetections = detectionService.getDetections();
            java.util.stream.Stream<DetectionData> stream = allDetections.stream();

            if (date != null && !date.isEmpty()) {
                String prefix = date;
                stream = stream.filter(d -> d.getTimestamp() != null && d.getTimestamp().startsWith(prefix));
            }
            if (camera != null && !camera.isEmpty()) {
                stream = stream.filter(d -> camera.equals(d.getCameraId()));
            }
            if (type != null && !type.isEmpty()) {
                stream = stream.filter(d -> d.getActions() != null && d.getActions().contains(type));
            }
            // When browsing "all clips", only show detections that have images
            if (!"true".equals(actionsOnly)) {
                stream = stream.filter(d -> d.getImageFilename() != null);
            }

            // Sort newest first
            List<DetectionData> filtered = stream
                .sorted((a, b) -> {
                    String ta = a.getTimestamp() != null ? a.getTimestamp() : "";
                    String tb = b.getTimestamp() != null ? b.getTimestamp() : "";
                    return tb.compareTo(ta);
                })
                .collect(Collectors.toList());
            int total = filtered.size();
            int from = Math.min(page * size, total);
            int to = Math.min(from + size, total);
            List<DetectionData> pageItems = filtered.subList(from, to);

            // Build response with image URLs
            List<Map<String, Object>> items = new ArrayList<>();
            for (DetectionData det : pageItems) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", det.getId());
                item.put("timestamp", det.getTimestamp());
                item.put("actions", det.getActions());
                item.put("personCount", det.getPersonCount());
                item.put("cameraName", det.getCameraName());
                item.put("cameraId", det.getCameraId());
                item.put("imageFilename", det.getImageFilename());
                item.put("snapshotUrl", det.getImageFilename() != null ? "/api/images/" + det.getImageFilename() : null);
                item.put("confidence", det.getFps());
                items.add(item);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("items", items);
            result.put("total", total);
            result.put("page", page);
            result.put("size", size);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Error getting evidence list", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/evidence/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getEvidenceStats() {
        try {
            List<Alert> alerts = alertService.getAllAlerts();
            int total = 0;
            int archived = 0;
            int critical = 0;
            for (Alert a : alerts) {
                if (a.getSnapshotUrl() != null && !a.getSnapshotUrl().isEmpty()) total++;
                if ("confirmed".equals(a.getStatus())) archived++;
                if ("critical".equals(a.getLevel())) critical++;
            }
            int onlineDevices = 0, totalDevices = 0;
            try {
                var cameras = cameraConfigService.getAllCameras();
                totalDevices = cameras.size();
                onlineDevices = (int) cameras.stream()
                    .filter(c -> (System.currentTimeMillis() - SystemMetricsController.getLastFrameUpdate()) < 30000)
                    .count();
            } catch (Exception ignored) {}
            double onlineRate = totalDevices > 0 ? Math.round((double) onlineDevices / totalDevices * 1000.0) / 10.0 : 0;

            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("total", total);
            stats.put("archived", archived);
            stats.put("critical", critical);
            stats.put("onlineRate", onlineRate);
            return ResponseEntity.ok(ApiResponse.success(stats));
        } catch (Exception e) {
            log.error("Error getting evidence stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/detection/start")
    public ResponseEntity<ApiResponse<Map<String, Object>>> startDetection() {
        try {
            Map<String, Object> result = pythonScriptService.startMonitoring();
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Error starting detection", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/detection/stop")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stopDetection() {
        try {
            Map<String, Object> result = pythonScriptService.stopMonitoring();
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("Error stopping detection", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/detection/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDetectionStatus() {
        try {
            boolean running = pythonScriptService.isRunning();
            return ResponseEntity.ok(ApiResponse.success(Map.of("running", running)));
        } catch (Exception e) {
            log.error("Error getting detection status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/screenshot")
    public ResponseEntity<ApiResponse<Map<String, Object>>> takeScreenshot(
            @RequestBody Map<String, Object> body) {
        try {
            String type = (String) body.get("type");
            if (type == null || type.isBlank()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("type 参数必填"));
            }
            String zhType = ALARM_TYPE_MAP.get(type);
            if (zhType == null) {
                return ResponseEntity.badRequest()
                    .body(ApiResponse.error("不支持的报警类型: " + type + "，可选: fight/fall/suicide/gathering"));
            }

            // 获取摄像头列表
            final List<String> filterIds;
            Object rawCameraIds = body.get("cameraIds");
            if (rawCameraIds instanceof List<?> rawList) {
                filterIds = rawList.stream().filter(String.class::isInstance).map(String.class::cast).collect(Collectors.toList());
            } else {
                filterIds = java.util.List.of();
            }
            List<CameraConfigService.Camera> allCams = cameraConfigService.getAllCameras();
            List<CameraConfigService.Camera> targets;
            if (!filterIds.isEmpty()) {
                targets = allCams.stream()
                    .filter(c -> filterIds.contains(c.getId()))
                    .collect(Collectors.toList());
            } else {
                targets = allCams;
            }
            if (targets.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("没有可用的摄像头"));
            }

            String go2rtcHost = appConfig.getGo2rtc().getApiHost();
            List<String> alertIds = new ArrayList<>();
            int saved = 0;
            List<String> failures = new ArrayList<>();

            for (CameraConfigService.Camera cam : targets) {
                String go2rtcId = cam.getGo2rtcId();
                if (go2rtcId == null || go2rtcId.isBlank()) {
                    go2rtcId = "cam_" + cam.getId();
                }
                try {
                    String snapshotUrl = go2rtcHost + "/api/frame.jpeg?src=" + go2rtcId;
                    byte[] jpeg = restTemplate.getForObject(snapshotUrl, byte[].class);
                    if (jpeg == null || jpeg.length == 0) {
                        failures.add(cam.getId() + ": 空响应");
                        continue;
                    }

                    // 存储 detection + frame
                    List<String> actions = List.of(zhType);
                    DetectionData det = detectionService.saveManualDetection(
                        jpeg, cam.getId(), cam.getName(), actions);

                    // 创建 Alert
                    Alert alert = new Alert();
                    alert.setType(zhType);
                    alert.setLevel("suicide".equals(type) ? "high" : "medium");
                    alert.setTime(det.getTimestamp());
                    alert.setCameraId(cam.getId());
                    alert.setCameraName(cam.getName());
                    alert.setImageFilename(det.getImageFilename());
                    alert.setSnapshotUrl("/api/images/" + det.getImageFilename());
                    alert.setMessage("手动报警: " + zhType);
                    alert.setConfidence(100.0);
                    alertService.addAlert(alert);
                    alertIds.add(alert.getId());
                    saved++;
                } catch (Exception e) {
                    log.warn("摄像头 {} 截图失败: {}", cam.getId(), e.getMessage());
                    failures.add(cam.getId() + ": " + e.getMessage());
                }
            }

            if (saved == 0) {
                return ResponseEntity.status(503)
                    .body(ApiResponse.error("截图服务不可用: " + String.join("; ", failures)));
            }

            // SSE 广播更新的报警列表
            KanbanEventBus.publish("alerts", alertService.getAllAlerts());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("saved", saved);
            result.put("alertIds", alertIds);
            if (!failures.isEmpty()) {
                result.put("failures", failures);
            }
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            log.error("截图接口异常", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("截图失败: " + e.getMessage()));
        }
    }

    @PostMapping("/upload_training_resource")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadTrainingResource(
            @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("文件为空"));
            }

            String originalName = file.getOriginalFilename();
            if (originalName == null) {
                return ResponseEntity.badRequest().body(ApiResponse.error("文件名为空"));
            }

            String ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
            if (!ext.matches("\\.(mp4|avi|jpg|jpeg|png)")) {
                return ResponseEntity.badRequest().body(ApiResponse.error("仅支持 MP4/AVI/JPG/PNG 格式"));
            }

            String type = (ext.equals(".mp4") || ext.equals(".avi")) ? "video" : "image";
            String uniqueName = "training_" + System.currentTimeMillis() + ext;

            Path dir = Paths.get(appConfig.getFile().getUploadDir(), "training");
            Files.createDirectories(dir);
            Path target = dir.resolve(uniqueName);
            Files.copy(file.getInputStream(), target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            log.info("训练素材已上传: {} -> {}", originalName, target);

            Map<String, Object> result = Map.of(
                "filename", uniqueName,
                "originalName", originalName,
                "size", file.getSize(),
                "type", type,
                "path", "/data/training/" + uniqueName
            );
            return ResponseEntity.ok(ApiResponse.success("上传成功", result));
        } catch (Exception e) {
            log.error("训练素材上传失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("上传失败: " + e.getMessage()));
        }
    }
}
