# Streamline Scheduler API Documentation

## Overview

The Streamline Scheduler backend provides a RESTful API for managing tasks, projects, calendars, and events. It's built with Rust using Axum framework, SeaORM for database operations, and JWT authentication.

**Base URL:** `http://localhost:3001` (default)

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Common Response Format

All API responses follow this structure:

```json
{
  "data": <response_data>,
  "message": "Optional success message"
}
```

Error responses:

```json
{
  "error": "Error message",
  "details": "Optional error details"
}
```

## Endpoints

### Health Check

#### `GET /health`
Check if the API is running.

**Response:**
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-12T14:30:00Z"
  }
}
```

---

## Authentication Endpoints

### Register User

#### `POST /api/auth/register`
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "data": {
    "access_token": "jwt_token_here",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": null,
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "app_metadata": {},
      "user_metadata": {}
    }
  },
  "message": "User registered successfully"
}
```

### Login

#### `POST /api/auth/login`
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:** Same as register response.

### Get Current User

#### `GET /api/auth/me`
Get current authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed_at": null,
    "created_at": "2025-09-12T14:30:00Z",
    "updated_at": "2025-09-12T14:30:00Z",
    "app_metadata": {},
    "user_metadata": {}
  }
}
```

---

## Project Endpoints

### List Projects

#### `GET /api/projects`
Get all projects for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `parent_id` (optional): Filter by parent project ID. Omit to get root projects.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "color": "#3b82f6",
      "parent_id": null,
      "display_order": 0,
      "is_collapsed": false,
      "user_id": "uuid",
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "encrypted_content",
      "iv": "initialization_vector",
      "salt": "salt_value"
    }
  ]
}
```

### Create Project

#### `POST /api/projects`
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "color": "#3b82f6",
  "parent_id": null,
  "display_order": 0,
  "is_collapsed": false,
  "encrypted_data": "encrypted_content",
  "iv": "initialization_vector",
  "salt": "salt_value"
}
```

**Response:** Single project object (same structure as list).

### Get Project

#### `GET /api/projects/{id}`
Get a specific project by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** Single project object.

### Update Project

#### `PUT /api/projects/{id}`
Update an existing project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as create (all fields optional).

**Response:** Updated project object.

### Delete Project

#### `DELETE /api/projects/{id}`
Delete a project and all its sub-projects.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": null,
  "message": "Project deleted successfully"
}
```

---

## Can-Do List Endpoints

### List Can-Do Items

#### `GET /api/can-do-list`
Get all can-do items for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `project_id` (optional): Filter by project ID
- `completed` (optional): Filter by completion status (true/false)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "content": "Task content",
      "completed": false,
      "due_date": "2025-09-15T12:00:00Z",
      "priority": "medium",
      "tags": ["work", "urgent"],
      "duration_minutes": 60,
      "project_id": "uuid",
      "display_order": 0,
      "user_id": "uuid",
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "encrypted_content",
      "iv": "initialization_vector",
      "salt": "salt_value"
    }
  ]
}
```

### Create Can-Do Item

#### `POST /api/can-do-list`
Create a new can-do item.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "New task",
  "due_date": "2025-09-15T12:00:00Z",
  "priority": "medium",
  "tags": ["work"],
  "duration_minutes": 60,
  "project_id": "uuid",
  "display_order": 0,
  "encrypted_data": "encrypted_content",
  "iv": "initialization_vector",
  "salt": "salt_value"
}
```

**Response:** Single can-do item object.

### Get Can-Do Item

#### `GET /api/can-do-list/{id}`
Get a specific can-do item by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** Single can-do item object.

### Update Can-Do Item

#### `PUT /api/can-do-list/{id}`
Update an existing can-do item.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as create (all fields optional).

**Response:** Updated can-do item object.

### Delete Can-Do Item

#### `DELETE /api/can-do-list/{id}`
Delete a can-do item.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": null,
  "message": "Can-do item deleted successfully"
}
```

---

## Calendar Endpoints

### List Calendars

#### `GET /api/calendars`
Get all calendars for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Calendar",
      "color": "#3b82f6",
      "is_visible": true,
      "user_id": "uuid",
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "encrypted_content",
      "iv": "initialization_vector",
      "salt": "salt_value"
    }
  ]
}
```

