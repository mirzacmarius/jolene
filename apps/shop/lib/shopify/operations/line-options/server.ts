import { gql } from "@shopify/hydrogen";

import { shopConfig } from "@/lib/config";
import type { CommerceLocale } from "@/lib/config/types";
import { EXTRAS_HANDLE, getReachableExtras, toBani } from "@/lib/line-options";
import type { LineOption, LineOptionKind, ProductLineOptions } from "@/lib/line-options/types";
import { assertStorefrontOk } from "@/lib/shopify/errors/server";
import { storefront } from "@/lib/shopify/storefront/server";

const GET_LINE_OPTIONS_QUERY = gql(`#graphql
  query getLineOptions($handle: String!, $extrasHandle: String!, $country: CountryCode, $language: LanguageCode) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      lineOptions: metafield(namespace: "jolene", key: "line_options") {
        references(first: 20) {
          nodes {
            ... on Metaobject {
              choices: field(key: "choices") {
                references(first: 50) {
                  nodes {
                    ... on Metaobject {
                      label: field(key: "label") {
                        value
                      }
                      price: field(key: "price") {
                        value
                      }
                    }
                  }
                }
              }
              hint: field(key: "hint") {
                value
              }
              key: field(key: "key") {
                value
              }
              kind: field(key: "kind") {
                value
              }
              label: field(key: "label") {
                value
              }
              required: field(key: "required") {
                value
              }
            }
          }
        }
      }
      fees: metafield(namespace: "jolene", key: "fees") {
        references(first: 10) {
          nodes {
            ... on ProductVariant {
              availableForSale
              id
              price {
                amount
                currencyCode
              }
              product {
                description
                title
              }
            }
          }
        }
      }
      minQuantity: metafield(namespace: "jolene", key: "min_quantity") {
        value
      }
    }
    extras: product(handle: $extrasHandle) {
      variants(first: 250) {
        nodes {
          availableForSale
          id
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
`);

const KINDS = new Set<string>(["email", "select", "text", "textarea"] satisfies LineOptionKind[]);

export async function fetchLineOptions({
  handle,
  locale = shopConfig.localization,
}: {
  handle: string;
  locale?: CommerceLocale;
}): Promise<ProductLineOptions> {
  const response = await storefront.request(GET_LINE_OPTIONS_QUERY, {
    locale,
    variables: { extrasHandle: EXTRAS_HANDLE, handle },
  });
  assertStorefrontOk(response, "getLineOptions");

  const { extras, product } = response.data;
  const options = (product?.lineOptions?.references?.nodes ?? []).flatMap((node): LineOption[] => {
    if (!("key" in node) || !node.key?.value || !node.label?.value) return [];
    const kind = node.kind?.value ?? "";
    if (!KINDS.has(kind)) return [];
    return [
      {
        choices: (node.choices?.references?.nodes ?? []).flatMap((choice) =>
          "label" in choice && choice.label?.value && choice.price?.value
            ? [{ label: choice.label.value, price: choice.price.value }]
            : [],
        ),
        ...(node.hint?.value ? { hint: node.hint.value } : {}),
        key: node.key.value,
        kind: kind as LineOptionKind,
        label: node.label.value,
        required: node.required?.value === "true",
      },
    ];
  });
  const reachable = getReachableExtras(options);
  return {
    extras: (extras?.variants.nodes ?? [])
      .filter((variant) => variant.availableForSale && reachable.has(toBani(variant.price.amount)))
      .map((variant) => ({ id: variant.id, price: variant.price })),
    fees: (product?.fees?.references?.nodes ?? []).flatMap((node) =>
      "id" in node && node.availableForSale
        ? [
            {
              description: node.product.description,
              id: node.id,
              price: node.price,
              title: node.product.title,
            },
          ]
        : [],
    ),
    minQuantity: Math.max(1, Number(product?.minQuantity?.value) || 1),
    options,
  };
}
