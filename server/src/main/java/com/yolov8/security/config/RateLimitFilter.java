package com.yolov8.security.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private static final int DEFAULT_MAX_REQUESTS = 60;
    private static final long DEFAULT_WINDOW_MS = 60_000L;

    private static final int VIDEO_MAX_REQUESTS = 5;
    private static final long VIDEO_WINDOW_MS = 30_000L;

    private static final int DELETE_MAX_REQUESTS = 3;
    private static final long DELETE_WINDOW_MS = 60_000L;

    private static final int MAX_ENTRIES = 10_000;

    /** 受信任的代理 IP 集合（仅这些来源的 X-Forwarded-For 会被信任） */
    private static final Set<String> TRUSTED_PROXIES = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1");

    private static class Window {
        volatile long startMs;
        final AtomicInteger count = new AtomicInteger(0);

        Window(long startMs) {
            this.startMs = startMs;
        }
    }

    private final Map<String, Window> apiWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> videoWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> deleteWindows = new ConcurrentHashMap<>();
    private final AtomicInteger requestCount = new AtomicInteger(0);

    private static final String[] PUBLIC_PATHS = {"/", "/index", "/static", "/error", "/api/monitor_status"};

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String cp = request.getContextPath();
        if (cp != null && !cp.isEmpty() && uri.startsWith(cp)) {
            uri = uri.substring(cp.length());
        }
        if (uri.isEmpty()) uri = "/";
        for (String p : PUBLIC_PATHS) {
            if (uri.startsWith(p)) return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        // Only trust X-Forwarded-For from known proxies (prevents IP spoofing)
        if (TRUSTED_PROXIES.contains(ip)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isEmpty()) {
                ip = xff.split(",")[0].trim();
            }
        }
        String uri = request.getRequestURI();
        Map<String, Window> windows;
        int max;
        long windowMs;

        if (uri.contains("/video_feed")) {
            windows = videoWindows;
            max = VIDEO_MAX_REQUESTS;
            windowMs = VIDEO_WINDOW_MS;
        } else if (uri.contains("/delete_")) {
            windows = deleteWindows;
            max = DELETE_MAX_REQUESTS;
            windowMs = DELETE_WINDOW_MS;
        } else {
            windows = apiWindows;
            max = DEFAULT_MAX_REQUESTS;
            windowMs = DEFAULT_WINDOW_MS;
        }

        // Only check eviction every 100 requests to reduce overhead
        if (requestCount.incrementAndGet() % 100 == 0) {
            evictIfFull(windows);
        }
        Window w = windows.computeIfAbsent(ip, k -> new Window(System.currentTimeMillis()));
        long now = System.currentTimeMillis();

        synchronized (w) {
            if (now - w.startMs > windowMs) {
                w.startMs = now;
                w.count.set(0);
            }
            if (w.count.incrementAndGet() > max) {
                log.warn("Rate limit exceeded for {} on {}", ip, uri);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"status\":\"error\",\"message\":\"Rate limit exceeded\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private void evictIfFull(Map<String, Window> windows) {
        if (windows.size() > MAX_ENTRIES) {
            long now = System.currentTimeMillis();
            // 移除已过期的窗口（不再活跃的 IP）
            Iterator<Map.Entry<String, Window>> it = windows.entrySet().iterator();
            int removed = 0;
            while (it.hasNext()) {
                Map.Entry<String, Window> entry = it.next();
                // 移除超过 2 倍窗口时间未活跃的条目
                if (now - entry.getValue().startMs > DEFAULT_WINDOW_MS * 2) {
                    it.remove();
                    removed++;
                }
            }
            // 如果清理后仍然超限，移除最旧的条目
            if (windows.size() > MAX_ENTRIES) {
                it = windows.entrySet().iterator();
                int toRemove = MAX_ENTRIES / 4;
                while (it.hasNext() && toRemove-- > 0) {
                    it.next();
                    it.remove();
                }
            }
        }
    }
}