### Create Calendar

#### `POST /api/calendars`
Create a new calendar.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Calendar",
  "color": "#3b82f6",
  "is_visible": true,
  "encrypted_data": "encrypted_content",
  "iv": "initialization_vector",
  "salt": "salt_value"
}
```

**Response:** Single calendar object.

### Get Calendar

#### `GET /api/calendars/{id}`
Get a specific calendar by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** Single calendar object.

### Update Calendar

#### `PUT /api/calendars/{id}`
Update an existing calendar.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as create (all fields optional).

**Response:** Updated calendar object.

### Delete Calendar

#### `DELETE /api/calendars/{id}`
Delete a calendar and all its events.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": null,
  "message": "Calendar deleted successfully"
}
```

---

## Calendar Event Endpoints

### List Calendar Events

#### `GET /api/calendar-events`
Get all calendar events for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `calendar_id` (optional): Filter by calendar ID
- `start_date` (optional): Filter events starting after this date (ISO 8601)
- `end_date` (optional): Filter events ending before this date (ISO 8601)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Event Title",
      "description": "Event description",
      "start_time": "2025-09-15T10:00:00Z",
      "end_time": "2025-09-15T11:00:00Z",
      "all_day": false,
      "calendar_id": "uuid",
      "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
      "recurrence_exception": [],
      "user_id": "uuid",
      "created_at": "2025-09-12T14:30:00Z",
      "updated_at": "2025-09-12T14:30:00Z",
      "encrypted_data": "encrypted_content",
      "iv": "initialization_vector",
      "salt": "salt_value"
    }
  ]
}
```

### Create Calendar Event

#### `POST /api/calendar-events`
Create a new calendar event.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "New Event",
  "description": "Event description",
  "start_time": "2025-09-15T10:00:00Z",
  "end_time": "2025-09-15T11:00:00Z",
  "all_day": false,
  "calendar_id": "uuid",
  "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
  "recurrence_exception": [],
  "encrypted_data": "encrypted_content",
  "iv": "initialization_vector",
  "salt": "salt_value"
}
```

**Response:** Single calendar event object.

### Get Calendar Event

#### `GET /api/calendar-events/{id}`
Get a specific calendar event by ID.

**Headers:** `Authorization: Bearer <token>`

**Response:** Single calendar event object.

### Update Calendar Event

#### `PUT /api/calendar-events/{id}`
Update an existing calendar event.

**Headers:** `Authorization: Bearer <token>`

**Request Body:** Same as create (all fields optional).

**Response:** Updated calendar event object.

### Delete Calendar Event

#### `DELETE /api/calendar-events/{id}`
Delete a calendar event.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "data": null,
  "message": "Calendar event deleted successfully"
}
```

---

## WebSocket Endpoint

### WebSocket Connection

#### `GET /ws`
Establish a WebSocket connection for real-time updates.

**Headers:** `Authorization: Bearer <token>` (via query parameter or in upgrade headers)

**Message Types:**
- Subscription confirmations
- Real-time data updates (INSERT, UPDATE, DELETE events)
- Authentication state changes

**Example Messages:**
```json
{
  "type": "subscription",
  "table": "projects",
  "eventType": "INSERT",
  "new": { "id": "uuid", "name": "New Project", ... }
}

{
  "type": "auth_change",
  "event": "SIGNED_OUT",
  "session": null
}
```

---

## Data Types

### Priority Levels
- `low`
- `medium` 
- `high`

### Recurrence Rules
Follow RFC 5545 (iCalendar) RRULE format:
- `FREQ=DAILY;INTERVAL=1`
- `FREQ=WEEKLY;BYDAY=MO,WE,FR`
- `FREQ=MONTHLY;BYMONTHDAY=15`

### Date Formats
All dates use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

---

## Error Codes

- `400` - Bad Request (invalid request body/parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `422` - Unprocessable Entity (validation errors)
- `500` - Internal Server Error

---

## Rate Limiting

Currently no rate limiting is implemented, but it's recommended for production use.

---

## CORS

The API is configured with permissive CORS for development. Configure appropriately for production.
