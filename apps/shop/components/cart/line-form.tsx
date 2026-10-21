"use client";

import { sanitizeQuantity, type CartFormRegister } from "@shopify/hydrogen";
import type { ComponentProps, ReactNode } from "react";

import { useCartForm } from "@/lib/cart/client";
import { MAX_QUANTITY } from "@/lib/line-options";

interface CartLineFormProps extends Omit<ComponentProps<"form">, "action" | "children" | "method"> {
  children: (register: CartFormRegister) => ReactNode;
  lineId: string;
  maxQuantity?: number;
  minQuantity?: number;
  removable?: boolean;
}

export function CartLineForm({
  children,
  lineId,
  maxQuantity = MAX_QUANTITY,
  minQuantity = 1,
  removable = true,
  ...props
}: CartLineFormProps) {
  const { formProps, register } = useCartForm();

  return (
    <form
      {...formProps({
        beforeSubmit: (event) => {
          const input = event.currentTarget.elements.namedItem("quantity");
          if (input instanceof HTMLInputElement) {
            const quantity = sanitizeQuantity(input.value, {
              max: maxQuantity,
              min: removable ? 0 : minQuantity,
            });
            // Zero removes the line; anything else stays at the product's minimum or above.
            input.value = String(quantity === 0 ? 0 : Math.max(minQuantity, quantity));
          }
        },
      })}
      {...props}
    >
      <button {...register("set")} />
      <input type="hidden" {...register("lineId", { value: lineId })} />
      {children(register)}
    </form>
  );
}
