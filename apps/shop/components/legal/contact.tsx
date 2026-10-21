import { COMPANY } from "@/lib/legal";
import type { LegalLanguage } from "@/lib/legal/types";

const LABELS = {
  en: {
    email: "Email",
    name: "Company",
    office: "Registered office",
    phone: "Phone",
    taxId: "Tax identification number (CUI)",
    tradeRegister: "Trade register number",
    vatId: "VAT number",
    workshop: "Workshop",
  },
  ro: {
    email: "Email",
    name: "Firma",
    office: "Sediul social",
    phone: "Telefon",
    taxId: "Cod unic de înregistrare (CUI)",
    tradeRegister: "Număr de ordine în Registrul Comerțului",
    vatId: "Cod de înregistrare în scopuri de TVA",
    workshop: "Atelierul",
  },
} as const;

interface CompanyDetailsProps {
  language: LegalLanguage;
}

export function CompanyDetails({ language }: CompanyDetailsProps) {
  const labels = LABELS[language];
  return (
    <ul>
      <li>{`${labels.name}: ${COMPANY.name}`}</li>
      <li>{`${labels.taxId}: ${COMPANY.taxId}`}</li>
      <li>{`${labels.tradeRegister}: ${COMPANY.tradeRegister}`}</li>
      <li>{`${labels.vatId}: ${COMPANY.vatId}`}</li>
      <li>{`${labels.office}: ${COMPANY.registeredOffice}`}</li>
      <li>{`${labels.workshop}: ${COMPANY.workshop}`}</li>
      <li>
        {`${labels.email}: `}
        <EmailLink />
      </li>
      <li>
        {`${labels.phone}: `}
        <PhoneLink language={language} />
      </li>
    </ul>
  );
}

export function EmailLink() {
  return <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
}

interface PhoneLinkProps {
  language: LegalLanguage;
}

export function PhoneLink({ language }: PhoneLinkProps) {
  return (
    <a className="whitespace-nowrap" href={COMPANY.phoneHref}>
      {language === "ro" ? COMPANY.phone : COMPANY.phoneInternational}
    </a>
  );
}
