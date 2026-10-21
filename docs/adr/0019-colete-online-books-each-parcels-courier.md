# Colete Online books each parcel's courier

A printed order needs a courier booked for its parcel, an AWB, and a label to stick on the box. jolene.ro booked Cargus through Cargus's plugin. Marius chose Colete Online instead. It compares the couriers (Cargus, Sameday, FAN Courier, DPD, GLS and others) and books the cheapest one for each parcel, all through one API (`convex/shipments.ts`, `convex/shipments/`).

- **The workshop books the courier once the parcel is packed** (`shipments.book`). The parcel goes in the standard box (1 kg, 35 × 25 × 5 cm) unless the workshop weighs and measures another. Convex asks Colete Online for the cheapest courier from the workshop's address saved in Colete Online to the order's delivery address, with the order's number as the reference. The order keeps the courier, its service, the AWB, what Colete Online charges for it, and the label's PDF, which the workshop prints.
- **A courier is booked once.** The order notes the booking before Colete Online is asked. A booking Colete Online refused can be asked for again, and so can one stuck for a quarter of an hour. Colete Online may have booked a stuck one all the same, so the team looks there first.
- **A test order books on Colete Online's staging API**, which no courier collects from.
- **The couple hear their parcel is on its way** in an email in the language they paid in, naming the courier and the AWB. Their order page shows both, with the courier's latest word. A couple picking up from the workshop gets an email when their order is ready instead (`recordPickupReady`), once the workshop marks it ready.
- **Colete Online tells Convex when a parcel's progress changes**, at an address each booking gives it: `/colete-online-webhook`, with the order and a secret of the booking's own. Convex then asks Colete Online where the parcel is, rather than trusting what it was sent. The workshop can also ask again (`shipments.refresh`).
- **What goes wrong goes to the team.** A refusal is kept on the order with Colete Online's reason, and the team gets an email with the address and phone number to book the courier by hand. A label that couldn't be fetched leaves the booking standing, with a warning.
- **The workshop can book a courier itself and type in its AWB** (`recordShipment`) when Colete Online can't book it. The couple hear of it the same way, though Convex can't follow that parcel's progress.

## Consequences

- A Convex deployment books couriers once it has `COLETE_ONLINE_CLIENT_ID` and `COLETE_ONLINE_CLIENT_SECRET`, from Colete Online's API settings, and the workshop's address is saved in Colete Online: the first address saved, or the one `COLETE_ONLINE_ADDRESS_ID` names. Until then the workshop books couriers in Colete Online itself and can type their AWBs in.
- What Colete Online charges for a courier is the shop's cost. The couple pay the delivery price of ADR 0015, 25 lei, or nothing from 800 lei.
- Booking a courier doesn't change the order's status: statuses are the workshop's to set.
- Colete Online's API documentation couldn't be read from the sessions that wrote this, so the calls follow a published PHP client of it, and its staging API is taken to accept the same keys. The first live booking is worth checking in Colete Online, the street and number of the address above all, and so is the webhook's first call.
