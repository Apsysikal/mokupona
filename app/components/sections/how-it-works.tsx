import { Link } from "@remix-run/react";

export function HowItWorksSection() {
  return (
    <section className="mb-5 flex flex-col gap-4">
      <p className="text-xl font-medium text-pink-800">Easy as baking a pie</p>
      <h2 className="text-4xl font-bold uppercase text-gray-800">
        How it works
      </h2>
      <ol className="text-xl">
        <li>
          <strong className="text-pink-800">1</strong> Select a dinner
        </li>
        <li>
          <strong className="text-pink-800">2</strong> Sign up
        </li>
        <li>
          <strong className="text-pink-800">3</strong> Show up
        </li>
      </ol>
      <p className="text-xl text-gray-800">
        <strong className="block text-pink-800">
          No honestly, it's just that.
        </strong>
        Besides the food and drinks, you will be joined by a moderator who
        moderates the whole event. They inform you about the food and drinks you
        are experiencing and provide conversation topics as neccessary.
      </p>
      <div className="flex w-full flex-col lg:flex-row">
        <Link
          to="/dinners"
          className="inline-block rounded-md bg-pink-800 px-4 py-2 text-center uppercase text-white shadow-md hover:bg-pink-700 active:bg-pink-900"
        >
          See available dates
        </Link>
      </div>
    </section>
  );
}
