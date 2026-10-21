/**
 * Directions to a venue in the apps guests use: Waze, which most drivers in
 * Romania do, Google Maps and Apple Maps. Each searches the venue's address,
 * with its name to tell it apart.
 */

/** What a map searches for: the address, else the venue's name. */
export function placeQuery(venue?: string, address?: string) {
  return [venue, address]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function wazeLink(query: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

export function googleMapsLink(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function appleMapsLink(query: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}
