import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CheckCircledIcon, LinkBreak2Icon } from "@radix-ui/react-icons";
import { data, Form, Link, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/reset-password";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { auth } from "~/features/auth/auth.server";
import { parseRequestForm } from "~/features/auth/form-schemas";
import { requestLoggerContext } from "~/features/auth/middleware.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import { getPasswordResetEmail } from "~/models/password-reset.server";
import { getClientIPAddress } from "~/shared/http.server";

const schema = withPasswordConfirmation({
  token: z.string(),
});

// The mailed link goes through better-auth's API endpoint, which validates
// the token and redirects here with ?token=… (or ?error=INVALID_TOKEN).
// Completing a reset also verifies the email (auth.server.ts onPasswordReset).
export const loader = async ({ request }: Route.LoaderArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.has("done")) return { state: "done" as const };

  const token = url.searchParams.get("token");
  if (!token || url.searchParams.has("error")) {
    return { state: "invalid" as const };
  }

  // resolve the token to its user for the "resetting for …" subhead — and to
  // dead-end immediately when it's stale
  const email = await getPasswordResetEmail(token);
  if (!email) return { state: "invalid" as const };

  return { state: "form" as const, token, email };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const logger = context.get(requestLoggerContext);
  const submission = await parseRequestForm(request, schema);

  if (submission.status !== "success") {
    return data({ result: submission.reply() });
  }

  const { password, token } = submission.value;
  // resolvable only while the token is live, so it has to be read first
  const email = await getPasswordResetEmail(token);

  try {
    await auth.api.resetPassword({
      body: { newPassword: password, token },
    });
  } catch (error) {
    logger.warn(
      {
        ip: getClientIPAddress(request),
        email,
        error,
      },
      "Password reset failed (stale token)",
    );
    return redirect("/reset-password?error=INVALID_TOKEN");
  }

  logger.info(
    {
      ip: getClientIPAddress(request),
      email,
    },
    "Password reset completed",
  );

  return redirect("/reset-password?done");
};

export const meta: Route.MetaFunction = () => [{ title: "Reset password" }];

export default function ResetPassword({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  if (loaderData.state === "done") {
    return (
      <AuthStatus
        standalone
        icon={<CheckCircledIcon className="size-7" />}
        heading="password updated"
        body="your new password is saved and your email is confirmed. log in to pick up where you left off."
      >
        <Button size="lg" className="w-full" asChild>
          <Link to="/login">continue to log in</Link>
        </Button>
      </AuthStatus>
    );
  }

  if (loaderData.state === "invalid") {
    return (
      <AuthStatus
        standalone
        tone="neutral"
        icon={<LinkBreak2Icon className="size-7" />}
        heading="this reset link has expired"
        body="request a fresh one and we'll email it right over."
      >
        <Button size="lg" className="w-full" asChild>
          <Link to="/forgot-password">request a new link</Link>
        </Button>
      </AuthStatus>
    );
  }

  return (
    <AuthShell
      brand={{
        eyebrow: "reset",
        heading: "pick something new",
        body: "pick a new password with at least 8 characters and you're back in.",
      }}
    >
      <div className="mt-1 flex flex-col gap-2">
        <h1 className="text-3xl leading-tight font-light tracking-tight">
          choose a new password
        </h1>
        {loaderData.email ? (
          <p className="text-foreground/65 text-sm">
            resetting for{" "}
            <strong className="text-foreground font-semibold">
              {loaderData.email}
            </strong>
          </p>
        ) : null}
      </div>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <input type="hidden" name="token" value={loaderData.token} />

        <div className="flex flex-col gap-1">
          <Field
            labelProps={{ children: "new password" }}
            inputProps={{
              ...getInputProps(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />
          {fields.password.errors?.length ? null : (
            <p className="text-foreground/50 text-sm">at least 8 characters.</p>
          )}
        </div>

        <Field
          labelProps={{ children: "confirm new password" }}
          inputProps={{
            ...getInputProps(fields.confirmPassword, { type: "password" }),
          }}
          errors={fields.confirmPassword.errors}
        />

        <Button type="submit" size="lg" className="w-full">
          save new password
        </Button>
      </Form>
    </AuthShell>
  );
}
