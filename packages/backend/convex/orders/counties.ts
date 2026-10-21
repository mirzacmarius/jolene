/**
 * Romania's counties (județe) and Bucharest: the code ISO 3166-2 gives each,
 * its name, and the first two digits of its postal codes. An invoice for
 * e-Factura and a courier's AWB both need an address's county, which
 * Stripe's page may not ask for in Romania, so an order finds it from the
 * postal code when Stripe has none.
 */
const counties: [code: string, name: string, prefixes: string[]][] = [
  ["AB", "Alba", ["51"]],
  ["AR", "Arad", ["31"]],
  ["AG", "Argeș", ["11"]],
  ["BC", "Bacău", ["60"]],
  ["BH", "Bihor", ["41"]],
  ["BN", "Bistrița-Năsăud", ["42"]],
  ["BT", "Botoșani", ["71"]],
  ["BV", "Brașov", ["50"]],
  ["BR", "Brăila", ["81"]],
  ["B", "București", ["01", "02", "03", "04", "05", "06"]],
  ["BZ", "Buzău", ["12"]],
  ["CS", "Caraș-Severin", ["32"]],
  ["CL", "Călărași", ["91"]],
  ["CJ", "Cluj", ["40"]],
  ["CT", "Constanța", ["90"]],
  ["CV", "Covasna", ["52"]],
  ["DB", "Dâmbovița", ["13"]],
  ["DJ", "Dolj", ["20"]],
  ["GL", "Galați", ["80"]],
  ["GR", "Giurgiu", ["08"]],
  ["GJ", "Gorj", ["21"]],
  ["HR", "Harghita", ["53"]],
  ["HD", "Hunedoara", ["33"]],
  ["IL", "Ialomița", ["92"]],
  ["IS", "Iași", ["70"]],
  ["IF", "Ilfov", ["07"]],
  ["MM", "Maramureș", ["43"]],
  ["MH", "Mehedinți", ["22"]],
  ["MS", "Mureș", ["54"]],
  ["NT", "Neamț", ["61"]],
  ["OT", "Olt", ["23"]],
  ["PH", "Prahova", ["10"]],
  ["SM", "Satu Mare", ["44"]],
  ["SJ", "Sălaj", ["45"]],
  ["SB", "Sibiu", ["55"]],
  ["SV", "Suceava", ["72"]],
  ["TR", "Teleorman", ["14"]],
  ["TM", "Timiș", ["30"]],
  ["TL", "Tulcea", ["82"]],
  ["VS", "Vaslui", ["73"]],
  ["VL", "Vâlcea", ["24"]],
  ["VN", "Vrancea", ["62"]],
];

/** A name as people type it: without diacritics, case or dashes. */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, " ")
    .replace(/^(judetul|jud\.?|municipiul) /i, "")
    .trim()
    .toLowerCase();

/**
 * The county of an address in Romania, by its name: what Stripe gave as the
 * address's state, as a code (IS, RO-IS) or a name however it's written,
 * else what the postal code's first two digits say. None when neither does.
 */
export function romanianCounty(
  state: string | null | undefined,
  postalCode: string | null | undefined,
): string | undefined {
  const given = state?.trim();
  if (given) {
    const code = given.toUpperCase().replace(/^RO-/, "");
    const found =
      counties.find(([known]) => known === code) ??
      counties.find(([, name]) => plain(name) === plain(given));
    if (found) return found[1];
  }
  const digits = postalCode?.replace(/\s/g, "");
  if (digits && /^\d{6}$/.test(digits)) {
    const found = counties.find(([, , prefixes]) =>
      prefixes.includes(digits.slice(0, 2)),
    );
    if (found) return found[1];
  }
  return given || undefined;
}
