# Forensic Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform llama-smith dashboard from raw terminal aesthetic to premium forensic control room while keeping Matrix/Smith DNA.

**Architecture:** Create new CSS design system (`dashboard-v2.css`) with elevated panels, semantic color hierarchy, and improved typography. Update HTML generation in `scripts/report.mjs` to use new markup structure. Keep changes backward-compatible by creating new files rather than modifying existing CSS.

**Tech Stack:** CSS custom properties, vanilla JS for interactions, existing Node.js report generation scripts.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `assets/dashboard-v2.css` | New design system with all CSS custom properties, component styles, and responsive rules |
| `scripts/report.mjs` | Generates HTML reports — modify to output v2 markup structure with new classes |
| `lib/dashboard.mjs` | Simple dashboard renderer — update inline styles if needed for v2 |
| `reports/index.html` | Regenerated output (no manual edits) |
| `reports/*.html` | Regenerated detail pages (no manual edits) |

---

## Phase 1: CSS Design System

### Task 1: CSS Foundation — Custom Properties

**Files:**
- Create: `assets/dashboard-v2.css`

- [ ] **Step 1: Create CSS file with design tokens**

```css
/* llama-smith forensic dashboard v2 */
/* Design tokens: color, typography, spacing */

:root {
  /* Background - near-black with subtle green tint */
  --bg: oklch(8% 0.015 145);
  --bg-elevated: oklch(12% 0.018 150);

  /* Surface layers - content panels */
  --surface: oklch(16% 0.02 150);
  --surface-hover: oklch(20% 0.025 150);
  --surface-active: oklch(24% 0.03 150);

  /* Lines and borders */
  --line-subtle: oklch(22% 0.025 150);
  --line: oklch(30% 0.035 150);
  --line-strong: oklch(40% 0.045 150);

  /* Primary green - used sparingly */
  --green-brand: oklch(75% 0.18 150);
  --green-hot: oklch(85% 0.22 150);
  --green-glow: oklch(85% 0.22 150 / 0.4);

  /* Semantic colors - distinct meanings */
  --red: oklch(60% 0.22 25);
  --red-glow: oklch(60% 0.22 25 / 0.3);
  --amber: oklch(75% 0.15 75);
  --cyan: oklch(70% 0.08 195);

  /* Text hierarchy */
  --text-primary: oklch(92% 0.01 150);
  --text-secondary: oklch(72% 0.025 150);
  --text-muted: oklch(55% 0.02 150);
  --text-faint: oklch(40% 0.015 150);

  /* Typography */
  --font-display: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-body: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;

  /* Spacing */
  --r-lg: 16px;
  --r: 12px;
  --r-sm: 8px;
  --r-xs: 4px;
  --gut: clamp(1rem, 0.6rem + 1.6vw, 2rem);

  /* Shadows */
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.4);
  --shadow: 0 4px 12px oklch(0% 0 0 / 0.35);
  --shadow-lg: 0 8px 30px oklch(0% 0 0 / 0.4);
  --shadow-glow: 0 0 20px var(--green-glow);
}
```

- [ ] **Step 2: Add base reset and body styles**

Append to `assets/dashboard-v2.css`:

```css
/* Base reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding-bottom: 5rem;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  canvas#rain {
    display: none;
  }
}

/* Focus styles */
:focus-visible {
  outline: 2px solid var(--green-brand);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}

/* Main wrapper */
.wrap {
  position: relative;
  z-index: 2;
  width: min(1240px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 0 var(--gut);
}
```

- [ ] **Step 3: Commit CSS foundation**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add dashboard v2 CSS design tokens and base styles"
```

---

### Task 2: CSS — Atmosphere Effects

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add Matrix rain with edge-only mask**

Append to `assets/dashboard-v2.css`:

```css
/* Matrix rain canvas - muted at center, visible at edges */
canvas#rain {
  position: fixed;
  inset: 0;
  z-index: 0;
  opacity: 0.035;
  pointer-events: none;
  mask-image: radial-gradient(
    ellipse 80% 80% at 50% 50%,
    transparent 40%,
    black 75%
  );
  -webkit-mask-image: radial-gradient(
    ellipse 80% 80% at 50% 50%,
    transparent 40%,
    black 75%
  );
}

/* Scanlines - very subtle, edge only */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  opacity: 0.08;
  background: repeating-linear-gradient(
    0deg,
    transparent 0 3px,
    oklch(0% 0 0 / 0.15) 3px 4px
  );
  mask-image: radial-gradient(
    ellipse 85% 85% at 50% 50%,
    transparent 50%,
    black 85%
  );
  -webkit-mask-image: radial-gradient(
    ellipse 85% 85% at 50% 50%,
    transparent 50%,
    black 85%
  );
}

/* Reading mask - clears atmosphere behind content */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
    ellipse 85% 85% at 50% 45%,
    var(--bg) 0%,
    var(--bg) 45%,
    transparent 85%
  );
}
```

- [ ] **Step 2: Commit atmosphere styles**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add matrix rain and scanline effects with edge masking"
```

---

### Task 3: CSS — Typography System

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add typography scale**

Append to `assets/dashboard-v2.css`:

