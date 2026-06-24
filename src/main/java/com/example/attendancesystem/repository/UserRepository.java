package com.example.attendancesystem.repository;

import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    List<User> findByRole(Role role);
    Optional<User> findByStudentId(String studentId);
}
