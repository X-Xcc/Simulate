package com.yolov8.security.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Service
public class SettingsService {

    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);
    private final Path settingsPath;
    private final ObjectMapper objectMapper;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    private static final Settings DEFAULTS = new Settings(0.5, 0.45, 100, 50, 30, 60);

    public SettingsService(AppConfig appConfig, ObjectMapper objectMapper) {
        this.settingsPath = Paths.get(appConfig.getFile().getUploadDir(), "settings.json");
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        Path tmpPath = settingsPath.getParent().resolve("settings.json.tmp");
        try { Files.deleteIfExists(tmpPath); } catch (IOException e) {
            log.warn("Failed to clean up settings.json.tmp", e);
        }
    }

    public Settings getSettings() {
        lock.readLock().lock();
        try {
            if (!Files.exists(settingsPath)) {
                return new Settings(DEFAULTS.getConfidence(), DEFAULTS.getIou(),
                        DEFAULTS.getInterval(), DEFAULTS.getMaxPeople(),
                        DEFAULTS.getCooldown(), DEFAULTS.getFatigueThreshold());
            }
            Settings stored = objectMapper.readValue(settingsPath.toFile(), Settings.class);
            return stored.withDefaults(DEFAULTS);
        } catch (IOException e) {
            log.error("Failed to read settings.json, returning defaults", e);
            return new Settings(DEFAULTS.getConfidence(), DEFAULTS.getIou(),
                    DEFAULTS.getInterval(), DEFAULTS.getMaxPeople(),
                    DEFAULTS.getCooldown(), DEFAULTS.getFatigueThreshold());
        } finally {
            lock.readLock().unlock();
        }
    }

    public void updateSettings(Settings updates) {
        lock.writeLock().lock();
        try {
            Settings current = getSettings();
            Settings merged = current.merge(updates);
            writeConfig(merged);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void writeConfig(Settings settings) {
        Path tmpPath = settingsPath.getParent().resolve("settings.json.tmp");
        try {
            Files.createDirectories(settingsPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tmpPath.toFile(), settings);
            Files.move(tmpPath, settingsPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("Failed to write settings.json", e);
            try { Files.deleteIfExists(tmpPath); } catch (IOException ignored) {}
            throw new RuntimeException("写入配置失败: " + e.getMessage());
        }
    }

    public static class Settings {
        private Double confidence;
        private Double iou;
        private Integer interval;
        private Integer maxPeople;
        private Integer cooldown;
        private Integer fatigueThreshold;

        public Settings() {}

        public Settings(Double confidence, Double iou, Integer interval,
                        Integer maxPeople, Integer cooldown, Integer fatigueThreshold) {
            this.confidence = confidence;
            this.iou = iou;
            this.interval = interval;
            this.maxPeople = maxPeople;
            this.cooldown = cooldown;
            this.fatigueThreshold = fatigueThreshold;
        }

        public Settings merge(Settings update) {
            return new Settings(
                    update.getConfidence() != null ? update.getConfidence() : this.confidence,
                    update.getIou() != null ? update.getIou() : this.iou,
                    update.getInterval() != null ? update.getInterval() : this.interval,
                    update.getMaxPeople() != null ? update.getMaxPeople() : this.maxPeople,
                    update.getCooldown() != null ? update.getCooldown() : this.cooldown,
                    update.getFatigueThreshold() != null ? update.getFatigueThreshold() : this.fatigueThreshold
            );
        }

        public Settings withDefaults(Settings defaults) {
            return new Settings(
                    this.confidence != null ? this.confidence : defaults.confidence,
                    this.iou != null ? this.iou : defaults.iou,
                    this.interval != null ? this.interval : defaults.interval,
                    this.maxPeople != null ? this.maxPeople : defaults.maxPeople,
                    this.cooldown != null ? this.cooldown : defaults.cooldown,
                    this.fatigueThreshold != null ? this.fatigueThreshold : defaults.fatigueThreshold
            );
        }

        public Double getConfidence() { return confidence; }
        public void setConfidence(Double confidence) { this.confidence = confidence; }
        public Double getIou() { return iou; }
        public void setIou(Double iou) { this.iou = iou; }
        public Integer getInterval() { return interval; }
        public void setInterval(Integer interval) { this.interval = interval; }
        public Integer getMaxPeople() { return maxPeople; }
        public void setMaxPeople(Integer maxPeople) { this.maxPeople = maxPeople; }
        public Integer getCooldown() { return cooldown; }
        public void setCooldown(Integer cooldown) { this.cooldown = cooldown; }
        public Integer getFatigueThreshold() { return fatigueThreshold; }
        public void setFatigueThreshold(Integer fatigueThreshold) { this.fatigueThreshold = fatigueThreshold; }
    }
}
