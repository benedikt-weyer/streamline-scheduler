mod auth;
mod db;
mod entities;
mod errors;
mod handlers;
mod middleware;
mod migrator;
mod models;
mod websocket;

use axum::{
    middleware as axum_middleware,
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use dotenvy::dotenv;
use sea_orm_migration::prelude::*;
use std::env;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    auth::AuthService,
    db::Database,
    errors::AppError,
    migrator::Migrator,
    models::ApiResponse,
    websocket::WebSocketState,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "streamline_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Initialize database
    let db = Database::new().await?;
    
    // Run migrations
    Migrator::up(&db.connection, None).await?;
    tracing::info!("Database migrations completed");

    // Initialize auth service
    let auth_service = AuthService::new(db.clone());
    
    // Initialize WebSocket state
    let ws_state = WebSocketState::new();

    // Public routes (no auth required)
    let public_routes = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login));

    // Protected routes (auth required)
    let protected_routes = Router::new()
        .route("/auth/me", get(handlers::auth::me))
        .route("/projects", get(handlers::projects::list_projects).post(handlers::projects::create_project))
        .route("/projects/:id", get(handlers::projects::get_project).put(handlers::projects::update_project).delete(handlers::projects::delete_project))
        .route("/can-do-list", get(handlers::can_do_list::list_items).post(handlers::can_do_list::create_item))
        .route("/can-do-list/:id", get(handlers::can_do_list::get_item).put(handlers::can_do_list::update_item).delete(handlers::can_do_list::delete_item))
        .route("/calendars", get(handlers::calendars::list_calendars).post(handlers::calendars::create_calendar))
        .route("/calendars/:id", get(handlers::calendars::get_calendar).put(handlers::calendars::update_calendar).delete(handlers::calendars::delete_calendar))
        .route("/calendar-events", get(handlers::calendar_events::list_events).post(handlers::calendar_events::create_event))
        .route("/calendar-events/:id", get(handlers::calendar_events::get_event).put(handlers::calendar_events::update_event).delete(handlers::calendar_events::delete_event))
        .route("/ws", get(websocket::websocket_handler))
        .layer(axum_middleware::from_fn_with_state(
            auth_service.clone(),
            middleware::auth_middleware,
        ));

    // Build application
    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        )
        .with_state(db.clone())
        .with_state(auth_service)
        .with_state(ws_state);

    // Start server
    let port = env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    tracing::info!("Server starting on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<ApiResponse<&'static str>> {
    Json(ApiResponse::with_message("ok", "Streamline Scheduler API is running"))
}