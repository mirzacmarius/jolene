"use client";

import type { Layer } from "@jolene/design";
import {
  Circle,
  Image,
  ImagePlus,
  type LucideIcon,
  Minus,
  Spline,
  Square,
  Type,
} from "lucide-react";
import { useI18n } from "@/locales/client";

type Kind = "text" | "image" | "photo" | "rect" | "ellipse" | "line" | "path";

/** What a layer is, as the layers panel and the inspector name it. */
export function layerKind(layer: Layer): Kind {
  if (layer.type === "shape") return layer.shape;
  if (layer.type === "image") return layer.replaceable ? "photo" : "image";
  return "text";
}

export const kindIcons: Record<Kind, LucideIcon> = {
  text: Type,
  image: Image,
  photo: ImagePlus,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  path: Spline,
};

/** Its words on one line, cut short, for a text layer that has no name. */
function opening(text: string) {
  const words = text.replace(/\s+/g, " ").trim();
  return words.length > 36 ? `${words.slice(0, 35).trimEnd()}…` : words;
}

/** A layer's name, or what it is and how its words begin. */
export function useLayerLabel() {
  const t = useI18n();
  return (layer: Layer) => {
    if (layer.name?.trim()) return layer.name.trim();
    const kind = t(`expert.kind.${layerKind(layer)}`);
    if (layer.type !== "text") return kind;
    const words = opening(layer.text);
    return words ? `${kind} · ${words}` : kind;
  };
}
