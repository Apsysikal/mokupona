import { Link } from "@remix-run/react";

const LINKS = [
  {
    label: "Dinners",
    to: "/dinners",
  },
  // {
  //   label: "Past Dinners",
  //   to: "/past-dinners",
  // },
  // {
  //   label: "About",
  //   to: "/about",
  // },
];

export function Footer() {
  return (
    <div className="bg-gray-800 text-gray-200">
      <div className="mx-auto max-w-3xl p-2">
        <div className="flex flex-col gap-3">
          <p className="font-bold lowercase">moku pona</p>
          <ul>
            {LINKS.map((props) => {
              return <FooterLink key={props.label} {...props} />;
            })}
            <li>
              <a
                href="https://instagram.com/mokupona"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-light hover:underline"
              >
                Instagram
              </a>
            </li>
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
