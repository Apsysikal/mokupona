import { NavBar } from "~/components/navbar";

export default function MeRoute() {
  return (
    <>
      <header>
        <NavBar className="text-white bg-emerald-800" />
      </header>
      <main className="flex flex-col gap-5 grow mx-auto items-center place-content-center text-gray-800">
        <p className="text-4xl font-bold text-center">
          This site is currently under construction.
        </p>
        <p className="text-xl font-semibold text-center text-gray-600">
          Please come back later...
        </p>
      </main>
    </>
  );
}
