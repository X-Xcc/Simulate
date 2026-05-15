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
 *
 * 为所有 HTTP 响应添加安全相关的 HTTP 头：
 * 1. Content-Security-Policy (CSP) — 防止 XSS 攻击，限制资源加载来源
 * 2. X-Content-Type-Options — 防止 MIME 类型嗅探
 * 3. X-Frame-Options — 防止点击劫持
 * 4. Strict-Transport-Security (HSTS) — 强制 HTTPS
 *
 * CSP 策略说明：
 * - script-src: 仅允许同源脚本 + jsdelivr CDN（Chart.js）
 * - style-src: 仅允许同源样式 + Google Fonts
 * - img-src: 允许同源图片 + data: URI（Base64 内联图片）
 * - font-src: 允许同源字体 + Google Fonts
 * - connect-src: 仅允许同源 AJAX 请求
 * - 已移除 'unsafe-inline' — 所有内联脚本和样式已迁移到外部文件
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        /*
         * CSP 策略（已移除 unsafe-inline）
         *
         * 所有 onclick 属性和内联 script/style 已迁移到外部 JS/CSS 文件
         * Chart.js 通过 jsdelivr CDN 加载，需要白名单
         * Google Fonts 需要 style-src 和 font-src 白名单
         */
        response.setHeader("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self' https://cdn.jsdelivr.net; " +
                "style-src 'self' https://fonts.googleapis.com; " +
                "img-src 'self' data: blob:; " +
                "connect-src 'self'; " +
                "font-src 'self' https://fonts.gstatic.com;");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        /* HSTS: 强制浏览器使用 HTTPS（仅在 HTTPS 环境下生效） */
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        chain.doFilter(request, response);
    }
}
