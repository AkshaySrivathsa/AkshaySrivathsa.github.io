# Cinematic Portfolio — Implementation Plan

Convert the approved HTML/React/CSS prototype into your existing **Vite + React 18 + TypeScript + Tailwind + Framer Motion + R3F** project.

---

## 1. Files to create

```
src/
├── components/
│   ├── cosmos/
│   │   ├── Cosmos.tsx              # Stage host + scroll-progress consumer
│   │   ├── StagePlate.tsx          # Single full-bleed image plate (memoized)
│   │   ├── stages.config.ts        # Stage timing/scale/filter table
│   │   └── useScrollProgress.ts    # 0..1 scroll hook (rAF-coalesced)
│   ├── chrome/
│   │   ├── Nav.tsx
│   │   ├── ProgressRail.tsx
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── About.tsx
│   │   ├── Experience.tsx
│   │   ├── Projects.tsx
│   │   ├── Skills.tsx
│   │   ├── Education.tsx
│   │   └── Contact.tsx
│   ├── primitives/
│   │   ├── Section.tsx             # wrapper w/ scrim + reveal
│   │   ├── SectionMeta.tsx
│   │   ├── Glass.tsx               # variant="card" | "panel"
│   │   ├── Button.tsx              # variant="primary" | "ghost"
│   │   ├── Chip.tsx
│   │   ├── Reveal.tsx              # IntersectionObserver fade-up
│   │   └── Icon.tsx                # tree-shakeable icon set
│   └── visualizations/
│       ├── CryptoChartViz.tsx      # SVG chart for CoinMarketCap card
│       ├── SeleniumGraphViz.tsx    # SVG node graph for Instagram bot card
│       └── LocalTime.tsx           # IST clock
├── hooks/
│   ├── usePointerParallax.ts       # {x,y} pointer normalized -1..1
│   ├── useActiveSection.ts         # IO-based active section id
│   └── usePrefersReducedMotion.ts
├── data/
│   ├── profile.ts                  # name, role, contacts, links
│   ├── experience.ts
│   ├── projects.ts
│   ├── skills.ts
│   └── education.ts
├── styles/
│   ├── tokens.css                  # CSS variables only (palette, fonts)
│   └── base.css                    # html/body resets, ::selection
├── lib/
│   └── math.ts                     # clamp, lerp, ramp, smooth
├── App.tsx
└── main.tsx

public/
├── images/
│   ├── galaxy.jpg                  # 3840×2160
│   ├── earth-far.jpg
│   ├── earth-horizon.jpg
│   └── city.jpg
└── fonts/                          # optional self-hosted Outfit subset
```

**Do not create:** any Three.js / R3F scene files. The current visual direction uses photographic plates, not 3D. Keep R3F installed but unused — easy to remove later or re-enable if you swap back to 3D.

---

## 2. Files to replace

