export function DifferenceSection() {
  return (
    <section className="flex flex-col gap-4 mb-5">
      <p className="text-xl font-medium text-emerald-800">
        Why not just a normal restaurant?
      </p>
      <h2 className="text-4xl uppercase font-bold text-gray-800">
        What makes this different?
      </h2>
      <p className="text-xl text-gray-800">
        We value our environment and we want you to enjoy our dinners without
        afterthoughts. That's why we cook with{" "}
        <span className="text-emerald-800">seasonal ingredients</span>, which
        are <span className="text-emerald-800">sourced locally</span> and to the
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
    </section>
  );
}
