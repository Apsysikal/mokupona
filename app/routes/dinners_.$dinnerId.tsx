import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { z } from "zod";

import { DinnerView } from "~/components/dinner-view";
import {
  CheckboxField,
  ErrorList,
  Field,
  TextareaField,
} from "~/components/forms";
import { Button } from "~/components/ui/button";
import { createEventResponse } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { redirectWithToast } from "~/utils/toast.server";

const signupPerson = z.object({
  name: z.string({ required_error: "Name is required" }).trim(),
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email")
    .trim(),
  phone: z.string({ required_error: "Phone number is required" }).trim(),
  alternativeMenu: z.boolean().default(false),
  student: z.boolean().default(false),
  dietaryRestrictions: z.string().trim().optional(),
});

const person = z.object({
  name: z.string({ required_error: "Name is required" }).trim(),
  alternativeMenu: z.boolean().default(false),
  student: z.boolean().default(false),
  dietaryRestrictions: z.string().trim().optional(),
});

const schema = z.object({
  signupPerson,
  people: z
    .array(person)
    .min(0, "You must at least sign up one person")
    .max(3, "You can't sign up more than 4 people"),
  comment: z.string().trim().optional(),
});

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Dinner" }];

  const { event } = data;
  if (!event) return [{ title: "Dinner" }];

  return [{ title: `Dinner - ${event.title}` }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { dinnerId } = params;

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  return { event };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { dinnerId } = params;

  invariant(typeof dinnerId === "string", "Parameter dinnerId is missing");

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  const { signupPerson, people, comment } = submission.value;

  const allSignups = [
    signupPerson,
    ...people.map((person) => {
      return {
        email: signupPerson.email,
        phone: signupPerson.phone,
        ...person,
      };
    }),
  ];

  const allSignupsPromises = allSignups.map(
    ({ name, email, phone, alternativeMenu, student, dietaryRestrictions }) => {
      return createEventResponse(
        dinnerId,
        name,
        email,
        phone,
        alternativeMenu,
        student,
        dietaryRestrictions,
        comment,
      );
    },
  );

  await Promise.all(allSignupsPromises);

  return redirectWithToast("/dinners", {
    title: "Signup complete",
    description:
      "We'll contact you if you were able to get a spot on the event.",
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
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });
  const signupPerson = fields.signupPerson.getFieldset();
  const people = fields.people.getFieldList();

  return (
    <main className="mx-auto mt-16 flex max-w-4xl grow flex-col gap-5 px-2 pb-8 pt-4">
      <DinnerView event={event} />

      <div className="my-8 border" />

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

        <ul className="flex flex-col gap-20">
          <li className="flex gap-3">
            <fieldset className="flex w-full flex-col gap-4">
              <Field
                labelProps={{ children: "Name" }}
                inputProps={{
                  ...getInputProps(signupPerson.name, { type: "text" }),
                }}
                errors={signupPerson.name.errors}
              />

              <Field
                labelProps={{ children: "Email" }}
                inputProps={{
                  ...getInputProps(signupPerson.email, { type: "email" }),
                }}
                errors={signupPerson.email.errors}
              />

              <Field
                labelProps={{ children: "Phone number" }}
                inputProps={{
                  ...getInputProps(signupPerson.phone, { type: "tel" }),
                }}
                errors={signupPerson.phone.errors}
              />

              <CheckboxField
                labelProps={{ children: "Vegan / Vegetarian" }}
                buttonProps={{
                  ...getInputProps(signupPerson.alternativeMenu, {
                    type: "checkbox",
                  }),
                }}
                errors={signupPerson.alternativeMenu.errors}
              />

              <CheckboxField
                labelProps={{ children: "Student" }}
                buttonProps={{
                  ...getInputProps(signupPerson.student, { type: "checkbox" }),
                }}
                errors={signupPerson.student.errors}
              />

              <Field
                labelProps={{ children: "Dietary restrictions" }}
                inputProps={{
                  ...getInputProps(signupPerson.dietaryRestrictions, {
                    type: "text",
                  }),
                }}
                errors={signupPerson.dietaryRestrictions.errors}
              />
            </fieldset>
          </li>
          {people.map((person, index) => {
            const { name, alternativeMenu, dietaryRestrictions, student } =
              person.getFieldset();

            return (
              <li key={person.id} className="flex gap-3">
                <fieldset className="flex w-full flex-col gap-4">
                  <Field
                    labelProps={{ children: "Name" }}
                    inputProps={{ ...getInputProps(name, { type: "text" }) }}
                    errors={name.errors}
                  />

                  <CheckboxField
                    labelProps={{ children: "Vegan / Vegetarian" }}
                    buttonProps={{
                      ...getInputProps(alternativeMenu, { type: "checkbox" }),
                    }}
                    errors={alternativeMenu.errors}
                  />

                  <CheckboxField
                    labelProps={{ children: "Student" }}
                    buttonProps={{
                      ...getInputProps(student, { type: "checkbox" }),
                    }}
                    errors={alternativeMenu.errors}
                  />

                  <Field
                    labelProps={{ children: "Dietary restrictions" }}
                    inputProps={{
                      ...getInputProps(dietaryRestrictions, { type: "text" }),
                    }}
                    errors={dietaryRestrictions.errors}
                  />

                  <Button
                    {...{
                      ...form.remove.getButtonProps({
                        name: fields.people.name,
                        index,
                      }),
                      disabled: people.length === 0,
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
            className="mt-20"
          >
            Add a friend
          </Button>
        ) : null}

        <ErrorList id={fields.people.id} errors={fields.people.errors} />

        <TextareaField
          labelProps={{ children: "Comment" }}
          textareaProps={{ ...getTextareaProps(fields.comment) }}
          errors={fields.comment.errors}
        />

        <Button type="submit">Join</Button>
      </Form>
    </main>
  );
}
