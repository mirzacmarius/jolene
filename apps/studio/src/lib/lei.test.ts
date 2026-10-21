import { describe, expect, test } from "bun:test";
import { leiField, parseLei } from "./lei";

describe("parseLei", () => {
  test("reads lei as Romanians and others type them", () => {
    expect(parseLei("300")).toBe(30_000);
    expect(parseLei(" 300,5 ")).toBe(30_050);
    expect(parseLei("300.05")).toBe(30_005);
    expect(parseLei("1000,00 lei")).toBe(100_000);
    expect(parseLei("0")).toBe(0);
  });

  test("reads nothing it could misread", () => {
    for (const text of [
      "",
      "lei",
      "1.000,50",
      "1,000.50",
      "10,505",
      "-5",
      "5e3",
      "3 00",
    ])
      expect(parseLei(text)).toBeNull();
  });
});

describe("leiField", () => {
  test("writes bani as the field reads them back", () => {
    expect(leiField(100_050, "ro")).toBe("1000,50");
    expect(leiField(100_050, "en")).toBe("1000.50");
    expect(parseLei(leiField(70_001, "ro"))).toBe(70_001);
  });
});
