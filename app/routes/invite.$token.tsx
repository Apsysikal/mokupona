import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import {
  ArrowRightIcon,
  InfoCircledIcon,
  LinkBreak2Icon,
  LockClosedIcon,
} from "@radix-ui/react-icons";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/invite.$token";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus, AuthStatusBody } from "~/components/auth-status";
import { ErrorList, Field } from "~/components/forms";
import { GoogleButton } from "~/components/google-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/features/auth/auth.client";
import { auth, googleAuthEnabled } from "~/features/auth/auth.server";
import { getUserWithRole, logout } from "~/features/auth/guards.server";
import { passwordSchema } from "~/features/auth/password-schema";
import { cn } from "~/lib/utils";
import { logger } from "~/logger.server";
import {
  acceptInvite,
  getInviteByToken,
  InviteNoLongerValidError,
  inviteValidity,
} from "~/models/invite.server";
import { getUserByEmail } from "~/models/user.server";
import { getClientIPAddress, obscureEmail } from "~/utils/misc";

const signupSchema = z.object({
  intent: z.literal("signup"),
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  password: passwordSchema,
});

// /invite/$token — email-bound, role-carrying link (design §6). Four states:
// dead-end (invalid/expired/used), logged-out signup with locked email,
// logged-in match (confirm upgrade), logged-in mismatch.
export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const invite = await getInviteByToken(params.token);
  const validity = inviteValidity(invite);

  if (validity !== "valid" || !invite) {
    return { state: "dead-end" as const, reason: validity };
  }

  const user = await getUserWithRole(request);

  if (!user) {
    return {
      state: "signup" as const,
      email: invite.email,
      roleName: invite.roleName,
      inviterName: invite.createdBy.name,
      googleEnabled: googleAuthEnabled,
    };
  }

  if (user.email === invite.email) {
    return {
      state: "confirm" as const,
      email: user.email,
      currentRole: user.role.name,
      roleName: invite.roleName,
    };
  }

  return {
    state: "mismatch" as const,
    invitedEmail: invite.email,
    currentEmail: user.email,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "logout-retry") {
    // destroys the session, then lands back on this link for a clean retry
    const response = await logout(request);
    response.headers.set("Location", `/invite/${params.token}`);
    return response;
  }

  const invite = await getInviteByToken(params.token);
  if (inviteValidity(invite) !== "valid" || !invite) {
    // token went stale between render and submit — re-render the dead-end
    return redirect(`/invite/${params.token}`);
  }

  if (intent === "accept") {
    const user = await getUserWithRole(request);
    if (!user || user.email !== invite.email) {
      return redirect(`/invite/${params.token}`);
    }
    try {
      await acceptInvite({ invite, userId: user.id });
    } catch (error) {
      if (error instanceof InviteNoLongerValidError) {
        // lost the race with a concurrent accept — re-render the dead-end
        return redirect(`/invite/${params.token}`);
      }
      throw error;
    }
    logger.info("Invite accepted (existing user)", {
      ip: getClientIPAddress(request),
      email: obscureEmail(user.email),
      role: invite.roleName,
    });
    return redirect(invite.roleName === "moderator" ? "/admin" : "/");
  }

  if (intent === "signup") {
    const submission = parseWithZod(formData, { schema: signupSchema });
    if (submission.status !== "success") {
      return data({ result: submission.reply(), formError: null });
    }

    if (await getUserByEmail(invite.email)) {
      return data({
        result: submission.reply(),
        formError:
          "an account already exists for this address. log in, then open the link again to accept it.",
      });
    }

    const { name, password } = submission.value;
    await auth.api.signUpEmail({
      body: { name, email: invite.email, password },
      headers: request.headers,
    });

    const created = await getUserByEmail(invite.email);
    if (!created) throw new Error("signup did not create a user");

    // the invite link proves mailbox control: acceptance verifies the email
    // and applies the role atomically — no verification mail hop needed
    try {
      await acceptInvite({ invite, userId: created.id });
    } catch (error) {
      if (error instanceof InviteNoLongerValidError) {
        // lost the race with a concurrent accept — re-render the dead-end
        return redirect(`/invite/${params.token}`);
      }
      throw error;
    }

    const { headers } = await auth.api.signInEmail({
      body: { email: invite.email, password },
      headers: request.headers,
      returnHeaders: true,
    });

    logger.info("Invite accepted (new user)", {
      ip: getClientIPAddress(request),
      email: obscureEmail(invite.email),
      role: invite.roleName,
    });

    return redirect(invite.roleName === "moderator" ? "/admin" : "/", {
      headers,
    });
  }

  throw new Response("Unknown intent", { status: 400 });
};

export const meta: Route.MetaFunction = () => [{ title: "Invite" }];

const DEAD_END_COPY = {
  invalid: {
    heading: "we don't recognise this invite",
    body: "double-check you copied the whole thing from your email.",
  },
  expired: {
    heading: "this invite has expired",
    body: "invites last about a week. ask whoever invited you to send a fresh one, or browse our public dinners in the meantime.",
  },
  used: {
    heading: "this invite has already been accepted",
    body: "if that was you, just log in.",
  },
} as const;

