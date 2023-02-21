import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Form, Link } from "@remix-run/react";
import clsx from "clsx";
import { Fragment } from "react";
import { useOptionalUser } from "~/utils";

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
  const maybeUser = useOptionalUser();

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
                    {maybeUser && (
                      <Link
                        key={"Create Dinner"}
                        to={"/dinners/new"}
                        className={clsx(
                          "text-gray-300 hover:bg-emerald-700 hover:text-white",
                          "rounded-md px-3 py-2 text-sm font-medium"
                        )}
                      >
                        {"Create Dinner"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                {/* Profile dropdown */}
                <Menu as="div" className="relative ml-3">
                  <div>
                    <Menu.Button className="flex rounded-md bg-emerald-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                      <span className="sr-only">Open user menu</span>
                      {maybeUser ? (
                        <span className="text-gray-300">{maybeUser.email}</span>
                      ) : (
                        <Link to="/login" className="text-gray-300">
                          Login
                        </Link>
                      )}
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <Form
                            method="post"
                            action="/logout"
                            className={clsx(
                              active ? "bg-emerald-100" : "",
                              "block px-4 py-2 text-sm text-gray-700"
                            )}
                          >
                            <button type="submit">Sign out</button>
                          </Form>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
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
