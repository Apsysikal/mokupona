import { Link } from "@remix-run/react";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { DifferenceSection } from "~/components/sections/difference";
import { HowItWorksSection } from "~/components/sections/how-it-works";
import { VisionSection } from "~/components/sections/vision";

import { useOptionalUser } from "~/utils";

export default function Index() {
  const user = useOptionalUser();
  return (
    <>
      <header>
        <NavBar className="text-white" />
      </header>
      <main>
        <div>
          <div className="relative flex h-[calc(100vh-3.5rem)] w-screen flex-col place-content-center gap-10 p-2 text-white">
            <div className="absolute -top-14 right-0 bottom-0 left-0 -z-10 bg-[url(/landing-background.jpg)] bg-cover bg-center bg-no-repeat" />
            <div className="absolute -top-14 right-0 bottom-0 left-0 -z-10 bg-gray-800/70" />
            <div className="mx-auto flex max-w-3xl flex-col place-content-center gap-4 p-2">
              <span className="text-2xl font-light">Hello, we are</span>
              <h1 className="whitespace-nowrap text-5xl font-extrabold uppercase text-emerald-600">
                Moku Pona
              </h1>
              <p className="text-2xl font-light">
                A dinner society located in Zurich. We love sharing food and
                stories with our friends. And you?
              </p>
            </div>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-2 lg:flex-row">
              <Link
                to="/dinners"
                className="inline-block rounded-md bg-emerald-800 px-4 py-2 text-center uppercase text-white shadow-md hover:bg-emerald-700 active:bg-emerald-900"
              >
                Join a dinner
              </Link>
              <Link
                to="#vision"
                className="inline-block rounded-md border border-emerald-800 px-4 py-2 text-center uppercase text-white shadow-md hover:border-emerald-700 active:border-emerald-900"
              >
                Get to know us
              </Link>
            </div>
          </div>
          <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4">
            <VisionSection />
            <HowItWorksSection />
            <DifferenceSection />
          </div>
        </div>
      </main>
      <footer>
        <Footer />
      </footer>
    </>
  );
}
