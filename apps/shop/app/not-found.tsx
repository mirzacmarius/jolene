import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";

export default function NotFoundError() {
  return (
    <Page className="flex flex-1 flex-col">
      <Container className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl">Pagina nu există</h1>
          <p className="max-w-xl text-sm text-muted-foreground md:text-base">
            Adresa poate fi greșită, sau pagina a fost mutată.
          </p>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            href="/collections/all"
          >
            Vezi produsele
          </Link>
        </div>
      </Container>
    </Page>
  );
}
