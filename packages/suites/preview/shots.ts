// Each collection's invitation, lifelike on a transparent ground, as the
// shop's home page shows it: bun run shots. Playwright's Chromium must be
// installed (bunx playwright-core install chromium).
import { chromium } from "playwright-core";
import { suites } from "../src";
import page from "./shots.html";

const studioPublic = new URL("../../../apps/studio/public/", import.meta.url);
const out = new URL(
  "../../../apps/shop/components/home/collections/",
  import.meta.url,
);

const server = Bun.serve({
  port: 0,
  routes: { "/": page },
  async fetch(request) {
    const file = Bun.file(
      new URL(`.${new URL(request.url).pathname}`, studioPublic),
    );
    return (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
});

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 2400 } });
for (const suite of suites) {
  await tab.goto(new URL(`/?suite=${suite.slug}`, server.url).href);
  await tab.waitForFunction(() => document.body.dataset.ready === "true");
  const png = await tab.locator("main").screenshot({ omitBackground: true });
  // Screenshots are PNG or JPEG; the browser's own encoder keeps the alpha.
  const webp = await tab.evaluate(async (base64) => {
    const source = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await source.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: 0.9,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, png.toString("base64"));
  const file = new URL(`${suite.slug}.webp`, out);
  await Bun.write(file, Buffer.from(webp, "base64"));
  console.info(`Wrote ${file.pathname}`);
}
await browser.close();
await server.stop();
