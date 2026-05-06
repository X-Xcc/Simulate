package com.yolov8.security.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping({"/", "/index"})
    public String index() {
        return "monitor";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/admin")
    public String admin() {
        return "admin";
    }

    @GetMapping("/monitor")
    public String monitor() {
        return "monitor";
    }

    @GetMapping("/annotate")
    public String annotate() {
        return "annotate";
    }
}
