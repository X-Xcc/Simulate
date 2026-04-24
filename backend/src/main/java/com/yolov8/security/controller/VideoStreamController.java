package com.yolov8.security.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
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
import java.util.Random;
import javax.imageio.ImageIO;

@RestController
public class VideoStreamController {

    private static final Logger log = LoggerFactory.getLogger(VideoStreamController.class);

    private volatile BufferedImage latestFrame;
    private volatile long lastFrameId = -1;

    private volatile BufferedImage cachedTestFrame;
    private volatile long cachedTestFrameAtMs;
    private static final long TEST_FRAME_CACHE_MS = 750L;

    public void updateFrame(BufferedImage frame) {
        this.latestFrame = frame;
        this.lastFrameId = System.currentTimeMillis();
    }

    @GetMapping(value = "/video_feed", produces = "multipart/x-mixed-replace;boundary=frame")
    public void getVideoFeed(@RequestParam(required = false) String cam, HttpServletResponse response) {
        response.setContentType("multipart/x-mixed-replace;boundary=frame");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("Pragma", "no-cache");

        try (OutputStream out = response.getOutputStream()) {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    byte[] frameBytes = getCurrentFrameBytes();
                    if (frameBytes.length > 0) {
                        writeFrame(out, frameBytes);
                    }
                } catch (IOException e) {
                    log.debug("Client disconnected during frame write", e);
                    break;
                }
                Thread.sleep(100);
            }
        } catch (IOException e) {
            log.debug("Client disconnected", e);
        } catch (InterruptedException e) {
            log.debug("Video feed interrupted");
            Thread.currentThread().interrupt();
        }
    }

    private byte[] getCurrentFrameBytes() {
        BufferedImage frameToUse = latestFrame;

        if (frameToUse == null) {
            frameToUse = getOrCreateCachedTestFrame();
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(frameToUse, "jpg", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Error encoding frame", e);
            return new byte[0];
        }
    }

    private BufferedImage getOrCreateCachedTestFrame() {
        long now = System.currentTimeMillis();
        BufferedImage cached = cachedTestFrame;
        if (cached != null && (now - cachedTestFrameAtMs) < TEST_FRAME_CACHE_MS) {
            return cached;
        }
        BufferedImage fresh = generateTestFrame();
        cachedTestFrame = fresh;
        cachedTestFrameAtMs = now;
        return fresh;
    }

    private BufferedImage generateTestFrame() {
        int width = 1280;
        int height = 720;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2d = image.createGraphics();

        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        g2d.setColor(new Color(12, 18, 32));
        g2d.fillRect(0, 0, width, height);

        g2d.setColor(new Color(20, 30, 50));
        g2d.fillRect(0, 0, width, height);

        g2d.setColor(new Color(40, 60, 100));
        for (int i = 0; i < width; i += 50) {
            g2d.drawLine(i, 0, i, height);
        }
        for (int i = 0; i < height; i += 50) {
            g2d.drawLine(0, i, width, i);
        }

        Random random = new Random();
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

        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(20, 20, 400, 120);
        g2d.fillRect(width - 320, 20, 300, 80);
        g2d.fillRect(20, height - 100, width - 40, 80);

        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.BOLD, 28));
        String title = "YOLOv8 智能监控系统";
        g2d.drawString(title, 40, 60);

        g2d.setFont(new Font("Microsoft YaHei", Font.PLAIN, 18));
        String subtitle = "实时目标检测 - A区监控";
        g2d.drawString(subtitle, 40, 95);

        g2d.setColor(new Color(16, 185, 129));
        g2d.fillOval(width - 300, 40, 16, 16);
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.BOLD, 16));
        g2d.drawString("系统在线", width - 275, 55);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        String timeStr = sdf.format(new Date());
        g2d.setFont(new Font("Consolas", Font.PLAIN, 16));
        g2d.drawString(timeStr, width - 300, 85);

        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Microsoft YaHei", Font.PLAIN, 18));
        String status1 = "检测人数: " + (2 + random.nextInt(4));
        String status2 = "FPS: " + (25 + random.nextInt(10));
        String status3 = "置信度: " + (78 + random.nextInt(15)) + "%";
        g2d.drawString(status1, 40, height - 65);
        g2d.drawString(status2, 200, height - 65);
        g2d.drawString(status3, 360, height - 65);

        g2d.setColor(new Color(59, 130, 246));
        g2d.setFont(new Font("Microsoft YaHei", Font.PLAIN, 16));
        g2d.drawString("点击「测试报警」按钮查看异常报告功能", width - 450, height - 60);

        g2d.dispose();
        return image;
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
