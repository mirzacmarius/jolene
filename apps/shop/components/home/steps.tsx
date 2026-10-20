import autumnSuite from "./photos/autumn-suite.jpg";
import bride from "./photos/bride.jpg";
import vellumSeal from "./photos/vellum-seal.jpg";
import { StepsExplorer } from "./steps-explorer";
import { Accent, Eyebrow } from "./typography";

export function HomeSteps() {
  return (
    <section aria-labelledby="steps-title" className="scroll-mt-16" id="cum-functioneaza">
      <StepsExplorer
        footnote={
          <p className="font-display text-[1.4375rem] leading-[1.35] italic opacity-70">
            Fără grabă și fără surprize:
            <br />
            vedeți totul înainte de tipar.
          </p>
        }
        listLabel="Pașii până la invitația voastră"
        steps={[
          {
            alt: "O invitație cu flori de toamnă în acuarelă, închisă cu un sigiliu auriu din ceară, pe o felie de lemn, lângă o fundă portocalie și o frunză galbenă",
            image: autumnSuite,
            label: "Alegeți",
            note: "Colecțiile Jolene",
            text: "Fiecare colecție aduce invitația împreună cu meniul, numerele de masă, plicurile de bani și restul papetăriei, desenate în același stil. Începeți cu una și adăugați ce vă trebuie.",
            title: "O colecție pentru toată ziua.",
          },
          {
            alt: "O mireasă ține în mâini o invitație cu bujori în acuarelă și calendarul lunii nunții",
            image: bride,
            label: "Creați",
            note: "Personalizată de voi",
            text: "Răspundeți la câteva întrebări în modul simplu sau mutați fiecare rând în modul expert. Designerul AI vă ajută cu textul, culorile și așezarea, iar previzualizarea realistă arată invitația pe masă, cu hârtie, folio și sigiliu.",
            title: "Numele voastre, cuvintele voastre.",
          },
          {
            alt: "O invitație cu liliac și bujori sub o foaie de calc prinsă cu un sigiliu mov din ceară, pe o farfurie roz cu stropi aurii",
            image: vellumSeal,
            label: "Comandați",
            note: "Gata de trimis",
            text: "Aprobați bunul de tipar, iar atelierul Jolene tipărește, asamblează cu sigiliu din ceară, foaie de calc sau panglică și vă trimite comanda în cel mult 7 zile lucrătoare.",
            title: "Tipărită, asamblată, trimisă.",
          },
        ]}
      >
        <Eyebrow className="reveal" data-reveal>
          Trei pași, fără grabă
        </Eyebrow>
        <h2
          className="reveal reveal-blur text-[clamp(2.75rem,4.7vw,4.5rem)] leading-[1.07] font-normal tracking-[-0.06em]"
          data-reveal
          id="steps-title"
        >
          De la prima idee
          <br />
          <Accent>la ultimul plic.</Accent>
        </h2>
      </StepsExplorer>
    </section>
  );
}
