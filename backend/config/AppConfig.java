package com.yolov8.security.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "app")
public class AppConfig {
    
    // File configuration
    private FileConfig file = new FileConfig();
    
    // Monitor configuration
    private MonitorConfig monitor = new MonitorConfig();
    
    // Python configuration
    private PythonConfig python = new PythonConfig();
    
    // Qwen VL configuration
    private QwenVLConfig qwenVl = new QwenVLConfig();
    
    // Getters
    public FileConfig getFile() {
        return file;
    }
    
    public MonitorConfig getMonitor() {
        return monitor;
    }
    
    public PythonConfig getPython() {
        return python;
    }
    
    public QwenVLConfig getQwenVl() {
        return qwenVl;
    }
    
    // Setters
    public void setFile(FileConfig file) {
        this.file = file;
    }
    
    public void setMonitor(MonitorConfig monitor) {
        this.monitor = monitor;
    }
    
    public void setPython(PythonConfig python) {
        this.python = python;
    }
    
    public void setQwenVl(QwenVLConfig qwenVl) {
        this.qwenVl = qwenVl;
    }
    
    public static class FileConfig {
        private String uploadDir;
        private String videoDir;
        private String modelDir;
        private String resultDir;
        
        // Getters
        public String getUploadDir() {
            return uploadDir;
        }
        public String getVideoDir() {
            return videoDir;
        }
        public String getModelDir() {
            return modelDir;
        }
        public String getResultDir() {
            return resultDir;
        }
        
        // Setters
        public void setUploadDir(String uploadDir) {
            this.uploadDir = uploadDir;
        }
        public void setVideoDir(String videoDir) {
            this.videoDir = videoDir;
        }
        public void setModelDir(String modelDir) {
            this.modelDir = modelDir;
        }
        public void setResultDir(String resultDir) {
            this.resultDir = resultDir;
        }
    }
    
    public static class MonitorConfig {
        private int timeout = 300;
        private int maxRecentDetections = 20;
        private int maxRecentFrames = 5;
        
        // Getters
        public int getTimeout() {
            return timeout;
        }
        public int getMaxRecentDetections() {
            return maxRecentDetections;
        }
        public int getMaxRecentFrames() {
            return maxRecentFrames;
        }
        
        // Setters
        public void setTimeout(int timeout) {
            this.timeout = timeout;
        }
        public void setMaxRecentDetections(int maxRecentDetections) {
            this.maxRecentDetections = maxRecentDetections;
        }
        public void setMaxRecentFrames(int maxRecentFrames) {
            this.maxRecentFrames = maxRecentFrames;
        }
    }
    
    public static class PythonConfig {
        private String scriptPath;
        private String executable;
        
        // Getters
        public String getScriptPath() {
            return scriptPath;
        }
        public String getExecutable() {
            return executable;
        }
        
        // Setters
        public void setScriptPath(String scriptPath) {
            this.scriptPath = scriptPath;
        }
        public void setExecutable(String executable) {
            this.executable = executable;
        }
    }
    
    public static class QwenVLConfig {
        private String serviceUrl = "http://127.0.0.1:5001";
        private String modelPath = "./models/Qwen2.5-VL-7B-Instruct";
        private int timeout = 30000;
        private int maxRetries = 3;
        
        // Getters
        public String getServiceUrl() {
            return serviceUrl;
        }
        public String getModelPath() {
            return modelPath;
        }
        public int getTimeout() {
            return timeout;
        }
        public int getMaxRetries() {
            return maxRetries;
        }
        
        // Setters
        public void setServiceUrl(String serviceUrl) {
            this.serviceUrl = serviceUrl;
        }
        public void setModelPath(String modelPath) {
            this.modelPath = modelPath;
        }
        public void setTimeout(int timeout) {
            this.timeout = timeout;
        }
        public void setMaxRetries(int maxRetries) {
            this.maxRetries = maxRetries;
        }
    }
}