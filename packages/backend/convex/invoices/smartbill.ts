import { env } from "../_generated/server";

/**
 * SmartBill's API, which issues Jolene's invoices and sends them to
 * e-Factura (ADR 0018). It answers in JSON, sometimes wrapped in an envelope
 * such as `sbcResponse`, and says what went wrong in `errorText`, in
 * Romanian, as the errors here are: the team reads them.
 */

const API = "https://ws.smartbill.ro/SBORO/api";

/** Jolene Design SRL's tax code, which issues the shop's invoices. */
const JOLENE_CIF = "RO49475720";

export interface SmartBill {
  username: string;
  token: string;
  /** The issuing company's tax code, as SmartBill has it. */
  cif: string;
  /** The series the shop's invoices are numbered in. */
  series: string;
}

/** Jolene's SmartBill account, or null until the deployment has one. */
export function smartBill(): SmartBill | null {
  const username = env.SMARTBILL_USERNAME?.trim();
  const token = env.SMARTBILL_TOKEN?.trim();
  const series = env.SMARTBILL_SERIES?.trim();
  if (!username || !token || !series) return null;
  return {
    username,
    token,
    cif: env.SMARTBILL_CIF?.trim() || JOLENE_CIF,
    series,
  };
}

/** What SmartBill said went wrong, or why it couldn't be asked. */
export class SmartBillError extends Error {
  /** SmartBill may have issued the invoice all the same, as on a timeout. */
  readonly unsure: boolean;

  constructor(message: string, unsure = false) {
    super(message);
    this.name = "SmartBillError";
    this.unsure = unsure;
  }
}

const envelopes = ["sbcResponse", "Response", "sbcTaxes", "sbcSeries"];

/** A JSON answer without its envelope, if it came in one. */
function unwrap(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) return {};
  const record = body as Record<string, unknown>;
  for (const key of envelopes) {
    const inner = record[key];
    if (typeof inner === "object" && inner !== null)
      return inner as Record<string, unknown>;
  }
  return record;
}

async function call(
  account: SmartBill,
  method: "GET" | "POST",
  path: string,
  {
    query,
    body,
    pdf = false,
  }: { query?: Record<string, string>; body?: unknown; pdf?: boolean } = {},
): Promise<Response> {
  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries(query ?? {}))
    url.searchParams.set(name, value);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${btoa(`${account.username}:${account.token}`)}`,
        Accept: pdf ? "application/octet-stream" : "application/json",
        ...(body !== undefined && {
          "Content-Type": "application/json; charset=utf-8",
        }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new SmartBillError(`SmartBill n-a răspuns (${String(error)})`, true);
  }
  if (response.ok) return response;
  if (response.status === 401)
    throw new SmartBillError(
      "SmartBill a refuzat contul: verificați SMARTBILL_USERNAME și SMARTBILL_TOKEN în Convex",
    );
  if (response.status === 403)
    throw new SmartBillError(
      "SmartBill refuză apelurile timp de 10 minute, după mai mult de 30 în 10 secunde",
    );
  const text = (await response.text()).trim();
  let said = "";
  try {
    said = String(unwrap(JSON.parse(text)).errorText ?? "").trim();
  } catch {
    // Not SmartBill's JSON: a line of text is worth passing on, a page isn't.
    if (text && !text.startsWith("<") && !text.includes("\n"))
      said = `SmartBill a răspuns ${response.status}: ${text.slice(0, 200)}`;
  }
  // SmartBill answers 500 to a request it can't read; a gateway's 502 to 504
  // may come after SmartBill went ahead.
  throw new SmartBillError(
    said || `SmartBill a răspuns ${response.status}`,
    [502, 503, 504].includes(response.status),
  );
}

/** A JSON answer, or SmartBill's error in it. */
async function json(response: Response): Promise<Record<string, unknown>> {
  const body = unwrap(await response.json());
  const error = typeof body.errorText === "string" ? body.errorText.trim() : "";
  if (error) throw new SmartBillError(error);
  return body;
}

/** A VAT rate as SmartBill has it, such as Normala at 21%. */
export interface Tax {
  name: string;
  percentage: number;
}

/** The VAT rates set up in SmartBill for the company. */
export async function taxes(account: SmartBill): Promise<Tax[]> {
  const body = await json(
    await call(account, "GET", "tax", { query: { cif: account.cif } }),
  );
  const list = Array.isArray(body.taxes) ? body.taxes : [];
  return list.flatMap((tax: unknown) => {
    const { name, percentage } = (tax ?? {}) as Record<string, unknown>;
    return typeof name === "string" && typeof percentage === "number"
      ? [{ name, percentage }]
      : [];
  });
}

/** An invoice SmartBill issued: its series and number, as JOL and 0042. */
export interface Issued {
  series: string;
  number: string;
}

function issued(body: Record<string, unknown>): Issued {
  return {
    series: typeof body.series === "string" ? body.series : "",
    number: typeof body.number === "string" ? body.number : "",
  };
}

/** Issues an invoice, or saves it as a draft when it says so. */
export async function createInvoice(
  account: SmartBill,
  invoice: Record<string, unknown>,
): Promise<Issued> {
  return issued(
    await json(await call(account, "POST", "invoice", { body: invoice })),
  );
}

/** Issues the credit note that reverses an invoice in full (storno). */
export async function reverseInvoice(
  account: SmartBill,
  invoice: Issued,
  issueDate: string,
): Promise<Issued> {
  return issued(
    await json(
      await call(account, "POST", "invoice/reverse", {
        body: {
          companyVatCode: account.cif,
          seriesName: invoice.series,
          number: invoice.number,
          issueDate,
        },
      }),
    ),
  );
}

/** An invoice's PDF, as SmartBill prints it. */
export async function invoicePdf(
  account: SmartBill,
  invoice: Issued,
): Promise<Blob> {
  const response = await call(account, "GET", "invoice/pdf", {
    query: {
      cif: account.cif,
      seriesname: invoice.series,
      number: invoice.number,
    },
    pdf: true,
  });
  return new Blob([await response.arrayBuffer()], { type: "application/pdf" });
}

/** What an invoice comes to in SmartBill, in bani. */
export async function invoiceTotal(
  account: SmartBill,
  invoice: Issued,
): Promise<number | null> {
  const body = await json(
    await call(account, "GET", "invoice/paymentstatus", {
      query: {
        cif: account.cif,
        seriesname: invoice.series,
        number: invoice.number,
      },
    }),
  );
  return typeof body.invoiceTotalAmount === "number"
    ? Math.round(body.invoiceTotalAmount * 100)
    : null;
}