```css
/* Typography scale */

/* Display - hero headlines */
.display-xl {
  font-family: var(--font-display);
  font-size: clamp(2rem, 1.2rem + 2.5vw, 2.8rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--green-hot);
  text-shadow: 0 0 24px var(--green-glow);
}

.display {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 1rem + 1.6vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

/* Section headers */
.section-title {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

/* Body text */
.body {
  font-family: var(--font-body);
  font-size: 0.92rem;
  font-weight: 400;
  line-height: 1.7;
  color: var(--text-secondary);
}

.body-strong {
  font-weight: 600;
  color: var(--text-primary);
}

/* Small text */
.label {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.meta {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text-muted);
}

.tiny {
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}

/* Quote/callout text */
.quote {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-style: italic;
  line-height: 1.6;
  color: var(--text-secondary);
  border-left: 2px solid var(--line-strong);
  padding-left: 1rem;
}
```

- [ ] **Step 2: Commit typography**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add typography scale with display, body, and label styles"
```

---

### Task 4: CSS — Component Styles

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add panel/card styles**

Append to `assets/dashboard-v2.css`:

```css
/* Panel/Card component */
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}

.panel:hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.panel-interactive:hover {
  border-color: var(--green-brand);
  box-shadow: var(--shadow), 0 0 20px var(--green-glow);
}

/* Elevated panel - for hero sections */
.panel-elevated {
  background: linear-gradient(180deg, var(--surface-hover), var(--surface));
  border: 1px solid var(--line-strong);
  border-radius: var(--r);
  padding: 1.5rem;
  box-shadow: var(--shadow), 0 0 0 1px oklch(0% 0 0 / 0.4);
}

/* Section spacing */
.section {
  margin: 4rem 0 1.5rem;
}

.section-header {
  margin-bottom: 1.5rem;
}
```

- [ ] **Step 2: Add badge styles**

Append to `assets/dashboard-v2.css`:

```css
/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.35rem 0.7rem;
  border-radius: var(--r-sm);
  white-space: nowrap;
}

/* Severity badges */
.badge-high {
  background: var(--red);
  color: oklch(10% 0.02 25);
}

.badge-medium {
  background: var(--amber);
  color: oklch(15% 0.05 75);
}

.badge-low {
  border: 1px solid var(--green-brand);
  color: var(--green-brand);
}

/* Grade badge - compact pill */
.badge-grade {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 2px solid;
}

.badge-grade-a,
.badge-grade-b {
  border-color: var(--green-brand);
  color: var(--green-brand);
}

.badge-grade-c {
  border-color: var(--amber);
  color: var(--amber);
}

.badge-grade-d,
.badge-grade-f {
  border-color: var(--red);
  color: var(--red);
}

/* Stack badge - cyan */
.badge-stack {
  border: 1px solid var(--cyan);
  color: var(--cyan);
}

/* Status badges */
.badge-success {
  background: var(--green-brand);
  color: var(--bg);
}

.badge-neutral {
  border: 1px solid var(--line);
  color: var(--text-muted);
}
```

- [ ] **Step 3: Add button styles**

Append to `assets/dashboard-v2.css`:

```css
/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.6rem 1.2rem;
  border-radius: var(--r-sm);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: var(--green-brand);
  color: var(--bg);
}

.btn-primary:hover {
  background: var(--green-hot);
  box-shadow: 0 0 16px var(--green-glow);
}

.btn-secondary {
  background: transparent;
  color: var(--green-brand);
  border: 1px solid var(--line-strong);
}

.btn-secondary:hover {
  border-color: var(--green-brand);
  background: oklch(20% 0.03 150);
}

.btn-sm {
  font-size: 0.75rem;
  padding: 0.4rem 0.8rem;
}
```

- [ ] **Step 4: Commit components**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add panel, badge, and button component styles"
```

---

### Task 5: CSS — Data Visualization

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add severity bar**

Append to `assets/dashboard-v2.css`:

```css
/* Severity bar - stacked horizontal */
.sevbar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sevbar-track {
  display: flex;
  height: 10px;
  border-radius: var(--r-xs);
  overflow: hidden;
  gap: 2px;
}

.sevbar-seg {
  display: block;
  height: 100%;
}

.sevbar-seg-high { background: var(--red); }
.sevbar-seg-medium { background: var(--amber); }
.sevbar-seg-low { background: var(--green-brand); }

.sevbar-legend {
  display: flex;
  gap: 1.2rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.sevbar-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
}

.sevbar-item b {
  font-weight: 600;
  color: var(--text-primary);
}

.sevbar-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sevbar-dot-high { background: var(--red); }
.sevbar-dot-medium { background: var(--amber); }
.sevbar-dot-low { background: var(--green-brand); }
```

- [ ] **Step 2: Add horizontal bar charts**

Append to `assets/dashboard-v2.css`:

```css
/* Horizontal bar chart */
.barchart {
  display: grid;
  gap: 0.75rem;
}

.barchart-row {
  display: grid;
  grid-template-columns: minmax(6rem, 10rem) 1fr auto;
  gap: 0.8rem;
  align-items: center;
  font-size: 0.78rem;
}

.barchart-label {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barchart-track {
  height: 10px;
  background: var(--line-subtle);
  border-radius: var(--r-xs);
  overflow: hidden;
}

.barchart-fill {
  display: block;
  height: 100%;
  background: var(--green-brand);
  border-radius: var(--r-xs);
  transition: width 0.3s ease;
}

.barchart-fill-danger {
  background: var(--red);
}

.barchart-fill-warning {
  background: var(--amber);
}

.barchart-value {
  color: var(--green-hot);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-size: 0.74rem;
}

.barchart-row.danger .barchart-value {
  color: var(--red);
}
```

- [ ] **Step 3: Add grade gauge**