| Existing file | Action |
|---|---|
| `src/App.tsx` | Replace with composition listed below. |
| `src/main.tsx` | Keep, just ensure imports `./styles/tokens.css` and `./styles/base.css`. |
| `tailwind.config.ts` | Extend (don't replace) — see §5. |
| `index.html` | Add Outfit Google Fonts `<link>` in `<head>`, plus `<link rel="preload" as="image">` for the 4 plates. |
| Any existing hero / portfolio scaffolding | Delete. |

---

## 3. Component structure

```tsx
// App.tsx
export default function App() {
  const progress = useScrollProgress();
  const pointer  = usePointerParallax();
  const active   = useActiveSection(SECTION_IDS);

  return (
    <>
      <Cosmos progress={progress} pointer={pointer} />
      <Nav active={active} />
      <ProgressRail active={active} />
      <main className="page">
        <Hero pointer={pointer} />
        <About />
        <Experience />
        <Projects />
        <Skills />
        <Education />
        <Contact />
        <Footer />
      </main>
    </>
  );
}
```

- **Single scroll engine.** One `useScrollProgress` hook, value passed top-down. No per-section scroll listeners.
- **Pointer state** propagated via context-free prop (it's only used in Cosmos + Hero).
- **No client routing.** Anchor links (`href="#about"`) + scroll-margin-top via Tailwind utility.

---

## 4. Scene architecture (Cosmos)

```ts
// stages.config.ts
export type Stage = {
  id: string;
  src: string;
  pos: string;            // background-position
  inS: number; inE: number;  // fade-in window
  outS: number; outE: number; // fade-out window
  scaleS: number; scaleE: number;
  filter: string;
};

export const STAGES: Stage[] = [
  { id: 'galaxy',  src: '/images/galaxy.jpg',        pos: '50% 48%', inS: -0.05, inE: 0.00, outS: 0.22, outE: 0.34, scaleS: 1.00, scaleE: 2.40, filter: 'brightness(1) saturate(1.05)' },
  { id: 'earth',   src: '/images/earth-far.jpg',     pos: '50% 50%', inS:  0.22, inE: 0.36, outS: 0.50, outE: 0.62, scaleS: 0.86, scaleE: 1.85, filter: 'brightness(1) saturate(1.05) contrast(1.04)' },
  { id: 'horizon', src: '/images/earth-horizon.jpg', pos: '50% 55%', inS:  0.50, inE: 0.64, outS: 0.76, outE: 0.86, scaleS: 0.90, scaleE: 1.70, filter: 'brightness(1.05) saturate(1.05) contrast(1.05)' },
  { id: 'city',    src: '/images/city.jpg',          pos: '50% 50%', inS:  0.74, inE: 0.84, outS: 1.50, outE: 2.00, scaleS: 0.92, scaleE: 1.45, filter: 'brightness(0.92) saturate(1.05) contrast(1.05)' },
];
```

```tsx
// Cosmos.tsx
export function Cosmos({ progress, pointer }: { progress: number; pointer: { x: number; y: number } }) {
  return (
    <div className="cosmos fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#02030c]">
      {STAGES.map(s => <StagePlate key={s.id} stage={s} progress={progress} pointer={pointer} />)}
      <div className="cosmos-vignette" />
      <div className="cosmos-readscrim" />
    </div>
  );
}
```

```tsx
// StagePlate.tsx
export const StagePlate = memo(function StagePlate({ stage, progress, pointer }: Props) {
  const inOp   = smooth(ramp(progress, stage.inS,  stage.inE));
  const outOp  = smooth(ramp(progress, stage.outS, stage.outE));
  const opacity = inOp * (1 - outOp);
  if (opacity < 0.001) return <div className="cosmos-stage" style={{ opacity: 0 }} />;

  const t = clamp((progress - stage.inS) / (stage.outE - stage.inS), 0, 1);
  const scale = lerp(stage.scaleS, stage.scaleE, smooth(t));

  return (
    <div
      className="cosmos-stage"
      style={{
        backgroundImage: `url("${stage.src}")`,
        backgroundPosition: stage.pos,
        opacity,
        transform: `translate3d(${pointer.x * 14}px, ${pointer.y * 14}px, 0) scale(${scale})`,
        filter: stage.filter,
      }}
    />
  );
});
```

**Why not Framer Motion here?** The transforms run every frame from a single scroll source; Motion's `MotionValue` adds overhead with no win over a raw `style` write. Use Framer Motion for `Reveal` (entry transitions only).

---

## 5. Styling approach

**Hybrid Tailwind + CSS variables + small global CSS.**

- **CSS variables** in `tokens.css` (palette, font, hairlines) — Tailwind can read these.
- **Tailwind** for layout, spacing, type scale, responsive breakpoints.
- **A small `base.css`** for: scrollbar styling, `::selection`, `.cosmos-stage`, `.glass` mixin (transforms + backdrop-filter Tailwind doesn't express well).

```css
/* tokens.css */
:root {
  --void: #050816;
  --violet: #8b6dff;
  --cyan: #6fd9ff;
  --gold: #f0d28a;
  --ink: #eef1fa;
  --ink-dim: #b3b9d0;
  --ink-faint: #6e7693;
  --hairline: rgba(255,255,255,0.08);
  --hairline-strong: rgba(255,255,255,0.18);
  --font-display: "Outfit", "Helvetica Neue", sans-serif;
}
```

```ts
// tailwind.config.ts — extend, don't replace
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        violet: 'var(--violet)',
        cyan: 'var(--cyan)',
        gold: 'var(--gold)',
        ink: 'var(--ink)',
        'ink-dim': 'var(--ink-dim)',
        'ink-faint': 'var(--ink-faint)',
      },
      fontFamily: {
        display: ['Outfit', 'Helvetica Neue', 'sans-serif'],
        sans: ['Outfit', 'Helvetica Neue', 'sans-serif'],
      },
      fontWeight: {
        thin: '200',
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
      },
    },
  },
};
```

**No italics anywhere** — gold "accent" text uses `font-weight: 300` + gradient `bg-clip-text`, not `italic`.

**Reading legibility over photos** is non-negotiable:
- `.glass` background: `rgba(10,12,28,0.45)` minimum opacity (NOT translucent white) so cards read against the bright city photo.
- Hero subtitle + section titles: add `text-shadow: 0 2px 12px rgba(0,0,0,0.5)`.
- Section content sits on a `<div class="scrim absolute inset-0 -z-10">` radial darken so columns read clearly.

---

## 6. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| **≥1100px** | 2-col About, 2-col Projects, 3-col Skills/Education, 2-col Contact, full nav + progress rail visible. |
| **901–1099px** | Same column counts, slight padding reduction. |
| **761–900px** | About + Contact collapse to 1 col, Skills → 2 col. Progress rail hidden. |
| **561–760px** | Projects + Education → 1 col. Timeline bullets → 1 col. Nav items collapse to brand only (CTA via menu icon optional, or simply omit). HUD coordinate readouts hidden. |
| **≤560px** | Skills → 1 col. Hero chips wrap freely, smaller text. Section padding `pt-28 px-5`. |

**Key safeguards:**
- `html, body { overflow-x: hidden }` to defeat any tiny overflow.
- Long handles: `word-break: break-all` on `.contact__link__handle`.
- All grids: `gap`, not margins. Never absolute-positioned content cards.
- `text-wrap: balance` on headings, `pretty` on long paragraphs.
- Min hit-target: 44px on every clickable.

---

## 7. Performance strategy

| Concern | Approach |
|---|---|
| Scroll thrash | One rAF-coalesced `useScrollProgress` writes to `useState`; `StagePlate` is `memo` and short-circuits when opacity < 0.001. |
| Pointer move thrash | rAF-coalesced same way; throttle effectively 1 set per frame. |
| LCP | Preload all 4 plates via `<link rel="preload" as="image" fetchpriority="high">` for the first plate, lower for others. |
| Image weight | Serve each plate as both AVIF + WebP fallback. Vite plugin: `vite-imagetools`. Target ≤ 400KB AVIF per plate. |
| Reflow | All animated properties are `opacity` + `transform` + `filter`. Never `width`/`top`/`left`. |
| Backdrop-filter cost | Only on `.glass` cards (limited count). Test on low-end Android Chrome. |
| Font load | `display=swap`, preconnect to fonts.gstatic.com, optional self-host the subset for offline-safe rendering. |
| Reduced motion | `usePrefersReducedMotion` → freeze all scale animations, keep crossfade only. |

---

## 8. Asset requirements

| Path | Source | Notes |
|---|---|---|
| `public/images/galaxy.jpg` | Provided plate (no watermark) | OK as-is. |
| `public/images/earth-far.jpg` | **Replace** | Current plate has Adobe Stock watermark. License a clean version or use NASA Visible Earth (public domain). |
| `public/images/earth-horizon.jpg` | **Replace** | Same — Adobe Stock watermark visible. |
| `public/images/city.jpg` | Current plate is Manhattan | Replace with a Bangalore / Mysore-area cityscape to match the narrative, OR drop the location framing in copy. |
| Fonts | Google Fonts CDN OR self-host Outfit 200/300/400/500/600 latin subset | ~80KB if self-hosted. |

Each plate: deliver `1920w` and `3840w` widths via `<img srcset>` for the rare case you switch StagePlate to `<img>` instead of `background-image`. (Background-image doesn't honor `srcset` — if you want resolution-aware delivery, swap StagePlate to absolutely-positioned `<img class="object-cover" loading="eager">`.)

---

## 9. Exact content mapping

All copy below is final from the approved prototype — paste verbatim into `src/data/`.

### `profile.ts`
```ts
export const profile = {
  name: 'Akshay Srivathsa',
  role: 'Software Developer',
  subtitle: 'AI & Automation Enthusiast',
  location: 'Mysore, Karnataka, India',
  email: 'akshayrs337@gmail.com',
  linkedin: 'https://www.linkedin.com/in/akshay-srivathsa-1852161b3',
  github: 'https://github.com/AkshaySrivathsa',
  availability: 'Open · Full-time · 2026',
};
```

### Hero copy
- Eyebrow: **OPEN TO OPPORTUNITIES · 2026**
- Title: `Akshay` / `Srivathsa` (second line uses `.accent` gold gradient)
- Subtitle: *"Software developer with a focus on AI, automation and the small, stubborn problems that quietly make systems faster. Currently a final-year CSE · AI student at NIE, Mysore."*
- Chips: `Mysore · Karnataka · IN` · `AI & Automation` · `Python · ML · Selenium`
- CTAs: `View work` (primary) → #projects, `Get in touch` (ghost) → mailto

### `experience.ts`
```ts
export const experience = [
  {
    role: 'Freelance Developer',
    where: 'Dan Tayar · Remote',
    when: 'Oct 2022 – Feb 2023',
    bullets: [
      'Analyzed large datasets with 100k+ records to surface decision-grade signals.',
      'Trained predictive ML models reaching around 85% accuracy on held-out data.',
      'Built Python visualizations that turned model output into something a human could act on.',
      'Improved model performance through feature selection and pipeline cleanup.',
    ],
  },
  {
    role: 'Freelance Developer',
    where: 'Upwork · Remote',
    when: 'Nov 2021 – Jul 2022',
    bullets: [
      'Built Python and Selenium automation tools for repeatable browser workflows.',
      'Cut manual workload for clients and made slow processes measurably faster.',
      'Wrote deployment notes and monitoring docs so the work outlived the contract.',
      'Iterated on script reliability across changing target websites and edge cases.',
    ],
  },
];
```

### `projects.ts`
```ts
export const projects = [
  {
    tag: '001 · Data',
    altTag: 'Open Source',
    name: 'CoinMarketCap Scraper',
    description:
      'A Python scraper that collects cryptocurrency market data from CoinMarketCap and stores it in a clean, queryable shape — designed so the analysis layer never has to do the cleanup work.',
    stack: ['Python', 'Requests', 'BeautifulSoup', 'Pandas'],
    viz: 'crypto',
  },
  {
    tag: '002 · Automation',
    altTag: 'Tooling',
    name: 'Instagram Automation Bot',
    description:
      'A Selenium-driven browser automation that handles repetitive Instagram workflows reliably — the kind of small lever that adds up to real time saved across a week.',
    stack: ['Python', 'Selenium', 'ChromeDriver', 'Workflow'],
    viz: 'bot',
  },
];
```

### `skills.ts`
```ts
export const skills = [
  { name: 'Python',             category: 'Lang',       weight: 92 },
  { name: 'C / C++',            category: 'Lang',       weight: 72 },
  { name: 'SQL',                category: 'Data',       weight: 78 },
  { name: 'MongoDB',            category: 'Data',       weight: 70 },
  { name: 'Selenium',           category: 'Automation', weight: 88 },
  { name: 'Machine Learning',   category: 'AI',         weight: 80 },
  { name: 'Data Visualization', category: 'AI',         weight: 78 },
  { name: 'Git / GitHub',       category: 'Tooling',    weight: 84 },
  { name: 'DSA',                category: 'CS Core',    weight: 74 },
  { name: 'SDLC',               category: 'Process',    weight: 76 },
  { name: 'Automation',         category: 'Practice',   weight: 90 },
  { name: 'Problem Solving',    category: 'Practice',   weight: 86 },
];
```

### `education.ts`
```ts
export const education = [
  {
    years: '2022 — 2026',
    institution: 'The National Institute of Engineering',
    degree: 'BE in Computer Science Engineering & Artificial Intelligence',
    score: '7.5',
    scoreLabel: 'CGPA',
  },
  {
    years: '2020 — 2022',
    institution: 'Base PU College, Mysore',
    degree: '12th · Karnataka State Board',
    score: '91%',
    scoreLabel: 'Aggregate',
  },
  {
    years: '2015 — 2020',
    institution: 'Maharshi Public School, Mysore',
    degree: '10th · CBSE',
    score: '93.5%',
    scoreLabel: 'Aggregate',
  },
];
```

### About section
- Title: **Building things that** *think,* **decide, and quietly disappear.** (the word "think" gets gold gradient, no italic.)
- Lede: *"I'm Akshay — a Computer Science and AI student at The National Institute of Engineering. Most of what I make sits at the seam between data, automation, and decision-making: tools that take something tedious and make it boring in a useful way."*
- Three body paragraphs (verbatim from prototype): short version / longer version / right now.
- Profile panel stats: `2026 · Graduating`, `2 yrs · Freelance experience`, `14+ · Core skills`, `100k+ · Records analyzed`.
- Profile rows: Location · Degree · Institution · Focus · Availability.

### Contact section
- Heading: **Want to build something** *quietly impressive*?
- Body: *"I'm looking for full-time software roles where I can do AI, automation, and the unglamorous engineering that makes both actually work. If that sounds like your team, the inbox is open."*
- Email button → `mailto:akshayrs337@gmail.com`
- Two link cards: LinkedIn, GitHub.

---

## 10. Validation commands

```bash
# Type-check
pnpm tsc --noEmit

# Lint
pnpm eslint src --ext .ts,.tsx

# Dev server (verify the journey)
pnpm dev
#  └─ scroll through and confirm: galaxy visible at 0%, earth-far at ~30%, horizon at ~65%, city solid from ~85%

# Production build (catches dead code + asset issues)
pnpm build && pnpm preview

# Lighthouse — aim for these on a wired connection
#   Performance ≥ 85, Accessibility ≥ 95, Best Practices = 100, SEO ≥ 95, LCP < 2.5s
pnpm dlx @lhci/cli autorun --collect.url=http://localhost:4173

# Responsive sanity check — open in DevTools at:
#   320px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1024px, 1440px, 1920px
#   Verify: no horizontal scroll, no text clipping, glass cards readable on each.

# Reduced-motion check
#   Toggle prefers-reduced-motion in DevTools Rendering panel.
#   Stage scale should freeze; crossfade still works.
```

---

## Notes & gotchas

- **Privacy rule respected throughout** — no mention of any private project, trading, broker, MT5, or related terms anywhere in code, data, or copy. Audit `data/projects.ts` and `data/experience.ts` for nothing but the two freelance items and two public projects listed above.
- **Mysore vs Bangalore** — current narrative places Akshay in Mysore but uses a generic city skyline. Decide: either source a Bangalore/Mysore cityscape image, or change `SectionMeta` "here" tags for Skills/Education/Contact to drop the city name.
- **R3F is kept installed** but unreferenced. Strip it from the bundle by removing from `package.json` if you confirm you don't need it; saves ~150KB gzipped.
- **Framer Motion** is used only for `Reveal` (entry transitions). If `motion/react` feels heavy for that one use, replace with a 6-line IntersectionObserver hook + CSS class swap — there's a pure-CSS version in the prototype.
