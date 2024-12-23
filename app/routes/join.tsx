import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { z } from "zod";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createUser, getUserByEmail } from "~/models/user.server";
import { safeRedirect } from "~/utils/misc";
import { createUserSession, getUserId } from "~/utils/session.server";

const schema = z
  .object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be greater than 8 characters"),
    confirmPassword: z.string({
      required_error: "Please confirm your password",
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
  );

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return {};
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const submission = await parseWithZod(formData, {
    schema: (intent) =>
      schema.superRefine(async (data, ctx) => {
        if (intent !== null) return { ...data };
        const existingUser = await getUserByEmail(data.email);
        if (existingUser) {
          ctx.addIssue({
            path: ["email"],
            code: z.ZodIssueCode.custom,
            message: "A user already exists with this email",
          });
          return;
        }
      }),
    async: true,
  });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const redirectTo = safeRedirect(submission.value.redirectTo, "/");
  const { email, password } = submission.value;

  const user = await createUser(email, password);

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
