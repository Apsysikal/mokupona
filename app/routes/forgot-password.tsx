import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { data, Form, Link } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/forgot-password";

import { AuthShell } from "~/components/auth-layout";
import { AuthStatus } from "~/components/auth-status";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { auth } from "~/features/auth/auth.server";
import { emailSchema } from "~/features/auth/form-schemas";
import { logger } from "~/logger.server";
import { getClientIPAddress, obscureEmail } from "~/shared/http.server";

const schema = z.object({
  email: emailSchema,
});

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return data({ result: submission.reply(), sentTo: null });
  }

  const { email } = submission.value;

  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/reset-password" },
    headers: request.headers,
  });

  logger.info("Password reset requested", {
    ip: getClientIPAddress(request),
    email: obscureEmail(email),
  });

  return data({ result: submission.reply(), sentTo: email });
};

export const meta: Route.MetaFunction = () => [{ title: "Forgot password" }];

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const sentTo = actionData?.sentTo ?? null;
  const [form, fields] = useForm({
    lastResult: actionData?.result,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  if (sentTo) {
    return (
      <AuthStatus
        standalone
        icon={<EnvelopeClosedIcon className="size-7" />}
        heading="check your inbox"
        body={
          <>
            if an account exists for{" "}
            <strong className="text-foreground font-semibold">{sentTo}</strong>,
            we&apos;ve sent a link to reset your password.
          </>
        }
      >
        <Button size="lg" className="w-full" asChild>
          <Link to="/login">back to log in</Link>
        </Button>
      </AuthStatus>
    );
  }

  return (
    <AuthShell
      brand={{
        eyebrow: "reset",
        heading: "happens to everyone",
        body: "tell us your email and we'll send a link to set a new password.",
      }}
    >
      <div className="mt-1 flex flex-col gap-1.5">
        <h1 className="text-3xl font-light">forgot your password?</h1>
        <p className="text-foreground/65 text-sm">
          enter the email you signed up with and we&apos;ll send a reset link.
        </p>
      </div>

      <Form
        method="post"
        className="flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "email address" }}
          inputProps={{
            ...getInputProps(fields.email, { type: "email" }),
            placeholder: "you@example.com",
          }}
          errors={fields.email.errors}
        />

        <Button type="submit" size="lg" className="mt-0.5 w-full">
          send reset link
        </Button>

        <p className="text-foreground/65 text-center text-sm">
          remembered it?{" "}
          <Link
            to="/login"
            className="text-primary font-medium hover:underline"
          >
            back to log in
          </Link>
        </p>
      </Form>
    </AuthShell>
  );
}
