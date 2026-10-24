import { CompanyDetails, EmailLink } from "./contact";
import { LegalLink } from "./legal-page";

export function PrivacyEn() {
  return (
    <>
      <p>
        This policy explains what personal data we keep when you use Jolene’s shop, studio and
        digital invitations, why, for how long, who else handles it and what rights you have, under
        Regulation (EU) 2016/679 (the GDPR). It applies to the couples and families who order from
        us and to the guests who open a digital invitation.
      </p>

      <h2>Who is responsible for your data</h2>
      <p>The controller of your data is:</p>
      <CompanyDetails language="en" />
      <p>
        For any question or request about your data, email us at <EmailLink />.
      </p>

      <h2>What data we use and why</h2>

      <h3>When you visit the website</h3>
      <p>
        Like any web server, the servers that host the website record your IP address, your browser
        and the pages you ask for, so that the website works and is protected from attacks. We rely
        on our legitimate interest in keeping the website running and secure. We use no analytics or
        advertising tools. Cookies and the data the website keeps in your browser are described in
        our <LegalLink language="en" page="cookies" />.
      </p>

      <h3>Your cart</h3>
      <p>
        We find your cart by a random code kept in a cookie for 90 days, and the cart holds the
        products and options you chose. We use it to prepare the contract you ask for.
      </p>

      <h3>The studio</h3>
      <p>
        When you design, we keep your designs and their versions, your event’s details (the names of
        the couple or the child, the date and time, the ceremony and reception venues, the names of
        the godparents and parents, the details for replies), the photos you upload and the proofs
        you approve. Without an account, they are tied to the browser you work in. We use them to
        provide the studio and prepare your order, which is the contract you ask for. When you turn
        on a design’s viewing link, whoever has the link sees that design with the details and
        photos it shows, until you turn the link off.
      </p>

      <h3>Your account</h3>
      <p>
        Your account holds your email address, to which we send your sign-in codes. A partner who
        joins your event uses their own account. We use it to provide the service you ask for.
      </p>

      <h3>The AI designer</h3>
      <p>
        When you write to the AI designer, we send your message, your design, your event’s details
        and pictures of the design, which may include your photos, to a model made by Anthropic, so
        that it can answer you. Anthropic processes them only on our behalf and does not use them to
        train its models. We keep the conversation with the design. We use it to provide the studio
        you ask for. The AI designer only suggests changes to your design when you ask; we make no
        automated decisions that affect you.
      </p>

      <h3>Orders and payments</h3>
      <p>
        For an order, we keep your name, email address, phone number, delivery address, the
        products, their proofs and what you paid. You enter your card details on Stripe’s page: we
        never see them. We use this data to make and deliver your order, send you emails about it
        and issue its invoice, as the contract and our accounting and tax obligations require. Your
        order’s page opens from the link in your confirmation email, which carries a long code that
        is hard to guess: please do not pass it on.
      </p>

      <h3>When you write to us</h3>
      <p>
        We keep the emails and messages you send us, to answer you and to keep your order’s history.
        We rely on our legitimate interest in answering you, or on the contract when it concerns an
        order.
      </p>

      <h2>The digital invitation</h2>

      <h3>For couples</h3>
      <p>
        You write your guest list: for each family, their name, how many people are invited, whether
        they may bring a plus-one, whose guests they are and, if you wish, their phone number, email
        address, language and a note only you see. You decide whom to invite and what to ask. We
        keep the list only for you and your partner and use it only to run your invitation. Please
        add only people you are inviting.
      </p>
      <p>
        When you send links by WhatsApp or text message, they go from your own phone; we only note
        that you sent them. When you ask us to, we email the invitation from Jolene’s address and
        show you whether each email arrived.
      </p>

      <h3>For guests</h3>
      <p>
        If you received a digital invitation, the couple put you on their list, with the details
        above. When you open it, we note when you first did. When you reply, we keep your answer:
        whether you are coming, who is coming (their names and whether they are children), the meal
        each chose if the couple asks, your message to the couple and, only if you write them, the
        allergies or foods you cannot eat.
      </p>
      <p>
        Only the couple and their partner see your reply, and Jolene’s team only when it needs to
        fix a problem. Allergies are health data: we use them only with the explicit consent you
        give when you write them, so that the couple can tell their venue. You can remove them at
        any time by sending a new reply without them. For the rest of your data we rely on
        legitimate interest: helping the couple organise the event you are invited to.
      </p>
      <p>
        For any request about your data, you can ask the couple, or us at <EmailLink />.
      </p>

      <h2>Who else handles your data</h2>
      <p>
        We do not sell your data or use it for advertising. We share it only with the companies that
        help us serve you, which handle it on our behalf and on our instructions, and with
        authorities when the law requires it:
      </p>
      <ul>
        <li>
          <strong>Convex</strong> (United States): the website’s database and files.
        </li>
        <li>
          <strong>Vercel</strong> (United States): hosting the website.
        </li>
        <li>
          <strong>Stripe</strong> (Ireland): payments. Stripe also handles some data on its own
          account, for example to prevent fraud; see{" "}
          <a href="https://stripe.com/privacy">Stripe’s privacy policy</a>.
        </li>
        <li>
          <strong>Resend</strong> (United States): sending emails (sign-in codes, order
          confirmations and invitations).
        </li>
        <li>
          <strong>Anthropic</strong> (United States): the AI designer’s model.
        </li>
        <li>
          <strong>Colete Online</strong> (Romania), which books the delivery, and the courier it
          books for the parcel, such as Cargus, Sameday, FAN Courier, DPD or GLS: delivering orders,
          with the recipient’s name, address and phone number.
        </li>
        <li>
          <strong>SmartBill</strong> (Intelligent IT SRL, Romania), which issues our invoices, and{" "}
          <strong>ANAF</strong>, Romania’s tax authority, through the RO e-Factura system: invoices.
        </li>
      </ul>

      <h2>Transfers outside the European Union</h2>
      <p>
        Convex, Vercel, Resend and Anthropic also process data in the United States. These transfers
        are protected by the standard contractual clauses approved by the European Commission and,
        for certified companies, by the EU-US Data Privacy Framework.
      </p>

      <h2>How long we keep your data</h2>
      <ul>
        <li>Orders and invoices: 10 years, as Romanian accounting law requires.</li>
        <li>
          Designs, event details, photos and conversations with the AI designer: until you ask us to
          delete them. Those made without an account are tied to your browser, so you can no longer
          open them once you clear its data.
        </li>
        <li>Your account: until you ask us to delete it.</li>
        <li>
          Guest lists, replies and the invitations’ emails: until the couple removes the family or
          asks us to delete their account. Otherwise we delete them automatically between 12 and 24
          months after the event, as Jolene sets it; for an event without a date, we count from the
          last change to the invitation or its list.
        </li>
        <li>
          Copies of the emails we send (sign-in codes, order confirmations and invitations): 30
          days.
        </li>
        <li>
          Your cart: its cookie expires after 90 days, and we delete a checkout you started but did
          not pay after 30 days.
        </li>
        <li>Server logs: up to 30 days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You have the right to ask for access to your data, to have it corrected or deleted, to
        restrict its use and to receive a copy in a format you can use elsewhere. You can object to
        uses based on our legitimate interest, and withdraw your consent at any time, without
        affecting what we did before. Email us at <EmailLink />; we answer within one month.
      </p>
      <p>
        If you think we handle your data unlawfully, you can complain to Romania’s data protection
        authority, the Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter
        Personal (ANSPDCP), Bd. G-ral. Gheorghe Magheru nr. 28-30, sector 1, București,{" "}
        <a href="https://www.dataprotection.ro/">dataprotection.ro</a>.
      </p>

      <h2>Security</h2>
      <p>
        The website uses encrypted connections (HTTPS), only the people who need your data can reach
        it, and Stripe processes payments. Your order’s page, your proof, your invitation and your
        design’s viewing link open from links with long codes that are hard to guess: anyone with
        such a link sees what it shows, so share it only with the people it is meant for.
      </p>

      <h2>Children</h2>
      <p>
        The shop and the studio are meant for adults. We receive data about children only when
        parents or couples write it: a child’s name on a christening invitation, or the children of
        a family in a reply.
      </p>

      <h2>Changes</h2>
      <p>
        When we change this policy, we update the date at the top of this page. If a change matters,
        we also tell you by email or in the studio. This English version is a translation: if the
        two differ, the Romanian version prevails.
      </p>
    </>
  );
}

