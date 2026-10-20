/** Elements a description keeps, without attributes. */
const kept = new Set([
  "br",
  "em",
  "h2",
  "h3",
  "h4",
  "hr",
  "li",
  "ol",
  "p",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

/** Elements that become kept ones; the product's title is the page's h1. */
const renamed: Record<string, string> = { b: "strong", h1: "h2", i: "em" };

/** Elements dropped with what they hold. */
const dropped = new Set(["button", "form", "iframe", "noscript", "script"]);

/** Elements that hold nothing once the description is clean. */
const empty =
  /<(em|h2|h3|h4|li|ol|p|strong|ul)>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/\1>/g;

/**
 * A product's description for Shopify, from jolene.ro's short and long
 * ones: the formatting kept, everything else left out, such as the
 * attributes pasted in with the text ("data-path-to-node") and the spans
 * around it.
 */
export function cleanDescription(...parts: (string | null)[]): string {
  const rewriter = new HTMLRewriter().on("*", {
    element(element) {
      const tag = element.tagName.toLowerCase();
      const kind = renamed[tag] ?? tag;
      if (dropped.has(tag)) element.remove();
      else if (!kept.has(kind)) element.removeAndKeepContent();
      else {
        for (const [name] of [...element.attributes])
          element.removeAttribute(name);
        if (kind !== tag) element.tagName = kind;
      }
    },
  });
  let html = rewriter.transform(parts.filter(Boolean).join("\n"));
  for (let before = ""; before !== html; ) {
    before = html;
    html = html.replace(empty, "");
  }
  return html.replace(/\n\s*\n/g, "\n").trim();
}
