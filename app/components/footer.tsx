import { Link } from "react-router";

import { BrandLockup } from "./brand-lockup";
import { Eyebrow } from "./section";

const linkClasses = "text-sm text-foreground/80 hover:text-foreground";

export function Footer() {
  return (
    <footer className="border-t">
      {/* desktop */}
      <div className="flex items-start justify-between gap-8 px-10 py-11 max-md:hidden">
        <div className="flex flex-col gap-3">
          <BrandLockup logoClassName="size-5" />
          <span className="text-foreground/50 text-xs">
            made with love in zürich
          </span>
        </div>
        <div className="flex gap-14">
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              explore
            </Eyebrow>
            <Link to="/dinners" className={linkClasses}>
              dinners
            </Link>
            <Link to="/privacy" className={linkClasses}>
              privacy policy
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow variant="tracked" tone="label">
              follow
            </Eyebrow>
            <a
              href="https://instagram.com/mokupona"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClasses}
            >
              instagram
            </a>
          </div>
        </div>
      </div>

      {/* mobile */}
      <div className="flex flex-col gap-4 px-5 pt-7 pb-10 md:hidden">
        <BrandLockup logoClassName="size-4" wordmarkClassName="text-base" />
        <div className="flex gap-5">
          <Link to="/dinners" className={linkClasses}>
            dinners
          </Link>
          <Link to="/privacy" className={linkClasses}>
            privacy policy
          </Link>
          <a
            href="https://instagram.com/mokupona"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            instagram
          </a>
        </div>
        <span className="text-foreground/50 text-xs">
          made with love in zürich
        </span>
      </div>
    </footer>
  );
}
