import type { Locale } from "@jolene/i18n";

/** The picture the page shows: the rose of Jolene's logo, as the shop serves it. */
export const GATE_PICTURE = "/icon.png";

/** What the page says, in each language Jolene speaks. */
const words: Record<
  Locale,
  { lead: string; password: string; enter: string; wrong: string }
> = {
  ro: {
    lead: "Site-ul nu este încă public. Introduceți parola ca să intrați.",
    password: "Parola",
    enter: "Intrați",
    wrong: "Parola nu este corectă. Încercați din nou.",
  },
  en: {
    lead: "The site isn't public yet. Enter the password to come in.",
    password: "Password",
    enter: "Come in",
    wrong: "That password isn't right. Try again.",
  },
};

/** Jolene's palette (packages/ui): paper, ink, evergreen, antique gold. */
const style = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#fbf8f3;color:#24201c;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:380px;padding:40px 32px;border:1px solid #e6ded2;border-radius:24px;background:#fff;text-align:center}
img{display:block;margin:0 auto 8px}
h1{margin:0;font:italic 400 36px/1.15 Georgia,"Times New Roman",serif}
p{margin:8px 0 24px;color:#6e665c;font-size:15px}
form{display:grid;gap:10px;text-align:left}
label{font-size:14px;font-weight:500}
input{width:100%;height:44px;padding:0 12px;border:1px solid #ddd4c6;border-radius:10px;background:#fff;color:inherit;font:inherit}
input:focus{outline:none;border-color:#a8823f;box-shadow:0 0 0 3px rgba(168,130,63,.3)}
input[aria-invalid=true]{border-color:#b3261e}
.wrong{margin:0;color:#b3261e;font-size:14px}
button{height:44px;margin-top:6px;border:0;border-radius:999px;background:#2e3b2f;color:#fbf8f3;font:inherit;font-weight:500;cursor:pointer}
button:hover{background:#3b4b3c}
button:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(168,130,63,.5)}
`;

/**
 * The page that asks for the site's password, in the visitor's language, and
 * says so when the last one they typed was wrong. It posts back to the
 * address it's on, and carries nothing from the request.
 */
export function gatePage(locale: Locale, wrong: boolean): string {
  const t = words[locale];
  const field = wrong
    ? `<input id="password" name="password" type="password" autocomplete="current-password" required autofocus aria-invalid="true" aria-describedby="wrong">
<p class="wrong" id="wrong" role="alert">${t.wrong}</p>`
    : `<input id="password" name="password" type="password" autocomplete="current-password" required autofocus>`;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#fbf8f3">
<title>Jolene</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<style>${style}</style>
</head>
<body>
<main>
<img src="${GATE_PICTURE}" width="64" height="64" alt="">
<h1>Jolene</h1>
<p>${t.lead}</p>
<form method="post">
<label for="password">${t.password}</label>
${field}
<button type="submit">${t.enter}</button>
</form>
</main>
</body>
</html>
`;
}
