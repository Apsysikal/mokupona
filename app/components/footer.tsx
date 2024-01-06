import { InstagramLogoIcon } from "@radix-ui/react-icons";
import { Link } from "@remix-run/react";

export function Footer() {
  return (
    <div className="mt-10 bg-muted text-muted-foreground">
      <div className="mx-auto max-w-3xl p-2">
        <div className="flex flex-col gap-3">
          <p className="font-bold lowercase">moku pona</p>
          <ul className="flex flex-col gap-2">
            <li>
              <Link to="/dinners" className="text-sm hover:underline">
                Dinners
              </Link>
            </li>
            <li>
              <a
                href="https://instagram.com/mokupona"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm hover:underline"
              >
                <InstagramLogoIcon />
                Instagram
              </a>
            </li>
          </ul>
          <p className="text-xs">
            Website made with love in Zurich by Benedikt
          </p>
        </div>
      </div>
    </div>
  );
}
