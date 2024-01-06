import { Prisma } from "@prisma/client";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { DinnerView } from "~/components/dinner-view";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { dinnerId } = params;

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({ event });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { dinnerId } = params;
  const formData = await request.formData();
  const { name, email } = Object.fromEntries(formData);

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const fieldErrors = {
    name: validateName(name),
    email: validateEmail(email),
  };

  const fields = {
    name: name as string,
    email: email as string,
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

  try {
    await createEventResponse(dinnerId, name as string, email as string);
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const { code } = error;

      if (code === "P2002") {
        return json(
          {
            fieldErrors,
            fields,
            formError:
              "Failed to sign you up. Maybe you already signed up with this email",
          },
          {
            status: 400,
          },
        );
      }
    }

    return json(
      {
        fieldErrors,
        fields,
        formError:
          "Failed to sign you up. If this error persists, please contact us",
      },
      {
        status: 500,
      },
    );
  }

  return redirect("/dinners");
}

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pb-8 pt-4">
      <DinnerView event={event} />

      <Form method="post">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name" className="font-semibold">
              Name
            </Label>
            <Input
              type="text"
              name="name"
              id="name"
              defaultValue={actionData?.fields.name}
              aria-invalid={actionData?.fieldErrors.name ? true : false}
              aria-errormessage={
                actionData?.fieldErrors.name ? "name-error" : undefined
              }
            />
            {actionData?.fieldErrors?.name ? (
              <p id="name-error" role="alert" className="text-sm text-red-500">
                {actionData.fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="email" className="font-semibold">
                Email
              </Label>
              <Input
                type="email"
                name="email"
                id="email"
                defaultValue={actionData?.fields.email}
                aria-invalid={actionData?.fieldErrors.email ? true : false}
                aria-errormessage={
                  actionData?.fieldErrors.email ? "email-error" : undefined
                }
              />
              {actionData?.fieldErrors?.email ? (
                <p
                  id="email-error"
                  role="alert"
                  className="text-sm text-red-500"
                >
                  {actionData.fieldErrors.email}
                </p>
              ) : null}
            </div>
          </div>
          {actionData?.formError ? (
            <div>
              <p className="text-sm text-red-500">{actionData.formError}</p>
            </div>
          ) : null}
          <div>
            <Button type="submit">Join</Button>
          </div>
        </div>
      </Form>
    </main>
  );
}

function validateName(name: FormDataEntryValue | string | null) {
  if (!name) return "Name must be provided";
  if (String(name).trim().length === 0) return "Name cannot be empty";
}

function validateEmail(email: FormDataEntryValue | string | null) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) return "Email must be provided";
  if (!emailRegex.test(String(email))) return "Email must be valid";
}
