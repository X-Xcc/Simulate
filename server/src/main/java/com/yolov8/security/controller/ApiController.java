package com.yolov8.security.controller;

import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.service.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ApiController {

    private static final Logger log = LoggerFactory.getLogger(ApiController.class);
    private final SettingsService settingsService;

    public ApiController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    // --- Settings endpoints ---

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<SettingsService.Settings>> getSettings() {
        try {
            SettingsService.Settings settings = settingsService.getSettings();
            return ResponseEntity.ok(ApiResponse.success(settings));
        } catch (Exception e) {
            log.error("Error getting settings", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("读取设置失败: " + e.getMessage()));
        }
    }

    @PostMapping("/settings")
    public ResponseEntity<ApiResponse<SettingsService.Settings>> updateSettings(@RequestBody SettingsService.Settings settings) {
        try {
            settingsService.updateSettings(settings);
            return ResponseEntity.ok(ApiResponse.success("设置已保存", settingsService.getSettings()));
        } catch (Exception e) {
            log.error("Error updating settings", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("保存设置失败: " + e.getMessage()));
        }
    }
}
