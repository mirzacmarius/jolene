import { describe, expect, test } from "bun:test";
import { cleanDescription } from "./descriptions";
import { readField, spellChoice } from "./fields";
import { imageUrl } from "./images";
import { liftCatalog, type Source } from "./lift";
import { feesIn, minQuantity } from "./terms";
import { cleanTitle } from "./titles";
import type { WooField, WooProduct } from "./woo";

describe("cleanTitle", () => {
  test.each([
    ["MĂRTURIE BOTEZ LUMANARE Iepuraș", "Mărturie botez lumânare Iepuraș"],
    ["INVITATIE BOTEZ PINK ELEPHANT", "Invitație botez Pink Elephant"],
    ["PLIC BANI NUNTA Frunză Verde", "Plic de bani nuntă Frunză Verde"],
    ["Inivtație de nună ROSE DIAPHANE", "Invitație de nuntă Rose Diaphane"],
    [
      "Invitatie Botez Animăluțe în balon",
      "Invitație Botez Animăluțe în balon",
    ],
    ["RSVP Card  FOREST", "RSVP Card Forest"],
    ["Felicitare Ho-Ho-Ho", "Felicitare Ho-Ho-Ho"],
    ["INVITAȚIE De NUNTĂ Yellow Flowers", "Invitație de nuntă Yellow Flowers"],
  ])("%s", (title, clean) => {
    expect(cleanTitle(title)).toBe(clean);
  });
});

describe("cleanDescription", () => {
  test("keeps the formatting and nothing else", () => {
    expect(
      cleanDescription(
        '<p data-path-to-node="3"><span style="color:red">Carton <b>300 gr</b></span></p>',
        '<h1 class="x">Detalii</h1><script>track()</script><p>&nbsp;</p><ul><li>Plic</li><li><br /></li></ul>',
      ),
    ).toBe(
      "<p>Carton <strong>300 gr</strong></p>\n<h2>Detalii</h2><ul><li>Plic</li></ul>",
    );
  });

  test("reads a product with no short description", () => {
    expect(cleanDescription(null, "<p>Plic</p>")).toBe("<p>Plic</p>");
  });
});

describe("readField", () => {
  test("reads the label's required mark and hint", () => {
    expect(
      readField("Text personalizat * Textul ce va apărea pe plic.", "text"),
    ).toEqual({
      key: "text-personalizat",
      label: "Text personalizat",
      hint: "Textul ce va apărea pe plic.",
      required: true,
      variant: false,
    });
  });

  test("knows a field by its longest start", () => {
    expect(readField("Culoare panglica", "panglica").key).toBe(
      "culoare-panglica",
    );
    expect(readField("Panglica *", "panglica").key).toBe("panglica");
  });

  test("reads a field without a label by its name", () => {
    expect(readField(null, "culoare_sigiliu")).toMatchObject({
      key: "culoare-sigiliu",
      required: false,
    });
  });

  test("makes paper and colours Shopify's options", () => {
    expect(readField("Carton *", "carton").variant).toBe(true);
    expect(readField("Culoare sigiliu", "sigiliu").variant).toBe(false);
  });

  test("refuses a field it doesn't know", () => {
    expect(() => readField("Gravură", "gravura")).toThrow("Gravură");
  });
});

describe("spellChoice", () => {
  test("adds diacritics", () => {
    expect(spellChoice("culoare-sigiliu", "Fara  sigiliu")).toBe(
      "Fără sigiliu",
    );
  });

  test("corrects a choice for one option only", () => {
    expect(spellChoice("culoare-plic", "Fără panglică")).toBe("Fără plic");
    expect(spellChoice("panglica", "Fără panglică")).toBe("Fără panglică");
  });
});

describe("minQuantity", () => {
  test.each([
    ["Comandă minimă: 30 buc.", 30],
    ["Cantitate minimă: 20 buc", 20],
    ["Număr minim de comandă: 40 buc.", 40],
    ["Comanda minima este de 30 bucăți.", 30],
    ["Recomandăm minimum 2 meniuri per masă.", undefined],
    ["Plic de bani.", undefined],
  ])("%s", (text, minimum) => {
    expect(minQuantity(text)).toBe(minimum);
  });

  test("refuses two minimums", () => {
    expect(() =>
      minQuantity("Comandă minimă 30 buc. Comandă minimă 20 buc."),
    ).toThrow("30, 20");
  });
});

describe("feesIn", () => {
  test("finds the diacritics and urgency fees", () => {
    expect(
      feesIn(
        "Diacriticele se adaugă contra cost – 50 ron. Comenzile urgente au o taxă de urgență de 200 ron.",
      ),
    ).toEqual(["diacritice-50", "comanda-urgenta"]);
    expect(feesIn("Diacritice: 10 lei.")).toEqual(["diacritice-10"]);
    expect(feesIn("Livrare în 5 zile.")).toEqual([]);
  });

  test("refuses a fee it doesn't know", () => {
    expect(() => feesIn("Diacriticele costă 30 lei.")).toThrow("30 lei");
  });
});

describe("imageUrl", () => {
  const image = {
    url: "https://jolene.ro/a.jpg",
    scaled_url: "https://jolene.ro/a-scaled.jpg",
    filename: "a.jpg",
    alt: "",
  };
  const label = { path: "images/a/a.jpg", width: 4000, height: 3000 };

  test("takes the original when Shopify does", () => {
    expect(imageUrl(image, { ...label, bytes: 3_000_000 })).toBe(image.url);
  });

  test("takes WordPress's copy of an image too big for Shopify", () => {
    expect(imageUrl(image, { ...label, width: 6000, bytes: 3_000_000 })).toBe(
      image.scaled_url,
    );
    expect(imageUrl(image, { ...label, bytes: 25_000_000 })).toBe(
      image.scaled_url,
    );
    expect(imageUrl(image)).toBe(image.scaled_url);
  });
});

