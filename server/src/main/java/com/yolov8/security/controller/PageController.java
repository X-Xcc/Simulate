package com.yolov8.security.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    /**
     * SPA catch-all: forward all non-API page routes to index.html.
     * React Router handles client-side routing.
     */
    @GetMapping({"/", "/index", "/login", "/dashboard", "/monitor", "/alerts",
                 "/devices", "/evidence", "/analysis", "/maintenance", "/audit",
                 "/monitor/fullscreen", "/training"})
    public String spaIndex() {
        return "forward:/index.html";
    }

    @GetMapping("/annotation")
    public String annotationPage() {
        // Forward to index.html, React Router handles /annotation route
        return "forward:/index.html";
    }

    @GetMapping("/training.html")
    public String trainingPage() {
        // Forward to index.html, React Router handles /training route
        return "forward:/index.html";
    }
}