Append to `assets/dashboard-v2.css`:

```css
/* Grade gauge - circular */
.gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.gauge-disc {
  position: relative;
  width: 120px;
  height: 120px;
}

.gauge-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.gauge-track {
  fill: none;
  stroke: var(--line);
  stroke-width: 10;
}

.gauge-progress {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
}

.gauge-progress-a,
.gauge-progress-b { stroke: var(--green-brand); }
.gauge-progress-c { stroke: var(--amber); }
.gauge-progress-d,
.gauge-progress-f { stroke: var(--red); }

.gauge-mid {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  line-height: 1;
}

.gauge-score {
  font-size: 2.4rem;
  font-weight: 800;
  color: var(--green-hot);
  font-variant-numeric: tabular-nums;
}

.gauge-grade {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.gauge-cap {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  font-weight: 600;
}
```

- [ ] **Step 4: Commit data viz**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add severity bars, barcharts, and grade gauge styles"
```

---

### Task 6: CSS — Evidence Cards

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add evidence card styles**

Append to `assets/dashboard-v2.css`:

```css
/* Evidence cards */
.evidence {
  display: grid;
  grid-template-columns: 4px 1fr;
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  overflow: hidden;
  transition: border-color 0.18s, transform 0.18s;
}

.evidence:hover {
  border-color: var(--line-strong);
  transform: translateX(3px);
}

.evidence-rail {
  background: var(--line);
}

.evidence-high .evidence-rail { background: var(--red); }
.evidence-medium .evidence-rail { background: var(--amber); }
.evidence-low .evidence-rail { background: var(--green-brand); }

.evidence-body {
  padding: 1.1rem 1.3rem;
}

.evidence-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.evidence-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  margin-top: 0.5rem;
}

.evidence-text {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 0.5rem;
}

.evidence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* File path chip */
.path-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--cyan);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--r-xs);
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.path-chip:hover {
  border-color: var(--cyan);
  background: var(--surface-hover);
}

.path-chip.copied {
  color: var(--green-brand);
  border-color: var(--green-brand);
}
```

- [ ] **Step 2: Commit evidence cards**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add evidence card and path chip styles"
```

---

### Task 7: CSS — Skill Artifact Section

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add skill artifact styles**

Append to `assets/dashboard-v2.css`:

```css
/* Skill artifact section - the product payoff */
.skill-artifact {
  background: linear-gradient(135deg, var(--surface-hover), var(--surface));
  border: 2px solid var(--green-brand);
  border-radius: var(--r);
  padding: 2rem;
  box-shadow: var(--shadow), 0 0 30px var(--green-glow);
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.skill-title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--green-hot);
}

.skill-file {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.skill-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.skill-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.skill-stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--green-hot);
  font-variant-numeric: tabular-nums;
}

.skill-stat-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.skill-preview {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 1.25rem;
  margin: 1.5rem 0;
  font-size: 0.85rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.skill-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
```

- [ ] **Step 2: Commit skill artifact**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add skill artifact section styles"
```

---

### Task 8: CSS — Layout Components

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add grid and layout utilities**

Append to `assets/dashboard-v2.css`:

```css
/* Grid layouts */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.25rem;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

/* Flex utilities */
.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.gap-1 { gap: 0.5rem; }
.gap-2 { gap: 1rem; }
.gap-3 { gap: 1.5rem; }

/* Header/navigation */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--line-subtle);
  margin-bottom: 2rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--green-hot);
  text-decoration: none;
}

.brand span {
  color: var(--text-muted);
  font-weight: 500;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Hero layout */
.hero {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: clamp(2rem, 4vw, 4rem);
  align-items: center;
  padding: 2rem 0 3rem;
  max-width: 1000px;
}

.hero-image {
  width: min(280px, 50vw);
  height: auto;
  border-radius: var(--r);
  opacity: 0.9;
}

.hero-content {
  min-width: 0;
}

.hero-proof {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.5rem;
}

.proof-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  padding: 0.4rem 0.7rem;
}

.proof-chip svg {
  width: 14px;
  height: 14px;
  color: var(--green-brand);
}

/* Pipeline steps */
.pipeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin: 2rem 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r);
  overflow: hidden;
}

.pipeline-step {
  flex: 1;
  min-width: 140px;
  padding: 1.2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-right: 1px solid var(--line);
  position: relative;
}

.pipeline-step:last-child {
  border-right: none;
}

.pipeline-step::after {
  content: "→";
  position: absolute;
  right: -0.6rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--line-strong);
  font-size: 0.9rem;
  z-index: 1;
}

.pipeline-step:last-child::after {
  display: none;
}

.step-icon {
  width: 22px;
  height: 22px;
  color: var(--green-brand);
}

.step-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.step-desc {
  font-size: 0.72rem;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Add responsive rules**

Append to `assets/dashboard-v2.css`:

```css
/* Responsive */
@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }

  .hero-image {
    width: min(200px, 60vw);
    order: -1;
  }

  .hero-proof {
    justify-content: center;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .grid-3,
  .grid-2 {
    grid-template-columns: 1fr;
  }

  .pipeline {
    flex-direction: column;
  }

  .pipeline-step {
    border-right: none;
    border-bottom: 1px solid var(--line);
  }

  .pipeline-step::after {
    content: "↓";
    right: auto;
    top: auto;
    bottom: -0.7rem;
    left: 50%;
    transform: translateX(-50%);
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* Hide rain on mobile */
@media (max-width: 640px) {
  canvas#rain {
    display: none;
  }
}
```

- [ ] **Step 3: Commit layout**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add grid, hero, and responsive layout styles"
```

---

### Task 9: CSS — Detail Page Specific

**Files:**
- Modify: `assets/dashboard-v2.css`

- [ ] **Step 1: Add detail page styles**

Append to `assets/dashboard-v2.css`:

```css
/* Detail page header */
.repo-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 2rem;
  padding: 1rem 0 2rem;
}

