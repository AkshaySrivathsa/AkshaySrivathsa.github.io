/* global React, ReactDOM, Cosmos */
const { useEffect, useRef, useState } = React;

const SECTIONS = [
{ id: 'hero', label: 'Origin' },
{ id: 'about', label: 'About' },
{ id: 'experience', label: 'Experience' },
{ id: 'projects', label: 'Projects' },
{ id: 'skills', label: 'Skills' },
{ id: 'education', label: 'Education' },
{ id: 'contact', label: 'Contact' }];


/* tiny icon set */
const Icon = {
  pin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13z" /><circle cx="12" cy="9" r="2.4" /></svg>,
  spark: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2" /></svg>,
  code: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  arrow: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  mail: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  linkedin: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.6v1.7h.05c.5-.9 1.7-1.9 3.5-1.9 3.7 0 4.4 2.4 4.4 5.6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4z" /></svg>,
  github: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.04 1.53 1.04.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z" /></svg>
};

/* ============================================================
   POINTER PARALLAX
   ============================================================ */
function usePointer() {
  const [p, setP] = useState({ x: 0, y: 0 });
  useEffect(() => {
    let raf;
    function onMove(e) {
      const x = e.clientX / window.innerWidth * 2 - 1;
      const y = e.clientY / window.innerHeight * 2 - 1;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setP({ x, y }));
    }
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

/* ============================================================
   SCROLL PROGRESS (0..1 across the whole page)
   ============================================================ */
function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf;
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY || window.pageYOffset || 0;
      const prog = max > 0 ? y / max : 0;
      setP(prog);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

/* ============================================================
   ACTIVE SECTION
   ============================================================ */
function useActiveSection() {
  const [active, setActive] = useState('hero');
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.
        filter((e) => e.isIntersecting).
        sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { threshold: [0.25, 0.5, 0.75], rootMargin: '-15% 0px -25% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/* ============================================================
   REVEAL ON SCROLL
   ============================================================ */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible');
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ============================================================
   PAGE
   ============================================================ */
function App() {
  const { x: mx, y: my } = usePointer();
  const progress = useScrollProgress();
  const active = useActiveSection();
  useReveal();

  return (
    <>
      <Cosmos progress={progress} mx={mx} my={my} />
      <Nav active={active} />
      <ProgressRail active={active} />

      <main className="page">
        <Hero mx={mx} my={my} />
        <About />
        <Experience />
        <Projects />
        <Skills />
        <Education />
        <Contact />
        <Footer />
      </main>
    </>);

}

/* ============================================================
   NAV
   ============================================================ */
function Nav({ active }) {
  return (
    <nav className="nav">
      <div className="nav__brand">
        <span className="mono-dot" />
        <b>AKSHAY</b> SRIVATHSA
      </div>
      <div className="nav__items">
        {SECTIONS.slice(1).map((s) =>
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`nav__link ${active === s.id ? 'is-active' : ''}`}>
          
            {s.label}
          </a>
        )}
      </div>
    </nav>);

}

function ProgressRail({ active }) {
  return (
    <div className="progress">
      {SECTIONS.map((s, i) =>
      <button
        key={s.id}
        className={active === s.id ? 'is-active' : ''}
        onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}>
        
          <span className="lbl">{String(i + 1).padStart(2, '0')} · {s.label}</span>
          <span className="pip" />
        </button>
      )}
    </div>);

}

/* ============================================================
   HERO
   ============================================================ */
function Hero({ mx, my }) {
  return (
    <section className="hero" id="hero" data-screen-label="01 Hero">
      <div className="hero__inner parallax" style={{ '--mx': mx, '--my': my, '--strength': '-10px' }}>
        <div className="hero__eyebrow">
          <span className="live" />
          OPEN TO OPPORTUNITIES · 2026
        </div>

        <h1 className="hero__title">
          Akshay<br />
          <span className="accent">Srivathsa</span>
        </h1>

        <p className="hero__subtitle">
          Software developer with a focus on AI, automation and the small,
          stubborn problems that quietly make systems faster.
          Currently a final-year CSE&nbsp;·&nbsp;AI student at NIE, Mysore.
        </p>

        <div className="hero__chips">
          <span className="hero__chip"><Icon.pin /> Mysore · Karnataka · IN</span>
          <span className="hero__chip"><Icon.spark /> AI &amp; Automation</span>
          <span className="hero__chip"><Icon.code /> Python · ML · Selenium</span>
        </div>

        <div className="hero__cta">
          <a className="btn btn--primary" href="#projects">View work <Icon.arrow /></a>
          <a className="btn btn--ghost" href="mailto:akshayrs337@gmail.com"><Icon.mail /> Get in touch</a>
        </div>
      </div>

      <div className="hero__hud-left">
        <span><b>SECTOR</b>MILKY WAY · ORION ARM</span>
        <span><b>STATUS</b>TRANSMITTING</span>
      </div>
      <div className="hero__hud">
        <span><b>RA</b>17h 45m 40s</span>
        <span><b>DEC</b>−29° 00′ 28″</span>
        <span><b>FRAME</b>2026.05.23</span>
      </div>

      <div className="hero__scroll">
        SCROLL
        <span className="line" />
      </div>
    </section>);

}

/* ============================================================
   SECTION SHELL (with reading scrim)
   ============================================================ */
function Section({ id, label, num, here, children }) {
  return (
    <section className="section" id={id} data-screen-label={label}>
      <div className="scrim" />
      <div className="section__wrap reveal">
        {children}
      </div>
    </section>);

}

function SectionMeta({ num, name, here }) {
  return (
    <div className="section__meta">
      <span className="dot" />
      <span className="num">{num}</span> · {name}
      <span className="rule" />
      <span className="here">{here}</span>
    </div>);

}

/* ============================================================
   ABOUT
   ============================================================ */
function About() {
  return (
    <Section id="about" label="02 About">
      <SectionMeta num="01" name="About" here="System: Sol · Planet: Earth" />

      <h2 className="section__title">
        Building things that <em>think,</em><br />
        decide, and quietly disappear.
      </h2>
      <p className="section__lede">
        I'm Akshay — a Computer Science and AI student at The National Institute of
        Engineering. Most of what I make sits at the seam between data, automation,
        and decision-making: tools that take something tedious and make it boring
        in a useful way.
      </p>

      <div className="about__layout">
        <div className="about__copy">
          <p>
            <strong>The short version.</strong> I work in Python every day. I write
            ML pipelines, scrape and clean datasets, build automation scripts,
            and ship the small full-stack pieces that hold a project together.
          </p>
          <p>
            <strong>The longer version.</strong> I like the moment a script turns
            into a system — when a one-off becomes a routine, a routine becomes
            a model, and a model starts being trusted by someone who isn't me.
            That gap, between a script you wrote at 2am and a thing other people
            rely on, is where I want to live.
          </p>
          <p>
            <strong>Right now.</strong> Finishing a BE in CSE-AI, sharpening data
            structures and systems fundamentals, and looking for the first full-time
            role where I can do this work with people I learn from.
          </p>
        </div>

        <div className="about__panel glass">
          <h4>Profile</h4>
          <div className="about__stats">
            <div className="about__stat">
              <div className="v">2026</div>
              <div className="l">Graduating</div>
            </div>
            <div className="about__stat">
              <div className="v">2 yrs</div>
              <div className="l">Freelance experience</div>
            </div>
            <div className="about__stat">
              <div className="v">14+</div>
              <div className="l">Core skills</div>
            </div>
            <div className="about__stat">
              <div className="v">100k+</div>
              <div className="l">Records analyzed</div>
            </div>
          </div>
          <div className="about__row"><span>Location</span><span>Mysore, IN</span></div>
          <div className="about__row"><span>Degree</span><span>BE · CSE &amp; AI</span></div>
          <div className="about__row"><span>Institution</span><span>NIE Mysore</span></div>
          <div className="about__row"><span>Focus</span><span>AI · Automation</span></div>
          <div className="about__row"><span>Availability</span><span style={{ color: '#6ee79b' }}>Open · Full-time</span></div>
        </div>
      </div>
    </Section>);

}

/* ============================================================
   EXPERIENCE
   ============================================================ */
const EXPERIENCE = [
{
  role: 'Freelance Developer',
  where: 'Dan Tayar · Remote',
  when: 'Oct 2022 – Feb 2023',
  bullets: [
  'Analyzed large datasets with 100k+ records to surface decision-grade signals.',
  'Trained predictive ML models reaching around 85% accuracy on held-out data.',
  'Built Python visualizations that turned model output into something a human could act on.',
  'Improved model performance through feature selection and pipeline cleanup.']

},
{
  role: 'Freelance Developer',
  where: 'Upwork · Remote',
  when: 'Nov 2021 – Jul 2022',
  bullets: [
  'Built Python and Selenium automation tools for repeatable browser workflows.',
  'Cut manual workload for clients and made slow processes measurably faster.',
  'Wrote deployment notes and monitoring docs so the work outlived the contract.',
  'Iterated on script reliability across changing target websites and edge cases.']

}];


function Experience() {
  return (
    <Section id="experience" label="03 Experience">
      <SectionMeta num="02" name="Experience" here="Earth · Approach trajectory" />

      <h2 className="section__title">
        A short, <em>useful</em> trail<br />
        of shipped work.
      </h2>
      <p className="section__lede">
        Two freelance engagements where the brief was always the same:
        take something slow or unclear, and make it fast and obvious.
      </p>

      <div className="timeline">
        {EXPERIENCE.map((e, i) =>
        <div className="tl-item" key={i}>
            <div className="tl-item__head">
              <div className="tl-item__role">{e.role}</div>
              <div className="tl-item__when">{e.when}</div>
            </div>
            <div className="tl-item__where">{e.where}</div>
            <ul className="tl-item__bullets">
              {e.bullets.map((b, j) =>
            <li key={j}>{b}</li>
            )}
            </ul>
          </div>
        )}
      </div>
    </Section>);

}

/* ============================================================
   PROJECTS
   ============================================================ */
function Projects() {
  return (
    <Section id="projects" label="04 Projects">
      <SectionMeta num="03" name="Projects" here="Selected · Public" />

      <h2 className="section__title">
        Things I built<br />
        to <em>understand</em> something.
      </h2>
      <p className="section__lede">
        Side projects are how I learn. Each one started as a question and
        ended as a small piece of software I still reach for.
      </p>

      <div className="projects">
        <article className="project glass glass--interactive">
          <div className="project__visual viz-crypto">
            <CryptoViz />
          </div>
          <div className="project__body">
            <div className="project__head">
              <span className="project__tag">001 · Data</span>
              <span className="project__tag project__tag--alt">Open Source</span>
            </div>
            <h3 className="project__name">CoinMarketCap Scraper</h3>
            <p className="project__desc">
              A Python scraper that collects cryptocurrency market data from
              CoinMarketCap and stores it in a clean, queryable shape — designed
              so the analysis layer never has to do the cleanup work.
            </p>
            <div className="project__stack">
              <span>Python</span><span>Requests</span><span>BeautifulSoup</span><span>Pandas</span>
            </div>
          </div>
        </article>

        <article className="project glass glass--interactive">
          <div className="project__visual viz-bot">
            <BotViz />
          </div>
          <div className="project__body">
            <div className="project__head">
              <span className="project__tag">002 · Automation</span>
              <span className="project__tag project__tag--alt">Tooling</span>
            </div>
            <h3 className="project__name">Instagram Automation Bot</h3>
            <p className="project__desc">
              A Selenium-driven browser automation that handles repetitive
              Instagram workflows reliably — the kind of small lever that adds
              up to real time saved across a week.
            </p>
            <div className="project__stack">
              <span>Python</span><span>Selenium</span><span>ChromeDriver</span><span>Workflow</span>
            </div>
          </div>
        </article>
      </div>
    </Section>);

}

function CryptoViz() {
  return (
    <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240,210,138,0.40)" />
          <stop offset="100%" stopColor="rgba(240,210,138,0)" />
        </linearGradient>
      </defs>
      <path
        d="M0,160 L40,150 L80,165 L120,130 L160,145 L200,108 L240,126 L280,90 L320,103 L360,68 L400,82 L440,55 L480,75 L520,45 L560,60 L600,32 L600,220 L0,220 Z"
        fill="url(#cf)" />
      
      <path
        d="M0,160 L40,150 L80,165 L120,130 L160,145 L200,108 L240,126 L280,90 L320,103 L360,68 L400,82 L440,55 L480,75 L520,45 L560,60 L600,32"
        fill="none" stroke="#f0d28a" strokeWidth="1.5" />
      
      {[60, 140, 220, 300, 380, 460, 540].map((cx, i) => {
        const up = i % 2 === 0;
        return (
          <g key={i} opacity="0.78">
            <line x1={cx} y1={75 + i * 4} x2={cx} y2={180 - i * 6} stroke={up ? '#6fd9ff' : '#8b6dff'} strokeWidth="1" />
            <rect x={cx - 3} y={108 + i % 3 * 8} width="6" height={20 + i % 3 * 4} fill={up ? '#6fd9ff' : '#8b6dff'} opacity="0.85" />
          </g>);

      })}
      <text x="14" y="24" fontFamily="JetBrains Mono" fontSize="9" fill="#b3b9d0" letterSpacing="2">BTC · 7D · USD</text>
      <text x="540" y="24" fontFamily="JetBrains Mono" fontSize="9" fill="#f0d28a" letterSpacing="1">↑ +12.4%</text>
    </svg>);

}

function BotViz() {
  return (
    <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <g stroke="rgba(155,227,255,0.4)" strokeWidth="1" fill="none">
        <line x1="60" y1="110" x2="180" y2="70" />
        <line x1="60" y1="110" x2="180" y2="150" />
        <line x1="180" y1="70" x2="300" y2="70" />
        <line x1="180" y1="70" x2="300" y2="110" />
        <line x1="180" y1="150" x2="300" y2="150" />
        <line x1="180" y1="150" x2="300" y2="110" />
        <line x1="300" y1="70" x2="420" y2="90" />
        <line x1="300" y1="110" x2="420" y2="110" />
        <line x1="300" y1="150" x2="420" y2="130" />
        <line x1="420" y1="90" x2="540" y2="110" />
        <line x1="420" y1="110" x2="540" y2="110" />
        <line x1="420" y1="130" x2="540" y2="110" />
      </g>
      {[
      [60, 110, 'TRIGGER', '#f0d28a'],
      [180, 70, 'LOGIN', '#6fd9ff'],
      [180, 150, 'COOKIE', '#6fd9ff'],
      [300, 70, 'NAV', '#8b6dff'],
      [300, 110, 'WAIT', '#8b6dff'],
      [300, 150, 'PARSE', '#8b6dff'],
      [420, 90, 'ACT', '#6fd9ff'],
      [420, 110, 'LOG', '#6fd9ff'],
      [420, 130, 'RETRY', '#6fd9ff'],
      [540, 110, 'DONE', '#6ee79b']].
      map(([x, y, l, c], i) =>
      <g key={i}>
          <circle cx={x} cy={y} r="14" fill="rgba(255,255,255,0.04)" stroke={c} strokeWidth="1" />
          <circle cx={x} cy={y} r="3" fill={c} opacity="0.9">
            <animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + i % 4 * 0.5}s`} repeatCount="indefinite" />
          </circle>
          <text x={x} y={y + 28} fontFamily="JetBrains Mono" fontSize="8" fill="#b3b9d0" textAnchor="middle" letterSpacing="1">{l}</text>
        </g>
      )}
      <text x="14" y="24" fontFamily="JetBrains Mono" fontSize="9" fill="#b3b9d0" letterSpacing="2">WORKFLOW · SELENIUM</text>
    </svg>);

}

/* ============================================================
   SKILLS
   ============================================================ */
const SKILLS = [
{ n: 'Python', c: 'Lang', w: 92 },
{ n: 'C / C++', c: 'Lang', w: 72 },
{ n: 'SQL', c: 'Data', w: 78 },
{ n: 'MongoDB', c: 'Data', w: 70 },
{ n: 'Selenium', c: 'Automation', w: 88 },
{ n: 'Machine Learning', c: 'AI', w: 80 },
{ n: 'Data Visualization', c: 'AI', w: 78 },
{ n: 'Git / GitHub', c: 'Tooling', w: 84 },
{ n: 'DSA', c: 'CS Core', w: 74 },
{ n: 'SDLC', c: 'Process', w: 76 },
{ n: 'Automation', c: 'Practice', w: 90 },
{ n: 'Problem Solving', c: 'Practice', w: 86 }];


function Skills() {
  return (
    <Section id="skills" label="05 Skills">
      <SectionMeta num="04" name="Skills" here="Toolkit · Current" />

      <h2 className="section__title">
        What I reach for<br />
        when something <em>needs</em> shipping.
      </h2>
      <p className="section__lede">
        The honest version of a skills list: things I use regularly,
        things I'm comfortable with, and the CS fundamentals underneath both.
      </p>

      <div className="skills">
        {SKILLS.map((s) =>
        <div key={s.n} className="skill glass">
            <div className="skill__head">
              <div className="skill__name">{s.n}</div>
              <div className="skill__cat">{s.c}</div>
            </div>
            <div className="skill__bar" style={{ '--w': `${s.w}%` }} />
          </div>
        )}
      </div>
    </Section>);

}

/* ============================================================
   EDUCATION
   ============================================================ */
const EDU = [
{
  years: '2022 — 2026',
  inst: 'The National Institute of Engineering',
  deg: 'BE in Computer Science Engineering & Artificial Intelligence',
  score: '7.5',
  label: 'CGPA'
},
{
  years: '2020 — 2022',
  inst: 'Base PU College, Mysore',
  deg: '12th · Karnataka State Board',
  score: '91%',
  label: 'Aggregate'
},
{
  years: '2015 — 2020',
  inst: 'Maharshi Public School, Mysore',
  deg: '10th · CBSE',
  score: '93.5%',
  label: 'Aggregate'
}];


function Education() {
  return (
    <Section id="education" label="06 Education">
      <SectionMeta num="05" name="Education" here="Mysore · Karnataka" />

      <h2 className="section__title">
        A decade of <em>school</em><br />
        that ends in a thesis.
      </h2>
      <p className="section__lede">
        The institutions and scores that brought me here, plus the
        working assumption that the most important learning is still ahead.
      </p>

      <div className="education">
        {EDU.map((e, i) =>
        <div key={i} className="edu glass">
            <div className="edu__years">{e.years}</div>
            <div className="edu__inst">{e.inst}</div>
            <div className="edu__deg">{e.deg}</div>
            <div className="edu__score">
              <b>{e.score}</b>
              <span>{e.label}</span>
            </div>
          </div>
        )}
      </div>
    </Section>);

}

/* ============================================================
   CONTACT
   ============================================================ */
function Contact() {
  return (
    <Section id="contact" label="07 Contact">
      <SectionMeta num="06" name="Contact" here="Skyline · Bangalore / Mysore" />

      <div className="contact">
        <div className="contact__panel glass">
          <h3>Want to build something<br /><em>quietly impressive</em>?</h3>
          <p style={{ color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.7, maxWidth: 520 }}>
            I'm looking for full-time software roles where I can do AI, automation,
            and the unglamorous engineering that makes both actually work. If that
            sounds like your team, the inbox is open.
          </p>

          <a className="contact__email" href="mailto:akshayrs337@gmail.com">
            <Icon.mail />
            akshayrs337@gmail.com
          </a>

          <div className="contact__links">
            <a className="contact__link" href="https://www.linkedin.com/in/akshay-srivathsa-1852161b3" target="_blank" rel="noreferrer">
              <div className="contact__link__l">
                <Icon.linkedin />
                <div>
                  <div className="contact__link__name">LinkedIn</div>
                  <div className="contact__link__handle">/in/akshay-srivathsa-1852161b3</div>
                </div>
              </div>
              <span className="contact__link__arrow">↗</span>
            </a>
            <a className="contact__link" href="https://github.com/AkshaySrivathsa" target="_blank" rel="noreferrer">
              <div className="contact__link__l">
                <Icon.github />
                <div>
                  <div className="contact__link__name">GitHub</div>
                  <div className="contact__link__handle">@AkshaySrivathsa</div>
                </div>
              </div>
              <span className="contact__link__arrow">↗</span>
            </a>
          </div>
        </div>

        <div className="contact__card glass">
          <div>
            <div className="contact__avatar">AS</div>
            <h4>Akshay Srivathsa</h4>
            <p>Software Developer · AI &amp; Automation Enthusiast<br />Mysore, Karnataka · India</p>
            <span className="availability">Available · Full-time · 2026</span>
          </div>

          <div style={{ marginTop: 28, borderTop: '1px solid var(--hairline)', paddingTop: 20, display: 'grid', gap: 10, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-faint)', letterSpacing: '0.12em' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>LOCAL TIME</span><LocalTime />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>TIMEZONE</span><span style={{ color: 'var(--ink-dim)' }}>IST · UTC+5:30</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>RESPONSE</span><span style={{ color: 'var(--ink-dim)' }}>~24 HOURS</span>
            </div>
          </div>
        </div>
      </div>
    </Section>);

}

function LocalTime() {
  const [t, setT] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const ist = new Date(utc + 5.5 * 3600000);
      const hh = String(ist.getHours()).padStart(2, '0');
      const mm = String(ist.getMinutes()).padStart(2, '0');
      const ss = String(ist.getSeconds()).padStart(2, '0');
      setT(`${hh}:${mm}:${ss}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: 'var(--cyan)' }}>{t}</span>;
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="sig">© 2026 · AKSHAY SRIVATHSA</div>
        <div>END OF TRANSMISSION · THANK YOU FOR SCROLLING</div>
        <div>BUILT WITH · REACT · CSS · ☉</div>
      </div>
    </footer>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);