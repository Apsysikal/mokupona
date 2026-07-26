import {
  FormProvider,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useMemo } from "react";
import { Form, Link } from "react-router";

import type { Route } from "./+types/dinners_.$dinnerId";

import { CheckboxField, ErrorList } from "~/components/forms";
import { RouteErrorContent } from "~/components/route-error-content";
import { BackLink, PageContainer } from "~/components/section";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  EventFactList,
  EventStory,
} from "~/features/events/components/event-view";
import { isPastEvent } from "~/features/events/event-status";
import { toEventDetailModel } from "~/features/events/view-models";
import { getViewForField, type FieldDescriptor } from "~/features/forms/fields";
import { normalizeSubmissionValues } from "~/features/forms/normalize-submission";
import { parseStoredFormSchemaOrLog } from "~/features/forms/serialization.server";
import { buildSignupSchema } from "~/features/signup-form/build-schema";
import { cn } from "~/lib/utils";
import { logger } from "~/logger.server";
import { getEventWithCurrentFormVersion } from "~/models/event.server";
import {
  createFormSubmission,
  FormVersionChangedError,
} from "~/models/form-submission.server";
import {
  getClientIPAddress,
  obscureEmail,
  requireFound,
} from "~/shared/http.server";
import { getImageUrl } from "~/shared/image";
import { withOpenGraphUrls } from "~/shared/meta";
import { getImageConfig } from "~/shared/root-data";
import { redirectWithToast } from "~/utils/toast.server";

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const { event, version } = requireFound(
    await getEventWithCurrentFormVersion(dinnerId),
  );

  return {
    event: toEventDetailModel(event),
    formFields: parseStoredFormSchemaOrLog(version),
    formVersionId: version.id,
  };
}

const FORM_CHANGED_ERROR =
  "The signup form was updated while you were filling it out. Please review your answers and submit again.";

export async function action({ params, request }: Route.ActionArgs) {
  const { dinnerId } = params;

  const { event: dinner, version } = requireFound(
    await getEventWithCurrentFormVersion(dinnerId),
  );

  if (isPastEvent(dinner.date, new Date())) {
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

  const { acceptedPrivacy: _acceptedPrivacy, ...values } = submission.value;
  const answers = normalizeSubmissionValues(formFields, values);

  const email = obscureEmail(
    typeof values.email === "string" ? values.email : "unknown@no-domain.com",
  );

  try {
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
  const tags = [
    { title: `Dinner - ${event.title}` },
    { property: "og:title", content: event.title },
    { property: "og:type", content: "website" },
  ];

  return withOpenGraphUrls(tags, {
    matches,
    imagePath: event.image
      ? getImageUrl(event.image, getImageConfig(matches))
      : undefined,
    pagePath: location.pathname,
  });
};

export default function DinnerPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { event, formFields, formVersionId } = loaderData;

  const eventIsPast = isPastEvent(new Date(event.date), new Date());
  const signupFields = eventIsPast ? null : formFields;
  const gridClasses = cn(
    "grid items-start gap-8",
    !eventIsPast && "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
  );

  return (
    <PageContainer className="grow pt-7 pb-20">
      <BackLink to="/dinners" className="mb-6">
        all dinners
      </BackLink>

      <div className={gridClasses}>
        <EventStory event={event} />

        {signupFields ? (
          <Card
            as="aside"
            id="sign-up"
            className="flex flex-col gap-4 p-5 lg:sticky lg:top-6 lg:p-7"
          >
            <EventFactList event={event} />

            <>
              <div aria-hidden className="bg-border h-px" />

              <h2 className="text-xl font-light">reserve your seat</h2>

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
          </Card>
        ) : null}
      </div>
    </PageContainer>
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
        className="flex flex-col gap-3"
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
              <span className="text-sm">
                i agree to the{" "}
                <Link to="/privacy" className="text-primary">
                  privacy policy
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

        <Button type="submit" size="lg" className="w-full">
          join this dinner
        </Button>

        <p className="text-foreground/50 text-center text-xs leading-normal">
          we&apos;ll email you to confirm if a seat is yours.
        </p>
      </Form>
    </FormProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
