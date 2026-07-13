import { EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { Link, redirect } from "react-router";

import type { Route } from "./+types/check-your-inbox";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus, AuthStatusBody } from "~/components/auth-status";
import { Button } from "~/components/ui/button";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) return redirect("/join");
  const redirectTo = url.searchParams.get("redirectTo");
  return { email, redirectTo };
};

export const meta: Route.MetaFunction = () => [{ title: "Check your inbox" }];

export default function CheckYourInbox({ loaderData }: Route.ComponentProps) {
  const { email, redirectTo } = loaderData;
  const loginSearch = redirectTo
    ? `?${new URLSearchParams({ redirectTo })}`
    : "";

  return (
    <AuthShell
      brand={{
        eyebrow: "one more step",
        heading: "you're almost at the table",
        body: "just confirm your email and your account is ready. we'll keep your seat warm.",
      }}
    >
      <AuthStatus
        icon={<EnvelopeClosedIcon className="size-7" />}
        heading="check your inbox"
      >
        <AuthStatusBody>
          we sent a verification link to{" "}
          <strong className="text-foreground font-semibold">{email}</strong>.
          open it to confirm your address, then log in.
        </AuthStatusBody>
        <Button size="lg" className="w-full" asChild>
          <Link to={`/login${loginSearch}`}>back to log in</Link>
        </Button>
        <p className="text-foreground/50 text-sm">
          no link yet? give it a minute, then check your spam folder.
        </p>
      </AuthStatus>
    </AuthShell>
  );
}
