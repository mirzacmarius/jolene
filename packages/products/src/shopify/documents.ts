/**
 * The Admin API calls the sync makes, in the API version below. Every one
 * is checked against that version's schema before the sync calls the store
 * (schema.ts).
 */
export const apiVersion = "2026-10";

const userErrors = "userErrors { field message }";
const page = "pageInfo { hasNextPage endCursor }";

export const documents = {
  access: /* GraphQL */ `
    query Access {
      shop { id name myshopifyDomain }
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
} as const;

export type Document = keyof typeof documents;
