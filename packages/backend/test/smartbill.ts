/**
 * A stand-in for SmartBill's API in tests: it issues invoices, drafts and
 * credit notes from memory, numbering them in their series, prints each a
 * PDF, and fails a call when a test asks. Other hosts go to whatever fetch
 * was there before, such as the fake Stripe.
 */

/** What the shop sent: the method, the path after /SBORO/api/, and its fields. */
export interface SmartBillRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, unknown> | null;
  headers: Headers;
}

/** An invoice or credit note SmartBill keeps, as it was sent. */
export interface Kept {
  series: string;
  number: string;
  body: Record<string, unknown>;
  /** What it comes to, in lei: negative for a credit note. */
  total: number;
  draft: boolean;
  /** The invoice a credit note reverses. */
  reverses?: string;
}

/** How a call fails: SmartBill's answer, or no answer at all. */
export type Failure =
  | { status: number; errorText?: string; issued?: boolean }
  | "unreachable";

/** Romania's VAT rates, as a company's SmartBill account lists them. */
const romanianTaxes = [
  { name: "Normala", percentage: 21 },
  { name: "Redusa", percentage: 11 },
  { name: "Taxare inversa", percentage: 0 },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** What an invoice's products come to, in lei, VAT inside. */
function totalOf(body: Record<string, unknown>): number {
  const products = Array.isArray(body.products) ? body.products : [];
  let total = 0;
  for (const product of products as Record<string, unknown>[])
    total += product.isDiscount
      ? Number(product.discountValue)
      : Number(product.quantity) * Number(product.price);
  return Math.round(total * 100) / 100;
}

/** Replaces fetch with a SmartBill that keeps its documents in memory. */
export function fakeSmartBill() {
  const requests: SmartBillRequest[] = [];
  const documents = new Map<string, Kept>();
  /** The last number given in each series. */
  const numbers = new Map<string, number>();
  const failures = new Map<string, Failure>();
  let taxes: { name: string; percentage: number }[] = romanianTaxes;
  /** What SmartBill's rounding adds to each new invoice, in lei. */
  let rounding = 0;

  const key = (series: string, number: string) => `${series} ${number}`;
  const next = (series: string) => {
    const number = (numbers.get(series) ?? 41) + 1;
    numbers.set(series, number);
    return String(number).padStart(4, "0");
  };

  /** Keeps a document, as SmartBill would before answering. */
  const keep = (
    path: string,
    body: Record<string, unknown>,
  ): Kept | Response => {
    if (path === "invoice") {
      const series = String(body.seriesName ?? "");
      const draft = body.isDraft === true;
      const kept: Kept = {
        series,
        number: draft ? "" : next(series),
        body,
        total: totalOf(body) + rounding,
        draft,
      };
      documents.set(
        key(series, kept.number || `draft ${documents.size}`),
        kept,
      );
      return kept;
    }
    const reversed = documents.get(
      key(String(body.seriesName), String(body.number)),
    );
    if (!reversed || reversed.draft)
      return json({ errorText: "Factura nu exista.", number: "", series: "" });
    const kept: Kept = {
      series: reversed.series,
      number: next(reversed.series),
      body,
      total: -reversed.total,
      draft: false,
      reverses: key(reversed.series, reversed.number),
    };
    documents.set(key(kept.series, kept.number), kept);
    return kept;
  };

  const previous = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== "ws.smartbill.ro") return previous(input, init);
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/SBORO\/api\//, "");
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : null;
    requests.push({
      method,
      path,
      query: url.searchParams,
      body,
      headers: new Headers(init?.headers),
    });

    const failure = failures.get(path);
    if (failure === "unreachable") throw new TypeError("fetch failed");
    if (failure) {
      // A gateway's timeout may come after SmartBill went ahead.
      if (failure.issued && body) keep(path, body);
      return failure.errorText
        ? json({ errorText: failure.errorText }, failure.status)
        : new Response("Bad Gateway", { status: failure.status });
    }

    if (path === "tax" && method === "GET")
      return json({ errorText: "", message: "", taxes });
    if ((path === "invoice" || path === "invoice/reverse") && body) {
      const kept = keep(path, body);
      if (kept instanceof Response) return kept;
      return json({
        errorText: "",
        message: "",
        number: kept.number,
        series: kept.series,
        url: "",
      });
    }
    const asked = documents.get(
      key(
        url.searchParams.get("seriesname") ?? "",
        url.searchParams.get("number") ?? "",
      ),
    );
    if (path === "invoice/pdf" && method === "GET")
      return asked
        ? new Response(`%PDF-1.4 ${key(asked.series, asked.number)}`, {
            headers: { "content-type": "application/octet-stream" },
          })
        : json({ errorText: "Factura nu exista." }, 400);
    if (path === "invoice/paymentstatus" && method === "GET")
      return asked
        ? json({
            errorText: "",
            message: "",
            number: asked.number,
            series: asked.series,
            invoiceTotalAmount: asked.total,
            paidAmount: asked.total,
            unpaidAmount: 0,
            paid: true,
          })
        : json({ errorText: "Factura nu exista." }, 400);
    return json({ errorText: `No such call: ${method} ${path}` }, 404);
  }) as typeof globalThis.fetch;

  return {
    requests,
    documents,
    /** The calls made to `path`, such as "invoice". */
    calls(path: string) {
      return requests.filter((request) => request.path === path);
    },
    /** Fails each call to `path` the way `failure` says, until `recover`. */
    fail(path: string, failure: Failure) {
      failures.set(path, failure);
    },
    recover(path: string) {
      failures.delete(path);
    },
    /** Makes each new invoice come to `lei` more in SmartBill, as rounding might. */
    misprice(lei: number) {
      rounding = lei;
    },
    /** Sets the VAT rates the account lists. */
    taxes(list: { name: string; percentage: number }[]) {
      taxes = list;
    },
    restore() {
      globalThis.fetch = previous;
    },
  };
}
