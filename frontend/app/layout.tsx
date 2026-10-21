import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBO 1795 | Nairobi Altitude Dyno & KRA Valuation Telemetry",
  description:
    "1,795m ASL thermodynamic horsepower derating, live MoTeC dyno simulation, and 2026 KRA CRSP landed cost engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="dark"
      style={{ backgroundColor: "#030509", color: "#E2E8F0", colorScheme: "dark" }}
    >
      <head>
        {/* Anna OS Tool ID map — injected by @anna-ai/cli at packaging time (window.__ANNA_TOOL_IDS__) */}
        <script src="./anna-tool-ids.js" defer />

        {/* Motorsport Typography: Space Grotesk (Headers) & JetBrains Mono (Telemetry Numerals) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
          rel="stylesheet"
        />

        {/* Deterministic Tailwind JIT Engine — Eliminates PostCSS/Config File Bloat */}
        <script src="https://cdn.tailwindcss.com" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                darkMode: 'class',
                theme: {
                  extend: {
                    fontFamily: {
                      sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
                      mono: ['JetBrains Mono', 'monospace'],
                    },
                    colors: {
                      obsidian: '#030509',
                      carbon: '#080C14',
                      panel: '#0C121E',
                      emerald: {
                        400: '#34D399',
                        500: '#10B981',
                      }
                    }
                  }
                }
              };
            `,
          }}
        />

        {/* Hardened Obsidian Carbon & Neon Telemetry Shader Sheet */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *, *::before, *::after {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                background-color: #030509 !important;
                color: #E2E8F0 !important;
                font-family: 'Space Grotesk', system-ui, sans-serif;
                overflow-x: hidden;
                -webkit-font-smoothing: antialiased;
              }
              /* Micro Carbon-Fiber & Telemetry Blueprint Grid Background */
              .nbo-atmosphere {
                background-color: #030509;
                background-image:
                  radial-gradient(circle at 15% 15%, rgba(16, 185, 129, 0.11) 0%, transparent 40%),
                  radial-gradient(circle at 85% 25%, rgba(6, 182, 212, 0.09) 0%, transparent 42%),
                  linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px);
                background-size: 100% 100%, 100% 100%, 28px 28px, 28px 28px;
              }
              /* Glassmorphic Telemetry Cards with Top Specular Highlight */
              .nbo-glass-card {
                background: linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(7, 11, 20, 0.94) 100%);
                border: 1px solid rgba(51, 65, 85, 0.65);
                box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.85), inset 0 1px 0 0 rgba(255, 255, 255, 0.07);
                backdrop-filter: blur(16px);
              }
              .nbo-glass-card-active {
                background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(7, 11, 20, 0.96) 100%);
                border: 1px solid rgba(16, 185, 129, 0.65);
                box-shadow: 0 0 30px -5px rgba(16, 185, 129, 0.25), inset 0 1px 0 0 rgba(16, 185, 129, 0.3);
              }
              /* Custom Range Scrubber */
              input[type=range].nbo-scrubber {
                -webkit-appearance: none;
                appearance: none;
                background: rgba(15, 23, 42, 0.9);
                height: 6px;
                border-radius: 999px;
                border: 1px solid rgba(51, 65, 85, 0.8);
              }
              input[type=range].nbo-scrubber::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #10B981;
                cursor: pointer;
                border: 2px solid #FFFFFF;
                box-shadow: 0 0 12px #10B981;
              }
              /* Custom Scrollbar for Groq Terminal */
              ::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              ::-webkit-scrollbar-track {
                background: #050811;
              }
              ::-webkit-scrollbar-thumb {
                background: #1E293B;
                border-radius: 3px;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: #10B981;
              }
            `,
          }}
        />
      </head>
      <body className="nbo-atmosphere min-h-screen text-slate-200 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}