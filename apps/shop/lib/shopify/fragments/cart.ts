import { gql } from "@shopify/hydrogen";

// Hydrogen's default fragment omits `updatedAt`, which its own useCartAnalytics requires, the selling plan name, and the product's minimum order.
export const CART_FRAGMENT = gql(/* GraphQL */ `
  fragment CartFragment on Cart {
    updatedAt
    lines(first: 250) {
      nodes {
        merchandise {
          ... on ProductVariant {
            product {
              minQuantity: metafield(namespace: "jolene", key: "min_quantity") {
                value
              }
            }
          }
        }
        sellingPlanAllocation {
          sellingPlan {
            name
          }
        }
      }
    }
  }
`);
