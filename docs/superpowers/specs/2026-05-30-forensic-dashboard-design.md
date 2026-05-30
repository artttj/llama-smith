# Llama-Smith Forensic Dashboard Design Specification

**Date:** 2026-05-30  
**Scope:** Complete visual redesign of index.html and detail pages  
**Direction:** Premium forensic control room with Matrix/Smith DNA

---

## 1. Design Philosophy

### From Raw Terminal to Forensic Interface

The current UI looks like "everything is terminal output." The new direction is "premium forensic interface that uses terminal aesthetics."

**Core Principle:** Background texture and terminal noise must never compete with text. Atmosphere belongs at the edges; content belongs on clean, elevated panels.

### Visual Hierarchy Priority

1. Repo identity and grade
2. Critical findings (high severity)
3. Cited evidence paths
4. Forged skill output (the product payoff)
5. Supporting metadata
6. Atmosphere (rain, scanlines)

---

## 2. Color System

### Semantic Color Palette

```css
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
  --red: oklch(60% 0.22 25);        /* High severity, failed */
  --red-glow: oklch(60% 0.22 25 / 0.3);
  --amber: oklch(75% 0.15 75);      /* Medium severity, warning, grade C */
  --cyan: oklch(70% 0.08 195);      /* Technical metadata, paths, commands */

  /* Text hierarchy */
  --text-primary: oklch(92% 0.01 150);
  --text-secondary: oklch(72% 0.025 150);
  --text-muted: oklch(55% 0.02 150);
  --text-faint: oklch(40% 0.015 150);
}
```

### Usage Rules

- **Green:** Brand, active states, validated facts, positive scan results, skill status
- **Red:** ONLY high-severity findings, failed validation
- **Amber:** Medium severity, partial confidence, grade C
- **Cyan:** Stack badges, commands, file paths, neutral technical metadata
- **Muted gray-green:** Descriptions, helper text, secondary metadata
- **Avoid:** Using the same green for borders, text, charts, icons, buttons, and tags

---

## 3. Typography System

### Font Stack

```css
:root {
  /* Headlines and labels - technical monospace */
  --font-display: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Body text - more readable monospace or semi-mono */
  --font-body: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;
}
```

### Type Scale

| Level | Usage | Size | Weight | Line Height | Letter Spacing |
|-------|-------|------|--------|-------------|----------------|
| H1 | Page title | 2.4rem | 800 | 1.05 | -0.03em |
| H2 | Section headers | 1.5rem | 700 | 1.2 | -0.01em |
| H3 | Card titles | 1.15rem | 600 | 1.3 | 0 |
| Body | Main text | 0.92rem | 400 | 1.7 | 0 |
| Label | Small labels | 0.7rem | 600 | 1.4 | 0.05em |
| Meta | Metadata | 0.72rem | 400 | 1.5 | 0.02em |
| Tiny | Timestamps | 0.65rem | 400 | 1.4 | 0.04em |

### Typography Rules

- **UPPERCASE only for small labels** (<0.75rem), not for everything
- **Repo names, grade, finding count, skill status** = loudest elements
- **Long evidence titles** wrap naturally with max-width, not full-width stretch
- **Line height increased** for body text (1.7 vs current 1.62)
- **Letter spacing reduced** on long paragraphs

---

## 4. Component Specifications

### 4.1 Hero Section (Index Page)

**Layout:** Strong left/right composition
- **Left:** Larger llama artifact image, framed but secondary
- **Right:** Headline, proof chips, 4-step pipeline, CTA

**Headline:**
```
Many Smiths enter.
One skill comes out.
```
- Size: 2.4rem
- Color: --green-hot with subtle glow
- Font: --font-display

**Proof Chips** (replace 4 bullets):
- Compact horizontal row
- Icons + text: "Real repo scan", "File-path cited", "Ollama local/cloud", "Oracle validated"
- Style: small bordered pills with icons

**README Callout:**
- Compact quote style with better contrast
- Border-left accent in --green-brand
- Shorter text: max 2 lines

