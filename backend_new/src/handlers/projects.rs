use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    db::Database,
    entities::{prelude::*, projects},
    errors::Result,
    middleware::AuthUser,
    models::{
        project::{CreateProjectRequest, UpdateProjectRequest, ProjectResponse},
        ApiResponse,
    },
};

#[derive(Debug, Deserialize)]
pub struct ProjectQuery {
    pub parent_id: Option<Uuid>,
}

pub async fn list_projects(
    State(db): State<Database>,
    auth_user: AuthUser,
    Query(query): Query<ProjectQuery>,
) -> Result<Json<ApiResponse<Vec<ProjectResponse>>>> {
    let mut find = Projects::find().filter(projects::Column::UserId.eq(auth_user.0.id));
    
    match query.parent_id {
        Some(parent_id) => {
            find = find.filter(projects::Column::ParentId.eq(parent_id));
        }
        None => {
            find = find.filter(projects::Column::ParentId.is_null());
        }
    }
    
    let projects = find
        .order_by_asc(projects::Column::DisplayOrder)
        .order_by_asc(projects::Column::CreatedAt)
        .all(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    let response: Vec<ProjectResponse> = projects.into_iter().map(|p| p.into()).collect();
    Ok(Json(ApiResponse::new(response)))
}

pub async fn get_project(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .one(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(ApiResponse::new(project.into())))
}

pub async fn create_project(
    State(db): State<Database>,
    auth_user: AuthUser,
    Json(request): Json<CreateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let display_order = request.display_order.unwrap_or(0);
    let is_collapsed = request.is_collapsed.unwrap_or(false);

    let mut project_active = projects::ActiveModel::new();
    project_active.user_id = Set(auth_user.0.id);
    project_active.encrypted_data = Set(request.encrypted_data);
    project_active.iv = Set(request.iv);
    project_active.salt = Set(request.salt);
    project_active.parent_id = Set(request.parent_id);
    project_active.display_order = Set(display_order);
    project_active.is_collapsed = Set(is_collapsed);

    let project = project_active.insert(&db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(project.into(), "Project created successfully")))
}

pub async fn update_project(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateProjectRequest>,
) -> Result<Json<ApiResponse<ProjectResponse>>> {
    let project = Projects::find_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .one(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?
        .ok_or_else(|| crate::errors::AppError::NotFound("Project not found".to_string()))?;

    let mut project_active: projects::ActiveModel = project.into();
    
    if let Some(encrypted_data) = request.encrypted_data {
        project_active.encrypted_data = Set(encrypted_data);
    }
    if let Some(iv) = request.iv {
        project_active.iv = Set(iv);
    }
    if let Some(salt) = request.salt {
        project_active.salt = Set(salt);
    }
    if let Some(is_default) = request.is_default {
        project_active.is_default = Set(is_default);
    }
    if let Some(parent_id) = request.parent_id {
        project_active.parent_id = Set(Some(parent_id));
    }
    if let Some(display_order) = request.display_order {
        project_active.display_order = Set(display_order);
    }
    if let Some(is_collapsed) = request.is_collapsed {
        project_active.is_collapsed = Set(is_collapsed);
    }

    let updated_project = project_active.update(&db.connection).await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    Ok(Json(ApiResponse::with_message(updated_project.into(), "Project updated successfully")))
}

pub async fn delete_project(
    State(db): State<Database>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<()>>> {
    let result = Projects::delete_by_id(id)
        .filter(projects::Column::UserId.eq(auth_user.0.id))
        .exec(&db.connection)
        .await
        .map_err(|e| crate::errors::AppError::Database(e.into()))?;

    if result.rows_affected == 0 {
        return Err(crate::errors::AppError::NotFound("Project not found".to_string()));
    }

    Ok(Json(ApiResponse::with_message((), "Project deleted successfully")))
}