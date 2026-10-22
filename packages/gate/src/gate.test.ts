import { describe, expect, test } from "bun:test";
import { GATE_COOKIE, gate } from "./gate";

const PASSWORD = "trandafir de grădină";
const SITE = "https://www.orvibo.it";

function visit(path: string, init: RequestInit = {}, site = SITE) {
  return new Request(`${site}${path}`, init);
}

/** The page's form, posted as a browser posts it. */
function post(path: string, password: string, site = SITE) {
  return visit(
    path,
    { method: "POST", body: new URLSearchParams({ password }) },
    site,
  );
}

/** The cookie a browser keeps once it gave `password`, as it sends it back. */
async function cookieFor(password: string) {
  const response = await gate(post("/", password), password);
  const cookie = response?.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("no cookie");
  return cookie;
}

describe("the site's password", () => {
  test("lets everything through while there's none", async () => {
    for (const path of ["/", "/studio", "/robots.txt"])
      expect(await gate(visit(path), null)).toBeNull();
    expect(await gate(post("/cart", "anything"), null)).toBeNull();
  });

  test("asks for it on every page, for no cache to keep and no index", async () => {
    const response = await gate(visit("/products/x?session=1"), PASSWORD);
    expect(response?.status).toBe(401);
    expect(response?.headers.get("cache-control")).toBe("private, no-store");
    expect(response?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response?.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    const page = (await response?.text()) ?? "";
    expect(page).toContain('<html lang="ro">');
    expect(page).toContain('<form method="post">');
    expect(page).toContain('name="password" type="password"');
    expect(page).toContain("Introduceți parola");
    expect(page).not.toContain('role="alert"');
    // Nothing from the request comes back in the page.
    expect(page).not.toContain("session");
  });

  test("asks in English for a visitor who chose it, or whose browser asks", async () => {
    const asks: Record<string, string>[] = [
      { cookie: "jolene-language=en" },
      { "accept-language": "en-GB,en;q=0.9" },
    ];
    for (const headers of asks) {
      const response = await gate(visit("/studio", { headers }), PASSWORD);
      expect(response?.headers.get("content-language")).toBe("en");
      expect(await response?.text()).toContain("Enter the password");
    }
    const romanian = await gate(
      visit("/studio", {
        headers: { cookie: "jolene-language=ro", "accept-language": "en" },
      }),
      PASSWORD,
    );
    expect(romanian?.headers.get("content-language")).toBe("ro");
  });

  test("sends the browser on to the page it asked for, with a cookie for 30 days", async () => {
    const response = await gate(
      post("/studio/atelier?tab=istoric", PASSWORD),
      PASSWORD,
    );
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe(
      `${SITE}/studio/atelier?tab=istoric`,
    );
    const cookie = response?.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(
      /^jolene-gate=[0-9a-f]{64}; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/,
    );
    expect(cookie).not.toContain("trandafir");
  });

  test("takes the password with spaces around it, as a phone's keyboard adds them", async () => {
    const response = await gate(post("/", ` ${PASSWORD} `), PASSWORD);
    expect(response?.status).toBe(303);
  });

  test("marks the cookie Secure only on https", async () => {
    const response = await gate(
      post("/", PASSWORD, "http://localhost:3024"),
      PASSWORD,
    );
    expect(response?.headers.get("set-cookie")).not.toContain("Secure");
  });

  test("lets a browser with the cookie through, on the shop and the studio alike", async () => {
    const cookie = await cookieFor(PASSWORD);
    for (const path of ["/", "/cart", "/studio", "/studio/atelier/J1001"]) {
      const headers = {
        cookie: `jolene-language=ro; ${cookie}; jolene_cart=x`,
      };
      expect(await gate(visit(path, { headers }), PASSWORD)).toBeNull();
      expect(
        await gate(visit(path, { method: "POST", headers }), PASSWORD),
      ).toBeNull();
    }
  });

  test("shuts every browser out once the password changes", async () => {
    const cookie = await cookieFor(PASSWORD);
    const response = await gate(
      visit("/", { headers: { cookie } }),
      "o parolă nouă",
    );
    expect(response?.status).toBe(401);
  });

  test("takes no cookie it didn't make", async () => {
    const forged = (await cookieFor(PASSWORD)).replace(/.$/, (last) =>
      last === "0" ? "1" : "0",
    );
    for (const cookie of [forged, `${GATE_COOKIE}=`, `${GATE_COOKIE}=yes`]) {
      const response = await gate(
        visit("/", { headers: { cookie } }),
        PASSWORD,
      );
      expect(response?.status).toBe(401);
    }
  });

  test("says when the password is wrong, and asks again", async () => {
    for (const typed of ["trandafir", ""]) {
      const response = await gate(post("/cart", typed), PASSWORD);
      expect(response?.status).toBe(401);
      expect(response?.headers.get("set-cookie")).toBeNull();
      const page = (await response?.text()) ?? "";
      expect(page).toContain('role="alert"');
      expect(page).toContain("Parola nu este corectă");
    }
  });

  test("answers any other post with the page, as a visit", async () => {
    const response = await gate(
      visit("/studio/design/nou", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: PASSWORD }),
      }),
      PASSWORD,
    );
    expect(response?.status).toBe(401);
    expect(await response?.text()).not.toContain('role="alert"');
  });

  test("keeps crawlers out, and shows its picture to anyone", async () => {
    const robots = await gate(visit("/robots.txt"), PASSWORD);
    expect(robots?.status).toBe(200);
    expect(await robots?.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(await gate(visit("/icon.png"), PASSWORD)).toBeNull();
  });
});
