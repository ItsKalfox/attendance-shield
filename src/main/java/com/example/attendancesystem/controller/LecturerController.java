package com.example.attendancesystem.controller;

import com.example.attendancesystem.dto.LecturerRequest;
import com.example.attendancesystem.dto.LecturerResponse;
import com.example.attendancesystem.service.LecturerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lecturers")
public class LecturerController {

    private final LecturerService lecturerService;

    public LecturerController(LecturerService lecturerService) {
        this.lecturerService = lecturerService;
    }

    @GetMapping
    public ResponseEntity<List<LecturerResponse>> getAllLecturers() {
        return ResponseEntity.ok(lecturerService.getAllLecturers());
    }

    @PostMapping
    public ResponseEntity<LecturerResponse> createLecturer(@Valid @RequestBody LecturerRequest request) {
        LecturerResponse response = lecturerService.createLecturer(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LecturerResponse> updateLecturer(
            @PathVariable Long id,
            @Valid @RequestBody LecturerRequest request) {
        return ResponseEntity.ok(lecturerService.updateLecturer(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLecturer(@PathVariable Long id) {
        lecturerService.deleteLecturer(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<LecturerResponse> resetPassword(@PathVariable Long id) {
        return ResponseEntity.ok(lecturerService.resetPassword(id));
    }
}
