import { describe, expect, test } from "bun:test";
import { sameSecret, visitorKey } from "./visitor";

describe("sameSecret", () => {
  test("takes the secret alone", () => {
    expect(sameSecret("s3cret-shop", "s3cret-shop")).toBe(true);
    for (const given of ["s3cret-shoq", "s3cret-sho", "s3cret-shop!", ""])
      expect(sameSecret(given, "s3cret-shop")).toBe(false);
  });
});

describe("visitorKey", () => {
  test("is an IPv4 address itself, the first of several", () => {
    expect(visitorKey("203.0.113.7")).toBe("203.0.113.7");
    expect(visitorKey(" 203.0.113.7, 10.0.0.1")).toBe("203.0.113.7");
    expect(visitorKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  test("is an IPv6 address's /64, however it's written", () => {
    const network = "2001:db8:1:2::/64";
    for (const address of [
      "2001:db8:1:2:3:4:5:6",
      "2001:0db8:0001:0002:ffff:0:0:1",
      "2001:DB8:1:2::",
      "2001:db8:1:2::9",
    ])
      expect(visitorKey(address)).toBe(network);
    expect(visitorKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(visitorKey("::1")).toBe("0:0:0:0::/64");
    expect(visitorKey("2001:db8:1:3::1")).not.toBe(network);
  });
});
