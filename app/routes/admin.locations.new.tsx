import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.locations.new";

import { AdminLocationForm } from "~/components/admin-location-form";
import { requireUserWithRole } from "~/features/auth/guards.server";
import { createAddress } from "~/models/address.server";
import { AddressSchema } from "~/utils/address-validation";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return {};
}

export async function action({ request }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: AddressSchema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const { streetName, houseNumber, zipCode, city } = submission.value;

  await createAddress({
    streetName,
    houseNumber,
    zip: zipCode,
    city,
  });

  return redirect("/admin/locations");
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Location" }];
};

export default function DinnersPage({ actionData }: Route.ComponentProps) {
  const lastResult = actionData;
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(AddressSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: AddressSchema });
    },
  });

  return (
    <Form method="POST" replace {...getFormProps(form)}>
      <AdminLocationForm
        fields={fields}
        submitText="Create location"
        pageTitle="New location"
      />
    </Form>
  );
}
