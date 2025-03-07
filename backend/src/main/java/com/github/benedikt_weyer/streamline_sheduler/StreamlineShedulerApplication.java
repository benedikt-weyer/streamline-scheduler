package com.github.benedikt_weyer.streamline_sheduler;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class StreamlineShedulerApplication {

	public static void main(String[] args) {
		SpringApplication.run(StreamlineShedulerApplication.class, args);
	}

}
