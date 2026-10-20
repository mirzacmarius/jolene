import { cacheLife, cacheTag } from "next/cache";

import type { CommerceLocale } from "@/lib/config/types";
import {
  EXTRAS_ATTRIBUTE,
  findExtrasVariant,
  getExtrasPerItem,
  getLineAttribute,
  getLineRole,
  getMissingOptions,
  getUnknownAnswers,
  planCartChange,
} from "@/lib/line-options";
import type { ProductLineOptions } from "@/lib/line-options/types";
import { fetchLineOptions } from "@/lib/shopify/operations/line-options/server";

// Choices and their prices are metaobjects, and editing one sends no product webhook.
export async function getLineOptions(params: {
  handle: string;
  locale?: CommerceLocale;
}): Promise<ProductLineOptions> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("products", `product-${params.handle}`);

  return fetchLineOptions(params);
}

interface OrderedLine {
  attributes?: ReadonlyArray<{ key: string; value?: string | null }> | null;
  id: string;
  merchandise?: {
    id?: string | null;
    product?: { handle?: string | null; title?: string | null } | null;
    title?: string | null;
  } | null;
  quantity: number;
}

// Read fresh: Jolene may have changed an option's choices or prices since the line was added.
export async function findOrderProblem(lines: readonly OrderedLine[]): Promise<string | undefined> {
  if (planCartChange(lines)) return "Coșul se actualizează. Încearcă din nou peste câteva clipe.";
  const products = lines.filter((line) => getLineRole(line) === "product");
  const handles = [...new Set(products.flatMap((line) => line.merchandise?.product?.handle ?? []))];
  const found = new Map(
    await Promise.all(
      handles.map(async (handle) => [handle, await fetchLineOptions({ handle })] as const),
    ),
  );
  for (const line of products) {
    const product = line.merchandise?.product;
    const lineOptions = product?.handle ? found.get(product.handle) : undefined;
    if (!product?.title || !lineOptions) continue;
    if (line.quantity < lineOptions.minQuantity)
      return `${product.title} se comandă de la ${lineOptions.minQuantity} buc.`;
    const { options } = lineOptions;
    const answers = Object.fromEntries(
      options.map((option) => [option.key, getLineAttribute(line, option.label) ?? ""]),
    );
    const bani = getExtrasPerItem(options, answers);
    const extras = bani ? findExtrasVariant(lineOptions.extras, bani) : undefined;
    if (
      getMissingOptions(options, answers).length ||
      getUnknownAnswers(options, answers).length ||
      (bani > 0 && !extras) ||
      extras?.id !== getLineAttribute(line, EXTRAS_ATTRIBUTE)
    )
      return `Opțiunile pentru ${product.title} s-au schimbat. Scoate produsul din coș și adaugă-l din nou.`;
  }
  return undefined;
}
