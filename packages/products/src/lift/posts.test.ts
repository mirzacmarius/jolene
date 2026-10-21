import { describe, expect, test } from "bun:test";
import type { Catalog } from "../catalog";
import {
  liftPost,
  linkTarget,
  type PostContext,
  parseHtml,
  photoCandidates,
  postPhotoSources,
  type WordPressPost,
} from "./posts";

const uploads = "https://jolene.ro/wp-content/uploads/2019/04";

const context: PostContext = {
  catalog: {
    categories: [{ handle: "invitatii-nunta", title: "Invitații nuntă" }],
    products: [
      {
        handle: "invitatie-nunta-venice",
        woo: { id: 1, path: "/produs/invitatie-nunta-venice/" },
      },
    ] as Catalog["products"],
  },
  slugs: new Set(["un-mers-in-cerc"]),
  photos: new Map([
    [
      `${uploads}/a-768x1024.jpg`,
      { url: `${uploads}/a.jpg`, width: 1500, height: 2000 },
    ],
    [
      `${uploads}/b-300x300.jpg`,
      { url: `${uploads}/b.jpg`, width: 1200, height: 1200 },
    ],
  ]),
};

function post(
  content: string,
  extra: Partial<WordPressPost> = {},
): WordPressPost {
  return {
    slug: "despre-text",
    date: "2019-04-11T10:00:00",
    modified: "2019-05-02T12:30:00",
    title: { rendered: "Despre &#8222;text&#8221;" },
    excerpt: { rendered: "<p>Primul rând &hellip; [&hellip;]</p>" },
    content: { rendered: content },
    ...extra,
  };
}

describe("parseHtml", () => {
  test("decodes text and attributes", () => {
    const root = parseHtml('<p title="a&amp;b">x&nbsp;&amp; y</p>');
    expect(root.children).toEqual([
      { tag: "p", attrs: { title: "a&b" }, children: ["x & y"] },
    ]);
  });

  test("ends a paragraph where a block starts, as a browser does", () => {
    const root = parseHtml("<p>a<div>b</div><h4>c</h4><p>d</p></p>");
    expect(
      root.children.map((child) =>
        typeof child === "string" ? child : child.tag,
      ),
    ).toEqual(["p", "div", "h4", "p"]);
  });
});

describe("photoCandidates", () => {
  test("tries the largest copy, the linked file, then the original", () => {
    const [img] = parseHtml(
      `<img src="${uploads}/a-300x400.jpg" srcset="${uploads}/a-300x400.jpg 300w, https://www.jolene.ro/wp-content/uploads/2019/04/a-768x1024.jpg 768w">`,
    ).children as ReturnType<typeof parseHtml>[];
    expect(photoCandidates(img!, `${uploads}/a.jpg`)).toEqual([
      `${uploads}/a-768x1024.jpg`,
      `${uploads}/a.jpg`,
      `${uploads}/a-300x400.jpg`,
    ]);
  });

  test("finds the featured photo with the others", () => {
    const sources = postPhotoSources(
      post(
        `<a href="${uploads}/b.jpg"><img src="${uploads}/b-300x300.jpg"></a>`,
        {
          _embedded: {
            "wp:featuredmedia": [{ source_url: `${uploads}/a.jpg` }],
          },
        },
      ),
    );
    expect([...sources.keys()]).toEqual([
      `${uploads}/a.jpg`,
      `${uploads}/b-300x300.jpg`,
    ]);
    expect(sources.get(`${uploads}/b-300x300.jpg`)).toEqual([
      `${uploads}/b.jpg`,
      `${uploads}/b-300x300.jpg`,
    ]);
  });
});

describe("linkTarget", () => {
  test.each([
    [
      "https://jolene.ro/produs/invitatie-nunta-venice/",
      "/products/invitatie-nunta-venice",
    ],
    ["https://jolene.ro/produs/invitatie-retrasa/", null],
    [
      "https://jolene.ro/categorie-produs/nunta/invitatii-nunta/",
      "/collections/invitatii-nunta",
    ],
    ["https://www.jolene.ro/un-mers-in-cerc/", "/un-mers-in-cerc"],
    ["https://jolene.ro/un-mers-in-cerc/poza-1/", null],
    ["https://jolene.ro/?s=invitatii+rustice", "/search?q=invitatii%20rustice"],
    ["https://jolene.ro/shop-jolene/", "/collections/all"],
    ["https://jolene.ro/contact-jolene/", "mailto:invitatii.jolene@gmail.com"],
    [`${uploads}/a.jpg`, null],
    [
      "https://www.instagram.com/jolene.ro/",
      "https://www.instagram.com/jolene.ro/",
    ],
    ["tel:+40740000000", "tel:+40740000000"],
    ["javascript:void(0)", null],
  ])("%s", (href, target) => {
    expect(linkTarget(href, context)).toBe(target);
  });
});

