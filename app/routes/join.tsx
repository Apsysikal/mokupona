import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/join";

import { AuthShell } from "~/components/auth-layout";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { auth, googleAuthEnabled } from "~/features/auth/auth.server";
import { GoogleSignInButton } from "~/features/auth/components/google-button";
import { displayNameSchema, emailSchema } from "~/features/auth/form-schemas";
import { getUserId } from "~/features/auth/guards.server";
import { withPasswordConfirmation } from "~/features/auth/password-schema";
import { logger } from "~/logger.server";
import { getUserByEmail } from "~/models/user.server";
import { getClientIPAddress, obscureEmail } from "~/shared/http.server";

const schema = withPasswordConfirmation({
  name: displayNameSchema,
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export const loader = async ({ request }: Route.LoaderArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return { googleEnabled: googleAuthEnabled };
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();

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
    logger.info("Failed signup request", {
      ip: getClientIPAddress(request),
      email: obscureEmail(
        submission.payload["email"]?.toString() ?? "unknown@no-domain.com",
      ),
      reason: submission.status === "error" ? submission.error : null,
    });

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

  logger.info("Successful signup request", {
    ip: getClientIPAddress(request),
    email: obscureEmail(email),
  });

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

  return (
    <AuthShell mode="join" search={searchParams.toString()}>
      <h1 className="mt-1 text-3xl font-light">sign up</h1>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
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

        <Button type="submit" size="lg" className="mt-0.5 w-full">
          create account
        </Button>

        {loaderData.googleEnabled ? (
          <GoogleSignInButton callbackURL={redirectTo ?? "/"} />
        ) : null}

        <p className="text-foreground/65 text-center text-sm">
          already have an account?{" "}
          <Link
            to={{
              pathname: "/login",
              search: searchParams.toString(),
            }}
            className="text-primary font-medium hover:underline"
          >
            log in
          </Link>
        </p>
      </Form>
    </AuthShell>
  );
}
