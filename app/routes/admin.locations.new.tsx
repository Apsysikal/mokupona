import { conform, useForm } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { createAddress } from "~/models/address.server";
import { AddressSchema } from "~/utils/address-validation";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return json({});
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Create Location" }];
};

export async function action({ request }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const formData = await request.formData();
  const submission = parse(formData, { schema: AddressSchema });

  if (submission.intent !== "submit" || !submission.value) {
    return json(submission);
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

export default function DinnersPage() {
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(AddressSchema),
    onValidate({ formData }) {
      return parse(formData, { schema: AddressSchema });
    },
  });

  return (
    <>
      <div>Create a new location</div>
      <Form
        method="POST"
        replace
        className="flex flex-col gap-2"
        {...form.props}
      >
        <Field
          labelProps={{ children: "Street Name" }}
          inputProps={{ ...conform.input(fields.streetName, { type: "text" }) }}
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

        <Button type="submit">Create Location</Button>
      </Form>
    </>
  );
}
