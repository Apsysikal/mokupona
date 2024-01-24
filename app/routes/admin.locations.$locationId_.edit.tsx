import { conform, useForm } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { getAddressById, updateAddress } from "~/models/address.server";
import { requireUserWithRole } from "~/session.server";
import { AddressSchema } from "~/utils/address-validation";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;
  invariant(typeof locationId === "string", "Parameter locationId is missing");

  const address = await getAddressById(locationId);

  if (!address) throw new Response("Not found", { status: 404 });

  return json({
    location: address,
  });
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Edit Location" }];
};

export async function action({ request, params }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const { locationId } = params;
  invariant(typeof locationId === "string", "Parameter locationId is missing");

  const formData = await request.formData();
  const submission = parse(formData, { schema: AddressSchema });

  if (submission.intent !== "submit" || !submission.value) {
    return json(submission);
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
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(AddressSchema),
    defaultValue: {
      streetName: location.streetName,
      houseNumber: location.houseNumber,
      zipCode: location.zip,
      city: location.city,
    },
    onValidate({ formData }) {
      return parse(formData, { schema: AddressSchema });
    },
  });

  return (
    <>
      <Form
        method="POST"
        replace
        className="flex flex-col gap-2"
        {...form.props}
      >
        <Field
          labelProps={{ children: "Street Name" }}
          inputProps={{
            ...conform.input(fields.streetName, { type: "text" }),
          }}
          errors={fields.streetName.errors}
        />

        <Field
          labelProps={{ children: "House Number" }}
          inputProps={{
            ...conform.input(fields.houseNumber, { type: "text" }),
          }}
          errors={fields.houseNumber.errors}
        />

        <Field
          labelProps={{ children: "Zip Code" }}
          inputProps={{ ...conform.input(fields.zipCode, { type: "text" }) }}
          errors={fields.zipCode.errors}
        />

        <Field
          labelProps={{ children: "City Name" }}
          inputProps={{ ...conform.input(fields.city, { type: "text" }) }}
          errors={fields.city.errors}
        />

        <Button type="submit">Update Location</Button>
      </Form>
    </>
  );
}
