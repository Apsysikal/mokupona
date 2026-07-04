import {
  FormProvider,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { useMemo } from "react";
import { Form, isRouteErrorResponse, Link } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/dinners_.$dinnerId";

import { DinnerView } from "~/components/dinner-view";
import { CheckboxField, ErrorList } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { getViewForField } from "~/features/forms/fields";
import { buildSignupSchema } from "~/features/signup-form/build-schema";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";
import { logger } from "~/logger.server";
import { createEventResponses } from "~/models/event-response.server";
import { getEventById } from "~/models/event.server";
import { getClientIPAddress, getImageUrl, obscureEmail } from "~/utils/misc";
import { redirectWithToast } from "~/utils/toast.server";

// Temporary Phase-0 adapter (removed in Phase 1c): re-reads the validated
// answers of DEFAULT_FORM with their concrete types so they can be fanned out
// onto the legacy per-attendee EventResponse writes.
const SignupAnswersSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  vegetarian: z.boolean().default(false),
  student: z.boolean().default(false),
  restrictions: z.string().optional(),
  friends: z.array(
    z.object({
      name: z.string(),
      vegetarian: z.boolean().default(false),
      student: z.boolean().default(false),
      restrictions: z.string().optional(),
    }),
  ),
  comment: z.string().optional(),
});

// DEFAULT_FORM is static in Phase 0, so the server schema is too; the
// component still derives its schema from loader data (the Phase 1 shape).
const signupSchema = buildSignupSchema(DEFAULT_FORM);

export const meta: Route.MetaFunction = ({ loaderData, matches, location }) => {
  const metaTags = [
    {
      title: "Dinner",
    },
  ];

  if (!loaderData) return metaTags;

  const { event } = loaderData;
  const domainUrl = matches[0].loaderData.domainUrl;

  const dinnerUrl = new URL(location.pathname, domainUrl);
  const imageUrl = new URL(getImageUrl(event.imageId), domainUrl);

  return [
    { title: `Dinner - ${event.title}` },
    { property: "og:title", content: event.title },
    { property: "og:type", content: "website" },
    { property: "og:image", content: imageUrl },
    { property: "og:url", content: dinnerUrl },
  ];
};

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const event = await getEventById(dinnerId);

  if (!event) throw new Response("Not found", { status: 404 });

  // Phase 0: every event still uses the static default form. Phase 1 replaces
  // this with the event's current FormVersion from the DB.
  return { event, formFields: DEFAULT_FORM };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { dinnerId } = params;

  const dinner = await getEventById(dinnerId);

  if (!dinner) throw new Response("Not found", { status: 404 });
  if (dinner.date < new Date()) {
    throw new Response("Forbidden", { status: 400 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: signupSchema });

  if (submission.status !== "success" || !submission.value) {
    logger.info("Failed submission for dinner signup", {
      ip: getClientIPAddress(request),
      dinner: dinner.id,
      email: obscureEmail(
        submission.payload["email"]?.toString() ?? "unknown@no-domain.com",
      ),
      reason: submission.status === "error" ? submission.error : null,
    });

    return submission.reply();
  }

  // acceptedPrivacy is stripped here: the adapter schema doesn't know it, and
  // zod objects drop unknown keys.
  const answers = SignupAnswersSchema.safeParse(submission.value);

  if (!answers.success) {
    // Bug guard: we control both schemas, so a mismatch means SignupAnswersSchema
    // drifted from DEFAULT_FORM. Fail soft with a form error instead of a 500.
    logger.error("Signup adapter schema drifted from DEFAULT_FORM", {
      dinner: dinner.id,
      error: answers.error,
    });

    return submission.reply({
      formErrors: ["Something went wrong. Please try again later."],
    });
  }

  const {
    name,
    email,
    phone,
    vegetarian,
    student,
    restrictions,
    friends,
    comment,
  } = answers.data;

  const allSignups = [
    { name, vegetarian, student, restrictions },
    // friends inherit the signer's contact info, as today
    ...friends,
  ];

  try {
    // one transaction: a partial write would turn the retry we prompt for
    // below into duplicate attendees
    await createEventResponses(
      dinnerId,
      allSignups.map((person) => ({ ...person, email, phone, comment })),
    );
  } catch (reason) {
    logger.error("Failed to persist dinner signup", {
      ip: getClientIPAddress(request),
      dinner: dinner.id,
      email: obscureEmail(email),
      reason: reason,
    });

    return submission.reply({
      formErrors: ["Your signup could not be saved. Please try again."],
    });
  }

  logger.info("Successful submission for dinner signup", {
    ip: getClientIPAddress(request),
    dinner: dinner.id,
    email: obscureEmail(email),
  });

  return redirectWithToast("/dinners", {
    title: "Signup complete",
    description:
      "We'll contact you if you were able to get a spot on the event.",
    type: "success",
  });
}

export default function DinnerPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { event, formFields } = loaderData;
  const lastResult = actionData;

  const schema = useMemo(() => buildSignupSchema(formFields), [formFields]);

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  const isPastEvent = event.date < new Date();

  const JumpToFormButton = !isPastEvent ? (
    <Button variant="outline" asChild>
      <div className="flex items-center gap-4">
        <Link to="#sign-up">Go straight to sign-up</Link>
        <ArrowRightIcon className="size-5 rotate-90" />
      </div>
    </Button>
  ) : null;

  return (
    <main className="mx-auto mt-16 flex max-w-4xl grow flex-col gap-5 px-2 pt-4 pb-8">
      <DinnerView event={event} topButton={JumpToFormButton} />

      {isPastEvent ? null : (
        <>
          <h2 id="sign-up" className="text-primary mt-8 text-2xl">
            Sign Up
          </h2>
          <FormProvider context={form.context}>
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

              {formFields.map((descriptor) => {
                const FieldView = getViewForField(descriptor);

                return (
                  <FieldView
                    key={descriptor.data.name}
                    fieldConfig={descriptor}
                    fieldMetadata={fields[descriptor.data.name]}
                  />
                );
              })}

              <CheckboxField
                labelProps={{
                  children: (
                    <span>
                      Agree to{" "}
                      <Link to="/privacy" className="text-primary">
                        Privacy Policy
                      </Link>
                    </span>
                  ),
                }}
                buttonProps={{
                  ...getInputProps(fields.acceptedPrivacy, {
                    type: "checkbox",
                  }),
                }}
                errors={fields.acceptedPrivacy.errors}
              />

              <ErrorList id={form.errorId} errors={form.errors} />

              <Button type="submit">Join</Button>
            </Form>
          </FormProvider>
        </>
      )}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">Error</h1>
        <p>{error.message}</p>
      </div>
    );
  } else {
    return (
      <div className="mx-auto mt-16 flex flex-col items-center gap-2 pt-4">
        <h1 className="font-semibold">Unknown Error</h1>
      </div>
    );
  }
}
