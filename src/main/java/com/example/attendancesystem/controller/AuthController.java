package com.example.attendancesystem.controller;

import com.example.attendancesystem.dto.LoginRequest;
import com.example.attendancesystem.dto.LoginResponse;
import com.example.attendancesystem.service.AuthenticationService;
import com.example.attendancesystem.util.RequestUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationService authenticationService;

    public AuthController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = RequestUtils.getClientIp(httpRequest);
        String userAgent = RequestUtils.getUserAgent(httpRequest);
        LoginResponse response = authenticationService.login(request, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }
}
