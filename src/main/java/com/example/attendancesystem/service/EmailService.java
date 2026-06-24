package com.example.attendancesystem.service;

import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendWelcomeEmail(String toEmail, String fullName, String studentId, String password) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("pas.verify.support@gmail.com");
            helper.setTo(toEmail);
            helper.setSubject("Welcome to Attendance Shield — Your Login Credentials");
            helper.setText(buildWelcomeHtml(fullName, studentId, toEmail, password), true);

            mailSender.send(message);
        } catch (MessagingException e) {
            System.err.println("[EmailService] Failed to send welcome email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send welcome email: " + e.getMessage(), e);
        }
    }

    public void sendPasswordResetEmail(String toEmail, String fullName, String studentId, String newPassword) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("pas.verify.support@gmail.com");
            helper.setTo(toEmail);
            helper.setSubject("Attendance Shield — Your Password Has Been Reset");
            helper.setText(buildPasswordResetHtml(fullName, studentId, toEmail, newPassword), true);

            mailSender.send(message);
        } catch (MessagingException e) {
            System.err.println("[EmailService] Failed to send password reset email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send password reset email: " + e.getMessage(), e);
        }
    }

    private String buildWelcomeHtml(String name, String studentId, String email, String password) {
        return "<!DOCTYPE html><html><body style='font-family:Inter,Arial,sans-serif;background:#0b0f19;color:#f3f4f6;padding:2rem;'>" +
               "<div style='max-width:520px;margin:auto;background:rgba(20,26,46,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:1rem;padding:2rem;'>" +
               "<h1 style='font-size:1.5rem;margin-bottom:0.25rem;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;'>Attendance Shield</h1>" +
               "<p style='color:#9ca3af;font-size:0.85rem;margin-bottom:2rem;'>Student Portal Access</p>" +
               "<p style='margin-bottom:1rem;'>Hello <strong>" + name + "</strong>,</p>" +
               "<p style='color:#9ca3af;margin-bottom:1.5rem;'>Your student account has been created. Here are your login credentials:</p>" +
               "<div style='background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:0.5rem;padding:1.25rem;margin-bottom:1.5rem;'>" +
               "<div style='margin-bottom:0.75rem;'><span style='color:#9ca3af;font-size:0.8rem;'>Student ID</span><br><strong style='font-size:1rem;'>" + studentId + "</strong></div>" +
               "<div style='margin-bottom:0.75rem;'><span style='color:#9ca3af;font-size:0.8rem;'>Email</span><br><strong style='font-size:1rem;'>" + email + "</strong></div>" +
               "<div><span style='color:#9ca3af;font-size:0.8rem;'>Password</span><br><strong style='font-size:1.1rem;font-family:monospace;color:#3b82f6;'>" + password + "</strong></div>" +
               "</div>" +
               "<p style='font-size:0.8rem;color:#9ca3af;'>Please keep your credentials secure. Contact your administrator if you need assistance.</p>" +
               "</div></body></html>";
    }

    private String buildPasswordResetHtml(String name, String studentId, String email, String password) {
        return "<!DOCTYPE html><html><body style='font-family:Inter,Arial,sans-serif;background:#0b0f19;color:#f3f4f6;padding:2rem;'>" +
               "<div style='max-width:520px;margin:auto;background:rgba(20,26,46,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:1rem;padding:2rem;'>" +
               "<h1 style='font-size:1.5rem;margin-bottom:0.25rem;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;'>Attendance Shield</h1>" +
               "<p style='color:#9ca3af;font-size:0.85rem;margin-bottom:2rem;'>Password Reset</p>" +
               "<p style='margin-bottom:1rem;'>Hello <strong>" + name + "</strong>,</p>" +
               "<p style='color:#9ca3af;margin-bottom:1.5rem;'>Your password has been reset by an administrator. Use the new credentials below:</p>" +
               "<div style='background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:0.5rem;padding:1.25rem;margin-bottom:1.5rem;'>" +
               "<div style='margin-bottom:0.75rem;'><span style='color:#9ca3af;font-size:0.8rem;'>Student ID</span><br><strong style='font-size:1rem;'>" + studentId + "</strong></div>" +
               "<div style='margin-bottom:0.75rem;'><span style='color:#9ca3af;font-size:0.8rem;'>Email</span><br><strong style='font-size:1rem;'>" + email + "</strong></div>" +
               "<div><span style='color:#9ca3af;font-size:0.8rem;'>New Password</span><br><strong style='font-size:1.1rem;font-family:monospace;color:#f59e0b;'>" + password + "</strong></div>" +
               "</div>" +
               "<p style='font-size:0.8rem;color:#9ca3af;'>If you did not request this reset, please contact your administrator immediately.</p>" +
               "</div></body></html>";
    }

    public void sendOtpEmail(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("pas.verify.support@gmail.com");
            helper.setTo(toEmail);
            helper.setSubject("Attendance Shield — Password Reset OTP");
            helper.setText(buildOtpHtml(toEmail, otp), true);

            mailSender.send(message);
        } catch (MessagingException e) {
            System.err.println("[EmailService] Failed to send OTP email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send OTP email: " + e.getMessage(), e);
        }
    }

    private String buildOtpHtml(String email, String otp) {
        return "<!DOCTYPE html><html><body style='font-family:Inter,Arial,sans-serif;background:#0b0f19;color:#f3f4f6;padding:2rem;'>" +
               "<div style='max-width:520px;margin:auto;background:rgba(20,26,46,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:1rem;padding:2rem;'>" +
               "<h1 style='font-size:1.5rem;margin-bottom:0.25rem;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;'>Attendance Shield</h1>" +
               "<p style='color:#9ca3af;font-size:0.85rem;margin-bottom:2rem;'>One-Time Password (OTP)</p>" +
               "<p style='margin-bottom:1rem;'>Hello,</p>" +
               "<p style='color:#9ca3af;margin-bottom:1.5rem;'>You requested a password reset. Use the OTP code below to verify your request:</p>" +
               "<div style='background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:0.5rem;padding:1.5rem;margin-bottom:1.5rem;text-align:center;'>" +
               "<span style='color:#9ca3af;font-size:0.85rem;display:block;margin-bottom:0.5rem;'>Your OTP Code</span>" +
               "<strong style='font-size:2.25rem;font-family:monospace;color:#3b82f6;letter-spacing:4px;'>" + otp + "</strong>" +
               "</div>" +
               "<p style='font-size:0.8rem;color:#9ca3af;'>This code will expire in 5 minutes. If you did not make this request, please ignore this email.</p>" +
               "</div></body></html>";
    }
}

