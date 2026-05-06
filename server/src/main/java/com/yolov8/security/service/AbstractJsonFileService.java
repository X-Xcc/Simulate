package com.yolov8.security.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public abstract class AbstractJsonFileService<T> {

    protected final Logger log = LoggerFactory.getLogger(getClass());
    protected final Path filePath;
    protected final ObjectMapper objectMapper;
    protected final ReadWriteLock lock = new ReentrantReadWriteLock();

    protected AbstractJsonFileService(Path filePath, ObjectMapper objectMapper) {
        this.filePath = filePath;
        this.objectMapper = objectMapper;
    }

    protected abstract TypeReference<List<T>> typeRef();

    @PostConstruct
    public void cleanup() {
        Path tmpPath = filePath.getParent().resolve(filePath.getFileName() + ".tmp");
        try {
            Files.deleteIfExists(tmpPath);
        } catch (IOException e) {
            log.warn("Failed to clean up {}", tmpPath.getFileName(), e);
        }
    }

    protected List<T> readConfig() {
        if (!Files.exists(filePath)) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(filePath.toFile(), typeRef());
        } catch (IOException e) {
            log.error("Failed to read {}", filePath.getFileName(), e);
            return new ArrayList<>();
        }
    }

    protected void writeConfig(List<T> data) {
        Path tmpPath = filePath.getParent().resolve(filePath.getFileName() + ".tmp");
        try {
            Files.createDirectories(filePath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tmpPath.toFile(), data);
            try {
                Files.move(tmpPath, filePath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                // Windows 上某些文件系统不支持 ATOMIC_MOVE，回退到普通移动
                log.debug("Atomic move not supported, falling back to regular move: {}", e.getMessage());
                Files.move(tmpPath, filePath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            log.error("Failed to write {}", filePath.getFileName(), e);
            try {
                Files.deleteIfExists(tmpPath);
            } catch (IOException ignored) {
            }
            throw new RuntimeException("写入配置失败: " + e.getMessage());
        }
    }
}
