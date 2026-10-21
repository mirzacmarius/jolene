import { COMPANY } from "@/lib/legal";

import { EmailLink } from "./contact";
import { LegalLink } from "./legal-page";

export function DeliveryEn() {
  return (
    <>
      <p>
        In short: you pay for your order in full when you place it, by card, and it reaches you
        within 7 working days. Delivery by courier costs 25 lei and is free for orders from 800 lei.
      </p>

      <h2>How to order</h2>
      <ol>
        <li>
          Design your stationery in the studio and approve its proof, or choose a product in the
          shop.
        </li>
        <li>Choose the paper, the options and the quantity, then add the product to your cart.</li>
        <li>Pay on Stripe’s page, where you enter your address and choose delivery.</li>
        <li>
          We email you the confirmation, with a link to your order’s page, and then the invoice.
        </li>
        <li>When we hand your parcel to the courier, we email you its tracking link.</li>
      </ol>
      <p>
        For a design made just for you, or an order you cannot find in the shop, email us at{" "}
        <EmailLink />.
      </p>

      <h2>Payment</h2>
      <ul>
        <li>
          You pay in full when you order, online, by card, Apple Pay or Google Pay. Stripe processes
          the payment; your card details never reach us.
        </li>
        <li>
          Prices are in Romanian lei (RON) and include VAT; the payment page shows how much of the
          total is VAT.
        </li>
        <li>We do not take cash on delivery or bank transfers.</li>
        <li>Discount codes go on the payment page.</li>
      </ul>

      <h2>Invoices</h2>
      <ul>
        <li>
          We issue an invoice for every paid order and email it to you as a PDF. We also send it to
          the RO e-Factura system, as Romanian law requires.
        </li>
        <li>
          For an invoice in a company’s name, tick that you are buying as a business on the payment
          page and enter the company’s name and tax ID.
        </li>
        <li>When we refund an order, we issue a credit note.</li>
      </ul>

      <h2>When your order arrives</h2>
      <ul>
        <li>
          We print, assemble and send your order so that it reaches you within 7 working days of
          payment, depending on the quantity and the finishes.
        </li>
        <li>When we email you the proof, those days count from your approval.</li>
        <li>
          If you need it sooner, some products offer an urgent order (200 lei). Email us before you
          order, so we can confirm the date.
        </li>
        <li>
          Nothing is delivered for the digital invitation: we unlock it as soon as your payment is
          confirmed.
        </li>
      </ul>

      <h2>Delivery</h2>
      <p>We deliver within Romania only. You choose delivery on the payment page:</p>
      <ul>
        <li>
          <strong>Cargus courier, to your address:</strong> 25 lei, free for orders from 800 lei
          (products and fees, before delivery and any discount code). The courier usually delivers
          within 1–2 working days of collecting the parcel, and may call you on the number you gave
          at checkout.
        </li>
        <li>
          <strong>Collection from our workshop:</strong> free, from {COMPANY.workshop}. We email you
          when your order is ready.
        </li>
      </ul>
      <p>
        When your parcel arrives, check it in front of the courier if you can. If it is damaged,
        tell the courier and email us photos; see <LegalLink language="en" page="returns" />.
      </p>
    </>
  );
}

export function DeliveryRo() {
  return (
    <>
      <p>
        Pe scurt: plătiți integral când comandați, cu cardul, iar comanda ajunge la dumneavoastră în
        cel mult 7 zile lucrătoare. Livrarea prin curier costă 25 de lei și este gratuită pentru
        comenzile de la 800 de lei.
      </p>

      <h2>Cum comandați</h2>
      <ol>
        <li>
          Creați papetăria în studio și aprobați bunul de tipar, sau alegeți un produs din magazin.
        </li>
        <li>Alegeți hârtia, opțiunile și cantitatea, apoi adăugați produsul în coș.</li>
        <li>Plătiți pe pagina Stripe, unde scrieți adresa și alegeți livrarea.</li>
        <li>Vă trimitem pe email confirmarea, cu linkul către pagina comenzii, apoi factura.</li>
        <li>Când predăm coletul curierului, vă trimitem pe email linkul de urmărire.</li>
      </ol>
      <p>
        Pentru un design făcut doar pentru dumneavoastră sau pentru o comandă pe care nu o găsiți în
        magazin, scrieți-ne la <EmailLink />.
      </p>

      <h2>Plata</h2>
      <ul>
        <li>
          Plătiți integral când comandați, online, cu cardul, Apple Pay sau Google Pay. Plata o
          procesează Stripe; datele cardului nu ajung la noi.
        </li>
        <li>
          Prețurile sunt în lei și includ TVA; pe pagina de plată vedeți cât TVA conține totalul.
        </li>
        <li>Nu primim plata la livrare (ramburs) și nici prin transfer bancar.</li>
        <li>Codurile de reducere le introduceți pe pagina de plată.</li>
      </ul>

      <h2>Factura</h2>
      <ul>
        <li>
          Emitem factura pentru fiecare comandă plătită și v-o trimitem pe email, în format PDF. O
          transmitem și în sistemul RO e-Factura, cum cere legea.
        </li>
        <li>
          Pentru factură pe firmă, bifați pe pagina de plată că plătiți în numele unei firme și
          scrieți denumirea și codul ei fiscal.
        </li>
        <li>Când rambursăm o comandă, emitem o factură de stornare.</li>
      </ul>

      <h2>În cât timp ajunge comanda</h2>
      <ul>
        <li>
          Tipărim, asamblăm și trimitem comanda astfel încât să ajungă la dumneavoastră în cel mult
          7 zile lucrătoare de la plată, în funcție de cantitate și de finisaje.
        </li>
        <li>Când bunul de tipar vi-l trimitem pe email, termenul curge de la aprobarea lui.</li>
        <li>
          Dacă aveți nevoie de comandă mai repede, unele produse au opțiunea „Comandă urgentă” (200
          de lei). Scrieți-ne înainte să comandați, ca să confirmăm termenul.
        </li>
        <li>Invitația digitală nu se livrează: o deblocăm imediat ce plata este confirmată.</li>
      </ul>

      <h2>Livrarea</h2>
      <p>Livrăm doar în România. Alegeți livrarea pe pagina de plată:</p>
      <ul>
        <li>
          <strong>Curier Cargus, la adresa dumneavoastră:</strong> 25 de lei, gratuit pentru
          comenzile de la 800 de lei (produsele și taxele, fără livrare și înainte de codurile de
          reducere). Curierul livrează de obicei în 1–2 zile lucrătoare de la preluarea coletului și
          vă poate suna la numărul dat la plată.
        </li>
        <li>
          <strong>Ridicare din atelier:</strong> gratuit, din {COMPANY.workshop}. Vă scriem când
          comanda este gata.
        </li>
      </ul>
      <p>
        Când primiți coletul, verificați-l, dacă puteți, în fața curierului. Dacă e deteriorat,
        spuneți-i curierului și trimiteți-ne fotografii; vedeți{" "}
        <LegalLink language="ro" page="returns" />.
      </p>
    </>
  );
}
