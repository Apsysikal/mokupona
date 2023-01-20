import { Link } from "@remix-run/react";

export function HowItWorksSection() {
  return (
    <section className="mb-5 flex flex-col gap-4">
      <p className="text-xl font-medium text-pink-800">Easy as baking a pie</p>
      <h2 className="text-4xl uppercase font-bold text-gray-800">
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
      <Link
        to="/dinners"
        className="inline-block px-4 py-2 rounded-md shadow-md bg-pink-800 text-white uppercase hover:bg-pink-700 active:bg-pink-900"
      >
        See available dates
      </Link>
    </section>
  );
}
