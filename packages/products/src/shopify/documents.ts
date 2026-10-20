import { keys, namespace } from "../order";

/**
 * The Admin API calls the sync and the workshop make, in the API version
 * below. Every one is checked against that version's schema before the sync
 * calls the store (schema.ts), so each plan checks the workshop's too.
 */
export const apiVersion = "2026-10";

const userErrors = "userErrors { field message }";
const page = "pageInfo { hasNextPage endCursor }";

/** What the workshop reads of an order's line. */
const orderLine = `
  id
  title
  variantTitle
  currentQuantity
  customAttributes { key value }
  originalUnitPriceSet { shopMoney { amount currencyCode } }
  variant { id }
  product { id }
`;

export const documents = {
  access: /* GraphQL */ `
    query Access {
      shop { name myshopifyDomain }
      currentAppInstallation { accessScopes { handle } }
    }
  `,
  publications: /* GraphQL */ `
    query Publications {
      publications(first: 50) {
        nodes {
          id
          catalog {
            title
            ... on AppCatalog { apps(first: 5) { nodes { handle title } } }
          }
        }
      }
    }
  `,
  definitions: /* GraphQL */ `
    query Definitions($choice: String!, $lineOption: String!, $namespace: String!) {
      choice: metaobjectDefinitionByType(type: $choice) {
        id
        fieldDefinitions { key type { name } }
      }
      lineOption: metaobjectDefinitionByType(type: $lineOption) {
        id
        fieldDefinitions { key type { name } }
      }
      metafieldDefinitions(ownerType: PRODUCT, namespace: $namespace, first: 50) {
        nodes { id key type { name } }
      }
    }
  `,
  metaobjects: /* GraphQL */ `
    query Metaobjects($type: String!, $after: String) {
      metaobjects(type: $type, first: 250, after: $after) {
        nodes { id handle }
        ${page}
      }
    }
  `,
  collections: /* GraphQL */ `
    query Collections($after: String) {
      collections(first: 250, after: $after) {
        nodes { id handle }
        ${page}
      }
    }
  `,
  products: /* GraphQL */ `
    query Products($after: String) {
      products(first: 100, after: $after) {
        nodes { id handle status variants(first: 3) { nodes { id title } } }
        ${page}
      }
    }
  `,
  createMetaobjectDefinition: /* GraphQL */ `
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id }
        ${userErrors}
      }
    }
  `,
  createMetafieldDefinition: /* GraphQL */ `
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id }
        ${userErrors}
      }
    }
  `,
  upsertMetaobject: /* GraphQL */ `
    mutation UpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        ${userErrors}
      }
    }
  `,
  createCollection: /* GraphQL */ `
    mutation CreateCollection($collection: CollectionCreateInput!) {
      collectionCreate(collection: $collection) {
        collection { id handle }
        ${userErrors}
      }
    }
  `,
  setProduct: /* GraphQL */ `
    mutation SetProduct($identifier: ProductSetIdentifiers!, $input: ProductSetInput!) {
      productSet(identifier: $identifier, input: $input, synchronous: true) {
        product {
          id
          handle
          status
          variants(first: 250) { nodes { id title } }
        }
        ${userErrors}
      }
    }
  `,
  setStatus: /* GraphQL */ `
    mutation SetStatus($id: ID!, $status: ProductStatus!) {
      productUpdate(product: { id: $id, status: $status }) {
        product { id status }
        ${userErrors}
      }
    }
  `,
  publish: /* GraphQL */ `
    mutation Publish($id: ID!, $publicationId: ID!) {
      publishablePublish(id: $id, input: [{ publicationId: $publicationId }]) {
        ${userErrors}
      }
    }
  `,
  media: /* GraphQL */ `
    query Media($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          handle
          media(first: 20) {
            nodes {
              status
              mediaErrors { message }
              ... on MediaImage { originalSource { url } }
            }
          }
        }
      }
    }
  `,
  // The workshop's order list (packages/backend/convex/workshop) reads the
  // open orders with these, oldest first, then what their lines point to.
  // The page sizes keep each call under the Admin API's limit of 1,000
  // points on its cost.
  orders: /* GraphQL */ `
    query Orders($after: String) {
      orders(
        first: 8
        after: $after
        query: "status:open -fulfillment_status:fulfilled"
        sortKey: PROCESSED_AT
      ) {
        nodes {
          id
          legacyResourceId
          name
          processedAt
          test
          note
          displayFinancialStatus
          displayFulfillmentStatus
          lineItems(first: 15) {
            nodes { ${orderLine} }
            ${page}
          }
        }
        ${page}
      }
    }
  `,
  orderLines: /* GraphQL */ `
    query OrderLines($id: ID!, $after: String) {
      order(id: $id) {
        lineItems(first: 50, after: $after) {
          nodes { ${orderLine} }
          ${page}
        }
      }
    }
  `,
  orderNodes: /* GraphQL */ `
    query OrderNodes($ids: [ID!]!) {
      nodes(ids: $ids) {
        id
        ... on Product {
          lineOptions: metafield(namespace: "${namespace}", key: "${keys.lineOptions}") { value }
          minQuantity: metafield(namespace: "${namespace}", key: "${keys.minQuantity}") { value }
        }
        ... on ProductVariant { title product { title } }
        ... on Metaobject { fields { key value } }
      }
    }
  `,
} as const;

export type Document = keyof typeof documents;
