import { waxColors } from "../catalog";
import { type Hex, luminance, mix } from "../color";
import type { Accessory } from "../schema";
import { seededRandom, seedOf } from "./grain";
import { lightX, lightY } from "./materials";
import { fontStack, type ResolvedAsset } from "./shared";

type WaxSealSpec = Extract<Accessory, { kind: "wax-seal" }>;

/**
 * How far the wax reaches at evenly spaced angles round the seal, as
 * fractions of its radius: a pool of poured wax, never a perfect circle, with
 * a few places where it ran a little further. The same seal is always the
 * same shape.
 */
export function sealReach(id: string, count = 40): number[] {
  const random = seededRandom(seedOf(id));
  const waves = [2, 3, 4, 5, 7].map((k) => ({
    k,
    amount: (0.004 + random() * 0.012) * (k < 4 ? 1.4 : 1),
    phase: random() * Math.PI * 2,
  }));
  const runs = Array.from({ length: 3 }, () => ({
    at: random() * Math.PI * 2,
    width: 0.22 + random() * 0.3,
    amount: 0.018 + random() * 0.032,
  }));
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    let reach = 1;
    for (const wave of waves)
      reach += wave.amount * Math.sin(wave.k * angle + wave.phase);
    for (const run of runs) {
      const apart = Math.atan2(
        Math.sin(angle - run.at),
        Math.cos(angle - run.at),
      );
      reach += run.amount * Math.exp(-((apart / run.width) ** 2));
    }
    return Math.min(1.1, Math.max(0.9, reach));
  });
}

/** The seal's edge as a smooth closed path round its centre. */
export function sealOutline(id: string, radius: number): string {
  const reach = sealReach(id);
  const points = reach.map((r, i) => {
    const angle = (i / reach.length) * Math.PI * 2;
    return [Math.cos(angle) * r * radius, Math.sin(angle) * r * radius];
  });
  const point = (i: number) =>
    points[(i + points.length) % points.length] as number[];
  const f = (n: number) => n.toFixed(2);
  // Catmull-Rom through the points, as cubic Béziers.
  const parts = [`M${f(point(0)[0] ?? 0)} ${f(point(0)[1] ?? 0)}`];
  for (let i = 0; i < points.length; i++) {
    const [x0 = 0, y0 = 0] = point(i - 1);
    const [x1 = 0, y1 = 0] = point(i);
    const [x2 = 0, y2 = 0] = point(i + 1);
    const [x3 = 0, y3 = 0] = point(i + 2);
    parts.push(
      `C${f(x1 + (x2 - x0) / 6)} ${f(y1 + (y2 - y0) / 6)} ${f(x2 - (x3 - x1) / 6)} ${f(y2 - (y3 - y1) / 6)} ${f(x2)} ${f(y2)}`,
    );
  }
  return `${parts.join("")}Z`;
}

/**
 * A wax seal as it looks pressed on paper: a domed pool of wax, its rim
 * catching the light, the stamp's well sunk into it with the initials or
 * motif standing up in relief, and its shadow on the paper. Its moving glint
 * is drawn apart, by SealGlint.
 */
