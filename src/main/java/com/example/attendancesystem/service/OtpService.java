package com.example.attendancesystem.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OtpService {

    private static class OtpData {
        private final String otp;
        private final LocalDateTime expiryTime;

        public OtpData(String otp, LocalDateTime expiryTime) {
            this.otp = otp;
            this.expiryTime = expiryTime;
        }

        public String getOtp() {
            return otp;
        }

        public boolean isExpired() {
            return LocalDateTime.now().isAfter(expiryTime);
        }
    }

    private final Map<String, OtpData> otpStorage = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public String generateOtp(String email) {
        int code = 100000 + random.nextInt(900000); // 6-digit OTP
        String otp = String.valueOf(code);
        System.out.println("GENERATED OTP FOR " + email + ": " + otp);
        // Expiry in 5 minutes
        otpStorage.put(email, new OtpData(otp, LocalDateTime.now().plusMinutes(5)));
        return otp;
    }

    public boolean verifyOtp(String email, String otp) {
        OtpData data = otpStorage.get(email);
        if (data == null) {
            return false;
        }
        if (data.isExpired()) {
            otpStorage.remove(email);
            return false;
        }
        return data.getOtp().equals(otp);
    }

    public void clearOtp(String email) {
        otpStorage.remove(email);
    }

    public String getOtpForTesting(String email) {
        OtpData data = otpStorage.get(email);
        if (data == null || data.isExpired()) {
            return null;
        }
        return data.getOtp();
    }
}
