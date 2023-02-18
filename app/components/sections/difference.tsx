import { Link } from "@remix-run/react";

export function DifferenceSection() {
  return (
    <section className="mb-5 flex flex-col gap-4">
      <p className="text-xl font-medium text-emerald-800">
        Why not just a normal restaurant?
      </p>
      <h2 className="text-4xl font-bold uppercase text-gray-800">
        What makes this different?
      </h2>
      <p className="text-xl text-gray-800">
        We value our environment and we want you to enjoy our dinners without
        afterthoughts. That's why we cook with{" "}
        <span className="text-emerald-800">seasonal ingredients</span>, which
        are <span className="text-emerald-800">sourced locally</span> and to the{" "}
        <span className="text-emerald-800">best standards</span>. To make this
        transparent, every foods origin and details are listed on the dinners
        detail page.
      </p>
      <p className="text-xl text-gray-800">
        Also, you're not just one of hundreds of guests an evening. Every dinner
        is unique - Just like you. As we, the founders, moderate the evenings,
        we also believe in{" "}
        <span className="text-emerald-800">
          a more personal relationship with our guests
        </span>{" "}
        than at a restaurant.
      </p>
      <p className="text-xl text-gray-800">
        This should have made clear, what we are all about. We would love to
        meet you soon at one of our meetings. If you still have questions feel
        free to contact us at any time. We're always happy to help.
      </p>
      <div className="flex w-full flex-col gap-2 lg:flex-row">
        <Link
          to="/dinners"
          className="inline-block rounded-md bg-emerald-800 px-4 py-2 text-center uppercase text-white shadow-md hover:bg-emerald-700 active:bg-emerald-900"
        >
          Reserve now
        </Link>
        <Link
          to="/contact"
          className="inline-block rounded-md border border-emerald-800 px-4 py-2 text-center uppercase text-emerald-800 shadow-md hover:border-emerald-700 active:border-emerald-900"
        >
          Contact us
        </Link>
      </div>
    </section>
  );
}
