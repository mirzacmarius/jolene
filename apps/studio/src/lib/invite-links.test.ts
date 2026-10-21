import { describe, expect, test } from "bun:test";
import {
  fill,
  internationalNumber,
  smsLink,
  whatsappLink,
} from "./invite-links";

describe("internationalNumber", () => {
  test("gives a Romanian number written the local way Romania's code", () => {
    expect(internationalNumber("0722 123 456")).toBe("40722123456");
    expect(internationalNumber("+40 (722) 123-456")).toBe("40722123456");
    expect(internationalNumber("0040722123456")).toBe("40722123456");
    expect(internationalNumber("+44 7700 900123")).toBe("447700900123");
  });

  test("is null for what isn't a number", () => {
    expect(internationalNumber("de sunat")).toBeNull();
    expect(internationalNumber("123")).toBeNull();
  });
});

describe("message links", () => {
  test("open WhatsApp and the phone's messages with the text written in", () => {
    expect(whatsappLink("Vă invităm & așteptăm", "0722 123 456")).toBe(
      "https://wa.me/40722123456?text=V%C4%83%20invit%C4%83m%20%26%20a%C8%99tept%C4%83m",
    );
    expect(whatsappLink("Salut")).toBe("https://wa.me/?text=Salut");
    expect(smsLink("Salut", "0722 123 456")).toBe("sms:0722123456?&body=Salut");
  });

  test("fill only the placeholders they're given", () => {
    expect(
      fill("{name}, iată: {link} {other}", { name: "Ana", link: "x" }),
    ).toBe("Ana, iată: x {other}");
  });
});
