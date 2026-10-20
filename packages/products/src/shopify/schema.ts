import {
  buildClientSchema,
  type GraphQLSchema,
  getVariableValues,
  Kind,
  type OperationDefinitionNode,
  parse,
  validate,
} from "graphql";
import { type Document, documents } from "./documents";

/**
 * Reads the Admin API's schema from an introspection result, such as the
 * one @shopify/dev-mcp ships (dist/data/admin_2026-10.json.gz).
 */
export async function readSchema(path: string): Promise<GraphQLSchema> {
  const file = Bun.file(path);
  const text = path.endsWith(".gz")
    ? new TextDecoder().decode(Bun.gunzipSync(await file.bytes()))
    : await file.text();
  const { data } = JSON.parse(text);
  // graphql-js holds Shopify's schema to rules stricter than Shopify's,
  // such as deprecating an interface's field along with its implementations.
  return buildClientSchema(data, { assumeValid: true });
}

/** Checks each call the sync makes, and what it sends, against the schema. */
export class Checker {
  private operations = new Map<Document, OperationDefinitionNode>();

  constructor(private schema: GraphQLSchema) {
    const problems: string[] = [];
    for (const [name, source] of Object.entries(documents)) {
      const document = parse(source);
      for (const error of validate(schema, document))
        problems.push(`${name}: ${error.message}`);
      const operation = document.definitions.find(
        (definition) => definition.kind === Kind.OPERATION_DEFINITION,
      );
      if (operation) this.operations.set(name as Document, operation);
    }
    if (problems.length > 0) throw new Error(problems.join("\n"));
  }

  /** What's wrong with these variables for the document, if anything. */
  check(name: Document, variables: Record<string, unknown>): string[] {
    const operation = this.operations.get(name);
    if (!operation) return [`${name} isn't an operation`];
    const result = getVariableValues(
      this.schema,
      operation.variableDefinitions ?? [],
      variables,
      { maxErrors: 10 },
    );
    return "errors" in result && result.errors
      ? result.errors.map((error) => error.message)
      : [];
  }
}
