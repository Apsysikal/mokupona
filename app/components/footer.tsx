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

export function Footer() {
  return (
    <div className="bg-gray-800 text-gray-200">
      <div className="max-w-3xl p-2 mx-auto">
        <div className="flex flex-col gap-3">
          <p className="font-bold uppercase">Moku Pona</p>
          <ul>
            {LINKS.map((props) => {
              return <FooterLink key={props.label} {...props} />;
            })}
          </ul>
          <p className="text-xs text-gray-600">
            Made with love in Zurich by Benedikt
          </p>
        </div>
      </div>
    </div>
  );
}

function FooterLink({ label, to }: { label: string; to: string }) {
  return (
    <li>
      <Link to={to} className="text-sm font-light hover:underline">
        {label}
      </Link>
    </li>
  );
}
