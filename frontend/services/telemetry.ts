export type FuelProfile = "95_RON" | "95_WMI" | "E30_BLEND";

export interface HardwareHotspot {
  stage: 1 | 2 | 3;
  xPercent: number;
  yPercent: number;
  subsystem: string;
  hardwareSpec: string;
  defaultFocus: string;
}

export interface ChassisVisualProfile {
  label: string;
  model: string;
  year: number;
  cc: number;
  cylinders: number;
  engineCode: string;
  baseWhp: number;
  baseCrspKes: number;
  imageUrl: string;
  hotspots: [HardwareHotspot, HardwareHotspot, HardwareHotspot];
}

export interface DynoSamplePoint {
  rpm: number;
  mbaWhp: number;
  nboWhp: number;
  nboTorqueNm: number;
  boostPsi: number;
  iatCelsius: number;
}

export interface BuildSnapshot {
  id: string;
  model: string;
  year: number;
  cc: number;
  stage: 1 | 2 | 3;
  nairobiWhp: number;
  totalProjectKes: number;
  kesPerWhp: number;
}

const CHASSIS_CATALOG: ChassisVisualProfile[] = [
  {
    label: "Audi SQ5 B9",
    model: "2020 Audi SQ5",
    year: 2020,
    cc: 2995,
    cylinders: 6,
    engineCode: "EA839 3.0L V6 Twin-Scroll",
    baseWhp: 349,
    baseCrspKes: 8_200_000,
    imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
    hotspots: [
      {
        stage: 1,
        xPercent: 58,
        yPercent: 42,
        subsystem: "Bosch MG1 ECU + ZF8HP TCU",
        hardwareSpec: "Stage 1 95-RON Octane Map & Torque Limiter Delete",
        defaultFocus: "ZF8HP torque converter slip and 95 RON ignition retard",
      },
      {
        stage: 2,
        xPercent: 25,
        yPercent: 62,
        subsystem: "Wagner Competition Intercooler + Catless Downpipe",
        hardwareSpec: "High-Flow Cast Downpipe + Oversized Bar-and-Plate Core",
        defaultFocus: "Charge air cooling at 1795m ASL and rocker arm durability",
      },
      {
        stage: 3,
        xPercent: 39,
        yPercent: 47,
        subsystem: "TTE710 Hybrid Turbo + 034 HPFP Piston",
        hardwareSpec: "Hot-V TTE710 Billet Compressor + Upgraded HPFP + WMI",
        defaultFocus: "TTE710 surge limits at high altitude and fuel rail pressure",
      },
    ],
  },
  {
    label: "BMW X6 M Comp",
    model: "2020 BMW X6 M Competition",
    year: 2020,
    cc: 4395,
    cylinders: 8,
    engineCode: "S63B44T4 4.4L V8 Twin-Turbo",
    baseWhp: 617,
    baseCrspKes: 16_400_000,
    imageUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
    hotspots: [
      {
        stage: 1,
        xPercent: 55,
        yPercent: 40,
        subsystem: "DME Calibration + M-Steptronic Flash",
        hardwareSpec: "Custom Bench Unlock + 22 PSI Boost Target Calibration",
        defaultFocus: "S63 connecting rod bend threshold on low-end torque spikes",
      },
      {
        stage: 2,
        xPercent: 24,
        yPercent: 58,
        subsystem: "Primary & Secondary Cat-Delete + Eventuri Carbon Intake",
        hardwareSpec: "200-Cell Heat-Shielded Downpipes + Dual Carbon Airboxes",
        defaultFocus: "Hot-V radiant heat soak management in Nairobi traffic",
      },
      {
        stage: 3,
        xPercent: 37,
        yPercent: 44,
        subsystem: "Pure900 Turbos + Dual-Nozzle Meth Injection",
        hardwareSpec: "Billet S63 Manifolds + Pure900 + Snow Performance WMI",
        defaultFocus: "Octane ceiling via water-methanol and rod bearing clearances",
      },
    ],
  },
  {
    label: "Cayenne Turbo GT",
    model: "2021 Porsche Cayenne Turbo GT",
    year: 2021,
    cc: 3996,
    cylinders: 8,
    engineCode: "EA825 4.0L V8 Twin-Turbo",
    baseWhp: 631,
    baseCrspKes: 18_500_000,
    imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    hotspots: [
      {
        stage: 1,
        xPercent: 56,
        yPercent: 43,
        subsystem: "Continental EMS Calibration",
        hardwareSpec: "Stage 1 Boost Pressure & Sport Response Mapping",
        defaultFocus: "EA825 cylinder wall scoring prevention and oil temps",
      },
      {
        stage: 2,
        xPercent: 25,
        yPercent: 60,
        subsystem: "Titanium Link-Pipes + BMC High-Flow Filters",
        hardwareSpec: "OPF/GPF Delete Link Pipes + High-Flow Intake Element",
        defaultFocus: "Exhaust backpressure reduction and titanium thermal expansion",
      },
      {
        stage: 3,
        xPercent: 39,
        yPercent: 47,
        subsystem: "TTE1000 8-Blade Turbos + CSF Intercoolers",
        hardwareSpec: "Reinforced Thrust Bearings + Dual CSF Charge Coolers",
        defaultFocus: "Compressor shaft speed ceiling at 81.4 kPa ambient pressure",
      },
    ],
  },
  {
    label: "LC200 V8 VD30",
    model: "2019 Toyota Land Cruiser 200",
    year: 2019,
    cc: 4461,
    cylinders: 8,
    engineCode: "1VD-FTV 4.5L V8 Twin-Turbo Diesel",
    baseWhp: 282,
    baseCrspKes: 14_000_000,
    imageUrl: "https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&w=1200&q=80",
    hotspots: [
      {
        stage: 1,
        xPercent: 54,
        yPercent: 42,
        subsystem: "Denso ECU Remap + AB60F Transmission Lockup",
        hardwareSpec: "Common-Rail Injection Duration + Torque Converter Lock",
        defaultFocus: "EGT thermal runaway at altitude and AB60F valve body pressure",
      },
      {
        stage: 2,
        xPercent: 28,
        yPercent: 48,
        subsystem: "Top-Mount PWR Intercooler + 4-Inch DPF-Back Exhaust",
        hardwareSpec: "High-Efficiency Top-Mount Core + Twin 3-Inch Dump Pipes",
        defaultFocus: "Air-to-fuel ratio smoke limit in thin Nairobi air",
      },
      {
        stage: 3,
        xPercent: 37,
        yPercent: 54,
        subsystem: "GTurbo Bad Boy Red + +30% Denso Injectors",
        hardwareSpec: "Billet VNT Twin Turbos + High-Flow Nozzles + HD Valvebody",
        defaultFocus: "1VD-FTV head gasket clamping load at 38 PSI boost",
      },
    ],
  },
];

