import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [{ title: "Remix Notes" }];

export default function Index() {
  return (
    <main className="relative flex flex-col">
      <div className="h-[70vh]">
        <img
          src="/landing-page.jpg"
          className="absolute left-0 right-0 top-0 -z-[1] h-[calc(70vh+3.5rem)] bg-black object-cover object-left opacity-80 [mask-image:linear-gradient(black,transparent_90%)]"
          alt=""
          width={1920}
          height={1080}
        />

        <div className="mx-auto flex h-full max-w-3xl grow flex-col justify-end gap-5 px-2">
          <h1 className="text-8xl font-extrabold lowercase text-primary">
            moku pona
          </h1>

          <p className="text-balance text-2xl">
            A dinner society located in Zurich. We love sharing food and stories
            with our friends. And you?
          </p>

          <div className="flex flex-col gap-2 sm:mb-10 sm:flex-row">
            <Button asChild>
              <Link to="/dinners">Join a dinner</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="#vision">Get to know us</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-2">
        <section
          id="vision"
          className="my-5 flex max-w-3xl scroll-m-9 flex-col gap-4"
        >
          <p className="text-xl font-medium text-primary">
            The perfect place to meet new people.
          </p>
          <h2 className="text-4xl font-bold uppercase">Our Vision</h2>
          <p className="text-xl">
            We wanted to create a new way to meet people. A place, where you are
            comfortable and the vibe encourages interesting conversations.
            That's why we created{" "}
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
              No honestly, it's just that.
            </strong>
            Besides the food and drinks, you will be joined by a moderator who
            moderates the whole event. They inform you about the food and drinks
            you are experiencing and provide conversation topics as neccessary.
          </p>
          <div className="flex w-full flex-col lg:flex-row">
            <Button asChild>
              <Link to="/dinners">See available dates</Link>
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
            without afterthoughts. That's why we cook with{" "}
            <span className="text-primary">seasonal ingredients</span>, which
            are <span className="text-primary">sourced locally</span> and to the{" "}
            <span className="text-primary">best standards</span>. To make this
            transparent, every foods origin and details are listed on the
            dinners detail page.
          </p>
          <p className="text-xl ">
            Also, you're not just one of hundreds of guests an evening. Every
            dinner is unique - Just like you. As we, the founders, moderate the
            evenings, we also believe in{" "}
            <span className="text-primary">
              a more personal relationship with our guests
            </span>{" "}
            than at a restaurant.
          </p>
          <p className="text-xl ">
            This should have made clear, what we are all about. We would love to
            meet you soon at one of our meetings. If you still have questions
            feel free to contact us at any time. We're always happy to help.
          </p>
          <div className="flex w-full flex-col gap-2 lg:flex-row">
            <Button asChild>
              <Link to="/dinners">Reserve now</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
