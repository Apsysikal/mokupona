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
import { z } from "zod";

import { DinnerView } from "~/components/dinner-view";
import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { RootLoaderData } from "~/root";
import { getEventImageUrl } from "~/utils";

const schema = z.object({
  name: z.string({ required_error: "Name is required" }).trim(),
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email")
    .trim(),
});

export async function loader({ params }: LoaderFunctionArgs) {
  const { dinnerId } = params;

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return json({ event });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { dinnerId } = params;

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const formData = await request.formData();
  const submission = await parse(formData, {
    schema: (intent) =>
      schema.superRefine(async (data, ctx) => {
        if (intent !== "submit") return { ...data };

        const existingResponse = await prisma.eventResponse.findUnique({
          where: {
            email_eventId: {
              email: data.email,
              eventId: dinnerId,
            },
          },
        });

        if (existingResponse) {
          ctx.addIssue({
            path: ["email"],
            code: z.ZodIssueCode.custom,
            message: "You already signed up using this email",
          });
          return;
        }
      }),
    async: true,
  });

  if (submission.intent !== "submit" || !submission.value) {
    return json(submission);
  }

  const { name, email } = submission.value;

  await createEventResponse(dinnerId, name as string, email as string);

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
      content: `${domainUrl}${getEventImageUrl(event.imageId)}`,
    },
    {
      property: "og:url",
      content: `${domainUrl}${matches.at(-1)?.pathname}`,
    },
  ];
};

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastSubmission,
    shouldValidate: "onBlur",
    constraint: getFieldsetConstraint(schema),
    onValidate({ formData }) {
      return parse(formData, { schema });
    },
  });

  return (
    <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 pb-8 pt-4">
      <DinnerView event={event} />

      <Form method="post" {...form.props}>
        <div className="flex flex-col gap-3">
          <Field
            labelProps={{ children: "Name" }}
            inputProps={{ ...conform.input(fields.name, { type: "text" }) }}
            errors={fields.name.errors}
          />

          <Field
            labelProps={{ children: "Email" }}
            inputProps={{ ...conform.input(fields.email, { type: "email" }) }}
            errors={fields.email.errors}
          />

          <Button type="submit">Join</Button>
        </div>
      </Form>
    </main>
  );
}