export class ChassisVisualRegistry {
  public static getPresetCatalog(): ChassisVisualProfile[] {
    return CHASSIS_CATALOG;
  }

  /**
   * Resolves any arbitrary user-searched vehicle into a visual profile with a real photograph
   * fetched live from Wikimedia Commons/Wikipedia REST API.
   */
  public static async resolveDynamicVehicleProfile(
    rawQuery: string,
    year: number
  ): Promise<ChassisVisualProfile> {
    const cleaned = rawQuery.trim();
    const matched = CHASSIS_CATALOG.find(
      (item) =>
        item.model.toLowerCase() === cleaned.toLowerCase() ||
        cleaned.toLowerCase().includes(item.label.toLowerCase())
    );
    if (matched) return matched;

    let discoveredPhoto =
      "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1200&q=80";

    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleaned + " car"
      )}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=1200&format=json&origin=*`;
      const res = await fetch(wikiUrl);
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages) {
          const firstPage = Object.values(pages)[0] as { thumbnail?: { source?: string } };
          if (firstPage?.thumbnail?.source) {
            discoveredPhoto = firstPage.thumbnail.source;
          }
        }
      }
    } catch {
      // Fallback image remains active if offline
    }

    return {
      label: cleaned,
      model: `${year} ${cleaned.replace(/^\d{4}\s*/, "")}`,
      year,
      cc: 2998,
      cylinders: 6,
      engineCode: "Groq Synthesized Powerplant",
      baseWhp: 385,
      baseCrspKes: 9_800_000,
      imageUrl: discoveredPhoto,
      hotspots: [
        {
          stage: 1,
          xPercent: 56,
          yPercent: 42,
          subsystem: `${cleaned} ECU & TCU Calibration`,
          hardwareSpec: "Stage 1 95-RON Ignition Timing & Boost Target Remap",
          defaultFocus: `${cleaned} 95 RON knock ceiling at 1,795m ASL`,
        },
        {
          stage: 2,
          xPercent: 25,
          yPercent: 59,
          subsystem: `${cleaned} Charge Cooler & Downpipe`,
          hardwareSpec: "High-Flow Catless Downpipe + Competition Intercooler Core",
          defaultFocus: `${cleaned} intake air temperature soak at 81.4 kPa`,
        },
        {
          stage: 3,
          xPercent: 38,
          yPercent: 46,
          subsystem: `${cleaned} Hybrid Turbo & Fueling Package`,
          hardwareSpec: "Billet Compressor Wheel Hybrid Turbo + Upgraded HPFP + WMI",
          defaultFocus: `${cleaned} turbo shaft speed limit and fuel rail pressure`,
        },
      ],
    };
  }
}

export class DynoCurveSynthesizer {
  public static generateRpmSweep(
    seaLevelPeakWhp: number,
    nairobiPeakWhp: number,
    stage: 1 | 2 | 3,
    fuel: FuelProfile
  ): DynoSamplePoint[] {
    const fuelModifier = fuel === "E30_BLEND" ? 1.055 : fuel === "95_WMI" ? 1.035 : 1.0;
    const baseBoost = stage === 3 ? 28.5 : stage === 2 ? 22.0 : 18.0;
    const baseIat = fuel === "95_WMI" ? 31 : stage === 2 ? 38 : 46;
    const points: DynoSamplePoint[] = [];

    for (let i = 0; i <= 20; i++) {
      const rpm = 2000 + i * 250;
      const norm = (rpm - 2000) / 5000;

      const mbaSpool = 1 / (1 + Math.exp(-10 * (norm - 0.22)));
      const nboSpool = 1 / (1 + Math.exp(-9.5 * (norm - 0.30)));
      const topEndTaper = 1 - 0.14 * Math.pow(Math.max(0, norm - 0.72), 2);

      const mbaFactor = Math.min(1.0, mbaSpool * (0.35 + 0.72 * norm) * topEndTaper);
      const nboFactor = Math.min(1.0, nboSpool * (0.32 + 0.74 * norm) * topEndTaper);

      const mbaWhp = Math.round(seaLevelPeakWhp * mbaFactor);
      const nboWhp = Math.round(nairobiPeakWhp * fuelModifier * nboFactor);
      const nboTorqueNm = Math.round((nboWhp * 7127) / rpm);
      const boostPsi = Number((baseBoost * nboSpool * topEndTaper).toFixed(1));
      const iatCelsius = Math.round(baseIat + Math.pow(norm, 1.7) * (stage === 1 ? 16 : 9));

      points.push({ rpm, mbaWhp, nboWhp, nboTorqueNm, boostPsi, iatCelsius });
    }
    return points;
  }

  public static buildSvgPolyline(
    points: DynoSamplePoint[],
    metric: "mbaWhp" | "nboWhp" | "nboTorqueNm",
    maxCeiling: number,
    width: number,
    height: number
  ): string {
    if (points.length === 0) return "";
    return points
      .map((pt, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - Math.min(1, pt[metric] / maxCeiling) * (height - 24) - 12;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }
}

export class AcousticTelemetryEngine {
  private static activeContext: AudioContext | null = null;

  public static triggerDynoSweepAudio(cylinders: number, stage: 1 | 2 | 3): void {
    if (typeof window === "undefined") return;
    AcousticTelemetryEngine.stopAudio();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    AcousticTelemetryEngine.activeContext = ctx;
    const now = ctx.currentTime;
    const duration = 2.4;

    const engineOsc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const turboOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();
    const turboGain = ctx.createGain();

    engineOsc.type = "sawtooth";
    subOsc.type = "triangle";
    turboOsc.type = "sine";

    const validCyl = Math.max(4, Math.min(12, cylinders || 6));
    const startFreq = (2000 / 60) * (validCyl / 2);
    const endFreq = (7000 / 60) * (validCyl / 2);

    engineOsc.frequency.setValueAtTime(startFreq, now);
    engineOsc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    subOsc.frequency.setValueAtTime(startFreq * 0.5, now);
    subOsc.frequency.exponentialRampToValueAtTime(endFreq * 0.5, now + duration);

    const turboBase = stage === 3 ? 1900 : stage === 2 ? 1500 : 1200;
    turboOsc.frequency.setValueAtTime(turboBase, now);
    turboOsc.frequency.exponentialRampToValueAtTime(turboBase * 2.8, now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + duration);

    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(0.14, now + 0.25);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.15);

    turboGain.gain.setValueAtTime(0.002, now);
    turboGain.gain.exponentialRampToValueAtTime(0.035 * stage, now + duration * 0.85);
    turboGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.15);

    engineOsc.connect(filter);
    subOsc.connect(filter);
    filter.connect(masterGain);
    turboOsc.connect(turboGain);
    turboGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    engineOsc.start(now);
    subOsc.start(now);
    turboOsc.start(now);
    engineOsc.stop(now + duration + 0.2);
    subOsc.stop(now + duration + 0.2);
    turboOsc.stop(now + duration + 0.2);
  }

  public static stopAudio(): void {
    if (AcousticTelemetryEngine.activeContext) {
      AcousticTelemetryEngine.activeContext.close().catch(() => {});
      AcousticTelemetryEngine.activeContext = null;
    }
  }
}

export class PermalinkCodec {
  public static encodeBuildUrl(baseUrl: string, model: string, year: number, cc: number, stage: number): string {
    const params = new URLSearchParams({
      m: model.trim(),
      y: year.toString(),
      c: cc.toString(),
      s: stage.toString(),
    });
    return `${baseUrl}?${params.toString()}`;
  }

  public static decodeWindowParams(search: string): { model: string; year: number; cc: number; stage: 1 | 2 | 3 } | null {
    const params = new URLSearchParams(search);
    const model = params.get("m");
    const year = Number(params.get("y"));
    const cc = Number(params.get("c"));
    const stage = Number(params.get("s"));

    if (!model || year < 2019 || year > 2026 || cc < 800 || ![1, 2, 3].includes(stage)) {
      return null;
    }
    return { model, year, cc, stage: stage as 1 | 2 | 3 };
  }
}

const RAILWAY_BASE = "https://nbo-production-25da.up.railway.app";

export class AnnaRuntimeBridge {
  /**
   * Invokes the bundled Executa via Anna Host API when inside Anna OS (logging Qualified MAU),
   * or falls back to direct Railway HTTPS call when accessed via standalone browser.
   */
  public static async invokeTelemetry(
    model: string,
    year: number,
    stage: 1 | 2 | 3,
    focus: string
  ): Promise<unknown> {
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        __ANNA_TOOL_IDS__?: Record<string, string>;
        anna?: {
          tools?: {
            invoke: (payload: {
              tool_id: string;
              method: string;
              args: Record<string, unknown>;
            }) => Promise<unknown>;
          };
        };
      };

      if (win.anna?.tools?.invoke) {
        const toolId = win.__ANNA_TOOL_IDS__?.["nbo-engine"] || "tool-dev-nbo-engine";
        return await win.anna.tools.invoke({
          tool_id: toolId,
          method: "compute_telemetry",
          args: { model, year, stage, focus },
        });
      }
    }

    const res = await fetch(`${RAILWAY_BASE}/api/v1/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, year, stage, focus }),
    });
    if (!res.ok) throw new Error(`Railway HTTP ${res.status}`);
    return await res.json();
  }

  /**
   * Returns the direct Railway SSE URL so EventSource never hits a 404 on Vercel.
   */
  public static getAdvisoryStreamUrl(
    model: string,
    year: number,
    stage: number,
    focus: string
  ): string {
    const sseUrl = new URL(`${RAILWAY_BASE}/api/v1/tuning/live-advisory`);
    sseUrl.searchParams.set("model", model);
    sseUrl.searchParams.set("year", year.toString());
    sseUrl.searchParams.set("stage", stage.toString());
    sseUrl.searchParams.set("focus", focus);
    return sseUrl.toString();
  }
}

export class ComparisonGarageVault {
  private static readonly STORAGE_KEY = "nbo1795_telemetry_garage_v1";

  public static saveSnapshot(snapshot: BuildSnapshot): BuildSnapshot[] {
    if (typeof window === "undefined") return [];
    const existing = ComparisonGarageVault.loadSnapshots().filter((item) => item.id !== snapshot.id);
    const updated = [snapshot, ...existing].slice(0, 3);
    try {
      window.localStorage.setItem(ComparisonGarageVault.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Storage write failed", e);
    }
    return updated;
  }

  public static loadSnapshots(): BuildSnapshot[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(ComparisonGarageVault.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as BuildSnapshot[]) : [];
    } catch {
      return [];
    }
  }
}