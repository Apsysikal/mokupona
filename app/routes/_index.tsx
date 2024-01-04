import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [{ title: "Remix Notes" }];

export default function Index() {
  return (
    <main className="relative flex items-center justify-center max-w-2xl mx-auto px-2">
      <div>
        <h1 className="whitespace-nowrap text-5xl font-extrabold lowercase text-primary">
          moku pona
        </h1>

        <p className="text-2xl font-light">
          A dinner society located in Zurich. We love sharing food and stories
          with our friends. And you?
        </p>

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 lg:flex-row">
          <Button asChild>
            <Link to="/dinners">Join a dinner</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="">Get to know us</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
