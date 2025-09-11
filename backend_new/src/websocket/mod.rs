use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{sink::SinkExt, stream::{SplitSink, SplitStream, StreamExt}};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

use crate::{auth::AuthService, errors::Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub event_type: String,
    pub table: String,
    pub user_id: Uuid,
    pub record_id: Option<Uuid>,
    pub data: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct WebSocketState {
    pub connections: Arc<RwLock<HashMap<Uuid, broadcast::Sender<WebSocketMessage>>>>,
}

impl WebSocketState {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection(&self, user_id: Uuid, tx: broadcast::Sender<WebSocketMessage>) {
        let mut connections = self.connections.write().await;
        connections.insert(user_id, tx);
    }

    pub async fn remove_connection(&self, user_id: &Uuid) {
        let mut connections = self.connections.write().await;
        connections.remove(user_id);
    }

    pub async fn broadcast_to_user(&self, user_id: &Uuid, message: WebSocketMessage) {
        let connections = self.connections.read().await;
        if let Some(tx) = connections.get(user_id) {
            let _ = tx.send(message);
        }
    }

    pub async fn broadcast_change(&self, table: &str, user_id: Uuid, event_type: &str, record_id: Option<Uuid>, data: Option<serde_json::Value>) {
        let message = WebSocketMessage {
            event_type: event_type.to_string(),
            table: table.to_string(),
            user_id,
            record_id,
            data,
        };
        
        self.broadcast_to_user(&user_id, message).await;
    }
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(app_state): State<crate::state::AppState>,
) -> Response {
    let auth_service = app_state.auth_service.clone();
    let ws_state = app_state.ws_state.clone();
    ws.on_upgrade(move |socket| websocket_connection(socket, auth_service, ws_state))
}

async fn websocket_connection(
    socket: WebSocket,
    auth_service: AuthService,
    ws_state: WebSocketState,
) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = broadcast::channel::<WebSocketMessage>(100);
    
    // Handle authentication
    let mut user_id: Option<Uuid> = None;
    
    // Authentication flow
    if let Some(msg) = receiver.next().await {
        if let Ok(Message::Text(text)) = msg {
            if let Ok(auth_msg) = serde_json::from_str::<serde_json::Value>(&text) {
                if let Some(token) = auth_msg.get("token").and_then(|t| t.as_str()) {
                    if let Ok(user) = auth_service.get_user_from_token(token).await {
                        user_id = Some(user.id);
                        ws_state.add_connection(user.id, tx.clone()).await;
                        
                        // Send authentication success
                        let auth_response = serde_json::json!({
                            "type": "auth_success",
                            "user_id": user.id
                        });
                        
                        if sender.send(Message::Text(auth_response.to_string().into())).await.is_err() {
                            return;
                        }
                    }
                }
            }
        }
    }
    
    if user_id.is_none() {
        // Authentication failed
        let auth_error = serde_json::json!({
            "type": "auth_error",
            "message": "Authentication failed"
        });
        
        let _ = sender.send(Message::Text(auth_error.to_string().into())).await;
        return;
    }
    
    let user_id = user_id.unwrap();
    
    // Spawn task to handle outgoing messages
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages
    let mut recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Handle incoming messages (e.g., subscriptions)
                    tracing::debug!("Received WebSocket message: {}", text);
                },
                Ok(Message::Close(_)) => {
                    break;
                },
                _ => {}
            }
        }
    });
    
    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        }
    }
    
    // Clean up connection
    ws_state.remove_connection(&user_id).await;
    tracing::info!("WebSocket connection closed for user: {}", user_id);
}
