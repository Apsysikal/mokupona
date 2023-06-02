import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link } from "@remix-run/react";
import clsx from "clsx";

const LINKS = [
  {
    label: "Home",
    to: "/",
    current: false,
  },
  {
    label: "Dinners",
    to: "/dinners",
    current: false,
  },
];

export function NavBar() {
  const maybeUser = null;

  return (
    <Disclosure as="nav" className="bg-emerald-800 shadow-xl">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-3xl px-2">
            <div className="relative flex h-16 items-center justify-between">
              <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                {/* Mobile menu button*/}
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-emerald-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
              <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                <div className="hidden sm:block">
                  <div className="flex space-x-4">
                    {LINKS.map((item) => (
                      <Link
                        key={item.label}
                        to={item.to}
                        className={clsx(
                          item.current
                            ? "bg-emerald-900 text-white"
                            : "text-gray-300 hover:bg-emerald-700 hover:text-white",
                          "rounded-md px-3 py-2 text-sm font-medium"
                        )}
                        aria-current={item.current ? "page" : undefined}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 px-2 pt-2 pb-3">
              {LINKS.map((item) => (
                <Disclosure.Button
                  key={item.label}
                  as={Link}
                  to={item.to}
                  className={clsx(
                    item.current
                      ? "bg-emerald-900 text-white"
                      : "text-gray-300 hover:bg-emerald-700 hover:text-white",
                    "block rounded-md px-3 py-2 text-base font-medium"
                  )}
                  aria-current={item.current ? "page" : undefined}
                >
                  {item.label}
                </Disclosure.Button>
              ))}
              {maybeUser && (
                <Disclosure.Button
                  key={"Create Dinner"}
                  as={Link}
                  to={"/dinners/new"}
                  className={clsx(
                    "text-gray-300 hover:bg-emerald-700 hover:text-white",
                    "block rounded-md px-3 py-2 text-base font-medium"
                  )}
                >
                  {"Create Dinner"}
                </Disclosure.Button>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
