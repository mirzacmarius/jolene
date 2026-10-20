import type { ReactNode } from "react";
import { type Palette, resolveColor } from "../color";
import { resolveText } from "../fields";
import type {
  DesignDocument,
  ImageLayer,
  Layer,
  ShapeLayer,
  TextLayer,
} from "../schema";
import { layoutText } from "../text-layout";
import { ptToMm } from "../units";
import { defIds } from "./defs";
import { fontStack, type RenderContext } from "./shared";

interface LayerProps<L extends Layer> {
  layer: L;
  document: DesignDocument;
  /** The paper the layer sits on, for white ink and relief. */
  paper: string;
  prefix: string;
  context: RenderContext;
}

/** The fill a layer's ink gives on screen: its colour, metal, or the paper. */
function inkFill(
  layer: Layer,
  color: string,
  paper: string,
  prefix: string,
): { fill: string; filter?: string } {
  const ids = defIds(prefix);
  switch (layer.ink) {
    case "white":
      return { fill: "#ffffff" };
    case "foil-gold":
    case "foil-silver":
    case "foil-rose-gold":
    case "foil-copper":
      return { fill: `url(#${ids.ink(layer.ink)})` };
    case "emboss":
      return { fill: paper, filter: `url(#${ids.emboss})` };
    case "deboss":
      return { fill: paper, filter: `url(#${ids.deboss})` };
    default:
      return { fill: color };
  }
}

function frameTransform(layer: Layer): string {
  const { x, y, width, height } = layer.frame;
  return layer.rotation
    ? `translate(${x} ${y}) rotate(${layer.rotation} ${width / 2} ${height / 2})`
    : `translate(${x} ${y})`;
}

export function LayerView(props: LayerProps<Layer>): ReactNode {
  const { layer } = props;
  if (layer.hidden) return null;
  let content: ReactNode;
  switch (layer.type) {
    case "text":
      content = <TextLayerView {...props} layer={layer} />;
      break;
    case "image":
      content = <ImageLayerView {...props} layer={layer} />;
      break;
    case "shape":
      content = <ShapeLayerView {...props} layer={layer} />;
      break;
  }
  return (
    <g
      transform={frameTransform(layer)}
      opacity={layer.opacity < 1 ? layer.opacity : undefined}
      data-layer={layer.id}
    >
      {content}
    </g>
  );
}

function TextLayerView({
  layer,
  document,
  paper,
  prefix,
  context,
}: LayerProps<TextLayer>) {
  const style = { ...document.theme.text[layer.style], ...layer.overrides };
  const text = resolveText(layer.text, {
    fields: context.fields,
    occasion: document.occasion,
    language: document.language,
  });
  if (!text.trim()) return null;
  const { width, height } = layer.frame;
  const layout = layoutText({
    text,
    style,
    width,
    height,
    fit: layer.fit,
    minSize: layer.minSize,
    measure: context.measure,
  });
  const sizeMm = ptToMm(layout.size);
  const trackingMm = (style.tracking / 1000) * sizeMm;
  const top =
    layer.valign === "top"
      ? 0
      : layer.valign === "bottom"
        ? height - layout.height
        : (height - layout.height) / 2;
  // Browsers space out the last letter of a line too, and centre or
  // right-align that trailing space with it; shift the line by that space so
  // its letters sit where the layout measured them.
  const x =
    layer.align === "left"
      ? 0
      : layer.align === "right"
        ? width + trackingMm
        : (width + trackingMm) / 2;
  const anchor =
    layer.align === "left"
      ? "start"
      : layer.align === "right"
        ? "end"
        : "middle";
  const color = resolveColor(style.color, document.theme.palette);
  const { fill, filter } = inkFill(layer, color, paper, prefix);
  return (
    <text
      fontFamily={fontStack(style.font)}
      fontWeight={style.weight}
      fontStyle={style.italic ? "italic" : undefined}
      fontSize={sizeMm}
      letterSpacing={trackingMm}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={fill}
      filter={filter}
      style={{ fontKerning: "normal" }}
    >
      {layout.lines.map((line, index) => (
        <tspan
          // Lines are positional: the same words can repeat on two lines.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          key={index}
          x={x}
          y={top + (index + 0.5) * layout.lineHeight}
        >
          {line.text}
        </tspan>
      ))}
    </text>
  );
}

