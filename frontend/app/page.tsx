"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ChassisVisualRegistry,
  ChassisVisualProfile,
  HardwareHotspot,
  DynoCurveSynthesizer,
  DynoSamplePoint,
  AcousticTelemetryEngine,
  FuelProfile,
  PermalinkCodec,
  ComparisonGarageVault,
  AnnaRuntimeBridge,
  BuildSnapshot,
} from "../services/telemetry";

interface BackendHotspot {
  stage: 1 | 2 | 3;
  x_percent: number;
  y_percent: number;
  subsystem: string;
  hardware_spec: string;
  default_focus: string;
}

interface BackendBlueprint {
  canonical_model: string;
  engine_code: string;
  displacement_cc: number;
  cylinders: number;
  base_whp: number;
  base_crsp_kes: number;
  image_url: string;
  hotspots: BackendHotspot[];
}

interface TelemetryPayload {
  blueprint: BackendBlueprint;
  landed_vehicle_kes: number;
  duties_kes: number;
  hardware_kes: number;
  sea_level_whp: number;
  nairobi_whp: number;
  kes_per_whp: number;
}

const POPULAR_SEARCHES = [
  "2021 Subaru WRX STI",
  "2022 Mercedes-AMG G63",
  "2020 Nissan GT-R R35",
  "2022 Volkswagen Golf R",
  "2021 Toyota GR Yaris",
];

