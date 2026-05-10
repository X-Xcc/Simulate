package com.yolov8.security.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.model.Alert;
import com.yolov8.security.model.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AlertService extends AbstractJsonFileService<Alert> {

    @Autowired
    public AlertService(AppConfig appConfig, ObjectMapper objectMapper) {
        super(Paths.get(appConfig.getFile().getUploadDir()).resolve("alerts.json"), objectMapper);
    }

    @Override
    protected TypeReference<List<Alert>> typeRef() {
        return new TypeReference<>() {};
    }

    public List<Alert> getAllAlerts() {
        lock.readLock().lock();
        try {
            List<Alert> alerts = readConfig();
            return alerts.stream()
                    .sorted(Comparator.comparing(Alert::getTime, Comparator.nullsLast(Comparator.reverseOrder())))
                    .collect(Collectors.toList());
        } finally {
            lock.readLock().unlock();
        }
    }

    public Alert addAlert(Alert alert) {
        lock.writeLock().lock();
        try {
            List<Alert> alerts = readConfig();
            alert.setId("ALERT_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 6));
            if (alert.getStatus() == null) {
                alert.setStatus("pending");
            }
            alerts.add(alert);
            writeConfig(alerts);
            return alert;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void updateAlertStatus(String id, String status) {
        lock.writeLock().lock();
        try {
            List<Alert> alerts = readConfig();
            Alert existing = alerts.stream()
                    .filter(a -> a.getId().equals(id))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("告警不存在: " + id));
            existing.setStatus(status);
            writeConfig(alerts);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public ApiResponse.PageData<Alert> getAlertsPage(int page, int size, String type, String status, String since) {
        lock.readLock().lock();
        try {
            List<Alert> all = readConfig();
            if (all == null) all = java.util.List.of();

            java.util.stream.Stream<Alert> stream = all.stream();

            if (type != null && !type.isEmpty()) {
                stream = stream.filter(a -> type.equals(a.getType()));
            }
            if (status != null && !status.isEmpty()) {
                stream = stream.filter(a -> status.equals(a.getStatus()));
            }
            if (since != null && !since.isEmpty()) {
                stream = stream.filter(a -> a.getTime() != null && a.getTime().compareTo(since) >= 0);
            }

            List<Alert> sorted = stream
                .sorted(Comparator.comparing(Alert::getTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

            int total = sorted.size();
            int fromIndex = Math.min(page * size, total);
            int toIndex = Math.min(fromIndex + size, total);
            List<Alert> pageItems = sorted.subList(fromIndex, toIndex);

            return new ApiResponse.PageData<>(pageItems, total, page, size);
        } finally {
            lock.readLock().unlock();
        }
    }

    public String toCsv(String type, String status, String since) {
        ApiResponse.PageData<Alert> page = getAlertsPage(0, Integer.MAX_VALUE, type, status, since);
        List<Alert> alerts = page.getItems();
        StringBuilder sb = new StringBuilder();
        sb.append("\uFEFFID,\u7C7B\u578B,\u7EA7\u522B,\u65F6\u95F4,\u5730\u70B9,\u72B6\u6001,\u7F6E\u4FE1\u5EA6,\u6D88\u606F\n");
        for (Alert a : alerts) {
            sb.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%.1f,\"%s\"\n",
                esc(a.getId()), esc(a.getType()), esc(a.getLevel()), esc(a.getTime()),
                esc(a.getCameraName()), esc(a.getStatus()), a.getConfidence(), esc(a.getMessage())));
        }
        return sb.toString();
    }

    private static String esc(String v) {
        return v == null ? "" : v.replace("\"", "\"\"");
    }
}
