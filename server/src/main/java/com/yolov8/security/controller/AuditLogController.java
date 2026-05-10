package com.yolov8.security.controller;

import com.yolov8.security.model.AuditLog;
import com.yolov8.security.model.ApiResponse;
import com.yolov8.security.service.AuditLogService;
import com.yolov8.security.service.KanbanEventBus;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping("/audit_logs")
    public ResponseEntity<ApiResponse<ApiResponse.PageData<AuditLog>>> getLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            ApiResponse.PageData<AuditLog> result = auditLogService.getLogsPage(page, size, search, category, riskLevel);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/audit_logs/export")
    public ResponseEntity<byte[]> exportLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String riskLevel) {
        try {
            String csv = auditLogService.toCsv(search, category, riskLevel);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit_logs.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/audit_logs/trend")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTrend(
            @RequestParam(defaultValue = "day") String range) {
        try {
            Map<String, Object> trend = auditLogService.getTrendData(range);
            return ResponseEntity.ok(ApiResponse.success(trend));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/audit_logs")
    public ResponseEntity<ApiResponse<AuditLog>> addAuditLog(@RequestBody AuditLog log) {
        try {
            AuditLog added = auditLogService.addLog(log);
            KanbanEventBus.publish("audit_logs", auditLogService.getAllLogs());
            return ResponseEntity.ok(ApiResponse.success("审计日志已创建", added));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("创建审计日志失败: " + e.getMessage()));
        }
    }
}
