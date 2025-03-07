package com.github.benedikt_weyer.streamline_sheduler.auth;

public class EmailAlreadyTakenException extends RuntimeException {

    public EmailAlreadyTakenException() {
        super("Email already taken.");
    }

    public EmailAlreadyTakenException(Throwable cause) {
        super("Email already taken.", cause);
    }
}
