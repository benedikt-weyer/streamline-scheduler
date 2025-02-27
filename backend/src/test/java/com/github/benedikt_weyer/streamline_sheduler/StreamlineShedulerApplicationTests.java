package com.github.benedikt_weyer.streamline_sheduler;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class StreamlineShedulerApplicationTests {

	@Test
	void contextLoads() {
	}

}
