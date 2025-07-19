import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { MetaFunction } from "react-router";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useSearchParams,
} from "react-router";
import { z } from "zod";

import type { Route } from "./+types/join";

import { CheckboxField, Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { logger } from "~/logger.server";
import { createUser, getUserByEmail } from "~/models/user.server";
import { getClientIPAddress, obscureEmail, safeRedirect } from "~/utils/misc";
import { createUserSession, getUserId } from "~/utils/session.server";

const schema = z
  .object({
    email: z.string({ error: "Email is required" }).email("Invalid email"),
    password: z
      .string({
        error: "Password is required",
      })
      .min(8, "Password must be greater than 8 characters"),
    confirmPassword: z.string({
      error: "Please confirm your password",
    }),
    acceptedPrivacy: z.boolean({
      error: "You must agree to register",
    }),
    redirectTo: z.string().optional(),
  })
  .refine(
    (data) => {
      return data.password === data.confirmPassword;
    },
    {
      message: "Passwords must match",
      path: ["confirmPassword"],
    },
  )
  .refine(
    (data) => {
      return data.acceptedPrivacy === true;
    },
    {
      message: "You must agree to register",
      path: ["acceptedPrivacy"],
    },
  );

export const loader = async ({ request }: Route.LoaderArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return {};
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();

  const submission = await parseWithZod(formData, {
    schema: (intent) =>
      schema.check(async (ctx) => {
        const existingUser = await getUserByEmail(ctx.value.email);

        if (existingUser) {
          ctx.issues.push({
            code: "custom",
            path: ["email"],
            message: "A user already exists with this email",
            input: ctx.value.email,
          });
        }
      }),
    async: true,
  });

  if (submission.status !== "success" || !submission.value) {
    logger.info("Failed login request", {
      ip: getClientIPAddress(request),
      email: obscureEmail(
        submission.payload["email"].toString() ?? "unknown@no-domain.com",
      ),
      reason: submission.status === "error" ? submission.error : null,
    });

    return submission.reply();
  }

  const redirectTo = safeRedirect(submission.value.redirectTo, "/");
  const { email, password } = submission.value;

  const user = await createUser(email, password);

  logger.info("Successful signup request", {
    ip: getClientIPAddress(request),
    email: obscureEmail(submission.value.email),
  });

  return createUserSession({
    redirectTo,
    remember: false,
    request,
    userId: user.id,
  });
};

export const meta: MetaFunction = () => [{ title: "Sign Up" }];

export default function Join() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const lastResult = useActionData<typeof action>();
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
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <Form method="post" className="space-y-6" {...getFormProps(form)}>
          <Field
            labelProps={{ children: "Email address" }}
            inputProps={{ ...getInputProps(fields.email, { type: "email" }) }}
            errors={fields.email.errors}
          />

          <Field
            labelProps={{ children: "Password" }}
            inputProps={{
              ...getInputProps(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />

          <Field
            labelProps={{ children: "Confirm Password" }}
            inputProps={{
              ...getInputProps(fields.confirmPassword, { type: "password" }),
            }}
            errors={fields.confirmPassword.errors}
          />

          <CheckboxField
            labelProps={{
              children: (
                <span>
                  Agree to{" "}
                  <Link to="/privacy" className="text-primary">
                    Privacy Policy
                  </Link>
                </span>
              ),
            }}
            buttonProps={{
              ...getInputProps(fields.acceptedPrivacy, { type: "checkbox" }),
            }}
            errors={fields.acceptedPrivacy.errors}
          />

          <Input type="hidden" name="redirectTo" value={redirectTo} />

          <Button type="submit">Create Account</Button>

          <div className="flex items-center justify-center">
            <div className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Button variant="link" asChild>
                <Link
                  to={{
                    pathname: "/login",
                    search: searchParams.toString(),
                  }}
                >
                  Log in
                </Link>
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
