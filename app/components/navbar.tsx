import { Link } from "@remix-run/react";
import clsx from "clsx";

const LINKS = [
  {
    label: "Dinners",
    to: "/dinners",
  },
  {
    label: "Past Dinners",
    to: "/past-dinners",
  },
  {
    label: "About",
    to: "/about",
  },
  {
    label: "Contact",
    to: "/contact",
  },
];

export function NavBar({ className }: { className?: string }) {
  return (
    <div className={clsx(["h-14 w-full p-2", className])}>
      <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-2">
        <Link
          to="/"
          className="whitespace-nowrap text-xl font-extrabold uppercase"
        >
          Moku Pona
        </Link>
        <div>
          <nav className="max-xl:hidden">
            <ul className="flex gap-2">
              {LINKS.map((props) => {
                return <NavLink key={props.label} {...props} />;
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

function NavLink({ label, to }: { label: string; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className="inline-block whitespace-nowrap rounded-md px-3 py-1 font-light uppercase hover:bg-white/25"
      >
        {label}
      </Link>
    </li>
  );
}
