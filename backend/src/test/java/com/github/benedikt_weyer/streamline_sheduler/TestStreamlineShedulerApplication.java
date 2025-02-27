package com.github.benedikt_weyer.streamline_sheduler;

import org.springframework.boot.SpringApplication;

public class TestStreamlineShedulerApplication {

	public static void main(String[] args) {
		SpringApplication.from(StreamlineShedulerApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