export function PrivacyRo() {
  return (
    <>
      <p>
        Aici explicăm ce date personale păstrăm când folosiți magazinul, studioul și invitațiile
        digitale Jolene, de ce, cât timp, cine le mai prelucrează și ce drepturi aveți, conform
        Regulamentului (UE) 2016/679 (GDPR). Politica se aplică mirilor și familiilor care comandă
        de la noi și invitaților care deschid o invitație digitală.
      </p>

      <h2>Cine răspunde de date</h2>
      <p>Operatorul datelor dumneavoastră este:</p>
      <CompanyDetails language="ro" />
      <p>
        Pentru orice întrebare sau cerere despre datele dumneavoastră, scrieți-ne la <EmailLink />.
      </p>

      <h2>Ce date prelucrăm și de ce</h2>

      <h3>Când vizitați site-ul</h3>
      <p>
        Ca orice server, serverele care găzduiesc site-ul înregistrează adresa IP, browserul și
        paginile cerute, ca site-ul să funcționeze și să fie apărat de atacuri. Temeiul este
        interesul nostru legitim de a ține site-ul funcțional și sigur. Nu folosim instrumente de
        analiză sau de publicitate. Despre cookie-uri și datele salvate în browser aflați mai multe
        din <LegalLink language="ro" page="cookies" />.
      </p>

      <h3>Coșul</h3>
      <p>
        Coșul îl găsim după un cod aleatoriu, păstrat într-un cookie 90 de zile, iar el ține
        produsele și opțiunile alese. Temeiul este pregătirea contractului, la cererea
        dumneavoastră.
      </p>

      <h3>Studioul</h3>
      <p>
        Când creați un design, păstrăm designul și versiunile lui, detaliile evenimentului (numele
        mirilor sau al copilului, data și ora, locurile ceremoniei și ale petrecerii, numele nașilor
        și ale părinților, datele pentru confirmări), fotografiile pe care le încărcați și bunurile
        de tipar aprobate. Fără cont, ele sunt legate de browserul în care lucrați. Temeiul este
        contractul: vă oferim studioul și pregătim comanda, la cererea dumneavoastră. Când porniți
        linkul de vizionare al unui design, oricine are linkul vede designul cu detaliile și
        fotografiile pe care le arată, până opriți linkul.
      </p>

      <h3>Contul</h3>
      <p>
        Contul are adresa dumneavoastră de email, la care vă trimitem codurile de conectare.
        Partenerul care se alătură evenimentului își folosește propriul cont. Temeiul este
        contractul.
      </p>

      <h3>Designerul AI</h3>
      <p>
        Când îi scrieți designerului AI, trimitem mesajul dumneavoastră, designul, detaliile
        evenimentului și imagini ale designului, care pot cuprinde fotografiile dumneavoastră, unui
        model al companiei Anthropic, ca să vă poată răspunde. Anthropic le prelucrează doar în
        numele nostru și nu le folosește ca să-și antreneze modelele. Conversația o păstrăm împreună
        cu designul. Temeiul este contractul. Designerul AI doar propune modificări ale designului,
        la cererea dumneavoastră; nu luăm decizii automate care să vă afecteze.
      </p>

      <h3>Comenzile și plățile</h3>
      <p>
        Pentru o comandă păstrăm numele, emailul, telefonul, adresa de livrare, produsele, bunurile
        lor de tipar și sumele plătite. Datele cardului le scrieți pe pagina Stripe: noi nu le
        vedem. Folosim aceste date ca să facem și să livrăm comanda, să vă trimitem emailurile
        despre ea și să emitem factura. Temeiurile sunt contractul și obligațiile noastre contabile
        și fiscale. Pagina comenzii se deschide din linkul din emailul de confirmare, care conține
        un cod lung, greu de ghicit: nu-l dați mai departe.
      </p>

      <h3>Când ne scrieți</h3>
      <p>
        Păstrăm emailurile și mesajele pe care ni le trimiteți, ca să vă răspundem și să avem
        istoricul comenzii. Temeiul este interesul nostru legitim de a vă răspunde sau, când e vorba
        de o comandă, contractul.
      </p>

      <h2>Invitația digitală</h2>

      <h3>Pentru miri</h3>
      <p>
        Lista de invitați o scrieți dumneavoastră: pentru fiecare familie, numele, câte persoane
        sunt invitate, dacă pot veni cu un însoțitor, ai cui invitați sunt și, dacă doriți,
        telefonul, emailul, limba și o notă pe care doar dumneavoastră o vedeți. Hotărâți pe cine
        invitați și ce întrebați. Noi păstrăm lista doar pentru dumneavoastră și pentru partener și
        o folosim doar ca invitația să funcționeze. Adăugați doar persoanele pe care le invitați.
      </p>
      <p>
        Când trimiteți linkurile prin WhatsApp sau SMS, mesajele pleacă de pe telefonul
        dumneavoastră; noi notăm doar că le-ați trimis. Când ne cereți, trimitem noi invitația pe
        email, de la adresa Jolene, și vă arătăm dacă fiecare email a ajuns.
      </p>

      <h3>Pentru invitați</h3>
      <p>
        Dacă ați primit o invitație digitală, mirii v-au trecut pe lista lor, cu datele de mai sus.
        Când o deschideți, notăm data primei deschideri. Când confirmați, păstrăm răspunsul: dacă
        veniți, cine vine (numele și dacă e copil), meniul ales de fiecare, dacă mirii întreabă,
        mesajul pentru miri și, doar dacă le scrieți, alergiile sau alimentele pe care nu le puteți
        mânca.
      </p>
      <p>
        Răspunsul îl văd doar mirii și partenerul, iar echipa Jolene doar când trebuie să rezolve o
        problemă. Alergiile sunt date despre sănătate: le folosim doar cu consimțământul explicit pe
        care îl dați când le scrieți, ca mirii să poată anunța localul. Le puteți șterge oricând,
        trimițând o confirmare nouă fără ele. Pentru celelalte date, temeiul este interesul legitim:
        să-i ajutăm pe miri să organizeze evenimentul la care sunteți invitat.
      </p>
      <p>
        Pentru orice cerere despre datele dumneavoastră, vă puteți adresa mirilor sau nouă, la{" "}
        <EmailLink />.
      </p>

      <h2>Cine mai prelucrează datele</h2>
      <p>
        Nu vindem datele și nu le folosim pentru publicitate. Le dăm doar firmelor care ne ajută să
        vă servim, care le prelucrează în numele nostru și după instrucțiunile noastre, și
        autorităților, când legea o cere:
      </p>
      <ul>
        <li>
          <strong>Convex</strong> (SUA): baza de date și fișierele site-ului.
        </li>
        <li>
          <strong>Vercel</strong> (SUA): găzduirea site-ului.
        </li>
        <li>
          <strong>Stripe</strong> (Irlanda): plățile. Stripe prelucrează unele date și în nume
          propriu, de exemplu ca să prevină fraudele; vedeți{" "}
          <a href="https://stripe.com/privacy">politica de confidențialitate a Stripe</a>.
        </li>
        <li>
          <strong>Resend</strong> (SUA): trimiterea emailurilor (codurile de conectare, confirmările
          comenzilor și invitațiile).
        </li>
        <li>
          <strong>Anthropic</strong> (SUA): modelul designerului AI.
        </li>
        <li>
          <strong>Colete Online</strong> (România), prin care comandăm livrarea, și curierul ales
          pentru colet, precum Cargus, Sameday, FAN Courier, DPD sau GLS: livrarea comenzilor, cu
          numele, adresa și telefonul destinatarului.
        </li>
        <li>
          <strong>SmartBill</strong> (Intelligent IT SRL, România), prin care emitem facturile, și{" "}
          <strong>ANAF</strong>, prin sistemul RO e-Factura: facturile.
        </li>
      </ul>

      <h2>Transferuri în afara Uniunii Europene</h2>
      <p>
        Convex, Vercel, Resend și Anthropic prelucrează date și în Statele Unite. Aceste transferuri
        sunt protejate prin clauzele contractuale standard aprobate de Comisia Europeană și, pentru
        firmele certificate, prin Cadrul UE-SUA privind protecția datelor.
      </p>

      <h2>Cât timp păstrăm datele</h2>
      <ul>
        <li>Comenzile și facturile: 10 ani, cât cere legea contabilității.</li>
        <li>
          Designurile, detaliile evenimentului, fotografiile și conversațiile cu designerul AI: până
          ne cereți să le ștergem. Cele făcute fără cont sunt legate de browser, așa că nu le mai
          puteți deschide după ce îi ștergeți datele.
        </li>
        <li>Contul: până ne cereți să-l ștergem.</li>
        <li>
          Lista de invitați, confirmările și emailurile invitațiilor: până când mirii șterg familia
          din listă sau ne cer să le ștergem contul. Altfel le ștergem automat între 12 și 24 de
          luni după eveniment, după cum stabilește Jolene; pentru un eveniment fără dată, socotim de
          la ultima schimbare a invitației sau a listei.
        </li>
        <li>
          Copiile emailurilor pe care le trimitem (codurile de conectare, confirmările comenzilor și
          invitațiile): 30 de zile.
        </li>
        <li>
          Coșul: cookie-ul expiră după 90 de zile, iar o plată începută și neterminată o ștergem
          după 30 de zile.
        </li>
        <li>Jurnalele serverelor: cel mult 30 de zile.</li>
      </ul>

      <h2>Drepturile dumneavoastră</h2>
      <p>
        Aveți dreptul să cereți accesul la datele dumneavoastră, corectarea sau ștergerea lor,
        restricționarea prelucrării și o copie într-un format pe care îl puteți folosi în altă
        parte. Vă puteți opune prelucrării bazate pe interesul nostru legitim și vă puteți retrage
        oricând consimțământul, fără să afecteze ce am făcut înainte. Scrieți-ne la <EmailLink />;
        vă răspundem în cel mult o lună.
      </p>
      <p>
        Dacă socotiți că vă prelucrăm datele cu încălcarea legii, puteți depune o plângere la
        Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP),
        Bd. G-ral. Gheorghe Magheru nr. 28-30, sector 1, București,{" "}
        <a href="https://www.dataprotection.ro/">dataprotection.ro</a>.
      </p>

      <h2>Securitate</h2>
      <p>
        Site-ul folosește conexiuni criptate (HTTPS), la date au acces doar oamenii care au nevoie
        de ele, iar plățile le procesează Stripe. Pagina comenzii, bunul de tipar, invitația și
        linkul de vizionare al designului se deschid din linkuri cu coduri lungi, greu de ghicit:
        oricine are un astfel de link vede ce arată el, așa că trimiteți-l doar celor cărora le este
        destinat.
      </p>

      <h2>Copiii</h2>
      <p>
        Magazinul și studioul sunt pentru adulți. Date despre copii primim doar când le scriu
        părinții sau mirii: numele copilului pe o invitație de botez sau copiii unei familii, într-o
        confirmare.
      </p>

      <h2>Modificări</h2>
      <p>
        Când schimbăm această politică, actualizăm data din capul paginii. Dacă schimbarea e
        importantă, v-o spunem și pe email sau în studio. Versiunea în limba engleză este o
        traducere: dacă cele două diferă, are prioritate cea în limba română.
      </p>
    </>
  );
}
