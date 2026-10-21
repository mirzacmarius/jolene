import { notFound, redirect } from "next/navigation";

import { getOrder } from "@/lib/order/server";

// The invoice email's link: on to the PDF of the order's invoice, wherever Convex keeps it.
export async function GET(_request: Request, { params }: RouteContext<"/orders/[token]/invoice">) {
  const { token } = await params;
  const order = await getOrder(token);
  if (!order?.invoice) notFound();
  redirect(order.invoice.url);
}