describe("liftCatalog", () => {
  const seal = (prices: string[]): WooField => ({
    name: "culoare_sigiliu",
    type: "select",
    label: "Culoare sigiliu",
    conditional: false,
    options: [
      { label: "Fara sigiliu", price: null },
      { label: "Roșu", price: prices[0] ?? null },
    ],
  });
  const product = (
    id: number,
    slug: string,
    fields: WooField[],
    more: Partial<WooProduct> = {},
  ): WooProduct => ({
    id,
    name: slug.toUpperCase().replaceAll("-", " "),
    slug,
    permalink: `https://jolene.ro/produs/${slug}/`,
    categories: [{ id: 11, name: "Invitații cu sigiliu", slug: "sigiliu" }],
    tags: [],
    price: { currency: "RON", price: 7, regular: 7, sale: null },
    short_description_html: null,
    description_html: "<p>Comandă minimă 30 bucăți.</p>",
    options: fields,
    images: [],
    ...more,
  });
  const source = (products: WooProduct[]): Source => ({
    products,
    categories: [
      { id: 10, name: "Nuntă &amp; botez", slug: "nunta-si-botez", parent: 0 },
      { id: 11, name: "Invitații cu sigiliu", slug: "sigiliu", parent: 10 },
      { id: 12, name: "Fără categorie", slug: "fara-categorie", parent: 0 },
    ],
    labels: [],
  });

  test("shares the options products ask the same way, the most asked first", () => {
    const catalog = liftCatalog(
      source([
        product(1, "invitatie-a", [seal(["1.50"])]),
        product(2, "invitatie-b", [seal(["1.50"])]),
        product(3, "invitatie-c", [seal(["1"])]),
      ]),
    );
    expect(catalog.lineOptions).toEqual([
      {
        handle: "culoare-sigiliu",
        key: "culoare-sigiliu",
        label: "Culoare sigiliu",
        kind: "select",
        required: false,
        choices: [
          { label: "Fără sigiliu", price: 0 },
          { label: "Roșu", price: 1.5 },
        ],
      },
      expect.objectContaining({
        handle: "culoare-sigiliu-2",
        choices: [
          { label: "Fără sigiliu", price: 0 },
          { label: "Roșu", price: 1 },
        ],
      }),
    ]);
    expect(catalog.products.map((p) => p.lineOptions)).toEqual([
      ["culoare-sigiliu"],
      ["culoare-sigiliu"],
      ["culoare-sigiliu-2"],
    ]);
  });

  test("keeps the labelled one of two fields asking the same", () => {
    const text = (label: string | null): WooField => ({
      name: "text_personalizat",
      type: "textarea",
      label,
      conditional: false,
    });
    const catalog = liftCatalog(
      source([
        product(1, "marturie", [text(null), text("Text personalizat *")]),
      ]),
    );
    expect(catalog.lineOptions).toMatchObject([
      { handle: "text-personalizat", required: true, choices: [] },
    ]);
  });

  test("makes paper a Shopify option priced by surcharges", () => {
    const paper: WooField = {
      name: "carton",
      type: "select",
      label: "Carton *",
      conditional: false,
      options: [
        { label: "Alb mat 300 gr", price: null },
        { label: "Alb sidef 300 gr", price: "1.50" },
      ],
    };
    const [lifted] = liftCatalog(source([product(1, "a", [paper])])).products;
    expect(lifted?.options).toEqual([
      {
        name: "Carton",
        values: [
          { name: "Alb mat 300 gr", surcharge: 0 },
          { name: "Alb sidef 300 gr", surcharge: 1.5 },
        ],
      },
    ]);
    expect(lifted?.lineOptions).toEqual([]);
  });

  test("reads a product's terms, sale, address and photos", () => {
    const photo = {
      url: "https://jolene.ro/b.jpg",
      scaled_url: "https://jolene.ro/b-scaled.jpg",
      filename: "b.jpg",
      alt: " ",
    };
    const [lifted] = liftCatalog(
      source([
        product(9, "invitatie_nunta_white_roses", [], {
          name: "INVITATIE NUNTA WHITE ROSES",
          price: { currency: "RON", price: 6, regular: 7, sale: 6 },
          categories: [
            { id: 11, name: "", slug: "sigiliu" },
            { id: 12, name: "", slug: "fara-categorie" },
          ],
          description_html:
            "<p>Comandă minimă 20 buc.</p><p>Diacriticele costă 50 ron.</p>",
          images: [photo, photo],
        }),
      ]),
    ).products;
    expect(lifted).toMatchObject({
      handle: "invitatie-nunta-white-roses",
      title: "Invitație nuntă White Roses",
      price: 6,
      compareAtPrice: 7,
      minQuantity: 20,
      fees: ["diacritice-50"],
      categories: ["nunta-si-botez", "sigiliu"],
      images: [{ url: photo.scaled_url, alt: "Invitație nuntă White Roses" }],
      woo: { id: 9, path: "/produs/invitatie_nunta_white_roses/" },
    });
  });

  test("keeps the categories it sells in", () => {
    const { categories } = liftCatalog(source([product(1, "a", [])]));
    expect(categories).toEqual([
      { handle: "nunta-si-botez", title: "Nuntă & botez" },
      { handle: "sigiliu", title: "Invitații cu sigiliu" },
    ]);
  });
});
