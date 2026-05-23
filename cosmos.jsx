/* global React */
const { useMemo } = React;

const clamp  = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const lerp   = (a, b, t) => a + (b - a) * t;
const ramp   = (p, from, to) => clamp((p - from) / (to - from), 0, 1);
const smooth = (t) => t * t * (3 - 2 * t);

/* ============================================================
   Stage plates — full-bleed 4K reference images with continuous
   zoom + smooth crossfade. Each plate keeps scaling while it's
   visible so the eye reads it as ONE continuous flight, not a
   slideshow.
   ============================================================ */
const STAGES = [
  {
    img: 'images/galaxy.jpg',
    pos: '50% 48%',
    // Visibility window — already fully visible at p=0
    inS: -0.05, inE: 0.00,
    outS: 0.22, outE: 0.34,
    // Scale runs from start of fade-in to end of fade-out
    scaleS: 1.00, scaleE: 2.40,
    // Color cast filter values
    filter: 'brightness(1.0) saturate(1.05)',
  },
  {
    img: 'images/earth-far.jpg',
    pos: '50% 50%',
    inS: 0.22, inE: 0.36,
    outS: 0.50, outE: 0.62,
    scaleS: 0.86, scaleE: 1.85,
    filter: 'brightness(1.0) saturate(1.05) contrast(1.04)',
  },
  {
    img: 'images/earth-horizon.jpg',
    pos: '50% 55%',
    inS: 0.50, inE: 0.64,
    outS: 0.76, outE: 0.86,
    scaleS: 0.90, scaleE: 1.70,
    filter: 'brightness(1.05) saturate(1.05) contrast(1.05)',
  },
  {
    img: 'images/city.jpg',
    pos: '50% 50%',
    inS: 0.74, inE: 0.84,
    outS: 1.50, outE: 2.00, // sticks for the rest of the page
    scaleS: 0.92, scaleE: 1.45,
    filter: 'brightness(0.92) saturate(1.05) contrast(1.05)',
  },
];

function Cosmos({ progress, mx, my }) {
  // Pointer parallax — subtle, max 14px movement
  const parX = mx * 14;
  const parY = my * 14;

  return (
    <div className="cosmos">
      {STAGES.map((s, i) => {
        const inOp  = smooth(ramp(progress, s.inS, s.inE));
        const outOp = smooth(ramp(progress, s.outS, s.outE));
        const opacity = inOp * (1 - outOp);

        // Scale t: spans full lifecycle of this stage
        const t = clamp((progress - s.inS) / (s.outE - s.inS), 0, 1);
        const scale = lerp(s.scaleS, s.scaleE, smooth(t));

        // skip render if essentially invisible (perf)
        if (opacity < 0.001) {
          return <div key={i} className="cosmos-stage" style={{ opacity: 0 }} />;
        }

        return (
          <div
            key={i}
            className="cosmos-stage"
            style={{
              backgroundImage: `url("${s.img}")`,
              backgroundPosition: s.pos,
              opacity,
              transform: `translate3d(${parX}px, ${parY}px, 0) scale(${scale})`,
              filter: s.filter,
              zIndex: i + 1,
            }}
          />
        );
      })}

      {/* Soft vignette unifies all stages */}
      <div className="cosmos-vignette" />
      {/* Slight darkening for content readability */}
      <div className="cosmos-readscrim" />
    </div>
  );
}

window.Cosmos = Cosmos;
