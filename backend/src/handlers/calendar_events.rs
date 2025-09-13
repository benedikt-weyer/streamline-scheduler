use axum::{
    extract::{Path, State},
    response::Json,
};
use sea_orm::*;
use uuid::Uuid;

use crate::{
    entities::{prelude::*, calendar_events},
    errors::Result,
    middleware::auth::AuthUser,
    models::{
        calendar_event::{CreateCalendarEventRequest, UpdateCalendarEventRequest, CalendarEventResponse},
        ApiResponse,
    },
    state::AppState,
};

pub async fn list_events(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<Vec<CalendarEventResponse>>>> {
    let events = CalendarEvents::find()
        .filter(calendar_events::Column::UserId.eq(auth_user.0.id))
        .order_by_asc(calendar_events::Column::CreatedAt)
        .all(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<CalendarEventResponse> = events.into_iter().map(|event| event.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_event(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let event = CalendarEvents::find_by_id(id)
        .filter(calendar_events::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar event not found".to_string()))?;

    Ok(Json(ApiResponse::new(event.into())))
}

pub async fn create_event(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Json(request): Json<CreateCalendarEventRequest>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let mut event_active = calendar_events::ActiveModel::new();
    event_active.user_id = Set(auth_user.0.id);
    event_active.encrypted_data = Set(request.encrypted_data);
    event_active.iv = Set(request.iv);
    event_active.salt = Set(request.salt);

    let event = event_active.insert(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(event.into(), "Calendar event created successfully")))
}

pub async fn update_event(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCalendarEventRequest>,
) -> Result<Json<ApiResponse<CalendarEventResponse>>> {
    let event = CalendarEvents::find_by_id(id)
        .filter(calendar_events::Column::UserId.eq(auth_user.0.id))
        .one(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar event not found".to_string()))?;

    let mut event_active: calendar_events::ActiveModel = event.into();
    
    if let Some(encrypted_data) = request.encrypted_data {
        event_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        event_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        event_active.salt = Set(salt);
    }

    let updated_event = event_active.update(&app_state.db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(updated_event.into(), "Calendar event updated successfully")))
}

pub async fn delete_event(
    State(app_state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let result = CalendarEvents::delete_by_id(id)
        .filter(calendar_events::Column::UserId.eq(auth_user.0.id))
        .exec(&app_state.db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Calendar event not found".to_string()));
    }

    Ok(Json(ApiResponse::with_message((), "Calendar event deleted successfully")))
}
