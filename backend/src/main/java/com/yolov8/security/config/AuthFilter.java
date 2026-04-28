package com.yolov8.security.config;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
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
        "/", "/index", "/login", "/static/**", "/error", "/api/login",
        "/video_feed", "/api/images/**"
    };

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final String apiKey;
    private final SecretKey jwtKey;

    public AuthFilter(AppConfig appConfig) {
        this.apiKey = appConfig.getApiKey();
        // 预构建 JWT 密钥，避免每次请求重复解析
        this.jwtKey = Keys.hmacShaKeyFor(
            appConfig.getJwtSecret().getBytes(StandardCharsets.UTF_8)
        );
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // 移除 context-path 后进行路径匹配
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
        // 1. 静态 API Key（向后兼容）
        if (apiKey != null && !apiKey.isBlank()) {
            String key = request.getHeader(HEADER);
            if (apiKey.equals(key)) {
                chain.doFilter(request, response);
                return;
            }
        }

        // 2. Bearer JWT Token（登录后颁发）
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            try {
                Jwts.parser()
                        .verifyWith(jwtKey)
                        .build()
                        .parseSignedClaims(token);
                chain.doFilter(request, response);
                return;
            } catch (Exception e) {
                // JWT 校验失败，继续执行拒绝逻辑
            }
        }

        log.warn("未授权访问 {} 来自 {}", request.getRequestURI(), request.getRemoteAddr());
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"status\":\"error\",\"message\":\"Unauthorized\"}");
    }
}
