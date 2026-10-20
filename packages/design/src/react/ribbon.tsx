import type { RibbonMaterial } from "../catalog";
import { type Hex, mix } from "../color";
import type { Box } from "../geometry";
import type { Accessory } from "../schema";
import { lightX } from "./materials";

type RibbonSpec = Extract<Accessory, { kind: "ribbon" }>;

/**
 * How each material takes the light: satin shines in long soft bands,
 * chiffon is sheer, velvet is deep with bright edges where the pile turns,
 * lace is open, and twine is a twisted cord.
 */
const looks: Record<
  RibbonMaterial,
  {
    /** Light across the ribbon: its edges, then its middle. */
    edge: number;
    middle: number;
    /** Strength of the bands of light along it. */
    sheen: number;
    opacity: number;
  }
> = {
  satin: { edge: -0.22, middle: 0.14, sheen: 0.42, opacity: 1 },
  chiffon: { edge: -0.06, middle: 0.1, sheen: 0.16, opacity: 0.6 },
  velvet: { edge: 0.2, middle: -0.2, sheen: 0.06, opacity: 1 },
  lace: { edge: 0, middle: 0.05, sheen: 0.1, opacity: 1 },
  twine: { edge: -0.3, middle: 0.12, sheen: 0, opacity: 1 },
};

/** Lightens (positive) or darkens (negative) a colour. */
const tone = (color: Hex, amount: number) =>
  amount >= 0 ? mix(color, "#ffffff", amount) : mix(color, "#000000", -amount);

/**
 * A ribbon tied round the whole assembly, as it lies on the paper: the light
 * along it, its edges, where it turns round the edge of the stack, its shadow,
 * and its bow.
 */
