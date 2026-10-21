import { Fragment } from "react";

import type { LegalLanguage } from "@/lib/legal/types";

import { LegalLink } from "./legal-page";

interface StoredItem {
  duration: string;
  kind: string;
  names: string[];
  purpose: string;
}

const STORED: Record<LegalLanguage, StoredItem[]> = {
  en: [
    {
      duration: "90 days",
      kind: "cookie",
      names: ["jolene_cart"],
      purpose: "The random code of your cart in the shop. Only our server reads it.",
    },
    {
      duration: "1 year",
      kind: "cookie",
      names: ["jolene-language"],
      purpose: "The language you chose in the studio, Romanian or English.",
    },
    {
      duration: "until you sign out; a session lasts up to 30 days",
      kind: "local storage",
      names: ["__convexAuthJWT_…", "__convexAuthRefreshToken_…"],
      purpose:
        "Keep you signed in to the studio, with or without an account, so you find your designs again.",
    },
    {
      duration: "until you clear your browser’s data",
      kind: "local storage",
      names: ["jolene-recently-viewed-v1"],
      purpose: "The products you looked at recently, which the shop’s search shows you.",
    },
    {
      duration: "until you clear your browser’s data",
      kind: "local storage",
      names: ["jolene.preview", "jolene.studio.designMode"],
      purpose: "The preview you chose in the studio (lifelike or flat), and simple or expert mode.",
    },
    {
      duration: "until you clear your browser’s data",
      kind: "local storage",
      names: ["jolene.studio.guidedStart.…"],
      purpose:
        "That you turned down the studio’s offer to make a collection from the details you already wrote.",
    },
    {
      duration: "until you close the tab",
      kind: "session storage",
      names: ["jolene-invitation-opened:…", "jolene-invitation-replied:…"],
      purpose:
        "That a guest opened the invitation’s envelope and sent their reply, so the page doesn’t start over.",
    },
  ],
  ro: [
    {
      duration: "90 de zile",
      kind: "cookie",
      names: ["jolene_cart"],
      purpose:
        "Codul aleatoriu al coșului dumneavoastră din magazin. Doar serverul nostru îl citește.",
    },
    {
      duration: "1 an",
      kind: "cookie",
      names: ["jolene-language"],
      purpose: "Limba aleasă în studio, română sau engleză.",
    },
    {
      duration: "până vă deconectați; o sesiune durează cel mult 30 de zile",
      kind: "local storage",
      names: ["__convexAuthJWT_…", "__convexAuthRefreshToken_…"],
      purpose: "Vă țin conectat în studio, cu sau fără cont, ca să vă regăsiți designurile.",
    },
    {
      duration: "până ștergeți datele browserului",
      kind: "local storage",
      names: ["jolene-recently-viewed-v1"],
      purpose: "Produsele văzute recent, pe care vi le arată căutarea din magazin.",
    },
    {
      duration: "până ștergeți datele browserului",
      kind: "local storage",
      names: ["jolene.preview", "jolene.studio.designMode"],
      purpose: "Previzualizarea aleasă în studio (realistă sau plată) și modul simplu sau expert.",
    },
    {
      duration: "până ștergeți datele browserului",
      kind: "local storage",
      names: ["jolene.studio.guidedStart.…"],
      purpose:
        "Că ați refuzat propunerea studioului de a crea o colecție din detaliile deja scrise.",
    },
    {
      duration: "până închideți fila",
      kind: "session storage",
      names: ["jolene-invitation-opened:…", "jolene-invitation-replied:…"],
      purpose:
        "Că un invitat a deschis plicul invitației și și-a trimis confirmarea, ca pagina să nu o ia de la capăt.",
    },
  ],
};

interface StoredListProps {
  language: LegalLanguage;
}

function StoredList({ language }: StoredListProps) {
  return (
    <ul>
      {STORED[language].map(({ duration, kind, names, purpose }) => (
        <li key={names.join()}>
          {names.map((name, index) => (
            <Fragment key={name}>
              {index > 0 && (language === "ro" ? " și " : " and ")}
              <code>{name}</code>
            </Fragment>
          ))}
          {` (${kind}, ${duration}): ${purpose}`}
        </li>
      ))}
    </ul>
  );
}

export function CookiesEn() {
  return (
    <>
      <p>
        Cookies are small files a website saves in your browser. Some of our pages also keep data in
        your browser’s local or session storage, for the same purposes. This policy covers all of
        them.
      </p>

      <h2>What we use</h2>
      <p>
        We use only the cookies and browser storage the website needs to work or to remember your
        choices. We use no analytics, advertising or social media cookies, so we do not ask for your
        consent: Romanian law (Law no. 506/2004) does not require consent for what is strictly
        necessary.
      </p>
      <StoredList language="en" />

      <h2>The payment page</h2>
      <p>
        You pay on Stripe’s page (checkout.stripe.com), which uses its own cookies for the payment
        and to prevent fraud. See{" "}
        <a href="https://stripe.com/cookies-policy/legal">Stripe’s cookie policy</a>.
      </p>

      <h2>Your choices</h2>
      <p>
        You can see and delete cookies and stored data in your browser’s settings. If you delete
        them, your cart empties and you need to sign in to the studio again; designs made without an
        account can no longer be opened.
      </p>

      <h2>Changes</h2>
      <p>
        If we ever use analytics or advertising cookies, we will ask for your consent first and
        update this page. How we handle your data is explained in our{" "}
        <LegalLink language="en" page="privacy" />.
      </p>
    </>
  );
}

export function CookiesRo() {
  return (
    <>
      <p>
        Cookie-urile sunt fișiere mici pe care un site le salvează în browser. Unele pagini salvează
        date și în spațiul de stocare al browserului (local storage sau session storage), cu același
        rol. Politica aceasta le cuprinde pe toate.
      </p>

      <h2>Ce folosim</h2>
      <p>
        Folosim doar cookie-urile și datele salvate în browser de care site-ul are nevoie ca să
        funcționeze sau ca să vă țină minte alegerile. Nu folosim cookie-uri de analiză, de
        publicitate sau ale rețelelor sociale, așa că nu vă cerem acordul: legea (Legea nr.
        506/2004) nu cere acord pentru ce este strict necesar.
      </p>
      <StoredList language="ro" />

      <h2>Pagina de plată</h2>
      <p>
        Plătiți pe pagina Stripe (checkout.stripe.com), care folosește propriile cookie-uri pentru
        plată și pentru prevenirea fraudelor. Vedeți{" "}
        <a href="https://stripe.com/cookies-policy/legal">politica de cookies a Stripe</a>.
      </p>

      <h2>Cum le controlați</h2>
      <p>
        Cookie-urile și datele salvate le puteți vedea și șterge din setările browserului. Dacă le
        ștergeți, coșul se golește, iar în studio trebuie să vă conectați din nou; designurile
        făcute fără cont nu le mai puteți deschide.
      </p>

      <h2>Modificări</h2>
      <p>
        Dacă vom folosi vreodată cookie-uri de analiză sau de publicitate, vă vom cere întâi acordul
        și vom actualiza această pagină. Cum prelucrăm datele dumneavoastră aflați din{" "}
        <LegalLink language="ro" page="privacy" />.
      </p>
    </>
  );
}
