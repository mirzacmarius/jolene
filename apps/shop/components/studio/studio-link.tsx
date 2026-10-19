import type { ComponentProps } from "react";

export interface StudioLinkProps extends Omit<ComponentProps<"a">, "href"> {
  path?: string;
}

// A plain anchor: /studio is another app behind a rewrite, so the browser must load it whole.
export function StudioLink({ path = "", ...props }: StudioLinkProps) {
  return <a href={`/studio${path}`} {...props} />;
}
