package com.yolov8.security.controller;

import com.yolov8.security.model.DetectionData;
import com.yolov8.security.model.StatsResponse;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.service.DetectionService;
import com.yolov8.security.service.ModelInfoService;
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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.ArrayList;

@RestController
@RequestMapping("/api")
public class StatsController {

    private static final Logger log = LoggerFactory.getLogger(StatsController.class);
    private final DetectionService detectionService;
    private final ModelInfoService modelInfoService;
    private final VideoStreamController videoStreamController;
    private final AppConfig appConfig;

    public StatsController(DetectionService detectionService, ModelInfoService modelInfoService, VideoStreamController videoStreamController, AppConfig appConfig) {
        this.detectionService = detectionService;
        this.modelInfoService = modelInfoService;
        this.videoStreamController = videoStreamController;
        this.appConfig = appConfig;
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
    public ResponseEntity<Map<String, Object>> getTrendStats(@RequestParam(defaultValue = "day") String range) {
        int dataPoints = "week".equals(range) ? 7 : "month".equals(range) ? 30 : 24;
        String labelFormat = "day".equals(range) ? "HH:00" : "MM-dd";
        java.time.format.DateTimeFormatter labelFmt = java.time.format.DateTimeFormatter.ofPattern(labelFormat);
        java.time.format.DateTimeFormatter parseFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        // Initialize buckets
        List<String> labels = new ArrayList<>();
        java.util.Map<String, Integer> bucketCounts = new java.util.LinkedHashMap<>();
        for (int i = dataPoints - 1; i >= 0; i--) {
            java.time.LocalDateTime point = now.minusHours("day".equals(range) ? i : i * 24L);
            String label = point.format(labelFmt);
            labels.add(label);
            bucketCounts.put(label, 0);
        }

        // Aggregate detections into buckets
        try {
            List<com.yolov8.security.model.DetectionData> detections = detectionService.getDetections();
            for (com.yolov8.security.model.DetectionData det : detections) {
                try {
                    java.time.LocalDateTime detTime = java.time.LocalDateTime.parse(det.getTimestamp(), parseFmt);
                    String bucket = detTime.format(labelFmt);
                    if (detTime.isAfter(now.minusHours("day".equals(range) ? dataPoints : dataPoints * 24L))) {
                        bucketCounts.merge(bucket, 1, Integer::sum);
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.warn("Failed to aggregate trend data", e);
        }

        return ResponseEntity.ok(Map.of("labels", labels, "data", new ArrayList<>(bucketCounts.values())));
    }
}
