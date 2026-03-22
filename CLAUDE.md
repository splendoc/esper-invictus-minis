# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPER Invictus is a three-view ER (Emergency Room) management system for the BBT ER soft launch. It consists of three standalone HTML files with embedded CSS and vanilla JavaScript — no build system, no framework, no bundler.

## Architecture

### Three Standalone Views (no shared state)

1. **MinisSoftLaunchFLOOR.html** — Staff floor view for tracking patients through the ER workflow. Has a hardcoded seed `patients` array (~13 patients). Features: patient cards, status transitions, quick-view panel for editing vitals/status/HN/phone, ESI and status filtering, situation dashboard with ESI counts.

2. **MinisSoftLaunchRegis.html** — Patient registration form. Collects HN, name, age, gender, chief complaint, ESI, and fast-track selection (Trauma/ACS/Stroke/Sepsis). Generates HN via localStorage counter. Currently logs to console only — no persistent save.

3. **MinisSoftLaunchPUBLICVIEW.html** — Public-facing ER status display. Auto-generates mock patients, paginates them in a carousel, calculates GEDWIN crowding score, and simulates patient flow (waiting → active → discharged) on a 10-second loop.

### Data Flow

- **No backend.** All patient data is in-memory JavaScript arrays/objects. Data resets on refresh.
- **No inter-view communication.** Each file maintains its own isolated dataset. The FLOOR view has a link to open the PUBLIC view in a new window, but no data passes between them.
- **localStorage** is used only for dark mode preference and HN generation counter.

### Patient Lifecycle (FLOOR view)

```
Waiting → Active → Disposition → Finalized
              ↘ (direct finalize for Admit/Discharge/Refer/etc.)
Waiting → Finalized (if status = 'เรียกไม่พบ' / patient not found)
```

Key status config is in the `SC` object which maps status strings to `{tab, icon, pill}`.

### Key Domain Concepts

- **ESI 1-5:** Emergency Severity Index (1=Resuscitation, 5=Non-Urgent). Drives triage color coding, wait time benchmarks, and breach timers.
- **GEDWIN Score** (PUBLIC view): ER crowding metric calculated from occupancy ratio and acuity ratio. Maps to 5 levels: Normal → Medium → Crowded → Very Crowded → Critical.
- **Breach timers** (FLOOR view): ESI 1-2 have shorter thresholds; ESI 3-5 use amber (warning) and red (overdue) time limits.
- **Vital signs:** bt, sbp/dbp, hr, rr, spo2, O2 source (RA/CNN/MCB/ETT), lpm, dtx.

## Tech Stack

- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`), dark mode via `class` strategy
- **Font Awesome** 6.x via CDN
- **Google Fonts:** Sarabun (Thai body text), IBM Plex Mono (data/monospace), Rajdhani (labels/numbers)
- **Vanilla JavaScript** — no frameworks, no npm, no modules

## Development

Open any HTML file directly in a browser. No build step, no server required. Use a local HTTP server (e.g., `python -m http.server` or VS Code Live Server) if you need cross-file navigation to work properly.

## Language

The UI is primarily in **Thai**. Status labels, patient names, and UI text are in Thai. Code comments and variable names are in English.
