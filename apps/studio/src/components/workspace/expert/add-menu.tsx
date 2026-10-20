"use client";

import {
  type DesignDocument,
  type FaceRef,
  type Labels,
  type LayerInput,
  newLayerId,
  type Operation,
  type Piece,
} from "@jolene/design";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import { Circle, Image, Minus, Plus, Square, Type } from "lucide-react";
import { useRef } from "react";
import { useI18n } from "@/locales/client";

/** A picture from the collection, as the catalog lists it. */
export interface Artwork {
  key: string;
  name: string | null;
  url: string;
  recolorable: boolean;
}

/** A new text layer's words, in the design's own language. */
const placeholder: Labels = { ro: "Textul vostru", en: "Your text" };

const tenth = (value: number) => Math.round(value * 10) / 10;

/** A frame of this size in the middle of the face. */
function centred(piece: Piece, width: number, height: number) {
  const w = tenth(Math.min(width, piece.width));
  const h = tenth(Math.min(height, piece.height));
  return {
    x: tenth((piece.width - w) / 2),
    y: tenth((piece.height - h) / 2),
    width: w,
    height: h,
  };
}

type Addition = "text" | "line" | "rect" | "ellipse" | Artwork;

/** A new layer of each kind, sized to the face it goes on. */
function newLayer(
  document: DesignDocument,
  piece: Piece,
  addition: Addition,
): LayerInput {
  const unit = Math.min(piece.width, piece.height);
  const line = { color: "$art" as const, width: 0.3 };
  if (addition === "text") {
    const room = piece.width - 2 * piece.safeMargin;
    return {
      id: newLayerId(document, "text"),
      type: "text",
      style: "body",
      text: placeholder[document.language],
      frame: centred(
        piece,
        Math.min(room, Math.max(30, unit * 0.7)),
        Math.max(8, unit * 0.1),
      ),
    };
  }
  if (addition === "line")
    return {
      id: newLayerId(document, "line"),
      type: "shape",
      shape: "line",
      stroke: line,
      frame: centred(piece, unit * 0.5, Math.max(1.5, unit * 0.02)),
    };
  if (addition === "rect")
    return {
      id: newLayerId(document, "rectangle"),
      type: "shape",
      shape: "rect",
      stroke: line,
      frame: centred(piece, unit * 0.45, unit * 0.3),
    };
  if (addition === "ellipse")
    return {
      id: newLayerId(document, "ellipse"),
      type: "shape",
      shape: "ellipse",
      stroke: line,
      frame: centred(piece, unit * 0.35, unit * 0.35),
    };
  return {
    id: newLayerId(document, addition.key),
    type: "image",
    asset: addition.key,
    fit: "contain",
    ...(addition.recolorable ? { tint: "$art" as const } : {}),
    frame: centred(piece, unit * 0.4, unit * 0.4),
  };
}

/** "Add": text, a line, a rectangle, an ellipse or the collection's artwork. */
export function AddMenu({
  document,
  piece,
  target,
  artwork,
  apply,
  onAdded,
}: {
  document: DesignDocument;
  piece: Piece;
  target: FaceRef;
  /** Undefined while it loads. */
  artwork: readonly Artwork[] | undefined;
  apply: (operations: Operation[]) => void;
  onAdded: (id: string, kind: "text" | "other") => void;
}) {
  const t = useI18n();
  // The new layer is chosen once the menu has closed and let go of the
  // keyboard, so new words can take it.
  const added = useRef<{ id: string; kind: "text" | "other" } | null>(null);
  const add = (addition: Addition) => {
    const layer = newLayer(document, piece, addition);
    added.current = {
      id: layer.id,
      kind: addition === "text" ? "text" : "other",
    };
    apply([{ op: "addLayer", ...target, layer }]);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[12px] font-medium text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("expert.add.label")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          const layer = added.current;
          if (!layer) return;
          added.current = null;
          if (layer.kind === "text") event.preventDefault();
          onAdded(layer.id, layer.kind);
        }}
      >
        <DropdownMenuItem onSelect={() => add("text")}>
          <Type aria-hidden />
          {t("expert.add.text")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => add("line")}>
          <Minus aria-hidden />
          {t("expert.add.line")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => add("rect")}>
          <Square aria-hidden />
          {t("expert.add.rect")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => add("ellipse")}>
          <Circle aria-hidden />
          {t("expert.add.ellipse")}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Image aria-hidden />
            {t("expert.add.artwork")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {artwork === undefined ? (
              <DropdownMenuItem disabled>
                {t("expert.loading")}
              </DropdownMenuItem>
            ) : artwork.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("expert.add.noArtwork")}
              </DropdownMenuItem>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {artwork.map((art) => (
                  <DropdownMenuItem
                    key={art.key}
                    onSelect={() => add(art)}
                    className="flex-col gap-1 p-1.5 text-center"
                    title={art.name ?? art.key}
                  >
                    <img
                      src={art.url}
                      alt=""
                      className="size-14 object-contain"
                      loading="lazy"
                    />
                    <span className="line-clamp-1 w-full text-[11px] text-muted-foreground">
                      {art.name ?? art.key}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
