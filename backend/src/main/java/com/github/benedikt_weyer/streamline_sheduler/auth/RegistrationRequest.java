package com.github.benedikt_weyer.streamline_sheduler.auth;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Getter
@Setter
@Builder
public class RegistrationRequest {

    @NotEmpty(message = "Email must not be empty")
    @NotBlank(message = "Email must not be blank")
    @Email(message = "Email should be valid")
    private String email;

    @NotEmpty(message = "Password must not be empty")
    @NotBlank(message = "Password must not be blank")
    @Size(min = 8, message = "Password must be at least 8 characters long")
    private String password;

    private String firstName;

    private String lastName;
}
