import type { ComponentProps } from "react";

interface ProductInfoDescriptionProps extends ComponentProps<"div"> {
  descriptionHtml: string;
}

// The descriptions are jolene.ro's own, loaded from packages/products.
export function ProductInfoDescription({
  className,
  descriptionHtml,
  ...props
}: ProductInfoDescriptionProps) {
  if (!descriptionHtml) return null;
  return (
    <div className={className} data-slot="product-info-description" {...props}>
      <div
        className="prose prose-sm text-foreground/80"
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    </div>
  );
}
