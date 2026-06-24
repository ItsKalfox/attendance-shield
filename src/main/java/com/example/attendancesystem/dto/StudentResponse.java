package com.example.attendancesystem.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class StudentResponse {
    private Long userId;
    private String studentId;
    private String fullName;
    private String email;
    private LocalDateTime createdAt;
}
