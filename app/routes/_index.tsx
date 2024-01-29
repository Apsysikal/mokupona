import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [
  {
    title: "moku pona",
  },
  {
    name: "description",
    content:
      "A dinner society located in Zurich. We love sharing food and stories with our friends.",
  },
];

export default function Index() {
  return (
    <main>
      <div className="mx-auto mt-8 max-w-6xl">
        <div className="mx-2 grid min-h-[60vh] grid-cols-5 md:overflow-hidden md:rounded-2xl md:border md:shadow-2xl">
          <div className="col-span-full max-md:overflow-hidden max-md:rounded-2xl md:col-span-3">
            <picture>
              <img
                srcSet="/landing-page-sm.webp 432w, /landing-page-md.webp 648w, /landing-page-lg.webp 864w, /landing-page-original.webp 1080w"
                src="/landing-page.jpg"
                className="aspect-video h-full w-full justify-end object-cover"
                alt=""
              />
            </picture>
          </div>

          <div className="col-span-full flex flex-col justify-center gap-5 pt-8 md:col-span-2 md:gap-10 md:p-8">
            <h1 className="text-7xl font-extrabold lowercase text-primary md:text-8xl">
              moku pona
            </h1>

            <p className="text-balance text-3xl lg:text-4xl">
              A dinner society located in Zurich. We love sharing food and
              stories with our friends. And you?
            </p>

            <div className="flex gap-2 max-md:flex-col">
              <Button asChild>
                <Link to="/dinners">Join a dinner</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="#vision">Get to know us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-4xl flex-col gap-2 px-2">
        <section
          id="vision"
          className="my-5 flex max-w-4xl scroll-m-9 flex-col gap-4"
        >
          <p className="text-xl font-medium text-primary">
            The perfect place to meet new people.
          </p>
          <h2 className="text-4xl font-bold uppercase">Our Vision</h2>
          <p className="text-xl">
            We wanted to create a new way to meet people. A place, where you are
            comfortable and the vibe encourages interesting conversations.
            That&lsquo;s why we created{" "}
            <span className="text-primary">moku pona</span>, where you can meet
            a few people over dinner and have an amazing evening.
          </p>
        </section>

        <section className="mb-5 flex flex-col gap-4">
          <p className="text-xl font-medium text-primary">
            Easy as baking a pie
          </p>
          <h2 className="text-4xl font-bold uppercase">How it works</h2>
          <ol className="text-xl">
            <li>
              <strong className="text-primary">1</strong> Select a dinner
            </li>
            <li>
              <strong className="text-primary">2</strong> Sign up
            </li>
            <li>
              <strong className="text-primary">3</strong> Show up
            </li>
          </ol>
          <p className="text-xl">
            <strong className="block text-primary">
              No honestly, it&lsquo;s just that.
            </strong>
            Besides the food and drinks, you will be joined by a moderator who
            moderates the whole event. They inform you about the food and drinks
            you are experiencing and provide conversation topics as neccessary.
          </p>
          <div>
            <Button asChild>
              <Link to="/dinners" className="max-md:w-full">
                See available dates
              </Link>
            </Button>
          </div>
        </section>

        <section className="mb-5 flex flex-col gap-4">
          <p className="text-xl font-medium text-primary">
            Why not just a normal restaurant?
          </p>
          <h2 className="text-4xl font-bold uppercase ">
            What makes this different?
          </h2>
          <p className="text-xl ">
            We value our environment and we want you to enjoy our dinners
            without afterthoughts. That&lsquo;s why we cook with{" "}
            <span className="text-primary">seasonal ingredients</span>, which
            are <span className="text-primary">sourced locally</span> and to the{" "}
            <span className="text-primary">best standards</span>. To make this
            transparent, every foods origin and details are listed on the
            dinners detail page.
          </p>
          <p className="text-xl ">
            Also, you&lsquo;re not just one of hundreds of guests an evening.
            Every dinner is unique - Just like you. As we, the founders,
            moderate the evenings, we also believe in{" "}
            <span className="text-primary">
              a more personal relationship with our guests
            </span>{" "}
            than at a restaurant.
          </p>
          <p className="text-xl ">
            This should have made clear, what we are all about. We would love to
            meet you soon at one of our meetings. If you still have questions
            feel free to contact us at any time. We&lsquo;re always happy to
            help.
          </p>
          <div>
            <Button asChild>
              <Link to="/dinners" className="max-md:w-full">
                Reserve now
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
