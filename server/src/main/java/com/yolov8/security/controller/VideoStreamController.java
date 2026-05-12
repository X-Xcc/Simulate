package com.yolov8.security.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletResponse;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;

@RestController
public class VideoStreamController {

    private static final Logger log = LoggerFactory.getLogger(VideoStreamController.class);

    @Value("${app.video.stream-poll-interval-ms:16}")
    private int streamPollIntervalMs;

    @Value("${app.video.no-frame-poll-interval-ms:200}")
    private int noFramePollIntervalMs;

    @Value("${app.video.frame-ttl-ms:30000}")
    private long frameTtlMs;

    /** Multi-camera frame storage: camId -> latest frame bytes (JPEG) */
    private final Map<String, byte[]> latestFrameBytes = new ConcurrentHashMap<>();
    private final Map<String, Long> lastFrameIds = new ConcurrentHashMap<>();

    /** Test frame cache per camera */
    private final Map<String, BufferedImage> cachedTestFrames = new ConcurrentHashMap<>();
    private final Map<String, Long> cachedTestFrameAtMs = new ConcurrentHashMap<>();
    private static final long TEST_FRAME_CACHE_MS = 750L;

    /** Default camera ID */
    private static final String DEFAULT_CAM = "0";

    /**
     * Update frame for a specific camera. Converts to JPEG bytes immediately.
     */
    public void updateFrame(BufferedImage frame, String camId) {
        String id = (camId != null && !camId.isEmpty()) ? camId : DEFAULT_CAM;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(frame, "jpg", baos);
            latestFrameBytes.put(id, baos.toByteArray());
            lastFrameIds.put(id, System.currentTimeMillis());
        } catch (IOException e) {
            log.error("Error encoding frame for cam={}", id, e);
        }
    }

    /**
     * Update frame with person count (used by StatsController).
     */
    public void updateFrame(BufferedImage frame, String camId, int personCount) {
        updateFrame(frame, camId);
    }

    /**
     * Legacy single-camera update (backward compatible).
     */
    public void updateFrame(BufferedImage frame) {
        updateFrame(frame, DEFAULT_CAM);
    }

    /**
     * MJPEG video feed endpoint. Supports ?cam=0, ?cam=1, etc.
     */
    @GetMapping(value = "/video_feed")
    public void getVideoFeed(@RequestParam(required = false, defaultValue = DEFAULT_CAM) String cam,
                             HttpServletResponse response) {
        response.setContentType("multipart/x-mixed-replace;boundary=frame");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("Pragma", "no-cache");

        try (OutputStream out = response.getOutputStream()) {
            byte[] lastSentFrame = null;
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    byte[] frameBytes = getFrameBytes(cam);
                    if (frameBytes != null && frameBytes.length > 0) {
                        if (!java.util.Arrays.equals(frameBytes, lastSentFrame)) {
                            writeFrame(out, frameBytes);
                            lastSentFrame = frameBytes;
                            Thread.sleep(streamPollIntervalMs);
                        } else {
                            Thread.sleep(streamPollIntervalMs / 2);
                        }
                    } else {
                        byte[] testFrame = getTestFrameBytes(cam);
                        if (testFrame.length > 0) {
                            writeFrame(out, testFrame);
                        }
                        Thread.sleep(noFramePollIntervalMs);
                    }
                } catch (IOException e) {
                    log.debug("Client disconnected during frame write (cam={})", cam);
                    break;
                }
            }
        } catch (IOException e) {
            log.debug("Client disconnected (cam={})", cam);
        } catch (InterruptedException e) {
            log.debug("Video feed interrupted (cam={})", cam);
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Get list of active cameras (for API).
     */
    @GetMapping(value = "/api/cameras", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getCameras() {
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("status", "success");
        result.put("cameras", latestFrameBytes.keySet());
        result.put("count", latestFrameBytes.size());
        return result;
    }

    /** Camera stats for SSE broadcasting */
    public Map<String, Object> getCameraStats() {
        Map<String, Object> stats = new java.util.LinkedHashMap<>();
        long now = System.currentTimeMillis();
        java.util.List<Map<String, Object>> camList = new java.util.ArrayList<>();
        for (Map.Entry<String, byte[]> entry : latestFrameBytes.entrySet()) {
            Map<String, Object> info = new java.util.LinkedHashMap<>();
            info.put("id", entry.getKey());
            Long ts = lastFrameIds.get(entry.getKey());
            info.put("online", ts != null && (now - ts) < frameTtlMs);
            camList.add(info);
        }
        stats.put("cameras", camList);
        stats.put("activeCount", latestFrameBytes.size());
        return stats;
    }

    private byte[] getFrameBytes(String cam) {
        // Check TTL — expire stale frames
        Long ts = lastFrameIds.get(cam);
        if (ts != null && System.currentTimeMillis() - ts > frameTtlMs) {
            latestFrameBytes.remove(cam);
            lastFrameIds.remove(cam);
            return null;
        }
        return latestFrameBytes.get(cam);
    }

    private byte[] getTestFrameBytes(String cam) {
        BufferedImage testFrame = getOrCreateCachedTestFrame(cam);
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(testFrame, "jpg", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            return new byte[0];
        }
    }

    private BufferedImage getOrCreateCachedTestFrame(String cam) {
        long now = System.currentTimeMillis();
        BufferedImage cached = cachedTestFrames.get(cam);
        Long cachedAt = cachedTestFrameAtMs.get(cam);
        if (cached != null && cachedAt != null && (now - cachedAt) < TEST_FRAME_CACHE_MS) {
            return cached;
        }
        BufferedImage fresh = generateTestFrame(cam);
        cachedTestFrames.put(cam, fresh);
        cachedTestFrameAtMs.put(cam, now);
        return fresh;
    }

    private BufferedImage generateTestFrame(String cam) {
        int width = 1280;
        int height = 720;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();

        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        // Background
        g2d.setColor(new Color(12, 18, 32));
        g2d.fillRect(0, 0, width, height);

        // Grid
        g2d.setColor(new Color(40, 60, 100));
        for (int i = 0; i < width; i += 50) g2d.drawLine(i, 0, i, height);
        for (int i = 0; i < height; i += 50) g2d.drawLine(0, i, width, i);

        // Camera-specific label
        String camLabel = getCameraLabel(cam);

        // Detection boxes
        Random random = new Random(cam.hashCode()); // Deterministic per camera
        int boxCount = 2 + random.nextInt(3);
        for (int i = 0; i < boxCount; i++) {
            int boxX = 100 + random.nextInt(width - 400);
            int boxY = 150 + random.nextInt(height - 350);
            int boxWidth = 150 + random.nextInt(100);
            int boxHeight = 200 + random.nextInt(100);

            Color boxColor;
            String label;
            if (random.nextBoolean()) {
                boxColor = new Color(239, 68, 68);
                label = "person: " + (75 + random.nextInt(20)) + "%";
            } else {
                boxColor = new Color(245, 158, 11);
                label = "object: " + (65 + random.nextInt(25)) + "%";
            }

            g2d.setColor(boxColor);
            g2d.drawRect(boxX, boxY, boxWidth, boxHeight);
            g2d.fillRect(boxX, boxY, g2d.getFontMetrics().stringWidth(label) + 16, 24);

            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Consolas", Font.BOLD, 14));
            g2d.drawString(label, boxX + 8, boxY + 17);
        }

        // Info panels
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(20, 20, 400, 120);
        g2d.fillRect(width - 320, 20, 300, 80);
        g2d.fillRect(20, height - 100, width - 40, 80);

        // Title
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.BOLD, 28));
        g2d.drawString("YOLOv8 智能监控系统", 40, 60);

        g2d.setFont(new Font("Microsoft YaHei", Font.PLAIN, 18));
        g2d.drawString("实时目标检测 - " + camLabel, 40, 95);

        // Status
        g2d.setColor(new Color(16, 185, 129));
        g2d.fillOval(width - 300, 40, 16, 16);
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.BOLD, 16));
        g2d.drawString("系统在线", width - 275, 55);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        g2d.setFont(new Font("Consolas", Font.PLAIN, 16));
        g2d.drawString(sdf.format(new Date()), width - 300, 85);

        // Stats
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.PLAIN, 18));
        g2d.drawString("检测人数: " + (2 + random.nextInt(4)), 40, height - 65);
        g2d.drawString("FPS: " + (25 + random.nextInt(10)), 200, height - 65);
        g2d.drawString("置信度: " + (78 + random.nextInt(15)) + "%", 360, height - 65);

        g2d.dispose();
        return image;
    }

    private String getCameraLabel(String cam) {
        switch (cam) {
            case "0": return "A区-主监控";
            case "1": return "B区-走廊";
            case "2": return "C区-操场";
            default: return "摄像头 " + cam;
        }
    }

    private void writeFrame(OutputStream out, byte[] frameBytes) throws IOException {
        out.write(("--frame\r\n").getBytes());
        out.write(("Content-Type: image/jpeg\r\n").getBytes());
        out.write(("Content-Length: " + frameBytes.length + "\r\n").getBytes());
        out.write(("\r\n").getBytes());
        out.write(frameBytes);
        out.write(("\r\n").getBytes());
        out.flush();
    }
}
