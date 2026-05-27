package com.yolov8.security.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 安全响应头过滤器
 * 为所有 HTTP 响应添加安全相关的 HTTP 头
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final String CSP =
        "default-src 'self'; " +
        "script-src 'self' https://cdn.jsdelivr.net; " +
        "style-src 'self' https://fonts.googleapis.com; " +
        "img-src 'self' data: blob: http://localhost:1984 http://127.0.0.1:1984; " +
        "connect-src 'self' http://localhost:1984 http://127.0.0.1:1984 ws://localhost:1984 ws://127.0.0.1:1984; " +
        "frame-src 'self' http://localhost:1984 http://127.0.0.1:1984; " +
        "font-src 'self' https://fonts.gstatic.com;";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        response.setHeader("Content-Security-Policy", CSP);
        response.setHeader("X-Content-Type-Options", "nosniff");
        chain.doFilter(request, response);
    }
}