export function LifelikeRibbon({
  ribbon,
  bounds,
  prefix,
}: {
  ribbon: RibbonSpec;
  bounds: Box;
  prefix: string;
}) {
  const id = (name: string) => `${prefix}-ribbon-${ribbon.id}-${name}`;
  const look = looks[ribbon.material];
  const color = ribbon.color as Hex;
  const horizontal = ribbon.orientation === "horizontal";
  // Drawn along x in its own frame, from one edge of the stack to the other,
  // then turned into place.
  const overhang = 0.8;
  const length = (horizontal ? bounds.width : bounds.height) + 2 * overhang;
  const w =
    ribbon.material === "twine" ? Math.min(ribbon.width, 3.2) : ribbon.width;
  const centre = {
    x: horizontal ? bounds.x + bounds.width / 2 : bounds.x + ribbon.offset,
    y: horizontal ? bounds.y + ribbon.offset : bounds.y + bounds.height / 2,
  };
  const frame = horizontal
    ? `translate(${bounds.x - overhang} ${centre.y})`
    : `translate(${centre.x} ${bounds.y - overhang}) rotate(90)`;
  const band = { x: 0, y: -w / 2, width: length, height: w };
  const lace = ribbon.material === "lace";
  const twine = ribbon.material === "twine";
  return (
    <g>
      <filter
        id={id("shadow")}
        x="-10%"
        y="-40%"
        width="120%"
        height="180%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.45" />
        <feOffset dx="0.3" dy="0.6" result="near" />
        <feComponentTransfer in="near" result="soft">
          <feFuncA type="linear" slope={twine ? 0.45 : 0.3} />
        </feComponentTransfer>
        <feFlood floodColor="#20180f" />
        <feComposite in2="soft" operator="in" />
      </filter>
      <linearGradient id={id("across")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={tone(color, look.edge)} />
        <stop offset="0.16" stopColor={color} />
        <stop offset="0.5" stopColor={tone(color, look.middle)} />
        <stop offset="0.84" stopColor={color} />
        <stop offset="1" stopColor={tone(color, look.edge * 1.2)} />
      </linearGradient>
      {/* Bands of light along the ribbon, drifting as the light moves. */}
      <linearGradient
        id={id("along")}
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={0}
        x2={72}
        y2={0}
        spreadMethod="repeat"
      >
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.3" stopColor="#ffffff" stopOpacity={look.sheen * 0.6} />
        <stop offset="0.42" stopColor="#ffffff" stopOpacity={look.sheen} />
        <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        <stop
          offset="0.8"
          stopColor="#000000"
          stopOpacity={look.sheen * 0.18}
        />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      {/* Where the ribbon turns round the edge of the stack, it falls away. */}
      <linearGradient
        id={id("ends")}
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={0}
        x2={length}
        y2={0}
      >
        <stop offset="0" stopColor="#000000" stopOpacity="0.35" />
        <stop
          offset={Math.min(0.5, 2.2 / length)}
          stopColor="#000000"
          stopOpacity="0"
        />
        <stop
          offset={Math.max(0.5, 1 - 2.2 / length)}
          stopColor="#000000"
          stopOpacity="0"
        />
        <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
      </linearGradient>
      {lace ? <LaceMask id={id("lace")} band={band} width={w} /> : null}
      {twine ? <TwineTwist id={id("twist")} color={color} /> : null}

      <g filter={`url(#${id("shadow")})`} opacity={look.opacity}>
        <g transform={frame}>
          {twine ? (
            <TwineStrands length={length} paint={`url(#${id("twist")})`} />
          ) : (
            <rect
              {...band}
              fill={color}
              mask={lace ? `url(#${id("lace")})` : undefined}
            />
          )}
        </g>
      </g>
      <clipPath id={id("band")}>
        <rect {...band} y={band.y - 1.5} height={band.height + 3} />
      </clipPath>
      <g
        transform={frame}
        opacity={look.opacity}
        clipPath={`url(#${id("band")})`}
        mask={lace ? `url(#${id("lace")})` : undefined}
      >
        {twine ? (
          <TwineStrands length={length} paint={`url(#${id("twist")})`} />
        ) : (
          <>
            <rect {...band} fill={`url(#${id("across")})`} />
            {look.sheen > 0 ? (
              <rect
                x={-80}
                y={band.y}
                width={length + 160}
                height={w}
                fill={`url(#${id("along")})`}
                style={{
                  transform: `translateX(calc(var(${lightX}, 0) * 16px))`,
                  transition: "transform 0.5s ease-out",
                }}
              />
            ) : null}
          </>
        )}
        {twine ? null : <rect {...band} fill={`url(#${id("ends")})`} />}
        {ribbon.material === "satin" || ribbon.material === "velvet" ? (
          <g
            stroke={tone(color, ribbon.material === "velvet" ? 0.25 : -0.3)}
            strokeOpacity={0.5}
            strokeWidth={0.18}
          >
            <line x1={0} y1={-w / 2 + 0.2} x2={length} y2={-w / 2 + 0.2} />
            <line x1={0} y1={w / 2 - 0.2} x2={length} y2={w / 2 - 0.2} />
          </g>
        ) : null}
      </g>
      {ribbon.bow ? (
        <Bow
          id={id("bow")}
          x={centre.x}
          y={centre.y}
          width={w}
          color={color}
          material={ribbon.material}
        />
      ) : null}
    </g>
  );
}

/**
 * Lace: a fine net, flowers and leaves worked solid into it, and scalloped
 * edges; the paper shows through the net.
 */
function LaceMask({
  id,
  band,
  width: w,
}: {
  id: string;
  band: Box;
  width: number;
}) {
  const repeat = w * 1.15;
  const edge = w * 0.1;
  const { y: top, height } = band;
  const flower = { x: repeat / 2, y: height / 2, r: w * 0.11 };
  const petals = [0, 72, 144, 216, 288];
  return (
    <mask
      id={id}
      maskUnits="userSpaceOnUse"
      x={band.x}
      y={top - 1}
      width={band.width}
      height={height + 2}
    >
      <pattern
        id={`${id}-net`}
        patternUnits="userSpaceOnUse"
        width={0.9}
        height={0.9}
        patternTransform="rotate(45)"
      >
        <path
          d="M0 0H0.9M0 0V0.9"
          stroke="#fff"
          strokeOpacity={0.85}
          strokeWidth={0.16}
        />
      </pattern>
      <pattern
        id={`${id}-motif`}
        patternUnits="userSpaceOnUse"
        x={0}
        y={top}
        width={repeat}
        height={height}
      >
        <g fill="#fff">
          {/* A flower, its petals round an open centre. */}
          {petals.map((angle) => (
            <ellipse
              key={angle}
              cx={flower.x}
              cy={flower.y - flower.r * 1.05}
              rx={flower.r * 0.6}
              ry={flower.r}
              transform={`rotate(${angle} ${flower.x} ${flower.y})`}
            />
          ))}
          <circle cx={flower.x} cy={flower.y} r={flower.r * 0.42} fill="#000" />
          <circle cx={flower.x} cy={flower.y} r={flower.r * 0.2} />
          {/* A leaf either side. */}
          {[-1, 1].map((side) => (
            <ellipse
              key={side}
              cx={flower.x + side * repeat * 0.36}
              cy={flower.y}
              rx={w * 0.12}
              ry={w * 0.045}
              transform={`rotate(${side * 28} ${flower.x + side * repeat * 0.36} ${flower.y})`}
            />
          ))}
          {/* Scallops along both edges, each pierced. */}
          {[edge, height - edge].map((y) => (
            <g key={y}>
              {[repeat / 4, (repeat * 3) / 4].map((x) => (
                <g key={x}>
                  <circle cx={x} cy={y} r={edge} />
                  <circle cx={x} cy={y} r={edge * 0.35} fill="#000" />
                </g>
              ))}
            </g>
          ))}
        </g>
      </pattern>
      <rect
        x={band.x}
        y={top + edge * 1.3}
        width={band.width}
        height={height - edge * 2.6}
        fill={`url(#${id}-net)`}
      />
      <rect {...band} fill={`url(#${id}-motif)`} />
      {/* A solid cord inside each row of scallops. */}
      <rect
        x={band.x}
        y={top + edge * 1.3}
        width={band.width}
        height={edge * 0.45}
        fill="#fff"
      />
      <rect
        x={band.x}
        y={top + height - edge * 1.75}
        width={band.width}
        height={edge * 0.45}
        fill="#fff"
      />
    </mask>
  );
}

/** Twine's twist: light and dark ridges running round the cord. */
function TwineTwist({ id, color }: { id: string; color: Hex }) {
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={1.3}
      height={1.3}
      patternTransform="rotate(-38)"
    >
      <rect width={1.3} height={1.3} fill={tone(color, -0.12)} />
      <rect width={0.62} height={1.3} fill={tone(color, 0.16)} />
      <rect x={0.62} width={0.14} height={1.3} fill={tone(color, -0.35)} />
    </pattern>
  );
}