**4-Step Pipeline:**
- Horizontal with connecting lines
- Each step: icon + label + micro-description
- Active step has stronger visual weight
- Steps: Scan repo → Extract facts → Oracle validates → Skill forged

### 4.2 Navigation Header

**Left:** Logo + wordmark (llama·smith)
**Right Actions:**
- GitHub (link)
- Docs (link)
- "Scan repo" (primary CTA - solid green button)
- "View samples" (secondary - dark with green border)

Buttons use human labels, not tiny terminal tabs.

### 4.3 Repo Cards (Scan Result Cards)

**Card Structure:**
```
┌─────────────────────────────────────────┐
│ [Avatar] owner/repo    [Grade Badge]    │  ← Identity row
│ Node · TypeScript · GitHub Actions      │  ← Stack (max 3 visible)
│                                         │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░ High 5 | Med 3      │  ← Severity bar
│                                         │
│ One-line repo summary here...           │  ← Summary
│                                         │
│ 1.2k commits · 45s scan · 12MB         │  ← Metadata
│                                         │
│ [Open report →]                         │  ← Action
└─────────────────────────────────────────┘
```

**Grade Badge (Compact Pill):**
- Format: "76 C" or "92 A"
- Colors: A/B = green, C = amber, D/F = red
- NOT circular (save circles for detail pages)

**Severity Bar:**
- Stacked horizontal bar
- Red | Amber | Green segments
- Numbers directly inside/beside segments

### 4.4 Charts

**Severity Distribution:**
```
Findings by severity
├─────────┬───────┬─────────┤
  High 5    Med 3    Low 0
```
- Horizontal stacked bar
- Labels with counts
- No donuts

**Ownership (Bus Factor):**
```
Ownership concentration
Single-owner: 12 ████████████
Shared:        688 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

Bus factor risk is concentrated in 12 files.
```
- Split bar, not donut
- Clear explanation below

**Architecture Coverage:**
- Horizontal bars grouped by:
  - Architecture
  - Operations
  - Risk
  - Skill Memory
- Category name + bar + count
- Clean, spacious layout

### 4.5 Evidence Cards (Detail Page)

**Structure:**
```
┌─────────────────────────────────────────┐
│ █ High  [SMITH-NAME]  [REPO]  [path]    │  ← Top row
│                                         │
│ Main finding title in larger text       │  ← Title
│ Supporting evidence details...          │  ← Evidence
│                                         │
│ [Open report] [View file] [Copy]        │  ← Actions
└─────────────────────────────────────────┘
```

**Left Rail:** Vertical color bar for severity
- Red = high
- Amber = medium
- Green = low

**Top Row:**
- Severity pill
- Smith name (small label)
- Repo name
- File path chip (cyan bordered)

**File Path Chips:**
- Small bordered code chips
- Cyan or muted green
- Copy-to-clipboard functionality
- Example: `.github/workflows/ci.yml`

### 4.6 Grade Gauge (Detail Page)

**Circular Display:**
```
     ╭──────────╮
    ╱   ┌──┐    ╲
   │    │76│     │   ← Large number center
   │    │ C│     │   ← Letter below
    ╲    └──    ╱
     ╰──────────╯
      REPO GRADE
```

- Ring color based on grade
- Large number in center
- Letter below number
- Small caption "Repo grade"
- Nearby explanation: "Grade based on validated risks, architecture coverage, ownership concentration, and operational gaps."

### 4.7 Skill Forged Section (Detail Page)

**Prominent Artifact Display:**
```
┌─────────────────────────────────────────┐
│ ⚡ SKILL FORGED                         │
├─────────────────────────────────────────┤
│                                         │
│  project.skill.md                       │
│  ├─ Status: Oracle validated ✓          │
│  ├─ Claims: 42                          │
│  ├─ Cited paths: 38                     │
│  └─ Rejected: 6                         │
│                                         │
│  Preview:                               │
│  "This skill teaches Claude how this    │
│   repo actually works."                   │
│                                         │
│  [Open forged skill] [Copy] [Download]  │
└─────────────────────────────────────────┘
```

