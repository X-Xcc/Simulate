package com.yolov8.security.service;

import com.yolov8.security.config.DemoProperties;
import com.yolov8.security.model.Alert;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class FakeAlertService {

    private static final Logger log = LoggerFactory.getLogger(FakeAlertService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // 行为类型定义：类型名, 级别
    private static final String[][] ACTION_DEFS = {
        {"人员聚集", "low"},
        {"离岗", "medium"},
    };

    private final AlertService alertService;
    private final CameraConfigService cameraConfigService;
    private final DemoProperties demoProperties;

    @Value("${app.fake-alert.enabled:false}")
    private boolean enabled;

    @Value("${app.fake-alert.min-count:10}")
    private int minCount;

    @Value("${app.fake-alert.max-count:15}")
    private int maxCount;

    public FakeAlertService(AlertService alertService,
                            CameraConfigService cameraConfigService,
                            DemoProperties demoProperties) {
        this.alertService = alertService;
        this.cameraConfigService = cameraConfigService;
        this.demoProperties = demoProperties;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!enabled) {
            log.debug("FakeAlertService: disabled, skipping");
            return;
        }
        if (demoProperties.isEnabled()) {
            log.info("FakeAlertService: demo mode is active, skipping (DemoService handles data generation)");
            return;
        }

        List<CameraConfigService.Camera> cameras = cameraConfigService.getAllCameras();
        if (cameras == null || cameras.isEmpty()) {
            log.info("FakeAlertService: no cameras configured, skipping");
            return;
        }

        // 统计今天已有的 simulated 告警
        String today = LocalDate.now().format(DATE_FMT);
        List<Alert> allAlerts = alertService.getAllAlerts();
        long todaySimulatedCount = allAlerts.stream()
                .filter(Alert::isSimulated)
                .filter(a -> a.getTime() != null && a.getTime().startsWith(today))
                .count();

        if (todaySimulatedCount >= minCount) {
            log.info("FakeAlertService: today already has {} simulated alerts (>= {}), skipping",
                    todaySimulatedCount, minCount);
            return;
        }

        int targetCount = ThreadLocalRandom.current().nextInt(minCount, maxCount + 1);
        int toGenerate = targetCount - (int) todaySimulatedCount;
        if (toGenerate <= 0) return;

        log.info("FakeAlertService: generating {} simulated alerts for today", toGenerate);

        // 生成随机时间戳（08:00 - 22:00），然后排序
        long[] timestamps = new long[toGenerate];
        long todayStart = LocalDateTime.of(LocalDate.now(), LocalTime.of(8, 0))
                .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        long todayEnd = LocalDateTime.of(LocalDate.now(), LocalTime.of(22, 0))
                .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();

        for (int i = 0; i < toGenerate; i++) {
            timestamps[i] = ThreadLocalRandom.current().nextLong(todayStart, todayEnd);
        }
        java.util.Arrays.sort(timestamps);

        ThreadLocalRandom rng = ThreadLocalRandom.current();

        for (int i = 0; i < toGenerate; i++) {
            // 随机选择行为类型（60% 人员聚集，40% 离岗）
            String[] actionDef = rng.nextDouble() < 0.6 ? ACTION_DEFS[0] : ACTION_DEFS[1];
            String actionType = actionDef[0];
            String level = actionDef[1];

            // 随机选择摄像头
            CameraConfigService.Camera cam = cameras.get(rng.nextInt(cameras.size()));

            // 构造告警
            Alert alert = new Alert();
            alert.setType(actionType);
            alert.setLevel(level);
            alert.setTime(TS_FMT.format(LocalDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(timestamps[i]),
                    java.time.ZoneId.systemDefault())));
            alert.setCameraName(cam.getName());
            alert.setCameraId(cam.getId());
            alert.setConfidence(Math.round((72 + rng.nextDouble() * 21) * 100.0) / 100.0);
            alert.setMessage(cam.getName() + " 检测到" + actionType + "行为");
            alert.setStatus("pending");
            alert.setSimulated(true);

            alertService.addAlert(alert);
        }

        log.info("FakeAlertService: generated {} simulated alerts", toGenerate);
    }
}
