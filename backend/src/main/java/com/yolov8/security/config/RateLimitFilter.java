package com.yolov8.security.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
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

    private static final String[] PUBLIC_PATHS = {"/", "/index", "/static", "/error", "/api/monitor_status"};

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        for (String p : PUBLIC_PATHS) {
            if (uri.startsWith(p)) return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
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

        Window w = windows.computeIfAbsent(ip, k -> new Window(System.currentTimeMillis()));
        long now = System.currentTimeMillis();

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

        chain.doFilter(request, response);
    }
}
