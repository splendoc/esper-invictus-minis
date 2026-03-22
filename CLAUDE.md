# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESPER Invictus is a three-view ER (Emergency Room) management system for the BBT ER soft launch. It consists of three standalone HTML files with embedded CSS and vanilla JavaScript — no build system, no framework, no bundler.

## Architecture

### Two Pages (planned)

1. **Floor (MinisSoftLaunchFLOOR.html)** — The main staff page. Does everything: patient board, status updates (right slide-out panel), patient registration (right slide-out panel, same slot as status update), editing (name/age/title/HN/phone via Edit toggle). Will be split into separate CSS/JS files as it grows.

2. **Public View (MinisSoftLaunchPUBLICVIEW.html)** — TV display for waiting area. Shows waiting and active patients with auto-pagination, GEDWIN crowding score, estimated wait times. Light/dark toggle for different lighting conditions.

3. **MinisSoftLaunchRegis.html** — Legacy standalone registration form. Being replaced by the registration panel inside Floor. Keep for reference but not the active workflow.

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

## Design System

Floor view is the **master design**. All pages must adopt its design language.

### Fonts (3 families, strict usage)

| Font | Usage | Example |
|------|-------|---------|
| **Sarabun** | Thai body text, patient names, section titles (Thai), status text, all Thai content | ชื่อผู้ป่วย, สังเกตอาการ |
| **IBM Plex Mono** | Numbers, HN, clock, data values, count badges, code-like content | HN 123-456-789, 14:30, 45y |
| **Rajdhani** | Labels (uppercase), English headings, buttons, tab text, letter-spaced UI elements | ESI 1, WAITING, Resuscitation |

### Dark Theme Colors (Floor = master)

| Token | Hex | Usage |
|-------|-----|-------|
| Body bg | `#080e17` | Page background |
| Card bg | `#0f1a27` | Patient cards, data containers |
| Panel bg | `#0c1520` | Quick view panels, sections |
| Input bg | `#070e18` | Form inputs |
| Border | `#1a2840` | All borders, dividers — no exceptions |
| Primary text | `#dde6f0` | Patient names, headings |
| Sub text | `#7a9ab8` | Chief complaint, descriptions |
| Muted text | `#6b8ba4` | HN, sex/age, icons, secondary info |
| Dim text | `#4a6a88` | Labels, placeholders, timestamps |
| Detail text | `#5a7a90` | Card meta details (sex/age separator) |
| Accent | `#0ea5e9` | Active states, focus rings, highlights |
| Accent hover | `#7dd3fc` | Hover states on accent elements |

### Light Theme Colors (Public View only)

| Token | Hex | Usage |
|-------|-----|-------|
| Body bg | `#edf2f7` | Page background |
| Card bg | `#f8fafc` | Patient cards |
| Section bg | `#ffffff` | Section containers |
| Border | `#d0dbe8` | All borders |
| Primary text | `#0c2340` | Navy — patient names, headings (not black) |
| Sub text | `#4a6a88` | Secondary info |
| Muted text | `#6b8ba4` | Same as dark — shared neutral |
| Accent | `#0284c7` | Slightly deeper blue for light backgrounds |

### ESI Colors (same in both themes, never darken)

| ESI | Color | Hex |
|-----|-------|-----|
| 1 | Red | `#ef4444` |
| 2 | Pink | `#ec4899` |
| 3 | Yellow | `#eab308` |
| 4 | Green | `#22c55e` |
| 5 | Blue | `#3b82f6` |

### Logo

Amber/gold medical cross with 4 orbital dots. Uses gold gradient (`#FCD34D` → `#B45309`). Same SVG across all pages — only size changes (34px Floor, 50px Public View).

### Brand Text

"ESPER INVICTUS" — Rajdhani 700, gradient (`#38bdf8` → `#0ea5e9` → `#0d9488`). Subtitle uses IBM Plex Mono with `.16em` letter-spacing.

### Design Decisions

- **Registration** will be a right slide-out panel inside Floor (same slot as status update), not a separate page
- **Public View** keeps light/dark toggle (for TV lighting conditions), dark is default
- **Patient cards on Public View** are always neutral color — no green/red tint on individual cards (confuses patients)
- **Date format**: Thai with Buddhist Era, full weekday and month (วันจันทร์ที่ 23 มีนาคม 2569)
- **Clock**: IBM Plex Mono for time digits, Sarabun for Thai date text
- **QV edit rows** (name, age, title, HN, phone) are hidden by default, revealed via Edit toggle button

## Tech Stack

- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`), dark mode via `class` strategy
- **Font Awesome** 6.x via CDN
- **Google Fonts:** Sarabun (Thai body text), IBM Plex Mono (data/monospace), Rajdhani (labels/numbers)
- **Vanilla JavaScript** — no frameworks, no npm, no modules

## Development

Open any HTML file directly in a browser. No build step, no server required. Use a local HTTP server (e.g., `python -m http.server` or VS Code Live Server) if you need cross-file navigation to work properly.

## Language

The UI is primarily in **Thai**. Status labels, patient names, and UI text are in Thai. Code comments and variable names are in English.
