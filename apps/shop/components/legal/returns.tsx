import { COMPANY } from "@/lib/legal";

import { EmailLink, PhoneLink } from "./contact";

const FORM_CLASS = "rounded-lg border border-border px-5";

export function ReturnsEn() {
  return (
    <>
      <p>In short:</p>
      <ul>
        <li>
          Personalised stationery cannot be returned, because we make it from your own details.
        </li>
        <li>
          If something is not as you ordered it, or arrives damaged, we make it again or give you
          your money back, at our cost.
        </li>
        <li>You can return products that are not personalised within 14 days, without a reason.</li>
        <li>
          A digital invitation you buy is unlocked right after payment, as you agree before paying,
          and can no longer be cancelled after that.
        </li>
      </ul>

      <h2>The right of withdrawal</h2>
      <p>
        If you buy as a private person, outside your trade or business, you may withdraw from a
        contract made at a distance within 14 days without giving a reason, under Government
        Emergency Ordinance no. 34/2014. The law makes some exceptions, set out below. Companies do
        not have this right.
      </p>

      <h3>Personalised stationery</h3>
      <p>
        The right of withdrawal does not apply to goods made to your specifications or clearly
        personalised (Article 16(c) of Ordinance no. 34/2014). That covers invitations, menus, money
        envelopes, table numbers and every other product printed with your names, date, venues or
        wording. This is why the studio shows you everything first, and we print only once you
        approve the proof.
      </p>

      <h3>Products that are not personalised</h3>
      <p>
        For products we do not personalise, such as favours or accessories with no name, date or
        wording printed on them, you have 14 days from receiving them to withdraw:
      </p>
      <ol>
        <li>
          Tell us by email at <EmailLink />, with your order number, or send us the form below. It
          is enough to send it before the 14 days are over.
        </li>
        <li>
          Send the products back within 14 days of telling us, to {COMPANY.name}, {COMPANY.workshop}
          . You pay for sending them back.
        </li>
        <li>
          We refund everything you paid for them, with the cost of delivering them to you if you
          return the whole order, within 14 days of hearing from you, by the same means of payment.
          We may wait to refund you until we receive the products or proof that you sent them.
        </li>
      </ol>
      <p>
        You are responsible for any loss in value if you used the products beyond what you needed to
        see and check them.
      </p>

      <h3>The digital invitation</h3>
      <p>
        Before you pay for a digital invitation, you tick in the cart that you want it unlocked
        right after payment and that you understand you then lose the right to withdraw from it. We
        unlock it as soon as your payment is confirmed, so from then on you can no longer withdraw
        (Article 16(a) and (m) of Ordinance no. 34/2014). The email confirming your order also
        confirms your agreement. One that comes free with printed invitations costs nothing, so you
        are asked for no agreement.
      </p>
      <p>
        If it does not work as it should, email us: we put it right, and if we cannot, we refund you
        in full or in part, under Government Emergency Ordinance no. 141/2021 on digital content and
        digital services.
      </p>

      <h2>Faulty or damaged products</h2>
      <p>
        Every product, personalised or not, comes with the legal guarantee of conformity (Government
        Emergency Ordinance no. 140/2021) for any lack of conformity that shows within 2 years of
        delivery. If a product does not match your order or your approved proof, has a printing
        error, is missing from the parcel or arrives damaged:
      </p>
      <ol>
        <li>
          Email us at <EmailLink /> as soon as you can after receiving the parcel, with your order
          number and photos of the products and, if it is damaged, of the parcel. You can also call
          us on <PhoneLink language="en" />.
        </li>
        <li>Keep the products and their packaging until we have sorted it out.</li>
        <li>
          We reprint or replace the products at our cost, delivery included. If that is not
          possible, or would not arrive in time for your event, we refund you in full or in part, as
          the case may be.
        </li>
      </ol>
      <p>
        Small differences in colour between a screen and paper, slight variations in handmade
        finishes, and mistakes left in an approved proof are not defects.
      </p>

      <h2>Model withdrawal form</h2>
      <p>
        Complete and send this form only if you wish to withdraw from the contract. You can copy it
        into an email; please add your order number, so we find it quickly.
      </p>
      <div className={FORM_CLASS}>
        <p>
          To: {COMPANY.name}, {COMPANY.workshop}, Romania, {COMPANY.email}
        </p>
        <p>
          I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the
          following goods (*)/for the provision of the following service (*):
        </p>
        <p>Ordered on (*)/received on (*):</p>
        <p>Name of consumer(s):</p>
        <p>Address of consumer(s):</p>
        <p>Signature of consumer(s) (only if this form is notified on paper):</p>
        <p>Date:</p>
        <p>(*) Delete as appropriate.</p>
      </div>
    </>
  );
}

