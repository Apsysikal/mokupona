import { getFormProps, getSelectProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, redirect } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";

import { SelectField } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { requireUserWithRole } from "~/utils/session.server";

const schema = z.object({
  roleName: z.union([z.literal("user"), z.literal("moderator")]),
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);

  const { userId } = params;
  invariant(typeof userId === "string", "Parameter userId is missing");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user) throw new Response("Not found", { status: 404 });

  return {
    user,
  };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Edit User" }];
};

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);

  const { userId } = params;
  invariant(typeof userId === "string", "Parameter userId is missing");

  const formData = await request.formData();
  const submission = await parseWithZod(formData, {
    schema: (intent) =>
      schema.transform(async (data, ctx) => {
        if (intent !== null) return { ...data, roleId: null };
        const role = await prisma.role.findUnique({
          where: { name: data.roleName },
        });
        if (!role) {
          ctx.addIssue({
            path: ["roleName"],
            code: z.ZodIssueCode.custom,
            message: "Invalid role",
          });
          return z.NEVER;
        }

        return { ...data, roleId: role.id };
      }),
    async: true,
  });

  if (
    submission.status !== "success" ||
    !submission.value ||
    !submission.value.roleId
  ) {
    return submission.reply();
  }

  const { roleId } = submission.value;

  await prisma.user.update({
    where: {
      id: userId,
      role: {
        NOT: {
          name: "admin",
        },
      },
    },
    data: {
      roleId,
    },
  });

  return redirect(`/admin/users`);
}

export default function DinnersPage() {
  const { user } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: {
      roleName: user.role.name,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const isAdmin = user.role.name === "admin";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl">User Information</h1>
        <p>
          Information for <span className="text-primary">{user.email}</span>
        </p>
      </div>

      <Form
        method="POST"
        replace
        className="mt-4 flex flex-col gap-4"
        {...getFormProps(form)}
      >
        <SelectField
          labelProps={{ children: "Role" }}
          selectProps={{
            ...getSelectProps(fields.roleName),
            disabled: isAdmin,
            children: [
              { name: "User", value: "user" },
              { name: "Moderator", value: "moderator" },
            ].map((role) => {
              const { name, value } = role;

              return (
                <option key={value} value={value}>
                  {name}
                </option>
              );
            }),
            className:
              "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground file:placeholder:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          }}
          errors={fields.roleName.errors}
          className="flex w-full flex-col gap-2"
        />

        <Button type="submit">Update User</Button>
      </Form>
    </div>
  );
}