export function LifelikeWaxSeal({
  seal,
  prefix,
  initials,
  motif,
}: {
  seal: WaxSealSpec;
  prefix: string;
  initials: string;
  motif?: ResolvedAsset;
}) {
  const r = seal.diameter / 2;
  const wax = waxColors[seal.color].color as Hex;
  // Pale wax shades towards warm brown, not grey; dark wax shows its gloss.
  const pale = luminance(wax) > 0.45;
  const shadow: Hex = pale ? "#6b5a45" : "#000000";
  const lit = mix(wax, "#ffffff", pale ? 0.5 : 0.3);
  const dim = mix(wax, shadow, pale ? 0.28 : 0.3);
  const deep = mix(wax, shadow, pale ? 0.45 : 0.55);
  const well = r * 0.66;
  const id = (name: string) => `${prefix}-seal-${seal.id}-${name}`;
  const outline = sealOutline(seal.id, r);
  const size = r * (initials.length > 3 ? 0.42 : 0.6);
  return (
    <g transform={`translate(${seal.x} ${seal.y})`}>
      <filter
        id={id("shadow")}
        filterUnits="userSpaceOnUse"
        x={-r * 1.4}
        y={-r * 1.4}
        width={r * 3}
        height={r * 3.1}
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation={r * 0.09} />
        <feOffset dx={r * 0.06} dy={r * 0.12} result="key" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.3" />
        <feOffset dx="0.15" dy="0.35" result="contact" />
        <feMerge result="shadow">
          <feMergeNode in="key" />
          <feMergeNode in="contact" />
        </feMerge>
        <feComponentTransfer in="shadow" result="soft">
          <feFuncA type="linear" slope="0.45" />
        </feComponentTransfer>
        <feFlood floodColor="#1f1810" />
        <feComposite in2="soft" operator="in" />
      </filter>
      <radialGradient id={id("dome")} cx="0.36" cy="0.32" r="0.78">
        <stop offset="0" stopColor={lit} />
        <stop offset="0.42" stopColor={wax} />
        <stop offset="0.82" stopColor={dim} />
        <stop offset="1" stopColor={deep} />
      </radialGradient>
      <radialGradient id={id("well")} cx="0.62" cy="0.66" r="0.78">
        <stop offset="0" stopColor={mix(wax, "#ffffff", 0.1)} />
        <stop offset="0.6" stopColor={wax} />
        <stop offset="1" stopColor={dim} />
      </radialGradient>
      {/* The well's wall: in shade at the top left, lit at the bottom right. */}
      <linearGradient id={id("wall")} x1="0.15" y1="0.15" x2="0.85" y2="0.85">
        <stop offset="0" stopColor={deep} stopOpacity="0.85" />
        <stop offset="0.5" stopColor={wax} stopOpacity="0" />
        <stop offset="1" stopColor={lit} stopOpacity="0.75" />
      </linearGradient>
      {/* The rim round the well: lit at the top left, shaded below. */}
      <linearGradient id={id("rim")} x1="0.1" y1="0.1" x2="0.9" y2="0.9">
        <stop offset="0" stopColor="#ffffff" stopOpacity={pale ? 0.5 : 0.4} />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.6" stopColor={shadow} stopOpacity="0" />
        <stop offset="1" stopColor={shadow} stopOpacity="0.3" />
      </linearGradient>

      <path d={outline} filter={`url(#${id("shadow")})`} />
      <path d={outline} fill={`url(#${id("dome")})`} />
      {/* Ripples where the wax spread and set. */}
      <path
        d={outline}
        transform="scale(0.9)"
        fill="none"
        stroke={lit}
        strokeOpacity={0.22}
        strokeWidth={0.3}
      />
      <path
        d={outline}
        transform="scale(0.94) rotate(9)"
        fill="none"
        stroke={deep}
        strokeOpacity={0.14}
        strokeWidth={0.25}
      />
      <circle
        r={well + r * 0.05}
        fill="none"
        stroke={`url(#${id("rim")})`}
        strokeWidth={r * 0.1}
      />
      <circle r={well} fill={`url(#${id("well")})`} />
      <circle
        r={well - r * 0.03}
        fill="none"
        stroke={`url(#${id("wall")})`}
        strokeWidth={r * 0.07}
      />
      {motif ? (
        <MotifRelief
          id={id("motif")}
          url={motif.url}
          size={well * 1.4}
          wax={wax}
          lit={lit}
          deep={deep}
        />
      ) : initials ? (
        <g
          fontFamily={fontStack("Cormorant Garamond")}
          fontStyle="italic"
          fontWeight={600}
          fontSize={size}
          textAnchor="middle"
          dominantBaseline="central"
        >
          <text x={size * 0.03} y={size * 0.04} fill={deep} opacity={0.75}>
            {initials}
          </text>
          <text x={-size * 0.022} y={-size * 0.025} fill={lit} opacity={0.8}>
            {initials}
          </text>
          <text fill={mix(wax, "#ffffff", 0.06)}>{initials}</text>
        </g>
      ) : null}
    </g>
  );
}

/**
 * Where a seal's glossy wax catches the light: a long glint on its dome and
 * a small one low on its rim, shifting as the light moves.
 */
export function SealGlint({
  seal,
  prefix,
}: {
  seal: WaxSealSpec;
  prefix: string;
}) {
  const r = seal.diameter / 2;
  const pale = luminance(waxColors[seal.color].color as Hex) > 0.45;
  const id = `${prefix}-seal-${seal.id}-glint`;
  const follow = (amount: number) => ({
    transform: `translate(calc(var(${lightX}, 0) * ${amount}px), calc(var(${lightY}, 0) * ${amount}px))`,
    transition: "transform 0.4s ease-out",
  });
  return (
    <g transform={`translate(${seal.x} ${seal.y})`}>
      <radialGradient id={id}>
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${id}-wax`}>
        <path d={sealOutline(seal.id, r)} />
      </clipPath>
      <g clipPath={`url(#${id}-wax)`}>
        <ellipse
          cx={-r * 0.5}
          cy={-r * 0.52}
          rx={r * 0.3}
          ry={r * 0.11}
          transform={`rotate(-42 ${-r * 0.5} ${-r * 0.52})`}
          fill={`url(#${id})`}
          opacity={pale ? 0.45 : 0.6}
          style={follow(r * 0.08)}
        />
        <circle
          cx={r * 0.3}
          cy={r * 0.62}
          r={r * 0.05}
          fill={`url(#${id})`}
          opacity={0.35}
          style={follow(r * 0.05)}
        />
      </g>
    </g>
  );
}

/** A motif from the stamp, standing up from the well. */
function MotifRelief({
  id,
  url,
  size,
  wax,
  lit,
  deep,
}: {
  id: string;
  url: string;
  size: number;
  wax: Hex;
  lit: Hex;
  deep: Hex;
}) {
  const box = { x: -size / 2, y: -size / 2, width: size, height: size };
  return (
    <g>
      <mask id={id} style={{ maskType: "alpha" }}>
        <image href={url} {...box} preserveAspectRatio="xMidYMid meet" />
      </mask>
      <g transform="translate(0.2 0.24)" opacity={0.7}>
        <rect {...box} fill={deep} mask={`url(#${id})`} />
      </g>
      <g transform="translate(-0.16 -0.18)" opacity={0.8}>
        <rect {...box} fill={lit} mask={`url(#${id})`} />
      </g>
      <rect {...box} fill={mix(wax, "#ffffff", 0.06)} mask={`url(#${id})`} />
    </g>
  );
}
