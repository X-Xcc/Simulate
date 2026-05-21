package com.yolov8.security.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class AuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthFilter.class);
    private static final String HEADER = "X-API-Key";
    private static final String[] PUBLIC_PATHS = {
        "/", "/index", "/annotation", "/annotation.html",
        "/static/**", "/error", "/api/login", "/api/cleanup",
        "/video_feed", "/api/images/**",
        "/dashboard", "/monitor", "/alerts", "/devices",
        "/evidence", "/analysis", "/maintenance", "/audit",
        "/monitor/**", "/assets/**",
        "/api/detection/start", "/api/detection/stop", "/api/detection/status",
        "/api/upload_training_resource",
        "/api/annotations/**",
        "/api/update_frame", "/api/model_info", "/api/gpu_status",
        "/api/discover"
    };

    // GET-only public API paths (monitor dashboard data)
    private static final String[] PUBLIC_GET_API_PATHS = {
        "/api/stats", "/api/stats/summary", "/api/stats/trend",
        "/api/camera_config", "/api/cameras",
        "/api/model_info", "/api/ai/status", "/api/system_metrics",
        "/api/system_info", "/api/devices", "/api/me",
        "/api/alerts", "/api/audit_logs", "/api/sse/stream", "/api/streams/status"
    };

    @Value("${app.api-key:}")
    private String apiKey;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    private final AntPathMatcher matcher = new AntPathMatcher();
    private SecretKey jwtKey;

    @PostConstruct
    public void init() {
        if (jwtSecret != null && !jwtSecret.isBlank()) {
            this.jwtKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            log.info("JWT auth enabled");
        } else {
            this.jwtKey = null;
            log.warn("JWT secret is not configured, JWT auth will be disabled");
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        String cp = request.getContextPath();
        if (!cp.isEmpty() && path.startsWith(cp)) {
            path = path.substring(cp.length());
        }
        if (path.isEmpty()) {
            path = "/";
        }
        // All GET requests are public
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        // POST /api/login and /api/cleanup are public
        for (String p : PUBLIC_PATHS) {
            if (matcher.match(p, path)) return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (apiKey != null && !apiKey.isBlank()) {
            String key = request.getHeader(HEADER);
            if (key != null && MessageDigest.isEqual(
                    apiKey.getBytes(StandardCharsets.UTF_8),
                    key.getBytes(StandardCharsets.UTF_8))) {
                chain.doFilter(request, response);
                return;
            }
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ") && jwtKey != null) {
            String token = authHeader.substring(7);
            try {
                Jwts.parser()
                        .verifyWith(jwtKey)
                        .build()
                        .parseSignedClaims(token);
                chain.doFilter(request, response);
                return;
            } catch (Exception e) {
                log.debug("JWT validation failed: {}", e.getMessage());
            }
        }

        log.warn("Unauthorized access {} from {}", request.getRequestURI(), request.getRemoteAddr());

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\":\"error\",\"message\":\"Unauthorized\"}");
    }
}
