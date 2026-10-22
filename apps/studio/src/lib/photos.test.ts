import { describe, expect, test } from "bun:test";
import { optimizable } from "./photos";

describe("optimizable", () => {
  test("takes the photo store, Convex's storage and jolene.ro", () => {
    expect(
      optimizable(
        "https://tnmeb8t2pe4ritq0.public.blob.vercel-storage.com/jolene.ro/2020/11/meniu4.jpg",
      ),
    ).toBe(true);
    expect(
      optimizable("https://quaint-ibis-260.convex.cloud/api/storage/abc"),
    ).toBe(true);
    expect(optimizable("https://jolene.ro/wp-content/uploads/a.jpg")).toBe(
      true,
    );
  });

  test("leaves anything else as it is", () => {
    expect(optimizable("http://127.0.0.1:3210/api/storage/abc")).toBe(false);
    expect(optimizable("https://convex.cloud.example.com/a.jpg")).toBe(false);
    expect(optimizable("/studio/art/a.webp")).toBe(false);
  });
});