This is the product payoff — make it visually dominant.

### 4.8 Product Story Diagram

**Compact Visual Flow:**
```
┌────────┐    ┌──────────┐    ┌────────┐    ┌──────────┐
│  📁    │───→│   👥     │───→│   👁    │───→│   📄     │
│  Repo  │    │  Smiths  │    │ Oracle │    │  Skill   │
└────────┘    └──────────┘    └────────┘    └──────────┘
```

- Simple icons connected by subtle lines
- Show in hero and as section divider on detail page

---

## 5. Page Layouts

### 5.1 Index Page Structure

```
┌─────────────────────────────────────────┐
│  [Logo]                      GitHub Docs│
│                              [Scan repo]│
├─────────────────────────────────────────┤
│                                         │
│    🦙          Many Smiths enter.       │
│   IMAGE        One skill comes out.     │
│                [Proof chips]            │
│                [CTA buttons]            │
│                                         │
│  ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐  │
│  │Scan │──→│Facts│──→│Orcl │──→│Skill│  │
│  └─────┘   └─────┘   └─────┘   └─────┘  │
│                                         │
├─────────────────────────────────────────┤
│  SCANNED REPOSITORIES                   │
│  [Filters: All High-risk Oracle Skill]  │
│  [Sort: Grade Findings Time]            │
│                                         │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Repo 1 │ │ Repo 2 │ │ Repo 3 │ ...  │
│  └────────┘ └────────┘ └────────┘      │
│                                         │
├─────────────────────────────────────────┤
│  WHAT THE SMITHS FOUND                  │
│  [Charts: Severity, Ownership, Arch]    │
│                                         │
│  THE MATRIX OF A CODEBASE               │
│  [Layered architecture diagram]         │
│                                         │
├─────────────────────────────────────────┤
│              [Footer]                   │
└─────────────────────────────────────────┘
```

### 5.2 Detail Page Structure

```
┌─────────────────────────────────────────┐
│  [← Back]                               │
├─────────────────────────────────────────┤
│                                         │
│  [Avatar] expressjs/express    ╭──────╮  │
│  Web framework · 6.4k commits  │ 76 C │  │
│                                ╰──────╯  │
│  "Fast, unopinionated, minimalist..."    │
│                                         │
│  [Stack badges] [Metadata]              │
│                                         │
├─────────────────────────────────────────┤
│  WHAT THE SCAN MEASURED                 │
│                                         │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐│
│  │ Severity│  │ Ownership│  │  Arch   ││
│  │ ████░░░ │  │  Bus: 2  │  │  Bars   ││
│  └─────────┘  └──────────┘  └─────────┘│
│                                         │
├─────────────────────────────────────────┤
│  HIGHEST RISK FINDINGS                  │
│  [Filter bar: Severity Smith Repo Path] │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │ █ High   Deploy    express  /ci/  │ │
│  │ Old Node version...               │ │
│  └─────────────────────────────────────┘ │
│  [More findings...]                     │
│                                         │
├─────────────────────────────────────────┤
│  ⚡ SKILL FORGED                        │
│  [Artifact card with preview]           │
│  [Open] [Copy] [Download]               │
│                                         │
├─────────────────────────────────────────┤
│  RAW EVIDENCE                           │
│  [Expandable findings list]             │
│                                         │
│  [Skill folder accordion]               │
│                                         │
├─────────────────────────────────────────┤
│              [Footer]                   │
└─────────────────────────────────────────┘
```

---

## 6. Microcopy Improvements

### Terminology Changes

| Current | New |
|---------|-----|
| vibe | grade |
| bus factor | ownership risk (bus factor as secondary) |
| self-improvement oracle | Skill memory |
| fragile hotspots | Fragile hotspots |
| Do-not-touch | Protected boundaries |
| glitch feed | Scan evidence |

### Prominent Phrases (Use Bold or Highlighted)

- "Every claim cites a file path"
- "README is not trusted"
- "Oracle rejects hallucinations"
- "Skill is forged from validated evidence"
- "Runs on Ollama, local or cloud"

