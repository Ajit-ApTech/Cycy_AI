package com.devmind.springbackend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public Map<String, String> getHealth() {
        return Map.of("status", "UP", "message", "Cycy Backend is running");
    }
}
