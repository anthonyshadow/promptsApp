import type { ReactNode } from "react";
import type { NavigateHandler } from "../viewTypes";
import { activeLinkStyle, navLinkStyle, stepLinkStyle } from "../styles";

function RouteLink({
  children,
  current,
  onNavigate,
  to,
  variant = "nav"
}: {
  children: ReactNode;
  current: boolean;
  onNavigate: NavigateHandler;
  to: string;
  variant?: "nav" | "step";
}) {
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigate(to);
  }

  const baseClassName = variant === "step" ? stepLinkStyle : navLinkStyle;
  const className = current ? `${baseClassName} ${activeLinkStyle}` : baseClassName;

  return (
    <a aria-current={current ? "page" : undefined} className={className} href={to} onClick={handleClick}>
      {children}
    </a>
  );
}

export default RouteLink;
