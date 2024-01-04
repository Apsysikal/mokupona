import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createAddress } from "~/models/address.server";
import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserId(request);

  const formData = await request.formData();

  const { streetName, houseNumber, zipCode, city } =
    Object.fromEntries(formData);

  const fieldErrors = {
    streetName: validateStreetName(streetName),
    houseNumber: validateHouseNumber(houseNumber),
    zipCode: validateZipCode(zipCode),
    city: validateCity(city),
  };

  const fields = {
    streetName: streetName as string,
    houseNumber: houseNumber as string,
    zipCode: zipCode as string,
    city: city as string,
  };

  if (Object.values(fieldErrors).some(Boolean)) {
    return json(
      {
        fieldErrors,
        fields,
        formError: null,
      },
      { status: 400 },
    );
  }

  await createAddress({
    streetName: String(streetName),
    houseNumber: String(houseNumber),
    zip: String(zipCode),
    city: String(city),
  });

  return redirect("/admin/locations");
}

export default function DinnersPage() {
  const actionData = useActionData<typeof action>();

  return (
    <>
      <div>Create a new location</div>
      <Form method="POST" replace className="flex flex-col gap-2">
        <div>
          <Label htmlFor="streetName">Street Name</Label>
          <Input
            id="streetName"
            name="streetName"
            type="text"
            defaultValue={actionData?.fields?.streetName}
          />
          {actionData?.fieldErrors?.streetName ? (
            <p>{actionData.fieldErrors.streetName}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="houseNumber">House number</Label>
          <Input
            id="houseNumber"
            name="houseNumber"
            type="text"
            defaultValue={actionData?.fields?.houseNumber}
          />
          {actionData?.fieldErrors?.houseNumber ? (
            <p>{actionData.fieldErrors.houseNumber}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="zipCode">Zip code</Label>
          <Input
            id="zipCode"
            name="zipCode"
            type="text"
            defaultValue={actionData?.fields?.zipCode}
          />
          {actionData?.fieldErrors?.zipCode ? (
            <p>{actionData.fieldErrors.zipCode}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="city">City name</Label>
          <Input
            id="city"
            name="city"
            type="text"
            defaultValue={actionData?.fields?.city}
          />
          {actionData?.fieldErrors?.city ? (
            <p>{actionData.fieldErrors.city}</p>
          ) : null}
        </div>

        <Button type="submit">Create Location</Button>
      </Form>
    </>
  );
}

function validateStreetName(streetName: FormDataEntryValue | string | null) {
  if (!streetName) return "Street name must be provided";
  if (streetName instanceof File) return "Invalid type";
  if (streetName.trim().length === 0) return "Street name cannot be empty";
}

function validateHouseNumber(houseNumber: FormDataEntryValue | string | null) {
  if (!houseNumber) return "House number must be provided";
  if (houseNumber instanceof File) return "Invalid type";
  if (houseNumber.trim().length === 0) return "House number cannot be empty";
}

function validateZipCode(zipCode: FormDataEntryValue | string | null) {
  if (!zipCode) return "Zip code must be provided";
  if (zipCode instanceof File) return "Invalid type";
  if (zipCode.trim().length === 0) return "Zip code cannot be empty";
}

function validateCity(city: FormDataEntryValue | string | null) {
  if (!city) return "City must be provided";
  if (city instanceof File) return "Invalid type";
  if (city.trim().length === 0) return "City cannot be empty";
}
