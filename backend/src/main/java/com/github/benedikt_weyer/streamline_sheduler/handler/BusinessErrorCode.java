package com.github.benedikt_weyer.streamline_sheduler.handler;

import org.springframework.http.HttpStatus;

import lombok.Getter;

public enum BusinessErrorCode {

    NO_CODE(0, HttpStatus.NOT_IMPLEMENTED, "No code"), 
    EMAIL_ALREADY_TAKEN(401, HttpStatus.CONFLICT, "Email already taken");
    

    @Getter
    final private int code;

    @Getter
    private final HttpStatus httpStatus;

    @Getter
    final private String description;

    private BusinessErrorCode(int code, HttpStatus httpStatus, String description) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.description = description;
    }
   
}
