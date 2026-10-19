import { expect, test } from "bun:test";
import { matchLocale, preferredTags, resolveLocale } from "./locale";

test("a stored choice wins over the browser", () => {
  expect(
    resolveLocale({ stored: "en", acceptLanguage: "ro-RO,ro;q=0.9" }),
  ).toBe("en");
});

test("the browser's best supported language comes next", () => {
  expect(
    resolveLocale({ acceptLanguage: "de-DE,de;q=0.9,en-GB;q=0.8,ro;q=0.7" }),
  ).toBe("en");
  expect(resolveLocale({ acceptLanguage: "ro-MD" })).toBe("ro");
});

test("Romanian when nothing matches", () => {
  expect(resolveLocale({ acceptLanguage: "fr-FR,de" })).toBe("ro");
  expect(resolveLocale({})).toBe("ro");
});

test("tags are ordered by weight, then position", () => {
  expect(preferredTags("en;q=0.5, ro, *;q=0.1, fr;q=0")).toEqual(["ro", "en"]);
  expect(matchLocale("mo")).toBe("ro");
});
