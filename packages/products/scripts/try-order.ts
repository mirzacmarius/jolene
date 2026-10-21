/**
 * Tries an order on the live shop as a couple would, without paying: opens a
 * product with its first paper, chooses its first paid choice and the answers
 * it asks for, ticks its fee, adds its minimum order to the cart and goes on
 * to Shopify's checkout. It writes what each step showed to report.md, with a
 * screenshot of each, to check that the cart adds the extras and fee lines
 * by itself and that checkout shows them.
 *
 *   bun scripts/try-order.ts [--shop <address>] [--product <handle>] [--out <folder>] [--chrome <path>]
 *
 * It runs Google Chrome, or the Chromium that --chrome names.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Page } from "playwright-core";
import { fees, readCatalog } from "../src";
import { extras, feeProductInput } from "../src/shopify/inputs";

const { values } = parseArgs({
  options: {
    shop: { type: "string", default: "https://www.orvibo.it" },
    product: { type: "string", default: "invitatie-nunta-olive-goldy" },
    out: { type: "string", default: "order" },
    chrome: { type: "string" },
  },
});
const shop = new URL(values.shop);
const out = values.out;
await mkdir(out, { recursive: true });

const catalog = await readCatalog();
const product = catalog.products.find((p) => p.handle === values.product);
if (!product) throw new Error(`The catalog has no product "${values.product}"`);
const lineOptions = product.lineOptions.flatMap(
  (handle) =>
    catalog.lineOptions.find((option) => option.handle === handle) ?? [],
);
const quantity = product.minQuantity ?? 1;
const fee = product.fees[0] ? fees[product.fees[0]] : undefined;
const feeTitle = fee ? feeProductInput(fee.product).title : undefined;

/** An amount of lei as the shop writes it, before its currency: "1,50". */
const amount = (lei: number) =>
  lei.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type Step = { name: string; ok: boolean; notes: string[]; shot?: string };
const steps: Step[] = [];
const problems: string[] = [];

const browser = await chromium.launch(
  values.chrome ? { executablePath: values.chrome } : { channel: "chrome" },
);
const page = await browser.newPage({
  locale: "ro-RO",
  viewport: { width: 1280, height: 900 },
});
page.on("pageerror", (error) =>
  problems.push(`${page.url()}: ${error.message}`),
);
page.on("console", (message) => {
  if (message.type() === "error")
    problems.push(`${page.url()}: ${message.text()}`);
});

/**
 * Runs a step and screenshots the page after it. A step that fails ends the
 * trial, since each one needs the one before.
 */
async function step(name: string, run: (notes: string[]) => Promise<void>) {
  const notes: string[] = [];
  let ok = true;
  try {
    await run(notes);
  } catch (error) {
    ok = false;
    notes.push(
      error instanceof Error
        ? (error.message.split("\n")[0] ?? error.message)
        : String(error),
    );
  }
  const shot = `${steps.length + 1}.png`;
  await page
    .screenshot({ path: join(out, shot), fullPage: true })
    .catch(() => undefined);
  steps.push({ name, ok, notes, shot });
  return ok;
}

/** The cart's lines once Shopify and the cart's own changes have settled. */
async function settledLines(page: Page) {
  let previous = "";
  for (let tries = 0; tries < 30; tries++) {
    await page.waitForTimeout(1500);
    const lines = await cartLines.evaluateAll((items) =>
      items.map((item) => ({
        title: item.getAttribute("aria-label") ?? "",
        busy: item.getAttribute("aria-busy") === "true",
        text: (item as HTMLElement).innerText,
        quantity: item.querySelector<HTMLInputElement>(
          'input[aria-label="Cantitate"]',
        )?.value,
      })),
    );
    const now = JSON.stringify(lines);
    const pending = lines.some(
      (line) => line.busy || line.text.includes("Se actualizează"),
    );
    if (lines.length && !pending && now === previous) return lines;
    previous = now;
  }
  throw new Error("The cart didn't settle in 45 seconds.");
}

const productUrl = new URL(`/products/${product.handle}`, shop);
for (const option of product.options)
  productUrl.searchParams.set(option.name, option.values[0]?.name ?? "");
const cartLines = page.locator('ul[aria-label="Produse în coș"] > li');
/** The answers chosen, and the lei they add to each one ordered. */
const chosen: string[] = [];
let perItem = 0;

