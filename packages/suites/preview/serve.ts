// Every template with its sample details, drawn by the studio's own renderer
// without a backend: bun run preview, then open the address it prints.
import page from "./index.html";

const studioPublic = new URL("../../../apps/studio/public/", import.meta.url);

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3030),
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
console.info(`Templates: ${server.url}`);
