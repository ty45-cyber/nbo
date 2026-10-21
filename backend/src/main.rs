pub mod api;
pub mod application;
pub mod domain;
pub mod infrastructure;

use axum::Router;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // 1. Initialize Deterministic Telemetry
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,nairobi_tuning_engine=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Bootstrapping Nairobi Auto-Tuning Engine...");

    // 2. Wire Dependency Injection (Infrastructure -> Application)
    let groq_api_key = std::env::var("GROQ_API_KEY").unwrap_or_default();
    let advisory_port = Arc::new(infrastructure::GroqAdvisoryAdapter::new(groq_api_key.clone()));
    let discovery_profiler = Arc::new(infrastructure::GroqVehicleProfiler::new(groq_api_key));
    let simulation_use_case = Arc::new(application::SimulationUseCase::new(discovery_profiler));

    let app_state = api::AppState {
        simulation_use_case,
        advisory_port,
    };

    // 3. Configure Strict Edge Security & CORS
    let cors = CorsLayer::new()
        .allow_origin(Any) // Vercel edge proxy rewrites mask the origin in production
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(api::build_router(app_state)) // Router defined in api.rs
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // 4. Bind TCP Socket
    let port = std::env::var("PORT").unwrap_or_else(|_| "8000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&addr).await.expect("Failed to bind TCP listener");

    tracing::info!("Core engine active and listening on {}", listener.local_addr().unwrap());
    
    axum::serve(listener, app)
        .await
        .expect("Fatal Axum server crash");
}
