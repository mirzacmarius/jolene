import { expect, test } from "bun:test";
import { readCatalog } from "./files";
import { photoPath, photoStore, photoUrl } from "./photos";

const catalog = await readCatalog();
const photo = "https://jolene.ro/wp-content/uploads/2021/10/a-1.jpg";

test("a photo keeps its path in jolene.ro's uploads", () => {
  expect(photoPath(photo)).toBe("jolene.ro/2021/10/a-1.jpg");
  expect(() => photoPath("https://example.com/a.jpg")).toThrow();
});

test("the shop shows photos from the store once it has its address", () => {
  if (photoStore) {
    expect(photoStore).toMatch(
      /^https:\/\/\w+\.public\.blob\.vercel-storage\.com$/,
    );
    expect(photoUrl(photo)).toBe(`${photoStore}/jolene.ro/2021/10/a-1.jpg`);
  } else expect(photoUrl(photo)).toBe(photo);
});

test("every photo of the catalog has a path in the store", () => {
  for (const product of catalog.products)
    for (const image of product.images)
      expect(photoPath(image.url)).toMatch(
        /^jolene\.ro\/\d{4}\/\d{2}\/[\w.-]+\.(jpe?g|png)$/i,
      );
});
