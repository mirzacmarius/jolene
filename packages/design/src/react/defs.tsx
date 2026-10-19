import { foilShades, type Ink, type PaperTexture } from "../catalog";

/** Ids of the shared definitions, scoped to one <svg> by `prefix`. */
export const defIds = (prefix: string) => ({
  ink: (ink: Ink) => `${prefix}-${ink}`,
  texture: (texture: PaperTexture) => `${prefix}-paper-${texture}`,
  emboss: `${prefix}-emboss`,
  deboss: `${prefix}-deboss`,
  shadow: `${prefix}-shadow`,
  vellum: `${prefix}-vellum`,
});

/**
 * Gradients, textures and relief that make a screen preview read as paper and
 * metal. All lengths are millimetres, the drawing's own unit.
 */
export function Defs({ prefix }: { prefix: string }) {
  const ids = defIds(prefix);
  return (
    <defs>
      {Object.entries(foilShades).map(([ink, [dark, light, mid]]) => (
        <linearGradient
          key={ink}
          id={ids.ink(ink as Ink)}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0" stopColor={mid} />
          <stop offset="0.32" stopColor={light} />
          <stop offset="0.5" stopColor={mid} />
          <stop offset="0.78" stopColor={dark} />
          <stop offset="1" stopColor={light} />
        </linearGradient>
      ))}
      <filter
        id={ids.texture("cotton")}
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="2.2"
          numOctaves="3"
          seed="7"
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.28  0.55 0 0 0 -0.2" />
      </filter>
      <filter
        id={ids.texture("linen")}
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="3 0.08"
          numOctaves="2"
          seed="2"
          result="weft"
        />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.08 3"
          numOctaves="2"
          seed="5"
          result="warp"
        />
        <feBlend in="weft" in2="warp" mode="multiply" />
        <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.36  0 0 0 0 0.3  0.8 0 0 0 -0.36" />
      </filter>
      <filter
        id={ids.texture("kraft")}
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.6 1.6"
          numOctaves="4"
          seed="11"
        />
        <feColorMatrix values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.08  1.4 0 0 0 -0.55" />
      </filter>
      <filter
        id={ids.texture("vellum")}
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="1.4"
          numOctaves="2"
          seed="4"
        />
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.6 0 0 0 -0.2" />
      </filter>
      <linearGradient id={ids.texture("pearl")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="0.45" stopColor="#f3e9f5" stopOpacity="0.12" />
        <stop offset="0.7" stopColor="#e8f1f4" stopOpacity="0.2" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.3" />
      </linearGradient>
      <filter id={ids.emboss} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.08" result="blur" />
        <feOffset in="blur" dx="0.14" dy="0.14" result="low" />
        <feFlood floodColor="#000" floodOpacity="0.28" />
        <feComposite in2="low" operator="in" result="shade" />
        <feOffset in="blur" dx="-0.12" dy="-0.12" result="high" />
        <feFlood floodColor="#fff" floodOpacity="0.85" />
        <feComposite in2="high" operator="in" result="light" />
        <feMerge>
          <feMergeNode in="shade" />
          <feMergeNode in="light" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={ids.deboss} x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.08" result="blur" />
        <feOffset in="blur" dx="-0.14" dy="-0.14" result="low" />
        <feFlood floodColor="#000" floodOpacity="0.3" />
        <feComposite in2="low" operator="in" result="shade" />
        <feOffset in="blur" dx="0.12" dy="0.12" result="high" />
        <feFlood floodColor="#fff" floodOpacity="0.8" />
        <feComposite in2="high" operator="in" result="light" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="shade" />
          <feMergeNode in="light" />
        </feMerge>
      </filter>
      <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow
          dx="0.6"
          dy="1.4"
          stdDeviation="1.6"
          floodColor="#2b2620"
          floodOpacity="0.22"
        />
      </filter>
      <filter id={ids.vellum} x="0" y="0" width="1" height="1">
        <feGaussianBlur stdDeviation="0.35" />
      </filter>
    </defs>
  );
}
