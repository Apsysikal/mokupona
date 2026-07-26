import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/join";

import { AuthShell } from "~/components/auth-layout";
import { AuthNotice } from "~/components/auth-notice";
import { ErrorList, Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { auth } from "~/features/auth/auth.server";
import { GoogleSignInButton } from "~/features/auth/components/google-button";
import { displayNameSchema, emailSchema } from "~/features/auth/form-schemas";
import { anonymousAuthPageLoader } from "~/features/auth/middleware.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import {
  EMAIL_SIGNUP_CLOSED_MESSAGE,
  SIGNUP_CLOSED_MESSAGE,
} from "~/features/auth/signup-settings";
import { isSignupEnabled } from "~/features/auth/signup-settings.server";
import { logger } from "~/logger.server";
import { getUserByEmail } from "~/models/user.server";
import { getClientIPAddress } from "~/shared/http.server";

const schema = withPasswordConfirmation({
  name: displayNameSchema,
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export const loader = anonymousAuthPageLoader;

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();

  // The form renders disabled while the toggle is off, so this catches direct
  // posts and the race where an admin closes sign-ups with the page already
  // open. Checked before the existing-account lookup: a closed door owes the
  // caller no database work, and no hint about which addresses are taken.
  if (!isSignupEnabled("email")) {
    logger.warn("Blocked signup request while self-signup is disabled", {
      ip: getClientIPAddress(request),
    });
    const rejected = parseWithZod(formData, { schema });
    return data(rejected.reply({ formErrors: [SIGNUP_CLOSED_MESSAGE] }), {
      status: 403,
    });
  }

  const submission = await parseWithZod(formData, {
    schema: schema.check(async (ctx) => {
      const existingUser = await getUserByEmail(ctx.value.email);

      if (existingUser) {
        ctx.issues.push({
          code: "custom",
          path: ["email"],
          message:
            "an account already exists with this email. try logging in instead.",
          input: ctx.value.email,
        });
      }
    }),
    async: true,
  });

  if (submission.status !== "success" || !submission.value) {
    logger.info(
      {
        ip: getClientIPAddress(request),
        email:
          submission.payload["email"]?.toString() ?? "unknown@no-domain.com",
        reason: submission.status === "error" ? submission.error : null,
      },
      "Failed signup request",
    );

    return submission.reply();
  }

  const { name, email, password, redirectTo } = submission.value;

  await auth.api.signUpEmail({
    body: { name, email, password },
    headers: request.headers,
  });

  await auth.api.sendVerificationEmail({
    body: {
      email,
      callbackURL: `/verify-email?email=${encodeURIComponent(email)}`,
    },
    headers: request.headers,
  });

  logger.info(
    {
      ip: getClientIPAddress(request),
      email,
    },
    "Successful signup request",
  );

  const search = new URLSearchParams({ email });
  if (redirectTo) search.set("redirectTo", redirectTo);
  return redirect(`/check-your-inbox?${search}`);
};

export const meta: Route.MetaFunction = () => [{ title: "Sign Up" }];

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const [form, fields] = useForm({
    lastResult: actionData,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const emailSignupOpen = loaderData.signupEnabled.email;
  const googleSignupOpen =
    loaderData.googleEnabled && loaderData.signupEnabled.google;

  return (
    <AuthShell mode="join" search={searchParams.toString()}>
      <h1 className="mt-1 text-3xl leading-tight font-light tracking-tight">
        sign up
      </h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        {emailSignupOpen ? (
          <ErrorList id={form.errorId} errors={form.errors} />
        ) : (
          // the loader's verdict replaces the equivalent form-level error, so
          // a rejected direct post never says the same thing twice
          <AuthNotice variant="destructive">
            {googleSignupOpen
              ? EMAIL_SIGNUP_CLOSED_MESSAGE
              : SIGNUP_CLOSED_MESSAGE}
          </AuthNotice>
        )}

        {/* every credential control at once — nothing here can be submitted
            while the toggle is off, and the greying-out is the explanation */}
        <fieldset
          disabled={!emailSignupOpen}
          className="flex flex-col gap-4 disabled:opacity-60"
        >
          <Field
            labelProps={{ children: "name" }}
            inputProps={{
              ...getInputProps(fields.name, { type: "text" }),
              placeholder: "e.g. lena huber",
            }}
            errors={fields.name.errors}
          />

          <Field
            labelProps={{ children: "email address" }}
            inputProps={{
              ...getInputProps(fields.email, { type: "email" }),
              placeholder: "you@example.com",
            }}
            errors={fields.email.errors}
          />

          <Field
            labelProps={{ children: "password" }}
            inputProps={{
              ...getInputProps(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />

          <Field
            labelProps={{ children: "confirm password" }}
            inputProps={{
              ...getInputProps(fields.confirmPassword, { type: "password" }),
            }}
            errors={fields.confirmPassword.errors}
          />

          <Input type="hidden" name="redirectTo" value={redirectTo} />

          <p className="text-foreground/50 text-center text-xs">
            by creating an account you accept the{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              privacy policy
            </Link>
          </p>

          <Button type="submit" size="lg" className="w-full">
            create account
          </Button>
        </fieldset>

        {googleSignupOpen ? (
          <GoogleSignInButton callbackURL={redirectTo ?? "/"} />
        ) : null}

        <p className="text-foreground/65 text-center text-sm">
          already have an account?{" "}
          <Link
            to={{
              pathname: "/login",
              search: searchParams.toString(),
            }}
            className="text-primary font-semibold hover:underline"
          >
            log in
          </Link>
        </p>
      </Form>
    </AuthShell>
  );
}
