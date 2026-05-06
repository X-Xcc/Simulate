package com.yolov8.security.controller;

import com.yolov8.security.model.LoginRequest;
import com.yolov8.security.model.LoginResponse;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:admin123}")
    private String adminPassword;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration:86400000}")
    private long jwtExpiration;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank() ||
            request.getPassword() == null || request.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户名和密码不能为空"));
        }

        if (constantTimeEquals(adminUsername, request.getUsername()) &&
            constantTimeEquals(adminPassword, request.getPassword())) {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            long now = System.currentTimeMillis();
            String token = Jwts.builder()
                    .subject(request.getUsername())
                    .issuedAt(new Date(now))
                    .expiration(new Date(now + jwtExpiration))
                    .signWith(key)
                    .compact();

            return ResponseEntity.ok(new LoginResponse(token, jwtExpiration / 1000));
        }

        return ResponseEntity.status(401).body(Map.of("error", "用户名或密码错误"));
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}