export default function Nbo1795Cockpit() {
  const catalog = ChassisVisualRegistry.getPresetCatalog();

  // --- Universal Search & Active Vehicle Profile State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [activeProfile, setActiveProfile] = useState<ChassisVisualProfile>(catalog[0]);
  const [year, setYear] = useState<number>(catalog[0].year);
  const [cc, setCc] = useState<number>(catalog[0].cc);
  const [stage, setStage] = useState<1 | 2 | 3>(2);
  const [fuel, setFuel] = useState<FuelProfile>("95_RON");
  const [focus, setFocus] = useState<string>(catalog[0].hotspots[1].defaultFocus);
  const [xRayMode, setXRayMode] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [imageError, setImageError] = useState<boolean>(false);

  // --- Execution & Dyno Sweep State ---
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [activeSweepIdx, setActiveSweepIdx] = useState<number>(20);
  const [isSweepingDyno, setIsSweepingDyno] = useState<boolean>(false);
  const [garage, setGarage] = useState<BuildSnapshot[]>([]);
  const [advisoryStream, setAdvisoryStream] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const sweepTimerRef = useRef<number | null>(null);

  const activeHotspot: HardwareHotspot =
    activeProfile.hotspots.find((h) => h.stage === stage) || activeProfile.hotspots[0];

  // Generate 21-point RPM Dyno Matrix
  const dynoPoints: DynoSamplePoint[] = useMemo(() => {
    const seaPeak = telemetry
      ? telemetry.sea_level_whp
      : Math.round(activeProfile.baseWhp * (stage === 3 ? 1.58 : stage === 2 ? 1.32 : 1.18));
    const nboPeak = telemetry
      ? telemetry.nairobi_whp
      : Math.round(seaPeak * (stage === 3 ? 0.965 : 0.935));
    return DynoCurveSynthesizer.generateRpmSweep(seaPeak, nboPeak, stage, fuel);
  }, [telemetry, activeProfile.baseWhp, stage, fuel]);

  const inspectedPoint: DynoSamplePoint = dynoPoints[activeSweepIdx] || dynoPoints[dynoPoints.length - 1];
  const peakPoint: DynoSamplePoint = dynoPoints[dynoPoints.length - 1];

  // KRA Tax Waterfall Computation
  const financialBreakdown = useMemo(() => {
    const landedKes = telemetry
      ? telemetry.landed_vehicle_kes
      : activeProfile.baseCrspKes * 1.48;
    const dutiesKes = telemetry
      ? telemetry.duties_kes
      : landedKes - activeProfile.baseCrspKes * 0.8;
    const baseCrspKes = Math.max(0, landedKes - dutiesKes);
    const hardwareKes = telemetry
      ? telemetry.hardware_kes
      : stage === 3
      ? 1_150_000
      : stage === 2
      ? 340_000
      : 95_000;
    const totalProjectKes = landedKes + hardwareKes;
    const kesPerWhp = totalProjectKes / Math.max(1, peakPoint.nboWhp);

    return { landedKes, dutiesKes, baseCrspKes, hardwareKes, totalProjectKes, kesPerWhp };
  }, [telemetry, activeProfile.baseCrspKes, stage, peakPoint.nboWhp]);

  const triggerAnimatedDynoPull = useCallback(
    (cylinders: number, activeStage: 1 | 2 | 3) => {
      if (sweepTimerRef.current) window.clearInterval(sweepTimerRef.current);
      setIsSweepingDyno(true);
      setActiveSweepIdx(0);

      if (soundEnabled) {
        AcousticTelemetryEngine.triggerDynoSweepAudio(cylinders, activeStage);
      }

      let step = 0;
      sweepTimerRef.current = window.setInterval(() => {
        step += 1;
        if (step >= 20) {
          setActiveSweepIdx(20);
          setIsSweepingDyno(false);
          if (sweepTimerRef.current) window.clearInterval(sweepTimerRef.current);
        } else {
          setActiveSweepIdx(step);
        }
      }, 110);
    },
    [soundEnabled]
  );

  // Core Discovery + Groq Telemetry Pipeline for Any Searched Vehicle
  const discoverAndSynthesizeVehicle = useCallback(
    async (targetQuery: string, targetYear: number, targetStage: 1 | 2 | 3, customFocus?: string) => {
      const cleanQuery = targetQuery.trim();
      if (!cleanQuery) return;

      setIsDiscovering(true);
      setImageError(false);
      setAdvisoryStream("");

      // 1. Immediately resolve visual photograph & optimistic profile in browser
      const optimisticProfile = await ChassisVisualRegistry.resolveDynamicVehicleProfile(
        cleanQuery,
        targetYear
      );
      setActiveProfile(optimisticProfile);
      setYear(optimisticProfile.year);
      setCc(optimisticProfile.cc);

      const selectedHotspot =
        optimisticProfile.hotspots.find((h) => h.stage === targetStage) ||
        optimisticProfile.hotspots[0];
      const activeFocus = customFocus || selectedHotspot.defaultFocus;
      setFocus(activeFocus);

      try {
        // 2. Query Rust Backend -> Groq JSON-Mode Blueprint + KRA Valuation
        //    Inside Anna OS: anna.tools.invoke -> bundled nbo-engine Executa (Qualified MAU)
        //    Standalone browser: direct HTTPS call to Railway backend
        let data: TelemetryPayload | null = null;
        try {
          data = (await AnnaRuntimeBridge.invokeTelemetry(
            cleanQuery,
            targetYear,
            targetStage,
            activeFocus
          )) as TelemetryPayload;
        } catch (err) {
          console.error("Telemetry invocation failed", err);
        }

        if (data && data.blueprint) {
          setTelemetry(data);

          const bp = data.blueprint;
          const mappedHotspots =
            bp.hotspots && bp.hotspots.length === 3
              ? (bp.hotspots.map((h) => ({
                  stage: h.stage as 1 | 2 | 3,
                  xPercent: h.x_percent,
                  yPercent: h.y_percent,
                  subsystem: h.subsystem,
                  hardwareSpec: h.hardware_spec,
                  defaultFocus: h.default_focus,
                })) as [HardwareHotspot, HardwareHotspot, HardwareHotspot])
              : optimisticProfile.hotspots;

          const groqProfile: ChassisVisualProfile = {
            label: bp.canonical_model,
            model: bp.canonical_model,
            year: targetYear,
            cc: bp.displacement_cc,
            cylinders: bp.cylinders,
            engineCode: bp.engine_code,
            baseWhp: bp.base_whp,
            baseCrspKes: bp.base_crsp_kes,
            imageUrl: bp.image_url || optimisticProfile.imageUrl,
            hotspots: mappedHotspots,
          };

          setActiveProfile(groqProfile);
          setCc(bp.displacement_cc);
          triggerAnimatedDynoPull(bp.cylinders, targetStage);
        } else {
          triggerAnimatedDynoPull(optimisticProfile.cylinders, targetStage);
        }

        // 3. Update Browser Permalink
        const nextUrl = PermalinkCodec.encodeBuildUrl(
          window.location.pathname,
          optimisticProfile.model,
          targetYear,
          optimisticProfile.cc,
          targetStage
        );
        window.history.replaceState({}, "", nextUrl);

        // 4. Stream Unbuffered Groq Modification Directives
        setIsStreaming(true);
        const sseUrl = AnnaRuntimeBridge.getAdvisoryStreamUrl(
          cleanQuery,
          targetYear,
          targetStage,
          `${activeFocus} (${fuel})`
        );

        eventSourceRef.current?.close();
        const sse = new EventSource(sseUrl);
        eventSourceRef.current = sse;

        sse.onmessage = (event) => {
          if (event.data === "[DONE]") {
            sse.close();
            setIsStreaming(false);
          } else {
            setAdvisoryStream((prev) => prev + event.data);
          }
        };

        sse.onerror = () => {
          sse.close();
          setIsStreaming(false);
        };
      } catch {
        triggerAnimatedDynoPull(optimisticProfile.cylinders, targetStage);
        setIsStreaming(false);
      } finally {
        setIsDiscovering(false);
      }
    },
    [fuel, triggerAnimatedDynoPull]
  );

  useEffect(() => {
    setGarage(ComparisonGarageVault.loadSnapshots());
    const decoded = PermalinkCodec.decodeWindowParams(window.location.search);
    if (decoded) {
      setStage(decoded.stage);
      discoverAndSynthesizeVehicle(decoded.model, decoded.year, decoded.stage);
    }
    return () => {
      eventSourceRef.current?.close();
      if (sweepTimerRef.current) window.clearInterval(sweepTimerRef.current);
      AcousticTelemetryEngine.stopAudio();
    };
  }, [discoverAndSynthesizeVehicle]);

  const handleUniversalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const yearMatch = searchQuery.match(/\b(2019|202\d)\b/);
    const extractedYear = yearMatch ? Number(yearMatch[1]) : year;
    discoverAndSynthesizeVehicle(searchQuery, extractedYear, stage);
  };

  const selectVisualPreset = (profile: ChassisVisualProfile) => {
    setImageError(false);
    setTelemetry(null);
    setActiveProfile(profile);
    setSearchQuery(profile.model);
    setYear(profile.year);
    setCc(profile.cc);
    const matchingHotspot = profile.hotspots.find((h) => h.stage === stage) || profile.hotspots[0];
    setFocus(matchingHotspot.defaultFocus);
    discoverAndSynthesizeVehicle(profile.model, profile.year, stage, matchingHotspot.defaultFocus);
  };

  const selectHardwareNode = (hotspot: HardwareHotspot) => {
    setStage(hotspot.stage);
    setFocus(hotspot.defaultFocus);
    discoverAndSynthesizeVehicle(activeProfile.model, year, hotspot.stage, hotspot.defaultFocus);
  };

  const handleSaveToGarage = () => {
    const snapshot: BuildSnapshot = {
      id: `${activeProfile.model}-S${stage}-${fuel}`,
      model: activeProfile.model,
      year,
      cc,
      stage,
      nairobiWhp: peakPoint.nboWhp,
      totalProjectKes: financialBreakdown.totalProjectKes,
      kesPerWhp: financialBreakdown.kesPerWhp,
    };
    setGarage(ComparisonGarageVault.saveSnapshot(snapshot));
  };

  const generateWhatsAppShareUrl = useCallback(() => {
    const shareUrl = PermalinkCodec.encodeBuildUrl(
      "https://nbo1795.vercel.app",
      activeProfile.model,
      year,
      cc,
      stage
    );
    const message = [
      `NBO 1795 TELEMETRY: ${activeProfile.model} [${activeProfile.engineCode}]`,
      `Stage ${stage} (${fuel}) | Mombasa Landed: KES ${(financialBreakdown.landedKes / 1e6).toFixed(2)}M`,
      `1,795m ASL Peak Output: ${peakPoint.nboWhp} WHP / ${peakPoint.nboTorqueNm} Nm @ ${peakPoint.boostPsi} PSI`,
      `Efficiency: KES ${Math.round(financialBreakdown.kesPerWhp).toLocaleString()} / WHP`,
      `Modify & Inspect Dyno: ${shareUrl}`,
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [financialBreakdown, activeProfile, year, cc, stage, fuel, peakPoint]);

  const maxGraphCeiling = Math.max(peakPoint.mbaWhp, peakPoint.nboTorqueNm, 750) * 1.12;
  const mbaPolyline = DynoCurveSynthesizer.buildSvgPolyline(dynoPoints, "mbaWhp", maxGraphCeiling, 560, 190);
  const nboPolyline = DynoCurveSynthesizer.buildSvgPolyline(dynoPoints, "nboWhp", maxGraphCeiling, 560, 190);
  const torquePolyline = DynoCurveSynthesizer.buildSvgPolyline(dynoPoints, "nboTorqueNm", maxGraphCeiling, 560, 190);
  const nboAreaPolygon = `0,190 ${nboPolyline} 560,190`;
  const cursorX = (activeSweepIdx / 20) * 560;

  const rpmRatio = Math.min(1, Math.max(0, (inspectedPoint.rpm - 1000) / 6500));
  const boostRatio = Math.min(1, Math.max(0, inspectedPoint.boostPsi / 32));

  return (
    <div className="min-h-screen pb-16">
      
      {/* Top Sticky MoTeC C125 Shift-Light Telemetry Strip */}
      <div
        className="sticky top-0 z-50 border-b border-slate-800/90 px-4 py-2.5 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(3, 5, 9, 0.92)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-mono">
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500 text-black rounded tracking-wider">
              MoTeC CAN-BUS
            </span>
            <span className="text-white font-bold tabular-nums text-sm">
              {inspectedPoint.rpm} <span className="text-slate-500 text-xs">RPM</span>
            </span>
          </div>

          <div className="flex-1 max-w-xl grid grid-cols-12 gap-1.5">
            {Array.from({ length: 12 }).map((_, idx) => {
              const thresholdIdx = Math.floor((idx / 12) * 20);
              const isLit = activeSweepIdx >= thresholdIdx;
              const activeColor =
                idx < 5
                  ? "bg-emerald-400 shadow-[0_0_12px_#10B981]"
                  : idx < 9
                  ? "bg-amber-400 shadow-[0_0_12px_#FBBF24]"
                  : "bg-rose-500 shadow-[0_0_16px_#F43F5E]";
              return (
                <div
                  key={idx}
                  className={`h-3 rounded-sm transition-all duration-75 ${
                    isLit ? activeColor : "bg-slate-900/90 border border-slate-800"
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="hidden md:inline text-cyan-400 font-bold tabular-nums">
              {inspectedPoint.boostPsi} PSI
            </span>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition-all ${
                soundEnabled
                  ? "border-emerald-500/80 text-emerald-400 bg-emerald-500/10"
                  : "border-slate-700 text-slate-500 bg-slate-900"
              }`}
            >
              {soundEnabled ? "SYNTH AUDIO: ON" : "AUDIO: MUTE"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-6">
        
        {/* UNIVERSAL VEHICLE SEARCH & GROQ SYNTHESIS COMMAND BAR */}
        <section className="nbo-glass-card-active rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-bold block">
                UNIVERSAL CHASSIS DISCOVERY // POWERED BY GROQ LPU + WIKIMEDIA COMMONS
              </span>
              <h2 className="text-lg md:text-xl font-bold text-white">
                Search Any Car Worldwide to Generate Its Visual Blueprint &amp; Stage 1–3 Spec
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              KEBS Import Window: <strong className="text-white">2019 – 2026</strong>
            </span>
          </div>

          <form onSubmit={handleUniversalSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter any car make & model (e.g., 2021 Subaru WRX STI, 2022 AMG G63, 2020 Golf R)..."
              className="flex-1 bg-black/90 border border-slate-700 focus:border-emerald-400 outline-none px-4 py-3 text-white font-mono text-sm rounded-lg"
            />
            <button
              type="submit"
              disabled={isDiscovering}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all shrink-0"
            >
              {isDiscovering ? "Synthesizing Blueprint..." : "Search & Load Vehicle"}
            </button>
          </form>

          {/* Instant Trending Searches */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-mono uppercase text-slate-400">Quick Search:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setSearchQuery(term);
                  discoverAndSynthesizeVehicle(term, 2021, stage);
                }}
                className="px-2.5 py-1 text-[11px] font-mono bg-black/70 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/50 rounded-md transition-all"
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        {/* Active Vehicle Command Header */}
        <header className="nbo-glass-card rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-semibold">
                ACTIVE TELEMETRY SUBJECT // {year} MODEL YEAR • {cc} CC
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {activeProfile.model}{" "}
              <span className="text-emerald-400 font-mono text-xl">[{activeProfile.engineCode}]</span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              FUEL CALIBRATION:
            </span>
            <div className="flex bg-black/70 p-1 rounded-lg border border-slate-800">
              {(
                [
                  { id: "95_RON", label: "95 RON PUMP" },
                  { id: "95_WMI", label: "95 + WMI METH" },
                  { id: "E30_BLEND", label: "E30 ETHANOL" },
                ] as { id: FuelProfile; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFuel(f.id);
                    triggerAnimatedDynoPull(activeProfile.cylinders, stage);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-md transition-all ${
                    fuel === f.id
                      ? "bg-emerald-500 text-black font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Reference Showroom Deck */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {catalog.map((item) => {
            const isSelected = item.model === activeProfile.model;
            return (
              <button
                key={item.model}
                type="button"
                onClick={() => selectVisualPreset(item)}
                className={`group text-left rounded-xl overflow-hidden transition-all duration-200 ${
                  isSelected ? "nbo-glass-card-active scale-[1.01]" : "nbo-glass-card hover:border-slate-600"
                }`}
              >
                <div className="relative h-24 w-full overflow-hidden bg-black">
                  <img
                    src={item.imageUrl}
                    alt={item.model}
                    loading="eager"
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, #070B14 5%, transparent 65%)" }}
                  />
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded tabular-nums">
                    {item.cc} CC
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-white truncate">{item.label}</p>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold tabular-nums">
                      {item.baseWhp} HP
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{item.engineCode}</p>
                </div>
              </button>
            );
          })}
        </section>

        {/* Main 12-Column Modification & Telemetry Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left 6 Columns: Dynamic Visual Vehicle Blueprint & Stage Hotspots */}
          <div className="lg:col-span-6 space-y-6">
            <div className="nbo-glass-card rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-black/60 border-b border-slate-800/80 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                    Visual Modification Blueprint (Click S1–S3 Nodes)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setXRayMode(!xRayMode)}
                  className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded border transition-all ${
                    xRayMode
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                >
                  {xRayMode ? "X-RAY SCHEMATIC: ON" : "OPTICAL SHOWROOM"}
                </button>
              </div>

              <div className="relative h-80 w-full bg-black overflow-hidden select-none">
                {activeProfile.imageUrl && !imageError ? (
                  <img
                    src={activeProfile.imageUrl}
                    alt={activeProfile.model}
                    onError={() => setImageError(true)}
                    className={`h-full w-full object-cover object-center transition-all duration-500 ${
                      xRayMode
                        ? "opacity-70 contrast-125 brightness-95 saturate-75"
                        : "opacity-95 contrast-105"
                    }`}
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 text-emerald-400 font-mono text-xs p-6 text-center">
                    <span>SYNTHESIZED CHASSIS CAD WIREFRAME: {activeProfile.model}</span>
                  </div>
                )}

                {xRayMode && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#22D3EE" strokeOpacity="0.15" strokeWidth="0.2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#22D3EE" strokeOpacity="0.15" strokeWidth="0.2" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#22D3EE" strokeOpacity="0.15" strokeWidth="0.2" />
                    <polyline
                      points={`${activeProfile.hotspots[1].xPercent},${activeProfile.hotspots[1].yPercent} ${activeProfile.hotspots[2].xPercent},${activeProfile.hotspots[2].yPercent} ${activeProfile.hotspots[0].xPercent},${activeProfile.hotspots[0].yPercent}`}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="0.85"
                      strokeDasharray="2 1.2"
                    />
                  </svg>
                )}

                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(3,5,9,0.96) 8%, rgba(3,5,9,0.18) 55%, rgba(3,5,9,0.7) 100%)",
                  }}
                />

                {/* Interactive Stage Hotspots */}
                {activeProfile.hotspots.map((node) => {
                  const isNodeActive = node.stage === stage;
                  return (
                    <button
                      key={node.stage}
                      type="button"
                      onClick={() => selectHardwareNode(node)}
                      style={{ left: `${node.xPercent}%`, top: `${node.yPercent}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                    >
                      {isNodeActive && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                      )}
                      <span
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full font-mono text-xs font-extrabold border-2 transition-all ${
                          isNodeActive
                            ? "bg-emerald-500 text-black border-white scale-110 shadow-[0_0_25px_#10B981]"
                            : "bg-black/90 text-white border-emerald-500/60 hover:border-white"
                        }`}
                      >
                        S{node.stage}
                      </span>
                    </button>
                  );
                })}

                <div className="absolute bottom-3 left-3 right-3 bg-black/90 border border-slate-700/80 backdrop-blur-md p-3.5 rounded-lg">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-emerald-400 font-bold uppercase">
                      STAGE {activeHotspot.stage} // {activeHotspot.subsystem}
                    </span>
                    <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded text-[10px] tabular-nums">
                      IAT: {inspectedPoint.iatCelsius}°C
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-1 truncate">
                    {activeHotspot.hardwareSpec}
                  </p>
                </div>
              </div>
            </div>

            {/* Stage & Parameter Control Deck */}
            <div className="nbo-glass-card rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Import Manufacture Year (2019–2026)
                  </label>
                  <input
                    type="number"
                    min="2019"
                    max="2026"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-black/80 border border-slate-700 focus:border-emerald-400 outline-none px-3 py-2 text-white font-mono text-xs rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                    Groq Synthesized Displacement (CC)
                  </label>
                  <input
                    type="number"
                    min="800"
                    value={cc}
                    onChange={(e) => setCc(Number(e.target.value))}
                    className="w-full bg-black/80 border border-slate-700 focus:border-emerald-400 outline-none px-3 py-2 text-white font-mono text-xs rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {activeProfile.hotspots.map((h) => {
                  const active = stage === h.stage;
                  return (
                    <button
                      key={h.stage}
                      type="button"
                      onClick={() => selectHardwareNode(h)}
                      className={`py-2.5 px-3 rounded-lg font-mono text-xs transition-all border ${
                        active
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "border-slate-800 bg-black/60 text-slate-400 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      STAGE {h.stage}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => discoverAndSynthesizeVehicle(activeProfile.model, year, stage)}
                  disabled={isDiscovering}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold font-mono text-xs py-3.5 rounded-lg uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all"
                >
                  {isDiscovering ? "Synthesizing Groq Telemetry..." : "Run Groq Modification & KRA Valuation"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerAnimatedDynoPull(activeProfile.cylinders, stage)}
                  className="px-4 bg-black/80 hover:bg-slate-900 text-emerald-400 border border-emerald-500/50 font-mono text-xs font-bold rounded-lg uppercase"
                >
                  Replay Pull
                </button>
              </div>
            </div>
          </div>

          {/* Right 6 Columns: Radial Dials, Vector Dyno, KRA Waterfall & Live Groq Stream */}
          <div className="lg:col-span-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="nbo-glass-card rounded-xl p-4 flex items-center gap-3.5">
                <svg className="w-20 h-20 -rotate-90 shrink-0" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" stroke="#1E293B" strokeWidth="7" fill="none" />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    stroke="#10B981"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="226.2"
                    strokeDashoffset={226.2 * (1 - rpmRatio)}
                  />
                </svg>
                <div className="font-mono">
                  <span className="text-[10px] text-slate-400 uppercase block">TACHOMETER</span>
                  <span className="text-xl font-extrabold text-white tabular-nums">{inspectedPoint.rpm}</span>
                  <span className="text-[10px] text-emerald-400 block">{activeProfile.cylinders}-CYLINDER</span>
                </div>
              </div>

              <div className="nbo-glass-card rounded-xl p-4 flex items-center gap-3.5">
                <svg className="w-20 h-20 -rotate-90 shrink-0" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" stroke="#1E293B" strokeWidth="7" fill="none" />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    stroke="#22D3EE"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="226.2"
                    strokeDashoffset={226.2 * (1 - boostRatio)}
                  />
                </svg>
                <div className="font-mono">
                  <span className="text-[10px] text-slate-400 uppercase block">MANIFOLD BOOST</span>
                  <span className="text-xl font-extrabold text-cyan-400 tabular-nums">
                    {inspectedPoint.boostPsi} <span className="text-xs">PSI</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block tabular-nums">
                    IAT: {inspectedPoint.iatCelsius}°C
                  </span>
                </div>
              </div>

              <div className="nbo-glass-card-active rounded-xl p-4 flex flex-col justify-center font-mono">
                <span className="text-[10px] text-emerald-300 uppercase tracking-wider">1,795M ASL NET PEAK</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-extrabold text-white tabular-nums">{peakPoint.nboWhp}</span>
                  <span className="text-xs text-emerald-400 font-bold">WHP</span>
                </div>
                <span className="text-[11px] text-slate-300 tabular-nums mt-1">
                  KES {Math.round(financialBreakdown.kesPerWhp).toLocaleString()} / WHP
                </span>
              </div>
            </div>

            {/* Vector Dyno Curve */}
            <div className="nbo-glass-card rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800/80 pb-3">
                <span className="text-xs font-mono uppercase text-white font-bold">
                  Altitude Dynamometer // {activeProfile.model}
                </span>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="text-emerald-400 font-bold">● NBO WHP</span>
                  <span className="text-cyan-400 font-bold">● TORQUE (Nm)</span>
                  <span className="text-slate-400">● MBA SEA-LEVEL</span>
                </div>
              </div>

              <div className="relative bg-black/80 border border-slate-800 rounded-lg p-3">
                <svg className="w-full h-44 overflow-visible" viewBox="0 0 560 190">
                  <defs>
                    <linearGradient id="nboEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((ratio, idx) => (
                    <line
                      key={idx}
                      x1="0"
                      y1={190 * ratio}
                      x2="560"
                      y2={190 * ratio}
                      stroke="#1E293B"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  ))}
                  <polygon points={nboAreaPolygon} fill="url(#nboEmeraldGrad)" />
                  <polyline fill="none" stroke="#64748B" strokeWidth="2" points={mbaPolyline} />
                  <polyline fill="none" stroke="#22D3EE" strokeWidth="2.2" strokeDasharray="5 3" points={torquePolyline} />
                  <polyline fill="none" stroke="#10B981" strokeWidth="3.2" points={nboPolyline} />
                  <line x1={cursorX} y1="0" x2={cursorX} y2="190" stroke="#F43F5E" strokeWidth="1.8" />
                </svg>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400 uppercase">SCRUB RPM</span>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={activeSweepIdx}
                  onChange={(e) => {
                    setIsSweepingDyno(false);
                    setActiveSweepIdx(Number(e.target.value));
                  }}
                  className="nbo-scrubber flex-1"
                />
                <span className="text-xs font-mono text-emerald-400 font-bold tabular-nums w-20 text-right">
                  {inspectedPoint.rpm} RPM
                </span>
              </div>
            </div>

            {/* KRA Landed Cost Breakdown */}
            <div className="nbo-glass-card rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center font-mono">
                <span className="text-xs uppercase text-slate-300 font-bold">
                  KRA Landed Cost + Stage {stage} Hardware
                </span>
                <span className="text-sm font-extrabold text-white tabular-nums">
                  TOTAL: KES {(financialBreakdown.totalProjectKes / 1e6).toFixed(2)}M
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="bg-black/60 border border-slate-800/80 p-2.5 rounded-lg">
                  <span className="text-[10px] text-emerald-400 block">DEPRECIATED CIF</span>
                  <span className="text-white font-bold tabular-nums">
                    KES {(financialBreakdown.baseCrspKes / 1e6).toFixed(2)}M
                  </span>
                </div>
                <div className="bg-black/60 border border-slate-800/80 p-2.5 rounded-lg">
                  <span className="text-[10px] text-cyan-400 block">KRA DUTIES + VAT</span>
                  <span className="text-white font-bold tabular-nums">
                    KES {(financialBreakdown.dutiesKes / 1e6).toFixed(2)}M
                  </span>
                </div>
                <div className="bg-black/60 border border-slate-800/80 p-2.5 rounded-lg">
                  <span className="text-[10px] text-amber-400 block">STAGE {stage} PARTS</span>
                  <span className="text-white font-bold tabular-nums">
                    KES {(financialBreakdown.hardwareKes / 1e3).toFixed(0)}K
                  </span>
                </div>
              </div>
            </div>

            {/* Groq LPU Real-Time Modification Directives */}
            <div className="nbo-glass-card rounded-xl overflow-hidden">
              <div className="bg-black/80 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center">
                <span className="text-[10px] uppercase text-emerald-400 font-mono font-bold tracking-wider">
                  GROQ LPU BUILD SHEET // {activeProfile.model} (STAGE {stage})
                </span>
                {(isStreaming || isDiscovering) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <div className="p-4 h-32 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-black/50">
                {advisoryStream ||
                  `[READY] Search any vehicle above or click a Stage node (S1-S3) on the ${activeProfile.model} blueprint to synthesize Groq LPU tuning directives and KRA CRSP valuation...`}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSaveToGarage}
                className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider"
              >
                + Pin Build to Garage ({garage.length}/3)
              </button>
              <a
                href={generateWhatsAppShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/70 py-3 rounded-xl text-xs font-mono font-extrabold uppercase tracking-wider"
              >
                Share Build to WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}