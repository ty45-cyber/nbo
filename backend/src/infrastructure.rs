use std::pin::Pin;
use futures::{Stream, StreamExt};
use reqwest::Client;
use reqwest_eventsource::{Event, EventSource};
use serde_json::Value;
use crate::application::{
    AdvisoryStreamPort, HotspotBlueprint, VehicleBlueprint, VehicleDiscoveryPort,
};
use crate::domain::DomainError;

pub struct GroqVehicleProfiler {
    client: Client,
    api_key: String,
}

impl GroqVehicleProfiler {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }

    async fn fetch_commons_photo(&self, query: &str) -> String {
        let url = "https://en.wikipedia.org/w/api.php";
        let search_term = format!("{} car", query);
        let resp = self
            .client
            .get(url)
            .query(&[
                ("action", "query"),
                ("generator", "search"),
                ("gsrsearch", search_term.as_str()),
                ("gsrlimit", "1"),
                ("prop", "pageimages"),
                ("piprop", "thumbnail"),
                ("pithumbsize", "1200"),
                ("format", "json"),
            ])
            .header("User-Agent", "NBO1795TelemetryEngine/1.0 (https://nbo1795.vercel.app)")
            .send()
            .await;

        if let Ok(r) = resp {
            if let Ok(json) = r.json::<Value>().await {
                if let Some(pages) = json["query"]["pages"].as_object() {
                    for (_, page) in pages {
                        if let Some(src) = page["thumbnail"]["source"].as_str() {
                            return src.to_string();
                        }
                    }
                }
            }
        }
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80".to_string()
    }

    fn fallback_blueprint(query: &str, year: u32, image_url: String) -> VehicleBlueprint {
        VehicleBlueprint {
            canonical_model: format!("{} {}", year, query.trim()),
            engine_code: "Forced-Induction High-Output".to_string(),
            displacement_cc: 2995,
            cylinders: 6,
            base_whp: 380,
            base_crsp_kes: 9_500_000.0,
            image_url,
            hotspots: vec![
                HotspotBlueprint {
                    stage: 1,
                    x_percent: 56,
                    y_percent: 42,
                    subsystem: "Standalone ECU & TCU Calibration".to_string(),
                    hardware_spec: "95-RON Ignition Timing & Boost Target Remap".to_string(),
                    default_focus: "95 RON knock threshold at 1,795m ASL".to_string(),
                },
                HotspotBlueprint {
                    stage: 2,
                    x_percent: 26,
                    y_percent: 58,
                    subsystem: "High-Flow Downpipe & Intercooler Core".to_string(),
                    hardware_spec: "Catless Downpipe + Competition Bar-and-Plate Intercooler".to_string(),
                    default_focus: "Intake air temperature stabilization at 81.4 kPa".to_string(),
                },
                HotspotBlueprint {
                    stage: 3,
                    x_percent: 38,
                    y_percent: 46,
                    subsystem: "Hybrid Turbocharger & Fuel System".to_string(),
                    hardware_spec: "Billet Wheel Hybrid Turbo + Upgraded HPFP + WMI".to_string(),
                    default_focus: "Compressor surge limit and methanol octane recovery".to_string(),
                },
            ],
        }
    }
}

