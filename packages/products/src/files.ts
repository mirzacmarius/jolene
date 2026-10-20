import { join } from "node:path";
import type { Catalog } from "./catalog";

/** Where the lift writes the catalog and the sync reads it. */
export const catalogFolder = join(import.meta.dir, "../catalog");

const files = {
  products: "products.json",
  lineOptions: "line-options.json",
  categories: "categories.json",
} as const;

export async function readCatalog(folder = catalogFolder): Promise<Catalog> {
  const read = (name: string) => Bun.file(join(folder, name)).json();
  return {
    products: await read(files.products),
    lineOptions: await read(files.lineOptions),
    categories: await read(files.categories),
  };
}

export async function writeCatalog(
  catalog: Catalog,
  folder = catalogFolder,
): Promise<void> {
  for (const [part, name] of Object.entries(files))
    await Bun.write(
      join(folder, name),
      `${JSON.stringify(catalog[part as keyof Catalog], null, 2)}\n`,
    );
}
