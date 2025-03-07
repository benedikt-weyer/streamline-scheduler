package com.github.benedikt_weyer.streamline_sheduler.handler;

import java.util.HashSet;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.github.benedikt_weyer.streamline_sheduler.auth.EmailAlreadyTakenException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EmailAlreadyTakenException.class)
    public ResponseEntity<ExceptionResponse> handleEmailAlreadyTakenException(EmailAlreadyTakenException exception) {

        return ResponseEntity
            .status(BusinessErrorCode.EMAIL_ALREADY_TAKEN.getHttpStatus())
            .body(
                ExceptionResponse.builder()
                    .businessErrorCode(BusinessErrorCode.EMAIL_ALREADY_TAKEN.getCode())
                    .businessErrorDescription(BusinessErrorCode.EMAIL_ALREADY_TAKEN.getDescription())
                    .error(exception.getMessage())
                    .build()
            );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ExceptionResponse> handleMethodArgumentNotValidException(MethodArgumentNotValidException exception) {

        Set<String> errors = new HashSet<>();
        exception.getBindingResult().getAllErrors()
            .forEach(error -> {
                String errorMessage = error.getDefaultMessage();
                errors.add(errorMessage);
            });

        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(
                ExceptionResponse.builder()
                    .validationErrors(errors)
                    .build()
            );
    }


    @ExceptionHandler(Exception.class)
    public ResponseEntity<ExceptionResponse> handleDefaultException(MethodArgumentNotValidException exception) {
        // log exception
        exception.printStackTrace();

        Set<String> errors = new HashSet<>();
        exception.getBindingResult().getAllErrors()
            .forEach(error -> {
                String errorMessage = error.getDefaultMessage();
                errors.add(errorMessage);
            });

        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(
                ExceptionResponse.builder()
                    .businessErrorDescription("Internal Server Error")
                    .error(exception.getMessage())
                    .validationErrors(errors)
                    .build()
            );
    }

}
