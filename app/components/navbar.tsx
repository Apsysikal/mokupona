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
    <div className={clsx(["p-2 h-14 w-full", className])}>
      <div className="flex justify-between max-w-3xl px-2 mx-auto items-center h-full">
        <Link
          to="/"
          className="text-xl font-extrabold uppercase whitespace-nowrap"
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
        className="uppercase font-light hover:bg-white/25 px-3 py-1 rounded-md inline-block whitespace-nowrap"
      >
        {label}
      </Link>
    </li>
  );
}
