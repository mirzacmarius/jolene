import type { ReactNode } from "react";

import { Link } from "@/components/ui/link";

export interface MenuLinkProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  url: string;
}

export function MenuLink({ children, className, onClick, url }: MenuLinkProps) {
  // The designer is another app on this domain: the browser loads it whole.
  if (url === "/studio" || url.startsWith("/studio/")) {
    return (
      <a className={className} href={url} onClick={onClick}>
        {children}
      </a>
    );
  }
  if (url.startsWith("http")) {
    return (
      <a
        className={className}
        href={url}
        onClick={onClick}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={url} onClick={onClick}>
      {children}
    </Link>
  );
}
