import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

import { AuthShell } from "~/components/auth-layout";
import { AuthNotice } from "~/components/auth-notice";
import { ErrorList, Field } from "~/components/forms";
import { GoogleSignInButton } from "~/components/google-button";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { auth, googleAuthEnabled } from "~/features/auth/auth.server";
import { getUserId } from "~/features/auth/guards.server";
import { logger } from "~/logger.server";
import { getClientIPAddress, obscureEmail, safeRedirect } from "~/utils/misc";

const schema = z.object({
  email: z.email({ error: "Email is required" }),
  password: z.string({ error: "Password is required" }),
  redirectTo: z.string().optional(),
  remember: z.boolean().optional().default(false),
});

export const loader = async ({ request }: Route.LoaderArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return { googleEnabled: googleAuthEnabled };
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();

  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return data({ result: submission.reply(), authError: null });
  }

  const { email, password, remember } = submission.value;
  const redirectTo = safeRedirect(submission.value.redirectTo, "/");

  try {
    const { headers } = await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: remember,
        // only used for the verification link an unverified attempt re-sends
        callbackURL: `/verify-email?email=${encodeURIComponent(email)}`,
      },
      headers: request.headers,
      returnHeaders: true,
    });

    logger.info("Successful login request", {
      ip: getClientIPAddress(request),
      email: obscureEmail(email),
    });

    return redirect(redirectTo, { headers });
  } catch (error) {
    const code =
      error instanceof Error && "body" in error
        ? (error as { body?: { code?: string } }).body?.code
        : undefined;

    logger.info("Failed login request", {
      ip: getClientIPAddress(request),
      email: obscureEmail(email),
      reason: code ?? "unknown",
    });

    if (code === "EMAIL_NOT_VERIFIED") {
      // better-auth already re-sent the verification link (sendOnSignIn)
      return data({
        result: submission.reply(),
        authError: { kind: "unverified" as const, email },
      });
    }

    return data({
      result: submission.reply(),
      authError: { kind: "credentials" as const, email },
    });
  }
};

export const meta: Route.MetaFunction = () => [{ title: "Login" }];

export default function LoginPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dinners";
  const authError = actionData?.authError ?? null;
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const credentialsRejected = authError?.kind === "credentials";

  return (
    <AuthShell mode="login" search={searchParams.toString()}>
      <h1 className="mt-1 text-3xl font-light">log in</h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        {credentialsRejected ? (
          <AuthNotice variant="destructive">
            we couldn&apos;t sign you in. check your email and password, then
            try again.
          </AuthNotice>
        ) : null}
        {authError?.kind === "unverified" ? (
          <AuthNotice variant="accent" title="your email isn't verified yet">
            <p>
              we just sent a fresh verification link to{" "}
              <strong className="text-foreground font-semibold">
                {authError.email}
              </strong>
              . open it, then come back and log in.
            </p>
            <p className="text-foreground/50 mt-1 text-xs">
              didn&apos;t get it? give it a minute, then check your spam folder.
            </p>
          </AuthNotice>
        ) : null}

        <Field
          labelProps={{ children: "email address" }}
          inputProps={{
            ...getInputProps(fields.email, { type: "email" }),
            "aria-invalid":
              credentialsRejected || fields.email.errors?.length
                ? true
                : undefined,
          }}
          errors={fields.email.errors}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={fields.password.id}>password</Label>
            <Link
              to="/forgot-password"
              className="text-primary text-sm font-medium hover:underline"
            >
              forgot password?
            </Link>
          </div>
          <Input
            {...getInputProps(fields.password, { type: "password" })}
            aria-invalid={
              credentialsRejected || fields.password.errors?.length
                ? true
                : undefined
            }
          />
          <ErrorList
            id={fields.password.errorId}
            errors={fields.password.errors}
          />
        </div>

        <Input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="flex items-center gap-2">
          <Checkbox id="remember" name="remember" />
          <Label
            htmlFor="remember"
            className="text-foreground/80 text-sm leading-none font-normal"
          >
            remember me
          </Label>
        </div>

        <Button type="submit" size="lg" className="mt-0.5 w-full">
          log in
        </Button>

        {loaderData.googleEnabled ? (
          <GoogleSignInButton callbackURL={redirectTo} />
        ) : null}

        <p className="text-foreground/50 text-center text-xs">
          by continuing you accept the{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
        </p>

        <p className="text-foreground/65 text-center text-sm">
          don&apos;t have an account?{" "}
          <Link
            to={{
              pathname: "/join",
              search: searchParams.toString(),
            }}
            className="text-primary font-medium hover:underline"
          >
            sign up
          </Link>
        </p>
      </Form>
    </AuthShell>
  );
}
