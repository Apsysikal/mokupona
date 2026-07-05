import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

import { AuthShell } from "~/components/auth-layout";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { logger } from "~/logger.server";
import { verifyLogin } from "~/models/user.server";
import { getClientIPAddress, obscureEmail, safeRedirect } from "~/utils/misc";
import { createUserSession, getUserId } from "~/utils/session.server";

const schema = z.object({
  email: z.email({ error: "Email is required" }),
  password: z
    .string({
      error: "Password is required",
    })
    .min(8, "Password must be greater than 8 characters"),
  redirectTo: z.string().optional(),
  remember: z.boolean().optional().default(false),
});

export const loader = async ({ request }: Route.LoaderArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return {};
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();

  const submission = await parseWithZod(formData, {
    schema: (intent) =>
      schema.transform(async (data, ctx) => {
        if (intent !== null) return { ...data, user: null };
        const user = await verifyLogin(data.email, data.password);
        if (!user) {
          ctx.addIssue({
            path: ["password"],
            code: "custom",
            message: "Invalid username or password",
          });
          return z.NEVER;
        }

        return { ...data, user };
      }),
    async: true,
  });

  if (
    submission.status !== "success" ||
    !submission.value ||
    !submission.value.user
  ) {
    logger.info("Failed login request", {
      ip: getClientIPAddress(request),
      email: obscureEmail(
        submission.payload["email"].toString() ?? "unknown@no-domain.com",
      ),
      reason: submission.status === "error" ? submission.error : null,
    });

    return submission.reply();
  }

  logger.info("Successful login request", {
    ip: getClientIPAddress(request),
    email: obscureEmail(submission.value.email),
  });

  const redirectTo = safeRedirect(submission.value.redirectTo, "/");
  const { remember, user } = submission.value;

  return createUserSession({
    redirectTo,
    remember: remember,
    request,
    userId: user.id,
  });
};

export const meta: Route.MetaFunction = () => [{ title: "Login" }];

export default function LoginPage({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dinners";
  const lastResult = actionData;
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
    <AuthShell mode="login" search={searchParams.toString()}>
      <h1 className="mt-1 text-[30px] font-light">log in</h1>

      <Form
        method="post"
        className="flex flex-col gap-4.5 [--input-surface:var(--card)]"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "email address" }}
          inputProps={{ ...getInputProps(fields.email, { type: "email" }) }}
          errors={fields.email.errors}
        />

        <Field
          labelProps={{ children: "password" }}
          inputProps={{
            ...getInputProps(fields.password, { type: "password" }),
          }}
          errors={fields.password.errors}
        />

        <Input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="flex items-center gap-2.5">
          <Checkbox id="remember" name="remember" />
          <Label
            htmlFor="remember"
            className="text-fg-secondary text-[13px] leading-none"
          >
            remember me
          </Label>
        </div>

        <Button type="submit" size="lg" className="mt-0.5 w-full rounded-[9px]">
          log in
        </Button>

        <div className="flex items-center gap-3.5" aria-hidden>
          <span className="bg-foreground/10 h-px flex-1" />
          <span className="text-fg-faint text-xs">or</span>
          <span className="bg-foreground/10 h-px flex-1" />
        </div>

        <p className="text-fg-muted text-center text-sm">
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
