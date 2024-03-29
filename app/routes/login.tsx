import { conform, useForm } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { z } from "zod";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { verifyLogin } from "~/models/user.server";
import { createUserSession, getUserId } from "~/session.server";
import { safeRedirect } from "~/utils";

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const submission = await parse(formData, {
    schema: (intent) =>
      schema.transform(async (data, ctx) => {
        if (intent !== "submit") return { ...data, user: null };
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
    submission.intent !== "submit" ||
    !submission.value ||
    !submission.value.user
  ) {
    return json(submission);
  }

  const redirectTo = safeRedirect(submission.value.redirectTo, "/");
  const { remember, user } = submission.value;

  return createUserSession({
    redirectTo,
    remember: remember,
    request,
    userId: user.id,
  });
};

export const meta: MetaFunction = () => [{ title: "Login" }];

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dinners";
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(schema),
    defaultValue: { redirectTo },
    onValidate({ formData }) {
      return parse(formData, { schema });
    },
  });

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <Form method="post" className="space-y-6" {...form.props}>
          <Field
            labelProps={{ children: "Email address" }}
            inputProps={{ ...conform.input(fields.email, { type: "email" }) }}
            errors={fields.email.errors}
          />

          <Field
            labelProps={{ children: "Password" }}
            inputProps={{
              ...conform.input(fields.password, { type: "password" }),
            }}
            errors={fields.password.errors}
          />

          <Input type="hidden" name="redirectTo" value={redirectTo} />

          <Button type="submit">Log in</Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Checkbox
                id="remember"
                name="remember"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label
                htmlFor="remember"
                className="ml-2 block text-sm text-gray-900"
              >
                Remember me
              </Label>
            </div>
            <div className="text-center text-sm text-gray-500">
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
