use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{sse::{Event, KeepAlive, Sse}, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, sync::Arc};

use crate::application::{AdvisoryStreamPort, SimulationUseCase, VehicleBlueprint};
use crate::domain::DomainError;

#[derive(Deserialize)]
pub struct SimulationQuery {
    pub model: String,
    pub year: u32,
    pub stage: u8,
    pub focus: String,
}

#[derive(Serialize)]
pub struct SimulationPayload {
    pub blueprint: VehicleBlueprint,
    pub landed_vehicle_kes: f64,
    pub duties_kes: f64,
    pub hardware_kes: f64,
    pub sea_level_whp: u32,
    pub nairobi_whp: u32,
    pub kes_per_whp: f64,
}

#[derive(Clone)]
pub struct AppState {
    pub simulation_use_case: Arc<SimulationUseCase>,
    pub advisory_port: Arc<dyn AdvisoryStreamPort>,
}

pub struct InputSanitizer;

impl InputSanitizer {
    pub fn sanitize_identifier(raw: &str, max_len: usize) -> Result<String, DomainError> {
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.len() > max_len {
            return Err(DomainError::InvalidInput("Identifier length out of bounds"));
        }
        let is_clean = trimmed
            .chars()
            .all(|c| c.is_alphanumeric() || c == ' ' || c == '-' || c == '.' || c == '/');
        if !is_clean {
            return Err(DomainError::InvalidInput("Illegal characters detected"));
        }
        Ok(trimmed.to_string())
    }
}

pub struct TelemetryController;

impl TelemetryController {
    pub async fn compute_metrics(
        State(state): State<AppState>,
        Json(req): Json<SimulationQuery>,
    ) -> Result<Json<SimulationPayload>, (StatusCode, String)> {
        let clean_model = InputSanitizer::sanitize_identifier(&req.model, 64)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("{:?}", e)))?;

        let result = state
            .simulation_use_case
            .execute(&clean_model, req.year, req.stage)
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("{:?}", e)))?;

        Ok(Json(SimulationPayload {
            blueprint: result.blueprint,
            landed_vehicle_kes: result.landed_vehicle_kes,
            duties_kes: result.duties_kes,
            hardware_kes: result.hardware_kes,
            sea_level_whp: result.sea_level_whp,
            nairobi_whp: result.nairobi_whp,
            kes_per_whp: result.kes_per_whp,
        }))
    }

    pub async fn stream_groq_advisory(
        State(state): State<AppState>,
        Query(req): Query<SimulationQuery>,
    ) -> Result<impl IntoResponse, (StatusCode, String)> {
        let clean_model = InputSanitizer::sanitize_identifier(&req.model, 64)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("{:?}", e)))?;
        let clean_focus = InputSanitizer::sanitize_identifier(&req.focus, 64)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("{:?}", e)))?;

        let stream = state
            .advisory_port
            .stream_advisory(&clean_model, req.stage, &clean_focus)
            .map(|res| match res {
                Ok(tok) => Ok::<Event, Infallible>(Event::default().data(tok)),
                Err(_) => Ok::<Event, Infallible>(Event::default().event("error").data("Stream halted")),
            });

        let mut headers = HeaderMap::new();
        headers.insert("X-Accel-Buffering", header::HeaderValue::from_static("no"));
        headers.insert(header::CACHE_CONTROL, header::HeaderValue::from_static("no-cache, no-transform"));

        let sse = Sse::new(stream).keep_alive(KeepAlive::new().text("ping"));
        Ok((headers, sse))
    }
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/api/v1/telemetry", post(TelemetryController::compute_metrics))
        .route("/api/v1/tuning/live-advisory", get(TelemetryController::stream_groq_advisory))
        .with_state(state)
}