const trial =
  (await step("Open the product", async (notes) => {
    const response = await page.goto(productUrl.href);
    if (!response?.ok())
      throw new Error(`${productUrl.href} answered ${response?.status()}.`);
    notes.push(`${productUrl.href}`);
    const title = (await page.locator("h1").first().textContent())?.trim();
    notes.push(`Title: ${title}`);
    // A product Shopify doesn't return still answers 200 with the shop's own Not Found page.
    if (title !== product.title)
      throw new Error(`The page shows "${title}", not ${product.title}.`);
    for (const option of product.options)
      notes.push(`${option.name}: ${option.values[0]?.name}`);
  })) &&
  (await step("Choose the order options", async (notes) => {
    const form = page.locator("fieldset", {
      has: page.locator("legend", { hasText: "Opțiuni de comandă" }),
    });
    await form.waitFor({ timeout: 15_000 });
    for (const option of lineOptions) {
      const control = form.getByLabel(option.label, { exact: true });
      if (option.kind === "select") {
        const choice =
          (perItem ? undefined : option.choices.find((c) => c.price > 0)) ??
          (option.required ? option.choices[0] : undefined);
        if (!choice) continue;
        await control.selectOption(choice.label);
        perItem += choice.price;
        chosen.push(`${option.label}: ${choice.label}`);
        notes.push(
          `${option.label}: ${choice.label}${choice.price ? ` (+${amount(choice.price)} lei/buc.)` : ""}`,
        );
      } else if (option.required) {
        const text =
          option.kind === "email"
            ? "proba@example.com"
            : "Ana & Mihai, probă de comandă";
        await control.fill(text);
        chosen.push(`${option.label}: ${text}`);
        notes.push(`${option.label}: ${text}`);
      }
    }
    if (fee) {
      const box = form
        .locator("label", { has: page.getByRole("checkbox") })
        .first();
      await box.getByRole("checkbox").check();
      notes.push(
        `Fee ticked: ${(await box.innerText()).replace(/\s+/g, " ").trim()}`,
      );
    }
    const refusal = page.getByText(
      /ca să adaugi în coș|nu se pot comanda online/,
    );
    if (await refusal.count())
      throw new Error((await refusal.first().innerText()).trim());
    const status = form.getByRole("status");
    if (await status.count())
      notes.push((await status.first().innerText()).trim());
  })) &&
  (await step("Add the minimum order to the cart", async (notes) => {
    await page.getByRole("button", { name: "Adaugă în coș" }).click();
    // The cart opens beside the page with the new line.
    await cartLines
      .filter({ hasText: product.title })
      .first()
      .waitFor({ timeout: 30_000 });
    notes.push(`Quantity: ${quantity} (the minimum order)`);
    await page.waitForTimeout(2000);
    await page.goto(new URL("/cart", shop).href);
    const lines = await settledLines(page);
    for (const line of lines)
      notes.push(
        `Line "${line.title}"${line.quantity ? `, quantity ${line.quantity}` : ""}: ${line.text.replace(/\s+/g, " ").trim()}`,
      );
    const main = lines.find((line) => line.title === product.title);
    if (!main) throw new Error(`The cart has no line for ${product.title}.`);
    if (main.quantity !== String(quantity))
      throw new Error(
        `${product.title} is in the cart ${main.quantity} times, not ${quantity}.`,
      );
    if (perItem) {
      const expected = `${extras.title}: +${amount(perItem)}`;
      if (!main.text.includes(expected))
        throw new Error(
          `${product.title}'s line doesn't say "${expected} lei/buc.".`,
        );
      notes.push(`Extras line: ${expected} lei/buc. ✓`);
    }
    if (fee) {
      const feeLine = lines.find((line) =>
        line.text.includes("O dată pe comandă"),
      );
      if (!feeLine) throw new Error("The cart has no fee line.");
      if (!feeLine.text.includes(amount(fee.price)))
        throw new Error(
          `The fee line "${feeLine.title}" isn't ${amount(fee.price)} lei.`,
        );
      notes.push(`Fee line: ${feeLine.title}, ${amount(fee.price)} lei ✓`);
    }
  })) &&
  (await step("Go on to Shopify's checkout", async (notes) => {
    await page.getByRole("button", { name: "Mergi la plată" }).click();
    const left = await page
      .waitForURL(
        (url) =>
          url.host !== shop.host || url.pathname.startsWith("/checkouts"),
        { timeout: 45_000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!left) {
      const alert = page.getByRole("alert");
      throw new Error(
        (await alert.count())
          ? `The cart refused: ${(await alert.first().innerText()).trim()}`
          : "The cart didn't go on to checkout in 45 seconds.",
      );
    }
    const shown = await page
      .getByText(product.title)
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    const url = new URL(page.url());
    notes.push(
      `Checkout: ${url.origin}${url.pathname}, "${await page.title()}"`,
    );
    if (
      url.pathname.startsWith("/password") ||
      (await page.locator('input[type="password"]').count())
    )
      throw new Error("Shopify asks for the store's password before checkout.");
    if (!shown)
      throw new Error(`Checkout doesn't show ${product.title} in 30 seconds.`);
    const summary = page.locator("aside, [role=complementary]").first();
    const text = await ((await summary.count())
      ? summary
      : page.locator("body")
    ).innerText();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines.slice(0, 40))
      notes.push(`Checkout shows: ${line}`);
    const absent = [
      ...(perItem ? [extras.title] : []),
      ...(feeTitle ? [feeTitle] : []),
    ].filter((title) => !text.includes(title));
    if (absent.length)
      throw new Error(`Checkout doesn't show ${absent.join(" or ")}.`);
  }));

await browser.close();

const report = [
  `# Trying an order on ${shop.host}`,
  "",
  `${product.title} (${product.handle}), ${quantity} buc.${chosen.map((answer) => `, ${answer}`).join("")}${fee ? `, ${feeTitle} ${fee.variant}` : ""}. Nothing is paid.`,
  "",
  ...steps.flatMap((s, index) => [
    `## ${index + 1}. ${s.name}: ${s.ok ? "✓" : "✗"}`,
    "",
    ...s.notes.map((note) => `- ${note}`),
    ...(s.shot ? [`- Screenshot: ${s.shot}`] : []),
    "",
  ]),
  ...(problems.length
    ? [
        "## Errors in the pages",
        "",
        ...[...new Set(problems)].map((p) => `- ${p}`),
        "",
      ]
    : []),
].join("\n");
await Bun.write(join(out, "report.md"), report);
console.info(report);
if (!trial) process.exit(1);