const aspect = {
  contain: "xMidYMid meet",
  cover: "xMidYMid slice",
  fill: "none",
} as const;

function ImageLayerView({
  layer,
  document,
  prefix,
  context,
}: LayerProps<ImageLayer>) {
  const { width, height } = layer.frame;
  const asset = layer.asset ? context.assets(layer.asset) : undefined;
  if (!asset) {
    return layer.replaceable ? (
      <PhotoSlot
        width={width}
        height={height}
        palette={document.theme.palette}
      />
    ) : null;
  }
  const clipId = `${prefix}-clip-${layer.id}`;
  const flip =
    layer.flipX || layer.flipY
      ? `translate(${layer.flipX ? width : 0} ${layer.flipY ? height : 0}) scale(${layer.flipX ? -1 : 1} ${layer.flipY ? -1 : 1})`
      : undefined;
  const image = (
    <image
      href={asset.url}
      width={width}
      height={height}
      preserveAspectRatio={aspect[layer.fit]}
    />
  );
  if (layer.tint && asset.recolorable) {
    const maskId = `${prefix}-mask-${layer.id}`;
    const tint = resolveColor(layer.tint, document.theme.palette);
    const { fill } = inkFill(layer, tint, tint, prefix);
    return (
      <g transform={flip}>
        <mask id={maskId} style={{ maskType: "alpha" }}>
          {image}
        </mask>
        <rect
          width={width}
          height={height}
          fill={fill}
          mask={`url(#${maskId})`}
        />
      </g>
    );
  }
  return (
    <g transform={flip}>
      <clipPath id={clipId}>
        <rect width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{image}</g>
    </g>
  );
}

/** An empty photo frame, waiting for the couple's picture. */
function PhotoSlot({
  width,
  height,
  palette,
}: {
  width: number;
  height: number;
  palette: Palette;
}) {
  const icon = Math.min(width, height) * 0.22;
  return (
    <g>
      <rect
        width={width}
        height={height}
        fill={palette.muted}
        fillOpacity={0.12}
        stroke={palette.muted}
        strokeWidth={0.3}
        strokeDasharray="1.2 1"
      />
      <g
        transform={`translate(${width / 2 - icon / 2} ${height / 2 - icon / 2}) scale(${icon / 24})`}
        fill="none"
        stroke={palette.muted}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </g>
    </g>
  );
}

function ShapeLayerView({
  layer,
  document,
  paper,
  prefix,
}: LayerProps<ShapeLayer>) {
  const { width, height } = layer.frame;
  const palette = document.theme.palette;
  const fillColor = layer.fill ? resolveColor(layer.fill, palette) : null;
  const strokeColor = layer.stroke
    ? resolveColor(layer.stroke.color, palette)
    : null;
  const fill = fillColor ? inkFill(layer, fillColor, paper, prefix) : null;
  const stroke = strokeColor
    ? inkFill(layer, strokeColor, paper, prefix)
    : null;
  const paint = {
    fill: fill?.fill ?? "none",
    stroke: stroke?.fill,
    strokeWidth: layer.stroke?.width,
    strokeDasharray: layer.stroke?.dash?.join(" "),
    filter: fill?.filter ?? stroke?.filter,
  };
  switch (layer.shape) {
    case "rect":
      return (
        <rect
          width={width}
          height={height}
          rx={layer.radius || undefined}
          {...paint}
        />
      );
    case "ellipse":
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          {...paint}
        />
      );
    case "line":
      return (
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          {...paint}
          stroke={stroke?.fill ?? fill?.fill}
          strokeWidth={layer.stroke?.width ?? height}
        />
      );
    case "path":
      return layer.path ? <path d={layer.path} {...paint} /> : null;
  }
}
