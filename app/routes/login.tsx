import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useSearchParams,
} from "react-router";
import { z } from "zod";

import type { Route } from "./+types/login";

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
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email"),
  password: z
    .string({
      required_error: "Password is required",
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
            code: z.ZodIssueCode.custom,
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

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dinners";
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

          <Input type="hidden" name="redirectTo" value={redirectTo} />

          <div className="flex items-center justify-between">
            <Button type="submit">Log in</Button>
            {/* <span className="text-sm">
              <Button variant="link" asChild>
                <Link
                  to={{
                    pathname: "/",
                    search: searchParams.toString(),
                  }}
                >
                  Forgot your password?
                </Link>
              </Button>
            </span> */}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Checkbox
                id="remember"
                name="remember"
                className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="remember" className="ml-2 block text-sm">
                Remember me
              </Label>
            </div>
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Button variant="link" asChild>
                <Link
                  to={{
                    pathname: "/join",
                    search: searchParams.toString(),
                  }}
                >
                  Sign up
                </Link>
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
