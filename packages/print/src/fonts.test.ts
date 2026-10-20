import { describe, expect, test } from "bun:test";
import type { FontSpec } from "@jolene/design";
import { fixtureFonts } from "./fixtures";
import { FontBook, faceFor, googleFonts, middleAboveBaseline } from "./fonts";

const jost: FontSpec = { family: "Jost", weight: 400, italic: false };
const bellefair: FontSpec = { family: "Bellefair", weight: 400, italic: false };

describe("faceFor", () => {
  test("draws the weight a browser would pick", () => {
    expect(faceFor(jost)).toEqual({
      face: { family: "Jost", weight: 400, italic: false },
      fakeItalic: false,
      fakeBold: false,
    });
    expect(faceFor({ family: "Jost", weight: 700, italic: true })).toEqual({
      face: { family: "Jost", weight: 600, italic: true },
      fakeItalic: false,
      fakeBold: false,
    });
  });

  test("fakes an italic or a bold the family lacks, as browsers do", () => {
    expect(faceFor({ family: "Bellefair", weight: 700, italic: true })).toEqual(
      {
        face: { family: "Bellefair", weight: 400, italic: false },
        fakeItalic: true,
        fakeBold: true,
      },
    );
    expect(faceFor({ ...bellefair, weight: 500 }).fakeBold).toBe(false);
  });
});

describe("FontBook", () => {
  test("loads each face once, and the symbol faces when a word needs one", async () => {
    const { source, asked } = fixtureFonts();
    const fonts = new FontBook(source);
    await fonts.load([
      { spec: jost, text: "Ana și Mihai" },
      { spec: jost, text: "Iași\n∞" },
    ]);
    expect(asked.map((face) => face.family)).toEqual(["Jost"]);
    await fonts.load([
      { spec: jost, text: "Ana" },
      { spec: bellefair, text: "Ana ♥ Mihai" },
    ]);
    expect(asked.map((face) => face.family)).toEqual([
      "Jost",
      "Bellefair",
      "Noto Sans Symbols 2",
      "Noto Sans Symbols",
      "Noto Sans Math",
    ]);
  });

  test("measures kerned words from the font file", async () => {
    const fonts = new FontBook(fixtureFonts().source);
    await fonts.load([{ spec: jost, text: "AV" }]);
    // Jost kerns A and V by a tenth of an em.
    expect(fonts.measure("AV", jost, 10)).toBeCloseTo(12.2, 6);
    expect(
      fonts.measure("A", jost, 10) + fonts.measure("V", jost, 10),
    ).toBeCloseTo(13.2, 6);
    expect(fonts.measure("AV", jost, 20)).toBeCloseTo(24.4, 6);
  });

  test("takes a symbol the typeface lacks from the first symbol face with it", async () => {
    const fonts = new FontBook(fixtureFonts().source);
    const boldItalic = { ...bellefair, weight: 700, italic: true };
    await fonts.load([{ spec: boldItalic, text: "♥" }]);
    const runs = fonts
      .runs("Ana ♥ ✝ ∞", boldItalic)
      .map(({ text, choice }) => [text, choice.face.family]);
    expect(runs).toEqual([
      ["Ana ", "Bellefair"],
      ["♥", "Noto Sans Symbols 2"],
      [" ", "Bellefair"],
      ["✝", "Noto Sans Symbols"],
      // Bellefair has its own infinity.
      [" ∞", "Bellefair"],
    ]);
    // The symbol faces have no bold or italic either: browsers fake both.
    const heart = fonts.runs("♥", boldItalic)[0]?.choice;
    expect(heart?.fakeBold).toBe(true);
    expect(heart?.fakeItalic).toBe(true);
    expect(fonts.runs("♥", bellefair)[0]?.choice.fakeBold).toBe(false);
    // ♥ is 0.74 em wide in Noto Sans Symbols 2.
    expect(fonts.measure("♥", boldItalic, 10)).toBeCloseTo(7.4, 6);
    expect(fonts.draws("♥", boldItalic)).toBe(true);
  });

  test("leaves a letter no face has to the typeface, and spaces plain", async () => {
    const fonts = new FontBook(fixtureFonts().source);
    await fonts.load([{ spec: jost, text: "💍" }]);
    expect(fonts.draws("💍", jost)).toBe(false);
    // An ideographic space, which no face has.
    expect(fonts.runs("a　💍", jost).map(({ text }) => text)).toEqual(["a 💍"]);
  });

  test("needs its faces loaded first", () => {
    expect(() => new FontBook(fixtureFonts().source).choose(jost)).toThrow(
      "Jost|400|roman was not loaded for printing",
    );
  });
});

test("middleAboveBaseline is halfway between ascent and descent", async () => {
  const fonts = new FontBook(fixtureFonts().source);
  await fonts.load([{ spec: jost, text: "" }]);
  // Jost: ascent 1070, descent -375, in 1000 units an em.
  expect(middleAboveBaseline(fonts.choose(jost).font)).toBeCloseTo(0.3475, 6);
});

describe("googleFonts", () => {
  const css = (file: string) =>
    new Response(`@font-face { src: url(${file}) format('truetype'); }`);

  test("asks for the face's whole TrueType file", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      asked.push(url);
      expect(new Headers(init?.headers).get("user-agent")).toBe(
        "Jolene print files",
      );
      return url.includes("googleapis")
        ? css("https://fonts.gstatic.com/s/cormorant/v1/italic.ttf")
        : new Response(new Uint8Array([1, 2, 3]));
    }) as typeof fetch;
    const bytes = await googleFonts(fetcher)({
      family: "Cormorant Garamond",
      weight: 500,
      italic: true,
    });
    expect(asked).toEqual([
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500",
      "https://fonts.gstatic.com/s/cormorant/v1/italic.ttf",
    ]);
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  test("tries again when Google Fonts fails, not when it refuses", async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls === 1) return new Response("", { status: 503 });
      return calls === 2
        ? css("https://fonts.gstatic.com/a.ttf")
        : new Response(new Uint8Array([7]));
    }) as unknown as typeof fetch;
    expect([...(await googleFonts(flaky)(faceFor(jost).face))]).toEqual([7]);
    expect(calls).toBe(3);

    let refused = 0;
    const missing = (async () => {
      refused += 1;
      return new Response("", { status: 400 });
    }) as unknown as typeof fetch;
    await expect(googleFonts(missing)(faceFor(jost).face)).rejects.toThrow(
      "400",
    );
    expect(refused).toBe(1);
  });
});
