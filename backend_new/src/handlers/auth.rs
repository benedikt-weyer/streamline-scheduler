use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};

use crate::{
    auth::AuthService,
    errors::Result,
    models::{
        user::{CreateUserRequest, LoginRequest, AuthResponse},
        ApiResponse,
    },
    middleware::AuthUser,
};

pub async fn register(
    State(auth_service): State<AuthService>,
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>> {
    let response = auth_service.register(request).await?;
    Ok(Json(ApiResponse::with_message(response, "User registered successfully")))
}

pub async fn login(
    State(auth_service): State<AuthService>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>> {
    let response = auth_service.login(request).await?;
    Ok(Json(ApiResponse::with_message(response, "Login successful")))
}

pub async fn me(
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<crate::models::user::UserResponse>>> {
    let user_response = auth_user.0.into();
    Ok(Json(ApiResponse::new(user_response)))
}
