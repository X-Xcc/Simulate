package com.yolov8.security.service;

import lombok.Data;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Data
@Service
public class ModelInfoService {
    
    private String status = "online";
    private String precision = "FP16";
    private String device = "GPU";
    private double modelSizeMb = 4096;
    private int totalLayers = 128;
    private int convLayers = 64;
    private int quantizedLayers = 32;
    private boolean gpuAvailable = true;
    private boolean halfPrecision = true;
    private long lastUpdate = System.currentTimeMillis();
    private static final long TIMEOUT = 300000; // 5分钟

    public void updateModelInfo(Map<String, Object> modelInfo) {
        if (modelInfo != null) {
            this.status = "online";
            this.precision = (String) modelInfo.getOrDefault("precision", "FP32");
            this.device = (String) modelInfo.getOrDefault("device", "CPU");
            this.modelSizeMb = ((Number) modelInfo.getOrDefault("model_size_mb", 0)).doubleValue();
            this.totalLayers = ((Number) modelInfo.getOrDefault("total_layers", 0)).intValue();
            this.convLayers = ((Number) modelInfo.getOrDefault("conv_layers", 0)).intValue();
            this.quantizedLayers = ((Number) modelInfo.getOrDefault("quantized_layers", 0)).intValue();
            this.gpuAvailable = (Boolean) modelInfo.getOrDefault("gpu_available", false);
            this.halfPrecision = (Boolean) modelInfo.getOrDefault("half_precision", false);
            this.lastUpdate = System.currentTimeMillis();
        }
    }

    public Map<String, Object> getModelInfo() {
        if (System.currentTimeMillis() - lastUpdate > TIMEOUT) {
            this.status = "offline";
        }
        
        return Map.of(
            "status", status,
            "precision", precision,
            "device", device,
            "model_size_mb", modelSizeMb,
            "total_layers", totalLayers,
            "conv_layers", convLayers,
            "quantized_layers", quantizedLayers,
            "gpu_available", gpuAvailable,
            "half_precision", halfPrecision,
            "last_update", lastUpdate
        );
    }
}
