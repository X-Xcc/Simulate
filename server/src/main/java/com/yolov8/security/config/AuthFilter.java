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
        "/", "/index", "/login", "/monitor", "/admin", "/annotate",
        "/static/**", "/css/**", "/js/**", "/error", "/api/login",
        "/video_feed", "/api/images/**"
    };

    // GET-only public API paths (monitor dashboard data)
    private static final String[] PUBLIC_GET_API_PATHS = {
        "/api/stats", "/api/stats/summary", "/api/stats/trend",
        "/api/camera_config", "/api/cameras"
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
        for (String pub : PUBLIC_PATHS) {
            if (matcher.match(pub, path)) {
                return true;
            }
        }
        // GET-only public API paths for monitor dashboard
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            for (String pub : PUBLIC_GET_API_PATHS) {
                if (path.equals(pub)) {
                    return true;
                }
            }
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

        // All unauthorized requests return 401 JSON
        // Client-side JS (authFetch) handles redirect to login for browser requests
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\":\"error\",\"message\":\"Unauthorized\"}");
    }
}
