"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import type { DesignDocument, Fields } from "@jolene/design";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import type { AssetLink, PreviewView } from "../design/design-preview";
import { takeSnapshot, viewName } from "./snapshot";

/** What the studio draws for the AI designer: a design as it shows it. */
export interface Shown {
  design: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
  view: PreviewView;
  /** The revision drawn. */
  revision: number;
}

/** A reply waiting to see its design (look_at_design). */
export interface RenderingRequest {
  messageId: Id<"aiMessages">;
  toolUseId: string;
}

/**
 * Requests this page has begun to answer. The AI designer's sheet and simple
 * mode's view of the collection can both see one; whichever claims it first
 * answers it, once.
 */
const claimed = new Set<string>();

/** Uploads a drawing of the design, for a message or a rendering. */
export function useUploadImage() {
  const generateUploadUrl = useMutation(api.ai.generateUploadUrl);
  return useCallback(
    async (image: Blob) => {
      const url = await generateUploadUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": image.type },
        body: image,
      });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      return storageId;
    },
    [generateUploadUrl],
  );
}

/**
 * Answers a reply that asked to see the design: draws it as shown, measures
 * its words in the page's fonts and hands both over. A drawing that fails
 * still gets an answer, so the reply goes on without it.
 */
export function useAnswerRendering() {
  const upload = useUploadImage();
  const answerRendering = useMutation(api.ai.answerRendering);
  return useCallback(
    async (request: RenderingRequest, shown: Shown) => {
      if (claimed.has(request.toolUseId)) return;
      claimed.add(request.toolUseId);
      let snapshot: Id<"_storage"> | undefined;
      let layers:
        | Awaited<ReturnType<typeof takeSnapshot>>["layers"]
        | undefined;
      try {
        const shot = await takeSnapshot(shown);
        layers = shot.layers;
        snapshot = await upload(shot.image);
      } catch (error) {
        console.warn("The AI designer's rendering failed:", error);
      }
      await answerRendering({
        ...request,
        revision: shown.revision,
        view: viewName(shown.view),
        snapshot,
        layers,
      }).catch(() => {});
    },
    [upload, answerRendering],
  );
}
