import { Link } from "react-router";

import { Logo } from "./logo";

import { cn } from "~/lib/utils";

export interface BrandLockupProps {
  /** wraps the lockup in a Link to "/" */
  to?: string;
  className?: string;
  logoClassName?: string;
  wordmarkClassName?: string;
}

// logo mark + "moku pona" wordmark, shared by nav, footer, auth panel and
// the mobile menu
export function BrandLockup({
  to,
  className,
  logoClassName,
  wordmarkClassName,
}: BrandLockupProps) {
  const content = (
    <>
      <Logo className={cn("size-5.5", logoClassName)} />
      <span className={cn("font-semibold", wordmarkClassName)}>moku pona</span>
    </>
  );

  const classes = cn("flex items-center gap-3", className);

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
