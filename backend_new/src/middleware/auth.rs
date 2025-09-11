use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

use crate::{
    auth::AuthService,
    errors::AppError,
    entities::users,
};

pub struct AuthUser(pub users::Model);

pub async fn auth_middleware(
    State(auth_service): State<AuthService>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = authorization.token();
    
    let user = auth_service.get_user_from_token(token).await?;
    
    // Insert the user into request extensions
    req.extensions_mut().insert(AuthUser(user));
    
    Ok(next.run(req).await)
}

// Helper to extract user from request extensions
impl axum::extract::FromRequestParts<()> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &(),
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| AppError::Auth("User not found in request".to_string()))
    }
}
