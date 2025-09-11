use axum::{
    extract::{Path, State},
    response::Json,
};
use sea_orm::*;
use uuid::Uuid;

use crate::{
    db::Database,
    entities::{prelude::*, calendars},
    errors::Result,
    middleware::AuthUser,
    models::{
        calendar::{CreateCalendarRequest, UpdateCalendarRequest, CalendarResponse},
        ApiResponse,
    },
};

pub async fn list_calendars(
    State(db): State<Database>,
    auth_user: AuthUser,
) -> Result<Json<ApiResponse<Vec<CalendarResponse>>>> {
    let calendars = Calendars::find()
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .order_by_asc(calendars::Column::CreatedAt)
        .all(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<CalendarResponse> = calendars.into_iter().map(|calendar| calendar.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_calendar(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .one(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    Ok(Json(ApiResponse::new(calendar.into())))
}

pub async fn create_calendar(
    State(db): State<Database>,
    auth_user: AuthUser,
    Json(request): Json<CreateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let mut calendar_active = calendars::ActiveModel::new();
    calendar_active.user_id = Set(auth_user.0.id);
    calendar_active.encrypted_data = Set(request.encrypted_data);
    calendar_active.iv = Set(request.iv);
    calendar_active.salt = Set(request.salt);

    let calendar = calendar_active.insert(&db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(calendar.into(), "Calendar created successfully")))
}

pub async fn update_calendar(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateCalendarRequest>,
) -> Result<Json<ApiResponse<CalendarResponse>>> {
    let calendar = Calendars::find_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .one(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Calendar not found".to_string()))?;

    let mut calendar_active: calendars::ActiveModel = calendar.into();
    
    if let Some(encrypted_data) = request.encrypted_data {
        calendar_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        calendar_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        calendar_active.salt = Set(salt);
    }
    if let Some(is_default) = request.is_default {
        calendar_active.is_default = Set(is_default);
    }

    let updated_calendar = calendar_active.update(&db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(updated_calendar.into(), "Calendar updated successfully")))
}

pub async fn delete_calendar(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let result = Calendars::delete_by_id(id)
        .filter(calendars::Column::UserId.eq(auth_user.0.id))
        .exec(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Calendar not found".to_string()));
    }

    Ok(Json(ApiResponse::with_message((), "Calendar deleted successfully")))
}
