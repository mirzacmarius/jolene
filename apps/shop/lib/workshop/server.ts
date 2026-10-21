import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

export async function isWorkshopAccount(token: string): Promise<boolean> {
  try {
    const access = await fetchQuery(api.workshop.access, {}, { token });
    return access.signedIn && access.allowed;
  } catch {
    return false;
  }
}