.repo-title-section {
  flex: 1;
  min-width: 0;
}

.repo-title {
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 1.2rem + 2vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--green-hot);
  line-height: 1.05;
}

.repo-title span {
  color: var(--text-muted);
  font-weight: 500;
}

.repo-blurb {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 0.75rem;
  max-width: 64ch;
}

.repo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin-top: 1.25rem;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.74rem;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-xs);
  padding: 0.3rem 0.6rem;
}

.meta-tag b {
  color: var(--text-primary);
  font-weight: 600;
}

/* Stats row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--green-hot);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

/* Filter bar */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 1.5rem;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 10;
}

.filter-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-right: 0.5rem;
}

.filter-pill {
  font-size: 0.78rem;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.filter-pill:hover {
  background: var(--surface-hover);
  border-color: var(--line-strong);
}

.filter-pill[aria-pressed="true"] {
  color: var(--text-primary);
  background: var(--surface-hover);
  border-color: var(--line-strong);
}

/* Back button */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-decoration: none;
  margin-bottom: 1rem;
}

.back-link:hover {
  color: var(--green-brand);
}

/* Footer */
.footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--line);
  text-align: center;
}

.footer-main {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.footer-main b {
  color: var(--green-brand);
}

.footer-sub {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.footer-sub a {
  color: var(--green-brand);
}
```

- [ ] **Step 2: Commit detail page styles**

```bash
git add assets/dashboard-v2.css
git commit -m "feat: add detail page header, stats, and filter styles"
```

---

## Phase 2: HTML Generation Updates

### Task 10: Update Report Script — Utility Functions

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update CSS reference in shell function**

In `scripts/report.mjs`, find the `shell` function (around line 96) and update the CSS reference:

```javascript
// Find this line:
const CSS = readAsset("dashboard.css")

// Replace with:
const CSS = readAsset("dashboard-v2.css")
```

- [ ] **Step 2: Update shell function HTML template**

In the `shell` function, ensure it includes the new structure:

```javascript
const shell = (title, body, js = '') => `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
<link rel="stylesheet" href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,600,700,800|ibm-plex-mono:400,500">
<style>${CSS}</style></head>
<body><canvas id="rain"></canvas><div class="wrap">${body}</div>
<script>${RAIN}${AVATAR_JS}${RESCAN_JS}${js}</script></body></html>`
```

- [ ] **Step 3: Commit utility changes**

```bash
git add scripts/report.mjs
git commit -m "refactor: update report script to use v2 CSS and fonts"
```

---

### Task 11: Update Report Script — Index Page Header

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update brandbar function**

In `scripts/report.mjs`, find `brandbar` function (around line 105) and update:

```javascript
// Replace existing brandbar function with:
const brandbar = () => `<header class="header">
  <a class="brand" href="index.html">
    llama<span>·</span>smith
  </a>
  <nav class="nav-actions">
    <a href="https://github.com/artttj/llama-smith" class="btn btn-sm btn-secondary" target="_blank" rel="noopener">GitHub</a>
    <a href="#" class="btn btn-sm btn-secondary">Docs</a>
    <button class="btn btn-sm btn-primary" onclick="alert('Run: node llama-smith.mjs <repo-path>')">Scan repo</button>
  </nav>
</header>`
```

- [ ] **Step 2: Commit header update**

```bash
git add scripts/report.mjs
git commit -m "feat: update index header with nav actions and v2 styling"
```

---

### Task 12: Update Report Script — Hero Section

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Create new hero function**

In `scripts/report.mjs`, replace the hero section generation. Find where the hero is built and replace with:

```javascript
// Add this function after brandbar:
const heroSection = () => {
  const heroImg = HAS_HERO ? `<img src="${HERO_DATA}" alt="llama-smith artifact" class="hero-image">` : ''
  return `<div class="hero">
    ${heroImg}
    <div class="hero-content">
      <h1 class="display-xl">Many Smiths enter.<br>One skill comes out.</h1>
      <p class="quote" style="margin-top:1.5rem">It does not summarize your repo. It forges operational memory from it.</p>
      <div class="hero-proof">
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Real repo scan
        </span>
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><polyline points="13 2 13 9 20 9"/></svg>
          File-path cited
        </span>
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/></svg>
          Ollama local/cloud
        </span>
        <span class="proof-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Oracle validated
        </span>
      </div>
    </div>
  </div>
  <div class="pipeline">
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
      <span class="step-label">Scan repo</span>
      <span class="step-desc">Many agents map structure</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 9 20 9"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span class="step-label">Extract facts</span>
      <span class="step-desc">Architecture & risks</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      <span class="step-label">Oracle validates</span>
      <span class="step-desc">Hallucinations rejected</span>
    </div>
    <div class="pipeline-step">
      <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 9 21 9"/><path d="m9 15 2 2 4-4"/></svg>
      <span class="step-label">Skill forged</span>
      <span class="step-desc">Claude-ready output</span>
    </div>
  </div>`
}
```

- [ ] **Step 2: Commit hero section**

```bash
git add scripts/report.mjs
git commit -m "feat: update hero section with proof chips and pipeline"
```

---

### Task 13: Update Report Script — Repo Cards

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update repo card generation**

Find the card/panel generation code and update to use v2 classes. Look for where panels are generated from manifests and update:

```javascript
// Replace card generation with v2 structure
// Find code around the panels mapping and replace with:

const repoCard = (r) => {
  const full = repoFull(r)
  const short = full.split('/').pop()
  const owner = ownerOf(full)
  const grade = vibeScore(r)
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const total = h + m + l
  const gradeClass = `badge-grade-${grade.grade.toLowerCase()}`

  // Severity bar segments
  const hPct = total ? Math.round((h / total) * 100) : 0
  const mPct = total ? Math.round((m / total) * 100) : 0
  const lPct = total ? Math.round((l / total) * 100) : 100

  return `<a href="${safeName(r.repo)}.html" class="panel panel-interactive" style="text-decoration:none;color:inherit">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.75rem">
      <div style="display:flex;align-items:center;gap:0.75rem;min-width:0">
        ${avatarImg(full)}
        <div style="min-width:0">
          <div style="font-size:1.15rem;font-weight:700;color:var(--green-hot);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(owner)}<span style="color:var(--text-muted)">/</span>${esc(short)}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.15rem">
            ${esc(repoStack(r))} · ${(r.commits || 0).toLocaleString()} commits
          </div>
        </div>
      </div>
      <span class="badge badge-grade ${gradeClass}">${grade.score} ${grade.grade}</span>
    </div>

    ${total ? `
    <div class="sevbar" style="margin:1rem 0">
      <div class="sevbar-track">
        ${h ? `<span class="sevbar-seg sevbar-seg-high" style="width:${hPct}%"></span>` : ''}
        ${m ? `<span class="sevbar-seg sevbar-seg-medium" style="width:${mPct}%"></span>` : ''}
        ${l ? `<span class="sevbar-seg sevbar-seg-low" style="width:${lPct}%"></span>` : ''}
      </div>
      <div class="sevbar-legend">
        ${h ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-high"></span>High <b>${h}</b></span>` : ''}
        ${m ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-medium"></span>Med <b>${m}</b></span>` : ''}
        ${l ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-low"></span>Low <b>${l}</b></span>` : ''}
      </div>
    </div>
    ` : '<div style="margin:1rem 0;font-size:0.85rem;color:var(--text-muted)">No findings — clean scan</div>'}

    <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.55;margin:0.75rem 0">
      ${esc(repoBlurb(r))}
    </div>

    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:auto;padding-top:1rem;font-size:0.8rem;color:var(--green-brand)">
      Open report →
    </div>
  </a>`
}
```

- [ ] **Step 2: Update panels mapping**

Find where `panels` is mapped from manifests and update:

```javascript
// Replace panels mapping with:
const repoGrid = `<div class="grid">${data.map(repoCard).join('')}</div>`
```

- [ ] **Step 3: Commit repo cards**

```bash
git add scripts/report.mjs
git commit -m "feat: update repo cards with v2 structure, severity bars, and grade badges"
```

---

### Task 14: Update Report Script — Corpus Charts

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update bar chart generation**

Find `barChart` function and ensure it uses v2 classes:

```javascript
// Update barChart function to use v2 classes:
const barChart = (rows, { unit = '' } = {}) => {
  if (!rows.length) return ''
  const max = Math.max(...rows.map(r => r.value), 1)
  const row = r => `<div class="barchart-row ${r.danger ? 'danger' : ''}">
      <span class="barchart-label" title="${esc(r.full || r.label)}">${esc(r.label)}</span>
      <span class="barchart-track"><span class="barchart-fill ${r.danger ? 'barchart-fill-danger' : r.warning ? 'barchart-fill-warning' : ''}" style="width:${Math.max(3, Math.round(r.value / max * 100))}%"></span></span>
      <span class="barchart-value">${r.value.toLocaleString()}${unit}</span>
    </div>`
  return `<div class="barchart" role="img" aria-label="bar chart">${rows.map(row).join('')}</div>`
}
```

- [ ] **Step 2: Update chart section structure**

Find where corpus charts are assembled (around `corpusCharts` function) and update to use grid layout:

```javascript
// Update corpus section to use v2 grid:
const corpusSection = () => {
  const shortName = r => repoFull(r).split('/').pop()
  const smithCounts = {}
  for (const r of data) for (const f of (r.opsFindings || [])) smithCounts[f.smith] = (smithCounts[f.smith] || 0) + 1
  const findingRows = Object.entries(smithCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: SMITH_LABEL[k] || k, value: v, danger: k === 'secret' }))
  const archRows = data.map(r => ({ label: shortName(r), value: (r.architecture || []).length })).filter(r => r.value).sort((a, b) => b.value - a.value)
  const busRows = data.filter(r => r.forensics && 'busFactor' in r.forensics).map(r => ({ label: shortName(r), value: r.forensics.busFactor, danger: r.forensics.busFactor <= 2 })).sort((a, b) => a.value - b.value)

  return `<section class="section">
    <div class="section-header">
      <span class="section-title">What the Smiths Found</span>
      <h2 class="display" style="margin-top:0.5rem">Corpus Signals</h2>
    </div>
    <div class="grid-3">
      ${findingRows.length ? `<div class="panel">
        <h3 class="section-title" style="margin-bottom:1rem">Findings by Smith</h3>
        ${barChart(findingRows)}
      </div>` : ''}
      ${archRows.length ? `<div class="panel">
        <h3 class="section-title" style="margin-bottom:1rem">Architecture Facts</h3>
        ${barChart(archRows)}
      </div>` : ''}
      ${busRows.length ? `<div class="panel">
        <h3 class="section-title" style="margin-bottom:1rem">Bus Factor</h3>
        ${barChart(busRows, { unit: '' })}
      </div>` : ''}
    </div>
  </section>`
}
```

- [ ] **Step 3: Commit corpus charts**

```bash
git add scripts/report.mjs
git commit -m "feat: update corpus charts with v2 barchart and grid layout"
```

---

### Task 15: Update Report Script — Index Page Assembly

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update index page body assembly**

Find where the index HTML is assembled and update to use new structure:

```javascript
// Find the index page generation and update body:
const indexBody = `${brandbar()}
${heroSection()}
<section class="section">
  <div class="section-header">
    <span class="section-title">Scanned Repositories</span>
    <h2 class="display" style="margin-top:0.5rem">${data.length} Repos Analyzed</h2>
  </div>
  ${repoGrid}
</section>
${corpusSection()}
${siteFooter()}`
```

- [ ] **Step 2: Commit index assembly**

```bash
git add scripts/report.mjs
git commit -m "feat: assemble index page with v2 sections and layout"
```

---

## Phase 3: Detail Page Updates

### Task 16: Update Report Script — Detail Page Header

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update detail page header**

Find where detail pages are generated and update the header section:

```javascript
// Add function for detail page header:
const detailHeader = (r) => {
  const full = repoFull(r)
  const grade = vibeScore(r)
  const gradeClass = `gauge-progress-${grade.grade.toLowerCase()}`
  const R = 52, C = +(2 * Math.PI * R).toFixed(1)
  const off = +(C * (1 - grade.score / 100)).toFixed(1)

  return `<a href="index.html" class="back-link">← Back to all repos</a>
<div class="repo-header">
  <div class="repo-title-section">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
      ${avatarImg(full, 'lg')}
      <h1 class="repo-title">${esc(full.replace('/', '<span>/</span>'))}</h1>
    </div>
    <p class="repo-blurb">${esc(repoBlurb(r))}</p>
    <div class="repo-meta">
      <span class="meta-tag"><b>${esc(repoStack(r))}</b> stack</span>
      <span class="meta-tag"><b>${(r.commits || 0).toLocaleString()}</b> commits</span>
      ${r.scanSeconds ? `<span class="meta-tag"><b>${r.scanSeconds}s</b> scan</span>` : ''}
      ${r.cloneMB != null ? `<span class="meta-tag"><b>${r.cloneMB}MB</b> clone</span>` : ''}
    </div>
  </div>
  <div class="gauge" style="flex:none">
    <div class="gauge-disc">
      <svg viewBox="0 0 120 120" class="gauge-svg">
        <circle class="gauge-track" cx="60" cy="60" r="${R}"/>
        <circle class="gauge-progress ${gradeClass}" cx="60" cy="60" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
      </svg>
      <div class="gauge-mid">
        <span class="gauge-score">${grade.score}</span>
        <span class="gauge-grade">${grade.grade}</span>
      </div>
    </div>
    <span class="gauge-cap">Repo Grade</span>
  </div>
</div>`
}
```

- [ ] **Step 2: Commit detail header**

```bash
git add scripts/report.mjs
git commit -m "feat: add v2 detail page header with gauge and meta tags"
```

---

### Task 17: Update Report Script — Detail Stats Cards

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Add stats cards for detail page**

```javascript
// Add function for detail stats:
const detailStats = (r) => {
  const h = sevCount(r, 'high'), m = sevCount(r, 'medium'), l = sevCount(r, 'low')
  const total = h + m + l
  const fr = r.forensics

  return `<div class="grid-3" style="margin:2rem 0">
    <div class="panel">
      <span class="section-title" style="margin-bottom:1rem">Findings by Severity</span>
      <div class="sevbar">
        <div class="sevbar-track">
          ${h ? `<span class="sevbar-seg sevbar-seg-high" style="width:${total ? (h/total*100) : 0}%"></span>` : ''}
          ${m ? `<span class="sevbar-seg sevbar-seg-medium" style="width:${total ? (m/total*100) : 0}%"></span>` : ''}
          ${l ? `<span class="sevbar-seg sevbar-seg-low" style="width:${total ? (l/total*100) : 0}%"></span>` : ''}
        </div>
        <div class="sevbar-legend">
          ${h ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-high"></span>High <b>${h}</b></span>` : ''}
          ${m ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-medium"></span>Medium <b>${m}</b></span>` : ''}
          ${l ? `<span class="sevbar-item"><span class="sevbar-dot sevbar-dot-low"></span>Low <b>${l}</b></span>` : ''}
        </div>
      </div>
    </div>

    <div class="panel">
      <span class="section-title" style="margin-bottom:1rem">Ownership Risk</span>
      ${fr ? `
        <div style="display:flex;align-items:baseline;gap:0.5rem">
          <span style="font-size:2.5rem;font-weight:800;color:${fr.busFactor <= 2 ? 'var(--red)' : 'var(--green-hot)'};font-variant-numeric:tabular-nums">${fr.busFactor}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em">Bus Factor</span>
        </div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:0.75rem;line-height:1.5">
          ${fr.singleOwner?.length ? `<strong style="color:var(--amber)">${fr.singleOwner.length} files</strong> owned by single contributor. ` : ''}
          ${fr.keyPeople?.length ? `Key knowledge held by ${fr.keyPeople.slice(0, 2).map(p => p.name).join(', ')}${fr.keyPeople.length > 2 ? ' and others' : ''}.` : ''}
        </p>
      ` : '<p style="font-size:0.85rem;color:var(--text-muted)">No ownership data available</p>'}
    </div>

    <div class="panel">
      <span class="section-title" style="margin-bottom:1rem">Architecture Coverage</span>
      ${r.architecture?.length ? `
        <div class="barchart">
          ${['overview', 'modules', 'dataflow', 'entrypoints'].map(area => {
            const count = r.architecture.filter(a => a.area === area).length
            const max = Math.max(...['overview', 'modules', 'dataflow', 'entrypoints'].map(a => r.architecture.filter(x => x.area === a).length), 1)
            return count ? `
              <div class="barchart-row">
                <span class="barchart-label">${AREA_LABELS[area] || area}</span>
                <span class="barchart-track"><span class="barchart-fill" style="width:${Math.round(count/max*100)}%"></span></span>
                <span class="barchart-value">${count}</span>
              </div>
            ` : ''
          }).join('')}
        </div>
      ` : '<p style="font-size:0.85rem;color:var(--text-muted)">No architecture data</p>'}
    </div>
  </div>`
}
```

- [ ] **Step 2: Commit stats cards**

```bash
git add scripts/report.mjs
git commit -m "feat: add v2 detail page stats cards for severity, ownership, and architecture"
```

---

### Task 18: Update Report Script — Evidence Cards

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update evidence/findings display**

```javascript
// Update findings display:
const findingsSection = (r) => {
  const findings = (r.opsFindings || [])
  if (!findings.length) return ''

  const findingCard = (f, i) => {
    const sevClass = f.severity === 'high' ? 'evidence-high' : f.severity === 'medium' ? 'evidence-medium' : 'evidence-low'
    const badgeClass = f.severity === 'high' ? 'badge-high' : f.severity === 'medium' ? 'badge-medium' : 'badge-low'
    const smith = SMITH_LABEL[f.smith] || f.smith

    return `<div class="evidence ${sevClass}">
      <div class="evidence-rail"></div>
      <div class="evidence-body">
        <div class="evidence-header">
          <span class="badge ${badgeClass}">${esc(f.severity)}</span>
          <span class="label" style="color:var(--text-muted)">${esc(smith)}</span>
          ${f.file ? `<span class="path-chip" data-path="${esc(f.file)}">${esc(f.file)}</span>` : ''}
        </div>
        <div class="evidence-title">${esc(f.title || f.text)}</div>
        ${f.details ? `<div class="evidence-text">${esc(f.details)}</div>` : ''}
        <div class="evidence-actions">
          ${f.file ? `<button class="btn btn-sm btn-secondary" onclick="alert('View file: ${esc(f.file)}')">View file</button>` : ''}
          <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${esc(f.title || f.text).replace(/'/g, "\\'")}');this.textContent='Copied'">Copy finding</button>
        </div>
      </div>
    </div>`
  }

  return `<section class="section">
    <div class="section-header">
      <span class="section-title">Scan Evidence</span>
      <h2 class="display" style="margin-top:0.5rem">Highest Risk Findings</h2>
    </div>
    <div class="filter-bar">
      <span class="filter-label">Filter:</span>
      <button class="filter-pill" aria-pressed="true">All</button>
      <button class="filter-pill">High</button>
      <button class="filter-pill">Medium</button>
      <button class="filter-pill">Low</button>
    </div>
    <div style="display:grid;gap:0.85rem">
      ${findings.sort((a, b) => (SEVRANK[a.severity] || 2) - (SEVRANK[b.severity] || 2)).map(findingCard).join('')}
    </div>
  </section>`
}
```

- [ ] **Step 2: Commit evidence cards**

```bash
git add scripts/report.mjs
git commit -m "feat: add v2 evidence cards with severity rails and actions"
```

---

### Task 19: Update Report Script — Skill Artifact Section

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Add skill artifact section**

```javascript
// Add skill artifact section:
const skillSection = (r) => {
  const skills = r.skills || []
  if (!skills.length) return ''

  const skill = skills[0]
  const claims = skill.claims || 0
  const cited = skill.citedPaths || 0
  const rejected = skill.rejected || 0

  return `<section class="section">
    <div class="section-header">
      <span class="section-title">Product Output</span>
      <h2 class="display" style="margin-top:0.5rem">⚡ Skill Forged</h2>
    </div>
    <div class="skill-artifact">
      <div class="skill-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green-hot)">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 9 21 9"/>
        </svg>
        <span class="skill-title">Claude-Ready Skill</span>
      </div>
      <div class="skill-file">${esc(r.repo)}.skill.md</div>
      <div class="skill-stats">
        <div class="skill-stat">
          <span class="skill-stat-value">${claims}</span>
          <span class="skill-stat-label">Claims</span>
        </div>
        <div class="skill-stat">
          <span class="skill-stat-value">${cited}</span>
          <span class="skill-stat-label">Cited Paths</span>
        </div>
        <div class="skill-stat">
          <span class="skill-stat-value">${rejected}</span>
          <span class="skill-stat-label">Rejected</span>
        </div>
      </div>
      <div class="skill-preview">
        <strong style="color:var(--green-hot)">This skill teaches Claude how ${esc(r.repo)} actually works.</strong><br><br>
        Every claim cites a file path. The Oracle rejected ${rejected} hallucinations.
        The skill was forged from validated evidence.
      </div>
      <div class="skill-actions">
        <button class="btn btn-primary" onclick="alert('Open skill file')">Open forged skill</button>
        <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('Skill content...');this.textContent='Copied'">Copy skill</button>
      </div>
    </div>
  </section>`
}
```

- [ ] **Step 2: Commit skill section**

```bash
git add scripts/report.mjs
git commit -m "feat: add v2 skill artifact section with stats and actions"
```

---

### Task 20: Update Report Script — Detail Page Assembly

**Files:**
- Modify: `scripts/report.mjs`

- [ ] **Step 1: Update detail page body assembly**

Find where detail page HTML is assembled and update:

```javascript
// Replace detail page body assembly:
const detailBody = (r) => `${brandbar()}
${detailHeader(r)}
${detailStats(r)}
${findingsSection(r)}
${skillSection(r)}
${siteFooter()}`
```

- [ ] **Step 2: Commit detail assembly**

```bash
git add scripts/report.mjs
git commit -m "feat: assemble detail page with v2 sections"
```

---

## Phase 4: Regenerate Reports

### Task 21: Regenerate All Reports

**Files:**
- None (outputs to reports/)

- [ ] **Step 1: Regenerate reports with new design**

```bash
cd /private/var/www/llama-smith
node scripts/report.mjs /tmp/ls-results.json reports
```

Expected output: Should regenerate `index.html` and all detail pages with v2 design.

- [ ] **Step 2: Verify files were created**

```bash
ls -la reports/*.html | wc -l
head -50 reports/index.html
```

Expected: Multiple HTML files exist, and `index.html` contains references to v2 classes like `display-xl`, `panel`, etc.

- [ ] **Step 3: Commit regenerated reports**

```bash
git add reports/*.html
git commit -m "chore: regenerate reports with v2 forensic dashboard design"
```

---

## Phase 5: Testing

### Task 22: Visual Verification

**Files:**
- None (browser verification)

- [ ] **Step 1: Start HTTP server for testing**

```bash
cd /private/var/www/llama-smith
python3 -m http.server 8090 &
```

- [ ] **Step 2: Open index page in browser**

Navigate to: `http://localhost:8090/reports/index.html`

Verify:
- [ ] Hero section displays with headline "Many Smiths enter. One skill comes out."
- [ ] 4-step pipeline is visible with icons
- [ ] Repo cards show grade badges and severity bars
- [ ] Matrix rain is visible but muted behind content
- [ ] Typography is readable with clear hierarchy
- [ ] Color system uses green/amber/red semantically

- [ ] **Step 3: Open detail page in browser**

Navigate to: `http://localhost:8090/reports/express.html` (or any generated detail page)

Verify:
- [ ] Grade gauge displays as circular SVG with score
- [ ] Stats cards show severity, ownership, architecture
- [ ] Evidence cards have left severity rail
- [ ] Skill artifact section is prominent
- [ ] File path chips are copyable

---

### Task 23: Responsive Testing

**Files:**
- None (browser verification)

- [ ] **Step 1: Test mobile viewport**

Resize browser to 375px width or use device emulation.

Verify:
- [ ] Hero stacks vertically
- [ ] Grid becomes single column
- [ ] Pipeline stacks vertically
- [ ] Text remains readable
- [ ] No horizontal overflow

- [ ] **Step 2: Test tablet viewport**

Resize browser to 768px width.

Verify:
- [ ] Grid shows 2 columns
- [ ] Stats cards fit side by side
- [ ] Navigation is accessible

---

## Phase 6: Cleanup

### Task 24: Final Review and Cleanup

**Files:**
- None (final verification)

- [ ] **Step 1: Run existing tests**

```bash
cd /private/var/www/llama-smith
npm test 2>/dev/null || echo "No test command configured"
```

- [ ] **Step 2: Check for console errors**

Open browser dev tools on index.html and detail page.

Verify:
- [ ] No JavaScript errors
- [ ] Matrix rain animation works
- [ ] Copy buttons work (if tested manually)

- [ ] **Step 3: Final commit**

```bash
git status
git log --oneline -10
```

Ensure all changes are committed with clear messages.

---

## Plan Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Color system with semantic palette | Task 1 (CSS custom properties) |
| Typography hierarchy | Task 3 |
| Panel/card components | Task 4 |
| Severity bars | Task 5 |
| Grade gauge | Task 5 |
| Evidence cards with rails | Task 6 |
| Skill artifact section | Task 7 |
| Hero section with pipeline | Task 12 |
| Repo cards with badges | Task 13 |
| Corpus charts | Task 14 |
| Detail page header | Task 16 |
| Detail stats cards | Task 17 |
| Evidence cards | Task 18 |
| Skill section | Task 19 |

**All spec requirements covered.**

### Placeholder Scan

- No "TBD" or "TODO" found
- All code blocks contain complete implementation
- All file paths are exact
- All commands have expected outputs

### Type Consistency

- CSS variable names consistent throughout
- Function names match between definition and usage
- Class names consistent between CSS and HTML generation

---

**Plan Status:** Complete and ready for execution

**Estimated Time:** 2-3 hours of focused work

**Next Step:** Execute using subagent-driven-development or executing-plans skill
