const readline = require("readline");
const manifest = require("./manifest.json");

const RAILWAY_ENDPOINT = process.env.BACKEND_URL || "https://nbo-production-25da.up.railway.app/api/v1/telemetry";

class AnnaRpcDispatcher {
  static async handleRequest(req) {
    if (req.method === "describe") {
      return { jsonrpc: "2.0", id: req.id, result: manifest };
    }
    if (req.method === "compute_telemetry" || req.method === "call") {
      const args = req.params?.arguments || req.params?.args || req.params || {};
      const data = await AnnaRpcDispatcher.forwardToRailway(args);
      return { jsonrpc: "2.0", id: req.id, result: data };
    }
    return {
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: `Method not found: ${req.method}` },
    };
  }

  static async forwardToRailway(args) {
    const model = String(args.model || "2021 Nissan GT-R R35");
    const year = Number(args.year) || 2021;
    const stage = Number(args.stage) || 2;
    const focus = String(args.focus || "1,795m ASL thermodynamic limit");

    try {
      const res = await fetch(RAILWAY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, year, stage, focus }),
      });
      if (res.ok) {
        return await res.json();
      }
      console.error(`Railway upstream returned HTTP ${res.status}; engaging deterministic fallback telemetry.`);
    } catch (err) {
      console.error(`Railway upstream unreachable (${err.message}); engaging deterministic fallback telemetry.`);
    }

    return AnnaRpcDispatcher.syntheticTelemetry(model, year, stage, focus);
  }

  static syntheticTelemetry(model, year, stage, focus) {
    const cleanModel = model.trim();
    const canonicalModel = cleanModel.startsWith(String(year)) ? cleanModel : `${year} ${cleanModel}`;
    const baseWhp = stage === 3 ? 550 : stage === 2 ? 460 : 380;
    const seaLevelWhp = Math.round(baseWhp * (stage === 3 ? 1.58 : stage === 2 ? 1.32 : 1.18));
    const nairobiWhp = Math.round(seaLevelWhp * (stage === 3 ? 0.965 : 0.935));
    const baseCrspKes = 9500000;
    const landedKes = Math.round(baseCrspKes * 1.48);
    const dutiesKes = Math.round(landedKes * 0.42);
    const hardwareKes = stage === 3 ? 1150000 : stage === 2 ? 340000 : 95000;
    return {
      blueprint: {
        canonical_model: canonicalModel,
        engine_code: "Forced-Induction High-Output",
        displacement_cc: 2995,
        cylinders: 6,
        base_whp: baseWhp,
        base_crsp_kes: baseCrspKes,
        image_url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
        hotspots: [
          {
            stage: 1,
            x_percent: 56,
            y_percent: 42,
            subsystem: "Standalone ECU & TCU Calibration",
            hardware_spec: "95-RON Ignition Timing & Boost Target Remap",
            default_focus: "95 RON knock threshold at 1,795m ASL",
          },
          {
            stage: 2,
            x_percent: 26,
            y_percent: 58,
            subsystem: "High-Flow Downpipe & Intercooler Core",
            hardware_spec: "Catless Downpipe + Competition Bar-and-Plate Intercooler",
            default_focus: "Intake air temperature stabilization at 81.4 kPa",
          },
          {
            stage: 3,
            x_percent: 38,
            y_percent: 46,
            subsystem: "Hybrid Turbocharger & Fuel System",
            hardware_spec: "Billet Wheel Hybrid Turbo + Upgraded HPFP + WMI",
            default_focus: "Compressor surge limit and methanol octane recovery",
          },
        ],
      },
      landed_vehicle_kes: landedKes,
      duties_kes: dutiesKes,
      hardware_kes: hardwareKes,
      sea_level_whp: seaLevelWhp,
      nairobi_whp: nairobiWhp,
      kes_per_whp: Math.round((landedKes + hardwareKes) / nairobiWhp),
    };
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const response = await AnnaRpcDispatcher.handleRequest(req);
    process.stdout.write(JSON.stringify(response) + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: String(err.message || err) },
      }) + "\n"
    );
  }
});
