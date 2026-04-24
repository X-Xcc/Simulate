package com.yolov8.security.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.concurrent.CompletableFuture;

@Service
public class PythonScriptService {

    private static final Logger log = LoggerFactory.getLogger(PythonScriptService.class);
    private final AppConfig appConfig;
    private final ObjectMapper objectMapper;
    
    public PythonScriptService(AppConfig appConfig, ObjectMapper objectMapper) {
        this.appConfig = appConfig;
        this.objectMapper = objectMapper;
    }

    @Async
    public CompletableFuture<String> executePythonScript(String... args) {
        try {
            String scriptPath = appConfig.getPython().getScriptPath();
            String pythonExecutable = appConfig.getPython().getExecutable();

            File scriptFile = new File(scriptPath);
            if (!scriptFile.exists()) {
                log.error("Python script not found: {}", scriptPath);
                return CompletableFuture.completedFuture("{\"status\":\"error\",\"message\":\"Script not found\"}");
            }

            ProcessBuilder processBuilder = new ProcessBuilder();
            processBuilder.command(pythonExecutable, scriptPath);
            processBuilder.command().addAll(java.util.Arrays.asList(args));
            
            processBuilder.redirectErrorStream(true);

            log.info("Executing Python script: {} {}", scriptPath, String.join(" ", args));

            Process process = processBuilder.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            log.info("Python script exit code: {}", exitCode);

            if (exitCode == 0) {
                return CompletableFuture.completedFuture(output.toString());
            } else {
                log.error("Python script failed with exit code: {}", exitCode);
                return CompletableFuture.completedFuture(
                    "{\"status\":\"error\",\"message\":\"Script execution failed\"}");
            }
        } catch (Exception e) {
            log.error("Error executing Python script", e);
            return CompletableFuture.completedFuture(
                "{\"status\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
        }
    }

    @Async
    public CompletableFuture<Void> startMonitoring() {
        log.info("Starting YOLOv8 monitoring...");
        return executePythonScript().thenAccept(result -> {
            log.info("Monitoring started: {}", result);
        });
    }

    @Async
    public CompletableFuture<Void> stopMonitoring() {
        log.info("Stopping YOLOv8 monitoring...");
        return CompletableFuture.completedFuture(null);
    }
}
