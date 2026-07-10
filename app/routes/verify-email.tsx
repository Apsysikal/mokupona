import { CheckCircledIcon, LinkBreak2Icon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import type { Route } from "./+types/verify-email";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus, AuthStatusBody } from "~/components/auth-status";
import { Button } from "~/components/ui/button";

// where the mailed verification link lands. better-auth's API endpoint
// verifies the token and redirects here — plain for success, ?error=… for an
// invalid/expired token. Recovery for the dead-end is simply logging in
// (an unverified attempt re-sends a fresh link).
export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);
  return {
    failed: url.searchParams.has("error"),
    email: url.searchParams.get("email"),
  };
};

export const meta: Route.MetaFunction = () => [{ title: "Verify email" }];

export default function VerifyEmail({ loaderData }: Route.ComponentProps) {
  const { failed, email } = loaderData;

  if (failed) {
    return (
      <main className="flex grow items-center justify-center px-6 py-16">
        <AuthStatus
          tone="neutral"
          icon={<LinkBreak2Icon className="size-7" />}
          heading="this link has expired"
        >
          <AuthStatusBody>
            just log in and we&apos;ll send a new link to verify your email.
          </AuthStatusBody>
          <Button size="lg" className="w-full" asChild>
            <Link to="/login">back to log in</Link>
          </Button>
        </AuthStatus>
      </main>
    );
  }

  return (
    <AuthShell
      brand={{
        eyebrow: "you're in",
        heading: "a seat at the table is yours",
        body: "your email is confirmed. log in to browse the next dinners and reserve your spot.",
      }}
    >
      <AuthStatus
        icon={<CheckCircledIcon className="size-7" />}
        heading="your email is verified"
      >
        <AuthStatusBody>
          {email ? (
            <>
              thanks for confirming{" "}
              <strong className="text-foreground font-semibold">{email}</strong>
              . you&apos;re all set to sign in.
            </>
          ) : (
            <>you&apos;re all set to sign in.</>
          )}
        </AuthStatusBody>
        <Button size="lg" className="w-full" asChild>
          <Link to="/login">continue to log in</Link>
        </Button>
        <Link
          to="/dinners"
          className="text-primary text-sm font-medium hover:underline"
        >
          browse dinners instead
        </Link>
      </AuthStatus>
    </AuthShell>
  );
}
