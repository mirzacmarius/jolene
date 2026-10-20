import { notFound } from "next/navigation";

/**
 * Any address no page answers. It shows the not-found screen beside it, in
 * the reader's language, instead of the framework's own page in English.
 */
export default function Missing() {
  notFound();
}
