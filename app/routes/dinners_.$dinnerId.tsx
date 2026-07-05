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

import type { Route } from "./+types/dinners_.$dinnerId";

import { DinnerView } from "~/components/dinner-view";
import { CheckboxField, ErrorList } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { getViewForField, type FieldDescriptor } from "~/features/forms/fields";
import { normalizeSubmissionValues } from "~/features/forms/normalize-submission";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { buildSignupSchema } from "~/features/signup-form/build-schema";
import { logger } from "~/logger.server";
import { getEventById } from "~/models/event.server";
import {
  createFormSubmission,
  FormVersionChangedError,
} from "~/models/form-submission.server";
import { getCurrentFormVersionForEvent } from "~/models/form.server";
import { getClientIPAddress, getImageUrl, obscureEmail } from "~/utils/misc";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const [event, version] = await Promise.all([
    getEventById(dinnerId),
    getCurrentFormVersionForEvent(dinnerId),
  ]);

  if (!event || !version) throw new Response("Not found", { status: 404 });

  return {
    event,
    // null when the stored schema fails to parse — the signup section is
    // hidden rather than rendered wrong (design §11)
    formFields: parseStoredFormSchemaOrLog(version),
    formVersionId: version.id,
  };
}

const FORM_CHANGED_ERROR =
  "The signup form was updated while you were filling it out. Please review your answers and submit again.";

export async function action({ params, request }: Route.ActionArgs) {
  const { dinnerId } = params;

  // the action never trusts client descriptors: re-read the current version
  // from the DB and rebuild the identical schema server-side (design §6.1)
  const [dinner, version] = await Promise.all([
    getEventById(dinnerId),
    getCurrentFormVersionForEvent(dinnerId),
  ]);

  if (!dinner || !version) throw new Response("Not found", { status: 404 });
  if (dinner.date < new Date()) {
    throw new Response("Forbidden", { status: 403 });
  }

  const formFields = parseStoredFormSchemaOrLog(version);

  if (!formFields) {
    // a bug — the loader hides the signup section for an unparseable schema,
    // so no legitimate submission can arrive here
    throw new Response("Internal Server Error", { status: 500 });
  }

  const schema = buildSignupSchema(formFields);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  // the answers must be validated and stored against the version the user
  // actually saw — a schema change in between would silently strip answers
  // to removed fields
  if (formData.get("formVersionId") !== version.id) {
    logger.info("Dinner signup submitted against an outdated form version", {
      dinner: dinner.id,
      submittedVersion: formData.get("formVersionId"),
      currentVersion: version.id,
    });

    return submission.reply({ formErrors: [FORM_CHANGED_ERROR] });
  }

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

  // acceptedPrivacy is a legal control, never a stored answer (design §5);
  // normalization stores explicit false for unchecked checkboxes and [] for
  // empty lists instead of absent keys.
  const { acceptedPrivacy: _acceptedPrivacy, ...values } = submission.value;
  const answers = normalizeSubmissionValues(formFields, values);

  const email = obscureEmail(
    typeof values.email === "string" ? values.email : "unknown@no-domain.com",
  );

  try {
    // one row per party — the version the loader rendered & this action
    // re-read (design §7). The updatedAt guard rejects the write if an
    // in-place schema update raced this request.
    await createFormSubmission({
      formVersionId: version.id,
      answers,
      expectedVersionUpdatedAt: version.updatedAt,
    });
  } catch (reason) {
    if (reason instanceof FormVersionChangedError) {
      logger.info("Dinner signup raced an in-place form update", {
        dinner: dinner.id,
        formVersion: version.id,
      });

      return submission.reply({ formErrors: [FORM_CHANGED_ERROR] });
    }

    logger.error("Failed to persist dinner signup", {
      ip: getClientIPAddress(request),
      dinner: dinner.id,
      email,
      reason: reason,
    });

    return submission.reply({
      formErrors: ["Your signup could not be saved. Please try again."],
    });
  }

  logger.info("Successful submission for dinner signup", {
    ip: getClientIPAddress(request),
    dinner: dinner.id,
    email,
  });

  return redirectWithToast("/dinners", {
    title: "Signup complete",
    description:
      "We'll contact you if you were able to get a spot on the event.",
    type: "success",
  });
}

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

export default function DinnerPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { event, formFields, formVersionId } = loaderData;

  const isPastEvent = event.date < new Date();
  // formFields is null when the stored schema failed to parse — the signup
  // section (and the button jumping to it) is hidden rather than rendered
  // wrong (design §11)
  const signupFields = isPastEvent ? null : formFields;

  const JumpToFormButton = signupFields ? (
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

      {signupFields ? (
        <>
          <h2 id="sign-up" className="text-primary mt-8 text-2xl">
            Sign Up
          </h2>
          {/* keyed on the schema content: an in-place update keeps the
              version id but must still remount the form and rebuild the
              client schema */}
          <SignupForm
            key={JSON.stringify(signupFields)}
            formFields={signupFields}
            formVersionId={formVersionId}
            lastResult={actionData}
          />
        </>
      ) : null}
    </main>
  );
}

function SignupForm({
  formFields,
  formVersionId,
  lastResult,
}: {
  formFields: FieldDescriptor[];
  formVersionId: string;
  lastResult: Route.ComponentProps["actionData"];
}) {
  // any content change remounts the component (content-derived key), so the
  // memo only saves rebuilds across same-data re-renders
  const schema = useMemo(() => buildSignupSchema(formFields), [formFields]);

  const [form, fields] = useForm({
    lastResult,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  return (
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

        {/* the action verifies the submission was made against the version
            it validates and stores with */}
        <input type="hidden" name="formVersionId" value={formVersionId} />

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
