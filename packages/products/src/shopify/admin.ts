import { apiVersion, type Document, documents } from "./documents";

type Throttle = {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
};

type Response = {
  data?: unknown;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: { requestedQueryCost: number; throttleStatus: Throttle };
  };
};

/** An error the store answered with, rather than a failed connection. */
export class ShopifyError extends Error {}

/**
 * The store's Admin API, as the Dev Dashboard app the store installed.
 * It waits out Shopify's rate limit, and retries a call that failed on
 * the way only when calling it twice does no harm.
 */
export class Admin {
  private available = Number.POSITIVE_INFINITY;
  private restoreRate = 50;

  private constructor(
    readonly domain: string,
    private token: string,
  ) {}

  /** Exchanges the app's client ID and secret for a day's access token. */
  static async connect(credentials: {
    domain: string;
    clientId: string;
    clientSecret: string;
  }): Promise<Admin> {
    const response = await fetch(
      `https://${credentials.domain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      },
    );
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !body.access_token)
      throw new ShopifyError(
        `${credentials.domain} refused the app's credentials (${response.status}${
          body.error ? `, ${body.error}` : ""
        }${body.error_description ? `: ${body.error_description}` : ""})`,
      );
    return new Admin(credentials.domain, body.access_token);
  }

  async request<T>(
    name: Document,
    variables: Record<string, unknown> = {},
    { idempotent = true } = {},
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.waitForRoom();
      let response: globalThis.Response;
      try {
        response = await fetch(
          `https://${this.domain}/admin/api/${apiVersion}/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": this.token,
            },
            body: JSON.stringify({ query: documents[name], variables }),
            signal: AbortSignal.timeout(120_000),
          },
        );
      } catch (error) {
        if (!idempotent || attempt >= 4) throw error;
        await sleep(2 ** attempt * 1000);
        continue;
      }
      // Shopify answers 429 before running the call, so it's safe to repeat.
      if (response.status === 429) {
        await sleep(Number(response.headers.get("Retry-After") ?? 2) * 1000);
        continue;
      }
      if (response.status >= 500 && idempotent && attempt < 4) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      const body = (await response.json().catch(() => ({}))) as Response;
      const cost = body.extensions?.cost;
      if (cost) {
        this.available = cost.throttleStatus.currentlyAvailable;
        this.restoreRate = cost.throttleStatus.restoreRate;
      }
      if (body.errors?.some((e) => e.extensions?.code === "THROTTLED")) {
        const needed = (cost?.requestedQueryCost ?? 100) - this.available;
        await sleep(Math.max(1, needed / this.restoreRate) * 1000);
        continue;
      }
      if (!response.ok || body.errors?.length || !body.data)
        throw new ShopifyError(
          `${name}: ${response.status} ${
            body.errors?.map((error) => error.message).join("; ") ?? ""
          }`,
        );
      return body.data as T;
    }
  }

  /**
   * Keeps a few hundred points of the rate limit's bucket in hand, as the
   * last answer left it; the next answer says how full it really is.
   */
  private async waitForRoom() {
    const room = 300;
    if (this.available >= room) return;
    const wait = (room - this.available) / this.restoreRate;
    this.available = room;
    await sleep(wait * 1000);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
