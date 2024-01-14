import { Prisma } from "@prisma/client";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import { DinnerView } from "~/components/dinner-view";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { RootLoaderData } from "~/root";

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

export const meta: MetaFunction<typeof loader> = ({ data, matches }) => {
  if (!data) return [{ title: "Dinner" }];
  const { domainUrl } = matches[0].data as RootLoaderData;

  const { event } = data;
  if (!event) return [{ title: "Dinner" }];

  return [
    { title: `Dinner - ${event.title}` },
    {
      property: "og:title",
      content: `Dinner - ${event.title}`,
    },
    {
      property: "og:image",
      content: `${domainUrl}${event.cover}`,
    },
    {
      property: "og:url",
      content: `${domainUrl}${matches.at(-1)?.pathname}`,
    },
  ];
};

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pb-8 pt-4">
      <DinnerView event={event} />

      <Form method="post">
        <div className="flex flex-col gap-3">
          <Field
            labelProps={{ children: "Name" }}
            inputProps={{
              id: "name",
              name: "name",
              type: "text",
            }}
            errors={
              actionData?.fieldErrors.name
                ? actionData.fieldErrors.name
                : undefined
            }
          />

          <Field
            labelProps={{ children: "Email" }}
            inputProps={{
              id: "email",
              name: "email",
              type: "email",
            }}
            errors={
              actionData?.fieldErrors.email
                ? actionData.fieldErrors.email
                : undefined
            }
          />

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
