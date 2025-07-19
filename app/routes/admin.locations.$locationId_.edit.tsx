import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect, useActionData, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import type { Route } from "./+types/admin.locations.$locationId_.edit";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { getAddressById, updateAddress } from "~/models/address.server";
import { AddressSchema } from "~/utils/address-validation";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;
  invariant(typeof locationId === "string", "Parameter locationId is missing");

  const address = await getAddressById(locationId);

  if (!address) throw new Response("Not found", { status: 404 });

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
  invariant(typeof locationId === "string", "Parameter locationId is missing");

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

export default function DinnersPage() {
  const { location } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
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
    <>
      <Form
        method="POST"
        replace
        className="flex flex-col gap-2"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "Street Name" }}
          inputProps={{
            ...getInputProps(fields.streetName, { type: "text" }),
          }}
          errors={fields.streetName.errors}
        />

        <Field
          labelProps={{ children: "House Number" }}
          inputProps={{
            ...getInputProps(fields.houseNumber, { type: "text" }),
          }}
          errors={fields.houseNumber.errors}
        />

        <Field
          labelProps={{ children: "Zip Code" }}
          inputProps={{ ...getInputProps(fields.zipCode, { type: "text" }) }}
          errors={fields.zipCode.errors}
        />

        <Field
          labelProps={{ children: "City Name" }}
          inputProps={{ ...getInputProps(fields.city, { type: "text" }) }}
          errors={fields.city.errors}
        />

        <Button type="submit">Update Location</Button>
      </Form>
    </>
  );
}