export function ReturnsRo() {
  return (
    <>
      <p>Pe scurt:</p>
      <ul>
        <li>
          Papetăria personalizată nu se poate returna, pentru că o facem după detaliile
          dumneavoastră.
        </li>
        <li>
          Dacă ceva nu este cum ați comandat sau ajunge deteriorat, refacem produsele sau vă dăm
          banii înapoi, pe cheltuiala noastră.
        </li>
        <li>Produsele nepersonalizate le puteți returna în 14 zile, fără să ne spuneți motivul.</li>
        <li>
          Invitația digitală cumpărată o deblocăm imediat după plată, cum vă dați acordul înainte să
          plătiți, iar după aceea nu mai puteți renunța la ea.
        </li>
      </ul>

      <h2>Dreptul de retragere</h2>
      <p>
        Dacă sunteți persoană fizică și cumpărați în afara activității profesionale, aveți dreptul
        să vă retrageți dintr-un contract încheiat la distanță în 14 zile, fără să vă motivați
        decizia, conform Ordonanței de urgență a Guvernului nr. 34/2014. Legea face câteva excepții,
        pe care le găsiți mai jos. Firmele nu au acest drept.
      </p>

      <h3>Papetăria personalizată</h3>
      <p>
        Dreptul de retragere nu se aplică produselor confecționate după specificațiile dumneavoastră
        sau personalizate în mod clar (art. 16 lit. c din OUG nr. 34/2014). Așa sunt invitațiile,
        meniurile, plicurile de bani, numerele de masă și orice alt produs tipărit cu numele, data,
        locurile sau textele dumneavoastră. De aceea vă arătăm totul în studio și tipărim doar după
        ce aprobați bunul de tipar.
      </p>

      <h3>Produsele nepersonalizate</h3>
      <p>
        Pentru produsele pe care nu le personalizăm, de exemplu mărturiile sau accesoriile fără
        nume, dată sau text tipărit, aveți 14 zile de la primire ca să vă retrageți:
      </p>
      <ol>
        <li>
          Anunțați-ne printr-un email la <EmailLink />, cu numărul comenzii, sau trimiteți-ne
          formularul de mai jos. E de ajuns să-l trimiteți înainte să treacă cele 14 zile.
        </li>
        <li>
          Trimiteți-ne produsele în cel mult 14 zile de la anunț, la {COMPANY.name},{" "}
          {COMPANY.workshop}. Costul returului îl suportați dumneavoastră.
        </li>
        <li>
          Vă rambursăm tot ce ați plătit pentru ele, cu tot cu livrarea către dumneavoastră dacă
          returnați toată comanda, în cel mult 14 zile de la anunț, prin aceeași metodă de plată.
          Putem amâna rambursarea până primim produsele sau dovada că le-ați trimis.
        </li>
      </ol>
      <p>
        Răspundeți pentru scăderea valorii produselor dacă le-ați folosit mai mult decât era nevoie
        ca să le vedeți și să le verificați.
      </p>

      <h3>Invitația digitală</h3>
      <p>
        Înainte să plătiți invitația digitală, bifați în coș că vreți s-o deblocăm imediat după
        plată și că înțelegeți că astfel pierdeți dreptul de retragere. O deblocăm imediat ce plata
        este confirmată, așa că de atunci nu vă mai puteți retrage (art. 16 lit. a și m din OUG nr.
        34/2014). Emailul care vă confirmă comanda vă confirmă și acordul. Cea primită gratuit cu
        invitațiile tipărite nu costă nimic, așa că nu vă cerem acordul.
      </p>
      <p>
        Dacă nu funcționează cum trebuie, scrieți-ne: o reparăm, iar dacă nu putem, vă rambursăm
        integral sau parțial, conform OUG nr. 141/2021 privind conținutul digital și serviciile
        digitale.
      </p>

      <h2>Produse neconforme sau deteriorate</h2>
      <p>
        Toate produsele, personalizate sau nu, au garanția legală de conformitate (Ordonanța de
        urgență a Guvernului nr. 140/2021), pentru lipsurile de conformitate care apar în cel mult 2
        ani de la livrare. Dacă un produs nu corespunde comenzii sau bunului de tipar aprobat, are o
        greșeală de tipar, lipsește din colet sau ajunge deteriorat:
      </p>
      <ol>
        <li>
          Scrieți-ne la <EmailLink /> cât mai repede după ce primiți coletul, cu numărul comenzii și
          fotografii ale produselor și, dacă e deteriorat, ale coletului. Ne puteți și suna la{" "}
          <PhoneLink language="ro" />.
        </li>
        <li>Păstrați produsele și ambalajul până rezolvăm.</li>
        <li>
          Retipărim sau înlocuim produsele pe cheltuiala noastră, cu tot cu livrarea. Dacă nu se
          poate sau nu ar ajunge la timp pentru eveniment, vă rambursăm integral sau parțial, după
          caz.
        </li>
      </ol>
      <p>
        Micile diferențe de culoare dintre ecran și hârtie, variațiile ușoare ale finisajelor
        lucrate de mână și greșelile rămase într-un bun de tipar aprobat nu sunt defecte.
      </p>

      <h2>Formular de retragere</h2>
      <p>
        Completați și trimiteți acest formular doar dacă doriți să vă retrageți din contract. Îl
        puteți copia într-un email; adăugați și numărul comenzii, ca s-o găsim repede.
      </p>
      <div className={FORM_CLASS}>
        <p>
          Către: {COMPANY.name}, {COMPANY.workshop}, {COMPANY.email}
        </p>
        <p>
          Vă informez/Vă informăm (*) prin prezenta cu privire la retragerea mea/noastră (*) din
          contractul referitor la vânzarea următoarelor produse (*)/prestarea următoarelor servicii
          (*):
        </p>
        <p>Comandate la data (*)/primite la data (*):</p>
        <p>Numele consumatorului (consumatorilor):</p>
        <p>Adresa consumatorului (consumatorilor):</p>
        <p>
          Semnătura consumatorului (consumatorilor) (doar în cazul în care acest formular este
          notificat pe hârtie):
        </p>
        <p>Data:</p>
        <p>(*) Se elimină mențiunea inutilă.</p>
      </div>
    </>
  );
}
