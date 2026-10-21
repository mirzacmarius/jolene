import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderDetails, OrderDetailsSkeleton } from "@/components/order/order-details";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { getOrder } from "@/lib/order/server";
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Comanda voastră",
};

export function generateStaticParams() {
  return [{ token: PLACEHOLDER_HANDLE }];
}

export default function OrderPage({ params }: PageProps<"/orders/[token]">) {
  return (
    <Page>
      <Container>
        <Sections>
          <Suspense fallback={<OrderDetailsSkeleton />}>
            <OrderPageContent params={params} />
          </Suspense>
        </Sections>
      </Container>
    </Page>
  );
}

async function OrderPageContent({ params }: Pick<PageProps<"/orders/[token]">, "params">) {
  const { token } = await params;
  if (token === PLACEHOLDER_HANDLE) notFound();
  const order = await getOrder(token);
  if (!order) notFound();
  return <OrderDetails order={order} />;
}
