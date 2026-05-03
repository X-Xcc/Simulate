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
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class AuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthFilter.class);
    private static final String HEADER = "X-API-Key";
    private static final String[] PUBLIC_PATHS = {
        "/", "/index", "/admin", "/monitor", "/login", "/static/**", "/error", "/api/login",
        "/video_feed", "/api/images/**", "/api/update_frame", "/api/stats", "/api/model_info", "/api/ai/**",
        "/api/system_info"
    };

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final AppConfig appConfig;
    private String apiKey;
    private SecretKey jwtKey;

    public AuthFilter(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    @PostConstruct
    public void init() {
        this.apiKey = appConfig.getApiKey();
        String secret = appConfig.getJwtSecret();
        if (secret != null && !secret.isBlank()) {
            this.jwtKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
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
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (apiKey != null && !apiKey.isBlank()) {
            String key = request.getHeader(HEADER);
            if (apiKey.equals(key)) {
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
            }
        }

        log.warn("Unauthorized access {} from {}", request.getRequestURI(), request.getRemoteAddr());
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\":\"error\",\"message\":\"Unauthorized\"}");
    }
}
