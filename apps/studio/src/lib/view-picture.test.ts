import { describe, expect, test } from "bun:test";
import {
  eucaliptFields,
  eucaliptPlaceCard,
  parseDocument,
} from "@jolene/design";
import { pictureKey } from "./view-picture";

const card = parseDocument(eucaliptPlaceCard);

describe("pictureKey", () => {
  test("changes with the revision and with the details the design shows", () => {
    const key = pictureKey(3, card, eucaliptFields);
    expect(key).toStartWith("3:");
    expect(key.length).toBeLessThanOrEqual(100);
    expect(pictureKey(3, card, { ...eucaliptFields })).toBe(key);
    expect(pictureKey(4, card, eucaliptFields)).not.toBe(key);
    expect(
      pictureKey(3, card, { ...eucaliptFields, guestName: "Familia Pop" }),
    ).not.toBe(key);
  });

  test("stays the same when a detail the design doesn't show changes", () => {
    const key = pictureKey(3, card, eucaliptFields);
    expect(
      pictureKey(3, card, { ...eucaliptFields, rsvpContact: "0722 000 000" }),
    ).toBe(key);
  });
});
