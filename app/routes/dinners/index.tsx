import { NavBar } from "~/components/navbar";

export default function DinnersIndexRoute() {
  return (
    <>
      <header>
        <NavBar className="text-white bg-emerald-800" />
      </header>
      <main className="flex flex-col gap-5 grow mx-auto items-center place-content-center text-gray-800">
        <p className="text-4xl font-bold text-center">
          There are currently no dinners available.
        </p>
        <p className="text-xl font-semibold text-center textgray">
          Please come back later...
        </p>
      </main>
    </>
  );
}
