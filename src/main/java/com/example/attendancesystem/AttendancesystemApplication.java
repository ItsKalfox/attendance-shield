package com.example.attendancesystem;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class AttendancesystemApplication {

	public static void main(String[] args) {
		SpringApplication.run(AttendancesystemApplication.class, args);
	}

	@Bean
	public CommandLineRunner schemaInitializer(JdbcTemplate jdbcTemplate) {
		return args -> {
			try {
				jdbcTemplate.execute("ALTER TABLE event_logs MODIFY COLUMN event_type VARCHAR(50)");
				System.out.println("SCHEMA UPDATE: successfully altered event_logs.event_type to VARCHAR(50)");
			} catch (Exception e) {
				System.err.println("SCHEMA UPDATE INFO: " + e.getMessage());
			}
		};
	}
}