export default function InvitePage({
  loaderData,
  actionData,
  params,
}: Route.ComponentProps) {
  if (loaderData.state === "dead-end") {
    const copy = DEAD_END_COPY[loaderData.reason as keyof typeof DEAD_END_COPY];
    return (
      <main className="flex grow items-center justify-center px-6 py-16">
        <AuthStatus
          tone="neutral"
          icon={<LinkBreak2Icon className="size-7" />}
          heading={copy.heading}
        >
          <AuthStatusBody>{copy.body}</AuthStatusBody>
          <Button size="lg" className="w-full" asChild>
            <Link to="/dinners">browse dinners</Link>
          </Button>
          <Link
            to="/login"
            className="text-primary text-sm font-medium hover:underline"
          >
            go to log in
          </Link>
        </AuthStatus>
      </main>
    );
  }

  if (loaderData.state === "confirm") {
    const { email, currentRole, roleName } = loaderData;
    const upgrades = currentRole === "user" && roleName === "moderator";
    return (
      <main className="flex grow items-center justify-center px-6 py-16">
        <AuthStatus
          icon={<LockClosedIcon className="size-7" />}
          heading="accept your invite"
        >
          <AuthStatusBody>
            you&apos;re signed in as{" "}
            <strong className="text-foreground font-semibold">{email}</strong>.
            {upgrades ? " accept to change your role:" : " accept to confirm."}
          </AuthStatusBody>
          {upgrades ? (
            <div className="flex items-center gap-3" aria-hidden>
              <RolePill>{currentRole}</RolePill>
              <ArrowRightIcon className="text-foreground/50 size-4.5" />
              <RolePill accent>
                <LockClosedIcon className="size-3.5" />
                {roleName}
              </RolePill>
            </div>
          ) : null}
          <Form method="post" className="w-full">
            <input type="hidden" name="intent" value="accept" />
            <Button type="submit" size="lg" className="w-full">
              {upgrades ? `accept and become a ${roleName}` : "accept invite"}
            </Button>
          </Form>
          <Link
            to="/"
            className="text-primary text-sm font-medium hover:underline"
          >
            not now
          </Link>
        </AuthStatus>
      </main>
    );
  }

  if (loaderData.state === "mismatch") {
    const { invitedEmail, currentEmail } = loaderData;
    return (
      <main className="flex grow items-center justify-center px-6 py-16">
        <AuthStatus
          tone="neutral"
          icon={<InfoCircledIcon className="size-7" />}
          heading="this invite is for a different account"
        >
          <AuthStatusBody>
            it was sent to{" "}
            <strong className="text-foreground font-semibold">
              {invitedEmail}
            </strong>
            , but you&apos;re signed in as{" "}
            <strong className="text-foreground font-semibold">
              {currentEmail}
            </strong>
            . log out and open the link again to accept it.
          </AuthStatusBody>
          <Form method="post" className="w-full">
            <input type="hidden" name="intent" value="logout-retry" />
            <Button type="submit" size="lg" className="w-full">
              log out &amp; retry
            </Button>
          </Form>
          <Link
            to="/"
            className="text-primary text-sm font-medium hover:underline"
          >
            stay signed in
          </Link>
        </AuthStatus>
      </main>
    );
  }

  return (
    <InviteSignup
      loaderData={loaderData}
      actionData={actionData}
      token={params.token}
    />
  );
}

function RolePill({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold",
        accent
          ? "border-primary/35 bg-primary/10 text-accent-light"
          : "border-border text-foreground/60",
      )}
    >
      {children}
    </span>
  );
}

function InviteSignup({
  loaderData,
  actionData,
  token,
}: {
  loaderData: Extract<Awaited<ReturnType<typeof loader>>, { state: "signup" }>;
  actionData: Route.ComponentProps["actionData"];
  token: string;
}) {
  const { email, roleName, inviterName, googleEnabled } = loaderData;
  const [form, fields] = useForm({
    lastResult: actionData?.result ?? null,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(signupSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: signupSchema });
    },
  });

  const brandBody =
    roleName === "moderator"
      ? `${inviterName} invited you to help run our dinners. set a password to accept. your invite is tied to the email below.`
      : `${inviterName} invited you to join our dinners. set a password to accept. your invite is tied to the email below.`;

  return (
    <AuthShell
      brand={{
        eyebrow: "you've been invited",
        heading: (
          <>
            join moku pona as a <span className="text-primary">{roleName}</span>
          </>
        ),
        body: brandBody,
      }}
    >
      <h1 className="mt-1 text-3xl font-light">accept your invite</h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="intent" value="signup" />

        {actionData?.formError ? (
          <ErrorList errors={[actionData.formError]} />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">email address</Label>
          <div className="relative">
            <Input
              id="invite-email"
              type="email"
              value={email}
              disabled
              className="text-foreground/55 pr-10"
            />
            <LockClosedIcon
              aria-hidden
              className="text-foreground/40 absolute top-1/2 right-3 size-4 -translate-y-1/2"
            />
          </div>
          <p className="text-foreground/50 text-sm">
            this invite is tied to this address.
          </p>
        </div>

        <Field
          labelProps={{ children: "name" }}
          inputProps={{
            ...getInputProps(fields.name, { type: "text" }),
            placeholder: "e.g. nadia fischer",
          }}
          errors={fields.name.errors}
        />

        <Field
          labelProps={{ children: "password" }}
          inputProps={{
            ...getInputProps(fields.password, { type: "password" }),
          }}
          errors={fields.password.errors}
        />

        <Button type="submit" size="lg" className="mt-0.5 w-full">
          accept &amp; create account
        </Button>

        {googleEnabled ? (
          <>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="bg-border h-px flex-1" />
              <span className="text-foreground/40 text-xs">or</span>
              <span className="bg-border h-px flex-1" />
            </div>

            <GoogleButton
              onClick={() =>
                authClient.signIn.social({
                  provider: "google",
                  callbackURL: `/invite/${token}`,
                })
              }
            />
          </>
        ) : null}

        <p className="text-foreground/50 text-center text-xs">
          {googleEnabled ? (
            <>
              google must return{" "}
              <strong className="text-foreground/70 font-semibold">
                {email}
              </strong>{" "}
              to accept.{" "}
            </>
          ) : null}
          by continuing you accept the{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </Form>
    </AuthShell>
  );
}
