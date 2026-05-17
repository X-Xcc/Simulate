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
    
    // Cleanup configuration
    private CleanupConfig cleanup = new CleanupConfig();

    // Qwen VL configuration
    private QwenVLConfig qwenVl = new QwenVLConfig();

    // go2rtc configuration
    private Go2rtcConfig go2rtc = new Go2rtcConfig();

    // Demo mode
    private boolean demoMode = false;
    
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
    
    public CleanupConfig getCleanup() {
        return cleanup;
    }

    public void setCleanup(CleanupConfig cleanup) {
        this.cleanup = cleanup;
    }

    public QwenVLConfig getQwenVl() {
        return qwenVl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    private String apiKey;

    private String jwtSecret;

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
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

    public boolean isDemoMode() {
        return demoMode;
    }

    public void setDemoMode(boolean demoMode) {
        this.demoMode = demoMode;
    }

    public Go2rtcConfig getGo2rtc() {
        return go2rtc;
    }

    public void setGo2rtc(Go2rtcConfig go2rtc) {
        this.go2rtc = go2rtc;
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

    public static class CleanupConfig {
        private int retentionDays = 7;

        public int getRetentionDays() { return retentionDays; }
        public void setRetentionDays(int retentionDays) { this.retentionDays = retentionDays; }
    }

    public static class Go2rtcConfig {
        private String binaryPath = "bin/go2rtc.exe";
        private String apiHost = "http://127.0.0.1:1984";
        private String rtspHost = "rtsp://127.0.0.1:8554";
        private int apiPort = 1984;
        private int rtspPort = 8554;
        private int webrtcPort = 8555;

        public String getBinaryPath() { return binaryPath; }
        public void setBinaryPath(String binaryPath) { this.binaryPath = binaryPath; }
        public String getApiHost() { return apiHost; }
        public void setApiHost(String apiHost) { this.apiHost = apiHost; }
        public String getRtspHost() { return rtspHost; }
        public void setRtspHost(String rtspHost) { this.rtspHost = rtspHost; }
        public int getApiPort() { return apiPort; }
        public void setApiPort(int apiPort) { this.apiPort = apiPort; }
        public int getRtspPort() { return rtspPort; }
        public void setRtspPort(int rtspPort) { this.rtspPort = rtspPort; }
        public int getWebrtcPort() { return webrtcPort; }
        public void setWebrtcPort(int webrtcPort) { this.webrtcPort = webrtcPort; }
    }
}