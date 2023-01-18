import { Link } from "@remix-run/react";

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

export function NavBar() {
  return (
    <div className="bg-transparent p-2 h-14 text-white w-full">
      <div className="flex justify-between max-w-3xl mx-auto items-center">
        <Link
          to="/"
          className="text-4xl font-extrabold uppercase whitespace-nowrap"
        >
          Moku Pona
        </Link>
        <div>
          <nav>
            <ul className="flex gap-2">
              {LINKS.map((props) => {
                return (
                  <li
                    key={props.label}
                    className="last:border border-white rounded-md"
                  >
                    <NavLink {...props} />
                  </li>
                );
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
