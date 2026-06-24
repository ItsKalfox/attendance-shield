package com.example.attendancesystem.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class LecturerResponse {
    private Long userId;
    private String lecturerId;
    private String fullName;
    private String email;
    private LocalDateTime createdAt;
}
