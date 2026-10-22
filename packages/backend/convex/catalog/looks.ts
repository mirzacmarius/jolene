import type {
  ChoiceLookKind,
  Look,
  RibbonMaterial,
  StockId,
} from "@jolene/design";
import type { Infer } from "convex/values";
import type { choiceValidator } from "../shop/validators";

/**
 * How the studio shows what a couple orders (ADR 0021): each of the shop's
 * papers and each choice of the order options that change a design has a
 * look, which choosing it applies to the design. The team sets a choice's on
 * the workshop's page; until then a choice jolene.ro had takes the one here,
 * found by its option's key and its name. Papers are named only by the seed,
 * so theirs are here alone.
 */

type Choice = Infer<typeof choiceValidator>;

/** What each order option that changes a design changes, by its key. */
const optionLooks: Record<string, ChoiceLookKind> = {
  "culoare-sigiliu": "seal",
  "culoare-plic": "envelope",
  panglica: "ribbon",
  snur: "ribbon",
  "print-interior-plic": "liner",
  "margini-invitatie": "corners",
  colturi: "corners",
};

const paper = (stock: StockId, color: string | null = null): Look => ({
  kind: "paper",
  stock,
  color,
});
const seal = (color: string | null): Look => ({ kind: "seal", color });
const envelope = (color: string): Look => ({ kind: "envelope", color });
const ribbon = (
  material: RibbonMaterial | null,
  color: string | null = null,
): Look => ({ kind: "ribbon", material, color });
const liner = (printed: boolean): Look => ({ kind: "liner", printed });
const corners = (radius: number): Look => ({ kind: "corners", radius });

/** Rounded corners, in millimetres. */
const ROUNDED = 4;
const GOLD_CORD = "#c9a85c";

/** The papers jolene.ro sold, by name, as the studio's stocks and colours. */
const paperLooks: Record<string, Look> = {
  "Alb mat 300 gr": paper("smooth-300"),
  "Crem mat 300 gr": paper("smooth-300", "#f3ead6"),
  "Ivory texturat 300 gr": paper("textured-300", "#f4eddc"),
  "Texturat 300 gr": paper("textured-300"),
  "Alb sidef 300 gr": paper("pearl-300"),
  "Auriu sidef 300 gr": paper("pearl-300", "#e3cf9a"),
  "Carton 250 gr": paper("smooth-250"),
  "Carton 300 gr mat": paper("smooth-300"),
  "Carton 300 gr texturat": paper("textured-300"),
};

/**
 * jolene.ro's choices, by their option's key and their name. Six of the
 * collections' envelopes are one of these colours, so their designs start
 * with it chosen: Forest's Verde pădure, Autumn's Verde olive, Carusel's
 * Roz, Classic Roses' Crem, Eucalipt's Ivory and Geometric Flowers' Alb.
 */
const choiceLooks: Record<string, Record<string, Look>> = {
  "culoare-sigiliu": {
    "Fără sigiliu": seal(null),
    Alb: seal("#f4f1ea"),
    Bronz: seal("#8a5a2b"),
    Roz: seal("#d8a7a0"),
    Roșu: seal("#9b1c22"),
    Blue: seal("#8fb0d6"),
    Albastru: seal("#2b4c8c"),
    Verde: seal("#3f7a4f"),
    "Verde olive": seal("#6b7046"),
    Negru: seal("#1c1c1c"),
    Auriu: seal("#b8913a"),
  },
  "culoare-plic": {
    Alb: envelope("#ffffff"),
    Roz: envelope("#ecd3d9"),
    Roșu: envelope("#a3222b"),
    Blue: envelope("#a9c3df"),
    Albastru: envelope("#2c4a7c"),
    "Verde pădure": envelope("#2f7d46"),
    "Verde olive": envelope("#727a4a"),
    Negru: envelope("#1f1f1f"),
    Crem: envelope("#f3ecd9"),
    Ivory: envelope("#f2efe8"),
    "Craft (maro)": envelope("#b48a5a"),
  },
  panglica: {
    "Fără panglică": ribbon(null),
    "Panglică satinată": ribbon("satin"),
    "Panglică dublu satinată": ribbon("satin"),
    "Panglică catifea": ribbon("velvet"),
    "Panglică mătase": ribbon("chiffon"),
    "Șnur auriu/argintiu": ribbon("twine", GOLD_CORD),
  },
  snur: {
    "Fără șnur": ribbon(null),
    "Șnur auriu": ribbon("twine", GOLD_CORD),
    "Șnur argintiu": ribbon("twine", "#c3c7cc"),
    "Șnur iută": ribbon("twine", "#b39b72"),
  },
  "print-interior-plic": {
    "Fără print": liner(false),
    "Cu print în designul invitației": liner(true),
  },
  "margini-invitatie": {
    "Margini drepte": corners(0),
    // The studio doesn't draw fringed edges yet, so it shows them square.
    "Margini franjurite": corners(0),
    "Colțuri rotunjite": corners(ROUNDED),
  },
  colturi: { Drepte: corners(0), Rotunjite: corners(ROUNDED) },
};

/** What an order option's choices change in a design, if they change one. */
export function optionLook(key: string): ChoiceLookKind | null {
  return Object.hasOwn(optionLooks, key) ? (optionLooks[key] ?? null) : null;
}

/** A paper's look, by its name; null for one the studio can't show. */
export function paperLook(name: string): Look | null {
  return Object.hasOwn(paperLooks, name) ? (paperLooks[name] ?? null) : null;
}

/**
 * A choice's look: the team's, else jolene.ro's by its name; null when it
 * changes nothing, as on an option that doesn't change a design.
 */
export function choiceLook(key: string, choice: Choice): Look | null {
  if (optionLook(key) === null) return null;
  if (choice.look !== undefined) return choice.look;
  const looks = Object.hasOwn(choiceLooks, key) ? choiceLooks[key] : undefined;
  return looks && Object.hasOwn(looks, choice.label)
    ? (looks[choice.label] ?? null)
    : null;
}
