import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";

import type { Route } from "./+types/admin.locations.$locationId_.edit";

import { AdminLocationForm } from "~/components/admin-location-form";
import { requireUserWithRole } from "~/features/auth/guards.server";
import { getAddressById, updateAddress } from "~/models/address.server";
import { requireFound } from "~/shared/http.server";
import { AddressSchema } from "~/utils/address-validation";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;

  const address = requireFound(await getAddressById(locationId));

  return {
    location: address,
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Edit Location" }];
};

export async function action({ request, params }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: AddressSchema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const { streetName, houseNumber, zipCode, city } = submission.value;

  await updateAddress(locationId, {
    streetName,
    houseNumber,
    zip: zipCode,
    city,
  });

  return redirect(`/admin/locations`);
}

export default function DinnersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { location } = loaderData;
  const lastResult = actionData;
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(AddressSchema),
    defaultValue: {
      streetName: location.streetName,
      houseNumber: location.houseNumber,
      zipCode: location.zip,
      city: location.city,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: AddressSchema });
    },
  });

  return (
    <Form method="POST" replace {...getFormProps(form)}>
      <AdminLocationForm
        fields={fields}
        submitText="Save location"
        pageTitle="Edit location"
      />
    </Form>
  );
}