### Button Labels

- "Open report"
- "Run scan"
- "View evidence"
- "Copy skill"
- "Re-scan"

---

## 7. Spacing & Layout Rules

### Section Spacing

- Between major sections: 4rem
- Between cards in grid: 1.25rem
- Inside cards padding: 1.5rem
- Component internal gaps: 0.75rem to 1rem

### Card Guidelines

- Max 7 badges visible by default
- Secondary badges in "+ more" expandable
- Avoid long horizontal badge rows (wrap at 2 rows max)
- Important numbers get breathing room (min 2rem margin-top)

### Responsive Breakpoints

- Desktop: >1024px (full layout)
- Tablet: 768px–1024px (2-column grids become 1–2)
- Mobile: <768px (single column, stacked)

**Mobile adaptations:**
- Hero image smaller or hidden
- Charts become simple labeled bars
- Badges wrap with "+ more" truncation
- Grade gauge remains prominent but smaller

---

## 8. Background & Atmosphere

### Matrix Rain Treatment

```css
/* Only at edges, muted behind content */
canvas#rain {
  position: fixed;
  inset: 0;
  z-index: 0;
  opacity: 0.035; /* Reduced from 0.045 */
  pointer-events: none;
  mask-image: radial-gradient(
    ellipse 80% 80% at 50% 50%,
    transparent 30%,
    black 70%
  );
}
```

### Scanlines

- Reduce opacity from 0.22 to 0.12
- Apply only at viewport edges via mask
- Disable entirely on mobile

### Content Mask

```css
/* Reading mask: atmosphere at edges only */
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

---

## 9. Icon System

### Semantic Icon Mapping

| Concept | Icon | Color Group |
|---------|------|-------------|
| Repo | Folder/Git | Cyan |
| Evidence/Oracle | Eye | Green |
| Validation | Shield | Green |
| Fragility | Bug | Red/Amber |
| Deploy risk | Rocket | Red/Amber |
| Architecture | Layers | Cyan |
| Ownership | Users | Cyan |
| Commands | Terminal | Cyan |
| Skill | FileText | Green |
| High severity | AlertTriangle | Red |
| Success/Valid | Check | Green |
| Warning | AlertCircle | Amber |

### Icon Rules

- Color by semantic group, not unique per icon
- Use Lucide line icons (consistent with current)
- Size: 16px inline, 20px for buttons, 24px for section headers

---

## 10. Implementation Notes

### CSS Architecture

Create new file: `assets/dashboard-v2.css`

Keep existing `dashboard.css` for backward compatibility.

### HTML Changes Required

1. Update class names to match new component system
2. Restructure hero section
3. Add semantic wrapper divs for panel elevation
4. Reorganize evidence card markup

### File Structure

```
assets/
├── dashboard.css        # Current (keep for reference)
├── dashboard-v2.css     # New forensic design
└── hero-v2.webp         # Optional: larger hero image

reports/
├── index.html           # Updated
├── [repo].html          # Updated
└── ...
```

### JavaScript Considerations

- Matrix rain opacity needs update
- Add copy-to-clipboard for file paths
- Evidence card expand/collapse
- Badge "+ more" expansion

---

## 11. Success Metrics

The redesign succeeds when:

1. **Repo grade** is the first thing noticed on any card
2. **High severity findings** visually pop without being garish
3. **File paths** are clearly visible and copyable
4. **Skill forged section** feels like the hero moment it is
5. **Text is readable** at all sizes without squinting
6. **Background doesn't compete** with foreground
7. **The product story** is clear without explanation

---

## 12. Files to Modify

| File | Changes |
|------|---------|
| `assets/dashboard-v2.css` | Create new (this is the primary deliverable) |
| `scripts/report.mjs` | Update HTML generation to use new classes |
| `lib/dashboard.mjs` | Update inline dashboard styles |
| `reports/index.html` | Regenerate with new markup |
| `reports/*.html` | Regenerate detail pages |

---

**Spec Status:** Ready for review  
**Next Step:** Implementation planning after approval