describe("liftPost", () => {
  test("reads the title, dates and description", () => {
    const lifted = liftPost(post("<p>x</p>"), context);
    expect(lifted).toMatchObject({
      slug: "despre-text",
      title: "Despre „text”",
      publishedOn: "2019-04-11",
      updatedOn: "2019-05-02",
      description: "Primul rând …",
    });
  });

  test("keeps the text's emphasis, links and spaces", () => {
    const { blocks } = liftPost(
      post(
        '<p class="has-text-align-center">Vezi <strong>modelul <a href="https://jolene.ro/produs/invitatie-nunta-venice/">Venice</a></strong> și <span>restul</span>.<br><br></p>',
      ),
      context,
    );
    expect(blocks).toEqual([
      {
        kind: "paragraph",
        centered: true,
        children: [
          "Vezi ",
          {
            kind: "strong",
            children: [
              "modelul ",
              {
                kind: "link",
                href: "/products/invitatie-nunta-venice",
                children: ["Venice"],
              },
            ],
          },
          " și restul.",
        ],
      },
    ]);
  });

  test("gives the post's biggest heading the level after the title", () => {
    const { blocks } = liftPost(
      post("<h4><strong>Prima</strong></h4><h5>A doua</h5><h6>A treia</h6>"),
      context,
    );
    expect(blocks).toEqual([
      { kind: "heading", level: 2, children: ["Prima"] },
      { kind: "heading", level: 3, children: ["A doua"] },
      { kind: "heading", level: 4, children: ["A treia"] },
    ]);
  });

  test("takes photos out of the text, at their full size, with their captions", () => {
    const { blocks } = liftPost(
      post(
        `<p>Înainte<img src="${uploads}/a-768x1024.jpg" alt="invitatie_nunta">după</p>` +
          `<figure class="wp-block-gallery"><ul><li><figure><img src="${uploads}/a-768x1024.jpg"><figcaption>Venice</figcaption></figure></li>` +
          `<li><figure><img src="${uploads}/b-300x300.jpg"><figcaption>poza_b</figcaption></figure></li>` +
          `<li><figure><img src="${uploads}/lipsa.jpg"></figure></li></ul></figure>`,
      ),
      context,
    );
    expect(blocks).toEqual([
      { kind: "paragraph", children: ["Înainte"] },
      {
        kind: "photos",
        photos: [
          {
            url: `${uploads}/a.jpg`,
            width: 1500,
            height: 2000,
            alt: "invitatie nunta",
          },
        ],
      },
      { kind: "paragraph", children: ["după"] },
      {
        kind: "photos",
        photos: [
          {
            url: `${uploads}/a.jpg`,
            width: 1500,
            height: 2000,
            alt: "Despre „text”",
            caption: ["Venice"],
          },
          {
            url: `${uploads}/b.jpg`,
            width: 1200,
            height: 1200,
            alt: "Despre „text”",
          },
        ],
      },
    ]);
  });

  test("reads lists, quotes, tables, videos and rules", () => {
    const { blocks } = liftPost(
      post(
        "<ol><li><p>Unu</p></li><li>Doi</li></ol><blockquote><p>Citat</p></blockquote>" +
          "<figure><table><tr><td>Ora <strong>13:00</strong></td><td>Cununia</td></tr></table></figure>" +
          '<figure class="wp-block-embed"><iframe src="https://www.youtube.com/embed/GnW64fM-uh4?feature=oembed"></iframe></figure>' +
          "<hr><style>#g{}</style><div><p>În div</p></div>",
      ),
      context,
    );
    expect(blocks).toEqual([
      { kind: "list", ordered: true, items: [["Unu"], ["Doi"]] },
      { kind: "quote", paragraphs: [["Citat"]] },
      {
        kind: "table",
        rows: [
          [["Ora ", { kind: "strong", children: ["13:00"] }], ["Cununia"]],
        ],
      },
      { kind: "video", url: "https://www.youtube.com/watch?v=GnW64fM-uh4" },
      { kind: "rule" },
      { kind: "paragraph", children: ["În div"] },
    ]);
  });
});
