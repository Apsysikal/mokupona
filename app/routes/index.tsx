import { Link } from "@remix-run/react";
import { NavBar } from "~/components/navbar";
import { DifferenceSection } from "~/components/sections/difference";
import { HowItWorksSection } from "~/components/sections/how-it-works";
import { VisionSection } from "~/components/sections/vision";

export default function Index() {
  return (
    <>
      <header>
        <NavBar className="text-white" />
      </header>
      <main className="grow mx-auto">
        <div>
          <div className="h-[calc(100vh-3.5rem)] p-2 flex flex-col gap-10 relative text-white place-content-center w-screen">
            <div className="bg-[url(/landing-background.jpg)] absolute -top-14 right-0 bottom-0 left-0 -z-10 bg-no-repeat bg-cover bg-center" />
            <div className="bg-gray-800/70 absolute -top-14 right-0 bottom-0 left-0 -z-10" />
            <div className="flex flex-col max-lg:grow place-content-center gap-4 max-w-3xl mx-auto p-2">
              <span className="text-2xl font-light">Hello, we are</span>
              <h1 className="text-5xl uppercase whitespace-nowrap font-extrabold text-emerald-600">
                Moku Pona
              </h1>
              <p className="text-2xl font-light">
                A dinner society located in Zurich. We love sharing food and
                stories with our friends. And you?
              </p>
            </div>
            <div className="flex flex-col lg:flex-row w-full gap-2 max-w-3xl mx-auto px-2">
              <Link
                to="/dinners"
                className="inline-block text-center px-4 py-2 rounded-md shadow-md bg-emerald-800 text-white uppercase hover:bg-emerald-700 active:bg-emerald-900"
              >
                Join a dinner
              </Link>
              <Link
                to="#vision"
                className="inline-block text-center px-4 py-2 rounded-md shadow-md text-white uppercase border border-emerald-800 hover:border-emerald-700 active:border-emerald-900"
              >
                Get to know us
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-5 p-4 max-w-3xl mx-auto">
            <VisionSection />
            <HowItWorksSection />
            <DifferenceSection />
          </div>
        </div>
      </main>
    </>
  );
}
