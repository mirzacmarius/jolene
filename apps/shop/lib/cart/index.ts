import type { LineProblem } from "@/lib/cart/types";

export const CART_COOKIE = "jolene_cart";

export function describeLineProblem(problem: LineProblem): string {
  switch (problem.kind) {
    case "changed":
      return `„${problem.label}” nu mai are alegerea făcută. Scoate produsul din coș și adaugă-l din nou.`;
    case "minimum":
      return `Se comandă de la ${problem.minQuantity} buc.`;
    case "missing":
      return `Lipsește „${problem.label}”. Scoate produsul din coș și adaugă-l din nou.`;
    case "unavailable":
      return "Produsul nu mai e de vânzare. Scoate-l din coș.";
    case "unlocked":
      return "Invitația e deschisă deja tuturor invitaților. Scoate-o din coș.";
  }
}