/** Twine wound twice round the stack. */
function TwineStrands({ length, paint }: { length: number; paint: string }) {
  return (
    <g stroke={paint} strokeWidth={1.25} strokeLinecap="round" fill="none">
      <path
        d={`M0 -0.85C${length * 0.35} -0.6 ${length * 0.65} -1.1 ${length} -0.8`}
      />
      <path
        d={`M0 0.85C${length * 0.4} 1.05 ${length * 0.6} 0.6 ${length} 0.9`}
      />
    </g>
  );
}

/** A bow tied where the ribbon crosses the middle. */
function Bow({
  id,
  x,
  y,
  width: w,
  color,
  material,
}: {
  id: string;
  x: number;
  y: number;
  width: number;
  color: Hex;
  material: RibbonMaterial;
}) {
  const look = looks[material];
  if (material === "twine") {
    const s = Math.max(w, 2.4) * 2.2;
    return (
      <g transform={`translate(${x} ${y})`}>
        <TwineTwist id={`${id}-twist`} color={color} />
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="170%"
          height="170%"
        >
          <feDropShadow
            dx="0.4"
            dy="0.8"
            stdDeviation="0.5"
            floodColor="#20180f"
            floodOpacity="0.45"
          />
        </filter>
        <g
          stroke={`url(#${id}-twist)`}
          strokeWidth={1.25}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${id}-shadow)`}
        >
          <path d={`M0 0C${-s} ${-s * 0.9} ${-s * 1.6} ${s * 0.2} 0 0.4`} />
          <path d={`M0 0C${s} ${-s * 0.9} ${s * 1.6} ${s * 0.2} 0 0.4`} />
          <path
            d={`M-0.2 0.4C${-s * 0.3} ${s * 0.8} ${-s * 0.5} ${s * 1.2} ${-s * 0.6} ${s * 1.6}`}
          />
          <path
            d={`M0.2 0.4C${s * 0.3} ${s * 0.8} ${s * 0.6} ${s * 1.1} ${s * 0.75} ${s * 1.5}`}
          />
        </g>
        <circle r={1.1} fill={tone(color, -0.1)} />
      </g>
    );
  }
  const light = tone(color, Math.max(0.12, look.middle + 0.1));
  const dark = tone(color, -0.32);
  const inside = tone(color, -0.45);
  // Sheer ribbon is sheer in each layer, so it shows denser where loops and
  // tails cross.
  const sheer = look.opacity;
  return (
    <g transform={`translate(${x} ${y})`} fillOpacity={sheer}>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="170%">
        <feGaussianBlur in="SourceAlpha" stdDeviation={w * 0.12} />
        <feOffset dx={w * 0.08} dy={w * 0.16} result="soft" />
        <feComponentTransfer in="soft" result="shade">
          <feFuncA type="linear" slope="0.38" />
        </feComponentTransfer>
        <feFlood floodColor="#20180f" />
        <feComposite in2="shade" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id={`${id}-loop`} x1="0.2" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor={light} />
        <stop offset="0.55" stopColor={color} />
        <stop offset="1" stopColor={dark} />
      </linearGradient>
      <linearGradient id={`${id}-tail`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={dark} />
        <stop offset="0.45" stopColor={light} />
        <stop offset="1" stopColor={color} />
      </linearGradient>
      <radialGradient id={`${id}-knot`} cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stopColor={light} />
        <stop offset="0.6" stopColor={color} />
        <stop offset="1" stopColor={dark} />
      </radialGradient>
      <g filter={`url(#${id}-shadow)`}>
        {/* Tails, cut in a V, falling to either side. */}
        <path
          d={`M${-w * 0.25} ${w * 0.15}C${-w * 0.7} ${w * 1.1} ${-w * 1.1} ${w * 2} ${-w * 1.5} ${w * 2.9}L${-w * 1.02} ${w * 2.62}L${-w * 0.72} ${w * 3.08}C${-w * 0.42} ${w * 2.2} ${-w * 0.08} ${w * 1.1} ${w * 0.18} ${w * 0.3}Z`}
          fill={`url(#${id}-tail)`}
        />
        <path
          d={`M${w * 0.22} ${w * 0.15}C${w * 0.6} ${w * 1.05} ${w * 0.95} ${w * 1.9} ${w * 1.3} ${w * 2.95}L${w * 0.84} ${w * 2.66}L${w * 0.52} ${w * 3.1}C${w * 0.3} ${w * 2.1} ${w * 0.02} ${w * 1.1} ${-w * 0.2} ${w * 0.32}Z`}
          fill={`url(#${id}-tail)`}
        />
        {/* Loops, the inside of each in shade. */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`scale(${side} 1)`}>
            <path
              d={`M0 ${-w * 0.25}C${-w * 0.9} ${-w * 1.55} ${-w * 2.75} ${-w * 1.35} ${-w * 2.7} ${-w * 0.25}C${-w * 2.65} ${w * 0.65} ${-w * 1.05} ${w * 0.62} 0 ${w * 0.28}Z`}
              fill={`url(#${id}-loop)`}
            />
            <path
              d={`M${-w * 0.55} ${-w * 0.22}C${-w * 1.15} ${-w * 0.95} ${-w * 2.15} ${-w * 0.88} ${-w * 2.18} ${-w * 0.28}C${-w * 2.1} ${w * 0.18} ${-w * 1.2} ${w * 0.22} ${-w * 0.55} ${w * 0.04}Z`}
              fill={inside}
              opacity={sheer < 1 ? 0.3 : 0.55}
            />
            <path
              d={`M${-w * 0.2} ${-w * 0.42}C${-w * 0.9} ${-w * 1.3} ${-w * 2.2} ${-w * 1.25} ${-w * 2.45} ${-w * 0.6}`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={look.sheen * 0.8}
              strokeWidth={w * 0.12}
              strokeLinecap="round"
            />
          </g>
        ))}
        <ellipse rx={w * 0.48} ry={w * 0.56} fill={`url(#${id}-knot)`} />
        <path
          d={`M${-w * 0.2} ${-w * 0.45}Q${-w * 0.05} 0 ${-w * 0.18} ${w * 0.48}M${w * 0.16} ${-w * 0.42}Q${w * 0.28} 0 ${w * 0.12} ${w * 0.5}`}
          fill="none"
          stroke={dark}
          strokeOpacity={0.45}
          strokeWidth={w * 0.05}
        />
      </g>
    </g>
  );
}