impl VehicleDiscoveryPort for GroqVehicleProfiler {
    fn discover_vehicle<'a>(
        &'a self,
        query: &'a str,
        year: u32,
    ) -> Pin<Box<dyn std::future::Future<Output = Result<VehicleBlueprint, DomainError>> + Send + 'a>> {
        Box::pin(async move {
            let system_prompt = "You are an automotive telemetry database and Kenya Revenue Authority (KRA) CRSP valuation oracle. Return ONLY a valid JSON object matching this exact schema: {\"canonical_model\": string, \"engine_code\": string, \"displacement_cc\": integer, \"cylinders\": integer, \"base_whp\": integer, \"base_crsp_kes\": number, \"hotspots\": [{\"stage\": 1, \"x_percent\": integer, \"y_percent\": integer, \"subsystem\": string, \"hardware_spec\": string, \"default_focus\": string}, {\"stage\": 2, ...}, {\"stage\": 3, ...}]}. Ensure hotspots have realistic x_percent (22-65) and y_percent (38-64) coordinates and real brand-name aftermarket parts for that exact engine code.";

            let user_prompt = format!(
                "Synthesize complete specifications, 2026 KRA Base CRSP in KES, and Stage 1-3 tuning hotspots for: {} {}",
                year, query
            );

            let model = std::env::var("GROQ_MODEL")
                .unwrap_or_else(|_| "llama-3.1-8b-instant".to_string());

            let body = serde_json::json!({
                "model": model,
                "response_format": { "type": "json_object" },
                "temperature": 0.1,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_prompt }
                ]
            });

            let groq_req = self
                .client
                .post("https://api.groq.com/openai/v1/chat/completions")
                .bearer_auth(&self.api_key)
                .json(&body)
                .send();

            let photo_req = self.fetch_commons_photo(query);
            let (groq_res, image_url) = tokio::join!(groq_req, photo_req);

            let response = match groq_res {
                Ok(r) => r,
                Err(err) => {
                    tracing::warn!("Groq network request failed: {}. Using fallback blueprint.", err);
                    return Ok(Self::fallback_blueprint(query, year, image_url));
                }
            };

            let payload: Value = match response.json().await {
                Ok(p) => p,
                Err(err) => {
                    tracing::warn!("Groq payload JSON decode failed: {}. Using fallback blueprint.", err);
                    return Ok(Self::fallback_blueprint(query, year, image_url));
                }
            };

            if let Some(err_msg) = payload.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
                tracing::warn!("Groq returned API error: {}. Using fallback blueprint.", err_msg);
                return Ok(Self::fallback_blueprint(query, year, image_url));
            }

            let content_str = match payload["choices"][0]["message"]["content"].as_str() {
                Some(c) => c,
                None => {
                    tracing::warn!("Groq response had no message content. Using fallback blueprint.");
                    return Ok(Self::fallback_blueprint(query, year, image_url));
                }
            };

            let parsed: Value = match serde_json::from_str(content_str) {
                Ok(v) => v,
                Err(err) => {
                    tracing::warn!("Groq content was not valid JSON ({}). Using fallback blueprint.", err);
                    return Ok(Self::fallback_blueprint(query, year, image_url));
                }
            };

            let hotspots: Vec<HotspotBlueprint> = serde_json::from_value(parsed["hotspots"].clone())
                .unwrap_or_else(|_| vec![
                    HotspotBlueprint {
                        stage: 1,
                        x_percent: 56,
                        y_percent: 42,
                        subsystem: "Standalone ECU & TCU Calibration".to_string(),
                        hardware_spec: "95-RON Ignition Timing & Boost Target Remap".to_string(),
                        default_focus: "95 RON knock threshold at 1,795m ASL".to_string(),
                    },
                    HotspotBlueprint {
                        stage: 2,
                        x_percent: 26,
                        y_percent: 58,
                        subsystem: "High-Flow Downpipe & Intercooler Core".to_string(),
                        hardware_spec: "Catless Downpipe + Competition Bar-and-Plate Intercooler".to_string(),
                        default_focus: "Intake air temperature stabilization at 81.4 kPa".to_string(),
                    },
                    HotspotBlueprint {
                        stage: 3,
                        x_percent: 38,
                        y_percent: 46,
                        subsystem: "Hybrid Turbocharger & Fuel System".to_string(),
                        hardware_spec: "Billet Wheel Hybrid Turbo + Upgraded HPFP + WMI".to_string(),
                        default_focus: "Compressor surge limit and methanol octane recovery".to_string(),
                    },
                ]);

            Ok(VehicleBlueprint {
                canonical_model: parsed["canonical_model"].as_str().unwrap_or(query).to_string(),
                engine_code: parsed["engine_code"].as_str().unwrap_or("Forced-Induction Powerplant").to_string(),
                displacement_cc: parsed["displacement_cc"].as_u64().unwrap_or(2995) as u32,
                cylinders: parsed["cylinders"].as_u64().unwrap_or(6) as u8,
                base_whp: parsed["base_whp"].as_u64().unwrap_or(380) as u32,
                base_crsp_kes: parsed["base_crsp_kes"].as_f64().unwrap_or(9_500_000.0),
                image_url,
                hotspots,
            })
        })
    }
}

pub struct GroqAdvisoryAdapter {
    client: Client,
    api_key: String,
}

impl GroqAdvisoryAdapter {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
        }
    }
}

impl AdvisoryStreamPort for GroqAdvisoryAdapter {
    fn stream_advisory(
        &self,
        vehicle: &str,
        stage: u8,
        focus: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, String>> + Send>> {
        let prompt = format!(
            "You are an elite Nairobi automotive performance engineer. The user is building a Stage {} {}. Focus: {}. Stream 3 highly technical, localized bullet points covering specific mechanical weak points, exact aftermarket part brands for this engine code, and thermodynamic constraints at 1,795m ASL (81.4 kPa) on Kenyan 95 RON fuel. Max 110 words.",
            stage, vehicle, focus
        );

        let model = std::env::var("GROQ_MODEL")
            .unwrap_or_else(|_| "llama-3.1-8b-instant".to_string());

        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": true,
            "temperature": 0.25
        });

        let request = self
            .client
            .post("https://api.groq.com/openai/v1/chat/completions")
            .bearer_auth(&self.api_key)
            .json(&body);

        let event_source = EventSource::new(request);

        let fallback_bullets = format!(
            "• Stage {} Calibration: 95 RON knock ceiling requires conservative ignition timing derate (-3.5 deg) at 1,795m ASL due to barometric pressure dropping to 81.4 kPa.\n• Thermal Management: High-flow competition intercooler and catless downpipe mandatory to prevent turbocharger shaft overspeed in thin ambient air.\n• Drivetrain Protection: Torque limiter tables adjusted for transmission clutch longevity under sustained boost ramp.",
            stage
        );

        let stream = async_stream::stream! {
            let mut event_source = match event_source {
                Ok(es) => es,
                Err(_) => {
                    yield Ok(fallback_bullets);
                    return;
                }
            };

            let mut streamed_any = false;
            while let Some(event) = event_source.next().await {
                match event {
                    Ok(Event::Message(message)) => {
                        if message.data == "[DONE]" { break; }
                        if let Ok(json) = serde_json::from_str::<Value>(&message.data) {
                            if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                streamed_any = true;
                                yield Ok(content.to_string());
                            }
                        }
                    }
                    Err(_) => {
                        if !streamed_any {
                            yield Ok(fallback_bullets);
                        }
                        break;
                    }
                    _ => {}
                }
            }
        };

        Box::pin(stream)
    }
}
