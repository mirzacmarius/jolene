import { describe, expect, test } from "bun:test";
import { romanianCounty } from "./counties";

describe("romanianCounty", () => {
  test("reads the county Stripe gave, as a code or however it's written", () => {
    expect(romanianCounty("IS", null)).toBe("Iași");
    expect(romanianCounty("RO-CJ", null)).toBe("Cluj");
    expect(romanianCounty("b", null)).toBe("București");
    expect(romanianCounty("Judetul Iasi", null)).toBe("Iași");
    expect(romanianCounty("bistrita nasaud", null)).toBe("Bistrița-Năsăud");
    expect(romanianCounty(" Satu-Mare ", null)).toBe("Satu Mare");
  });

  test("finds it from the postal code when Stripe gave none", () => {
    expect(romanianCounty(null, "700259")).toBe("Iași");
    expect(romanianCounty("", "400 000")).toBe("Cluj");
    expect(romanianCounty(undefined, "030167")).toBe("București");
    expect(romanianCounty(null, "077190")).toBe("Ilfov");
    expect(romanianCounty("Sector 3", "030167")).toBe("București");
    expect(romanianCounty(null, "731001")).toBe("Vaslui");
  });

  test("keeps what it can't place, and has nothing without either", () => {
    expect(romanianCounty("Moldova", null)).toBe("Moldova");
    expect(romanianCounty(null, "99999")).toBeUndefined();
    expect(romanianCounty(null, "990000")).toBeUndefined();
    expect(romanianCounty(null, null)).toBeUndefined();
  });
});
