import { StudioLink } from "@/components/studio/studio-link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";

import { PillArrow, textLinkClassName } from "./pill";
import { Eyebrow } from "./typography";

const QUESTIONS = [
  {
    answer:
      "Tipărim, asamblăm și trimitem comanda în cel mult 7 zile lucrătoare de la aprobarea bunului de tipar, în funcție de cantitate și de finisaje precum sigiliul din ceară sau fundițele.",
    question: "Cât durează până primim comanda?",
  },
  {
    answer:
      "Da. Studioul arată fiecare invitație realist, pe hârtia aleasă, cu folio, foaie de calc și sigiliu, iar înainte de tipar primiți bunul de tipar spre aprobare.",
    question: "Putem vedea invitația înainte de tipar?",
  },
  {
    answer:
      "Da. În modul simplu răspundeți la câteva întrebări și alegeți culorile, hârtia și finisajele, iar în modul expert mutați și rescrieți fiecare element. Designerul AI vă poate ajuta cu textul și cu așezarea în pagină.",
    question: "Putem schimba textul, culorile și fonturile?",
  },
  {
    answer:
      "Nu. Numele, data și locurile scrise pe invitație apar deja pe meniu, pe numerele de masă și pe restul papetăriei din aceeași colecție.",
    question: "Trebuie să scriem detaliile pe fiecare card?",
  },
  {
    answer:
      "Da, la cerere. Dacă nu găsiți colecția potrivită, Jolene desenează una doar pentru voi.",
    question: "Faceți și designuri personalizate?",
  },
  {
    answer:
      "Nu, pentru că sunt făcute special pentru voi. De aceea vedeți totul în studio și aprobați bunul de tipar înainte să tipărim.",
    question: "Se pot returna invitațiile personalizate?",
  },
];

export function HomeQuestions() {
  return (
    <div className="border-t">
      <Container aria-labelledby="questions-title" className="scroll-mt-16" id="intrebari">
        <div className="grid gap-10 py-24 md:grid-cols-[1fr_1.35fr] md:py-25">
          <div className="grid content-start justify-items-start gap-5">
            <Eyebrow className="reveal" data-reveal>
              Bine de știut
            </Eyebrow>
            <h2
              className="reveal reveal-blur text-[clamp(2.5rem,3.6vw,3.25rem)] leading-[1.12] font-normal tracking-[-0.06em]"
              data-reveal
              id="questions-title"
            >
              Câteva lucruri
              <br />
              înainte să începeți.
            </h2>
            <StudioLink className={textLinkClassName}>
              Începeți în studio <PillArrow />
            </StudioLink>
          </div>
          <Accordion multiple>
            {QUESTIONS.map(({ answer, question }) => (
              <AccordionItem
                className="reveal border-b first:border-t last:border-b"
                data-reveal
                key={question}
                value={question}
              >
                <AccordionTrigger className="items-center py-6 text-sm leading-[1.45] hover:no-underline">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="max-w-[65ch] pr-9 pb-6 text-sm leading-[1.8] text-muted-foreground">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </div>
  );
}
