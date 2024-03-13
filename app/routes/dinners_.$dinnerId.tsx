import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { z } from "zod";

import { DinnerView } from "~/components/dinner-view";
import { ErrorList, Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { redirectWithToast } from "~/utils/toast.server";

const person = z.object({
  name: z.string({ required_error: "Name is required" }).trim(),
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email")
    .trim(),
});

const schema = z.object({
  people: z
    .array(person)
    .min(1, "You must at least sign up one person")
    .max(3, "You can't sign up more than 3 people"),
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
  const submission = await parseWithZod(formData, {
    schema: (intent) =>
      schema.superRefine(async (data, ctx) => {
        if (intent?.type !== "validate") return { ...data };

        const d = data.people.map(async ({ email }, index) => {
          const existingResponse = await prisma.eventResponse.findUnique({
            where: {
              email_eventId: {
                email: email,
                eventId: dinnerId,
              },
            },
          });

          if (existingResponse) {
            ctx.addIssue({
              path: [`people[${index}].email`],
              code: z.ZodIssueCode.custom,
              message: "Someone is already signed up with this email",
            });
          }
        });

        await Promise.all(d);
      }),
    async: true,
  });

  if (submission.status !== "success" || !submission.value) {
    return json(submission.reply());
  }

  const { people } = submission.value;

  await Promise.all(
    people.map(({ name, email }) => {
      return createEventResponse(dinnerId, name, email);
    }),
  );

  return redirectWithToast("/dinners", {
    title: "Thank you for signing up",
    description: "We'll email you, if you were lucky to get a seat.",
    type: "success",
  });
}

export default function DinnerPage() {
  const { event } = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    defaultValue: { people: [{}] },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const people = fields.people.getFieldList();
  // const people = useFieldList(form.ref, fields.people);

  return (
    <main className="mx-auto flex max-w-4xl grow flex-col gap-5 px-2 pb-8 pt-4">
      <DinnerView event={event} />

      <Form
        method="post"
        {...getFormProps(form)}
        className="flex flex-col gap-4"
      >
        {/**
         * This button is needed as hitting Enter would otherwise remove the first person.
         * https://github.com/edmundhung/conform/issues/216
         */}
        <button type="submit" hidden />
        <ul className="flex flex-col gap-6">
          {people.map((person, index) => {
            const { name, email } = person.getFieldset();

            return (
              <li key={person.key} className="flex gap-3">
                <fieldset className="flex w-full flex-col gap-4">
                  <Field
                    labelProps={{ children: "Name" }}
                    inputProps={{ ...name, type: "text" }}
                    errors={name.errors}
                  />

                  <Field
                    labelProps={{ children: "Email" }}
                    inputProps={{ ...email, type: "email" }}
                    errors={email.errors}
                  />

                  <Button
                    {...{
                      ...form.remove.getButtonProps({
                        name: fields.people.name,
                        index,
                      }),
                      disabled: people.length === 1,
                    }}
                    variant="destructive"
                  >
                    Remove this person
                  </Button>
                </fieldset>
              </li>
            );
          })}
        </ul>

        {people.length < 3 ? (
          <Button
            variant="outline"
            {...form.insert.getButtonProps({ name: fields.people.name })}
            className="mt-8"
          >
            Add a person
          </Button>
        ) : null}

        <ErrorList id={fields.people.id} errors={fields.people.errors} />

        <Button type="submit">Join</Button>
      </Form>
    </main>
  );
}
