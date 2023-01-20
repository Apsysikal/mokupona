import { Link } from "@remix-run/react";
import { DifferenceSection } from "~/components/sections/difference";
import { HowItWorksSection } from "~/components/sections/how-it-works";
import { VisionSection } from "~/components/sections/vision";

export default function Index() {
  return (
    <div>
      <div className="h-[calc(100vh-3.5rem)] p-2 flex flex-col gap-10 relative text-white place-content-center w-screen">
        <div className="bg-[url(https://images.unsplash.com/photo-1530062845289-9109b2c9c868?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1472&q=80)] absolute -top-14 right-0 bottom-0 left-0 -z-10 bg-no-repeat bg-cover bg-center" />
        <div className="bg-gray-800/70 absolute -top-14 right-0 bottom-0 left-0 -z-10" />
        <div className="flex flex-col max-lg:grow place-content-center gap-4 max-w-3xl mx-auto p-2">
          <span className="text-2xl font-light">Hello, we are</span>
          <h1 className="text-5xl uppercase whitespace-nowrap font-extrabold text-emerald-600">
            Moku Pona
          </h1>
          <p className="text-2xl font-light">
            A dinner society located in Zurich. We love sharing food and stories
            with our friends. And you?
          </p>
        </div>
        <div className="flex flex-col lg:flex-row w-full gap-2 max-w-3xl mx-auto">
          <Link
            to="/dinners"
            className="inline-block text-center px-4 py-2 rounded-md shadow-md bg-emerald-700 text-white uppercase hover:bg-emerald-700 active:bg-emerald-900"
          >
            Join a dinner
          </Link>
          <Link
            to="/about"
            className="inline-block text-center px-4 py-2 rounded-md shadow-md text-white uppercase border border-emerald-700 hover:bg-emerald-200/50 active:bg-emerald-200"
          >
            Get to know us
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-2  max-w-3xl mx-auto">
        <VisionSection />
        <HowItWorksSection />
        <DifferenceSection />
      </div>
    </div>
  );
}
