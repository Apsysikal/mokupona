import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction} from "react-router";
import {
  redirect,
} from "react-router";
import { Form, useActionData } from "react-router";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { createAddress } from "~/models/address.server";
import { AddressSchema } from "~/utils/address-validation";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return {};
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Create Location" }];
};

export async function action({ request }: ActionFunctionArgs) {
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

export default function DinnersPage() {
  const lastResult = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(AddressSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: AddressSchema });
    },
  });

  return (
    <>
      <div>Create a new location</div>
      <Form
        method="POST"
        replace
        className="flex flex-col gap-2"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "Street Name" }}
          inputProps={{ ...getInputProps(fields.streetName, { type: "text" }) }}
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

        <Button type="submit">Create Location</Button>
      </Form>
    </>
  );
}
