import { describe, expect, test } from "bun:test";
import { contrast, isColorRef, mix, resolveColor } from "./color";
import {
  fieldProblem,
  formatDate,
  isIsoDate,
  monogram,
  previewFields,
  resolveText,
  tokensIn,
} from "./fields";
import { trimPath } from "./geometry";
import { palettePresets } from "./palettes";
import { eucaliptTheme } from "./samples";
import { textStyleSchema } from "./schema";
import { applyCase, layoutText } from "./text-layout";
import { mmToPt, ptToMm } from "./units";

describe("resolveText", () => {
  const options = {
    fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
    occasion: "wedding" as const,
    language: "ro" as const,
  };

  test("fills tokens and formats dates in Romanian", () => {
    expect(resolveText("{{partner1}} & {{partner2}}", options)).toBe(
      "Ana & Mihai",
    );
    expect(resolveText("{{date:long}}", options)).toBe(
      "sâmbătă, 12 iunie 2027",
    );
    expect(resolveText("{{date:short}}", options)).toBe("12.06.2027");
  });

  test("drops a line whose fields are all empty", () => {
    expect(
      resolveText("{{partner1}}\nNași: {{godparents}}\nVă așteptăm", options),
    ).toBe("Ana\nVă așteptăm");
  });

  test("keeps text that has no tokens, including blank lines", () => {
    expect(resolveText("Vă invităm\n\ncu drag", options)).toBe(
      "Vă invităm\n\ncu drag",
    );
  });

  test("joins accents to their letters and draws symbols as type", () => {
    // "ș" typed as s and a comma below, a heart and a check mark from a
    // phone's emoji keyboard.
    expect(
      resolveText("Ia\u0219i \u2764\uFE0F {{partner1}} \u2714\uFE0E", options),
    ).toBe("Iași ❤ Ana ✔");
  });

  test("derives the monogram unless one is given", () => {
    expect(resolveText("{{monogram}}", options)).toBe("A & M");
    expect(
      resolveText("{{monogram}}", {
        ...options,
        fields: { ...options.fields, monogram: "AM" },
      }),
    ).toBe("AM");
    expect(monogram({ child: "sofia" }, "christening")).toBe("S");
  });

  test("lists tokens once, in order", () => {
    expect(tokensIn("{{a}} {{b:long}} {{a}}")).toEqual(["a", "b"]);
  });
});

describe("fieldProblem", () => {
  test("accepts the occasion's fields, and empty values to clear them", () => {
    expect(fieldProblem("wedding", "partner1", "Ana")).toBeNull();
    expect(fieldProblem("wedding", "date", "")).toBeNull();
    expect(fieldProblem("christening", "child", "Sofia")).toBeNull();
  });

  test("refuses fields the occasion doesn't have", () => {
    expect(fieldProblem("christening", "partner1", "Ana")).toBe("unknown");
    expect(fieldProblem("wedding", "toString", "x")).toBe("unknown");
  });

  test("checks dates, times and lengths", () => {
    expect(fieldProblem("wedding", "date", "2027-02-30")).toBe("date");
    expect(fieldProblem("wedding", "date", "12.06.2027")).toBe("date");
    expect(fieldProblem("wedding", "ceremonyTime", "24:00")).toBe("time");
    expect(fieldProblem("wedding", "ceremonyTime", "09:30")).toBeNull();
    expect(fieldProblem("wedding", "partner1", "A".repeat(161))).toBe(
      "too-long",
    );
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
});

test("previews fill empty fields with examples in the design's language", () => {
  const fields = previewFields("wedding", "en", {
    partner1: "Ioana",
    date: " ",
  });
  expect(fields.partner1).toBe("Ioana");
  expect(fields.partner2).toBe("Mihai");
  expect(fields.date).toBe("2027-06-12");
  expect(fields.civilVenue).toBe("Iasi City Hall");
  expect(fields.monogram).toBeUndefined();
  expect(
    resolveText("{{monogram}}", {
      fields,
      occasion: "wedding",
      language: "en",
    }),
  ).toBe("I & M");
});

test("every palette preset keeps its ink readable on its paper", () => {
  for (const [id, { palette }] of Object.entries(palettePresets)) {
    expect([id, contrast(palette.ink, palette.paper) >= 7]).toEqual([id, true]);
    expect([id, contrast(palette.accent, palette.paper) >= 4.5]).toEqual([
      id,
      true,
    ]);
  }
});

test("formatDate speaks English too", () => {
  expect(formatDate("2027-06-12", "long", "en")).toBe("Saturday, 12 June 2027");
  expect(formatDate("2027-06-12", "short", "en")).toBe("12/06/2027");
  expect(formatDate("2027-01-03", "weekday", "ro")).toBe("duminică");
  expect(formatDate("not a date", "long", "en")).toBe("not a date");
});

describe("layoutText", () => {
  const style = textStyleSchema.parse(eucaliptTheme.text.body);

  test("wraps at spaces to the frame's width", () => {
    const layout = layoutText({
      text: "vă invită cu drag să le fiți alături în ziua cea mare",
      style,
      width: 40,
      height: 100,
      fit: "none",
    });
    expect(layout.lines.length).toBeGreaterThan(1);
    for (const line of layout.lines)
      expect(line.width).toBeLessThanOrEqual(40.01);
    expect(layout.overflows).toBe(false);
  });

  test("shrinks long names until they fit", () => {
    const names = textStyleSchema.parse(eucaliptTheme.text.names);
    const layout = layoutText({
      text: "Alexandra-Maria & Constantin-Bogdan",
      style: names,
      width: 100,
      height: 18,
      fit: "shrink",
    });
    expect(layout.size).toBeLessThan(names.size);
    expect(layout.overflows).toBe(false);
  });

  test("stops shrinking at the minimum size", () => {
    const layout = layoutText({
      text: "Unnecessarilylongunbreakablenamethatcannotfit",
      style,
      width: 10,
      height: 5,
      fit: "shrink",
      minSize: 8,
    });
    expect(layout.size).toBe(8);
    expect(layout.overflows).toBe(true);
  });

  test("upper-cases Romanian correctly", () => {
    expect(applyCase("ziua în care își unesc", "upper")).toBe(
      "ZIUA ÎN CARE ÎȘI UNESC",
    );
  });
});

describe("colour", () => {
  test("resolves tokens and normalises hex", () => {
    expect(resolveColor("$accent", eucaliptTheme.palette)).toBe("#56664a");
    expect(resolveColor("#ABCDEF", eucaliptTheme.palette)).toBe("#abcdef");
    expect(isColorRef("$paper")).toBe(true);
    expect(isColorRef("$gold")).toBe(false);
  });

  test("mixes and measures contrast", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(
      contrast(eucaliptTheme.palette.ink, eucaliptTheme.palette.paper),
    ).toBeGreaterThan(7);
  });
});

test("trim paths close and stay inside the piece", () => {
  const size = { width: 120, height: 170 };
  for (const shape of [
    { kind: "rect", radius: 0 },
    { kind: "rect", radius: 6 },
    { kind: "arch" },
    { kind: "scallop", count: 10 },
  ] as const) {
    const path = trimPath({ ...size, shape });
    expect(path.endsWith("Z")).toBe(true);
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
  }
});

test("points and millimetres convert both ways", () => {
  expect(ptToMm(72)).toBeCloseTo(25.4, 6);
  expect(mmToPt(ptToMm(11))).toBeCloseTo(11, 6);
});
