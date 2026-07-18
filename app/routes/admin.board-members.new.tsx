import {
  getFormProps,
  getInputProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members.new";

import { Field, fileFieldClassName } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { MemberSchema } from "~/features/board-members/schema";
import { parseImageFormData } from "~/features/uploads/image-upload.server";
import { createBoardMember } from "~/models/board-member.server";
import { fileToImageData } from "~/models/image.server";
import { VALID_IMAGE_TYPES } from "~/shared/image";

export async function action({ request }: Route.ActionArgs) {
  const uploadResult = await parseImageFormData(request, "image");

  if (!uploadResult.success) {
    // folded into the conform result so actionData has a single shape
    return {
      status: "error",
      error: { image: [uploadResult.uploadError] },
    } satisfies SubmissionResult;
  }

  // Every exit below — validation failure (the file is sent again on
  // resubmit), success, or a thrown error — is done with the staged temp
  // file, so one idempotent discard in `finally` covers them all.
  try {
    const submission = parseWithZod(uploadResult.formData, {
      schema: MemberSchema,
    });

    if (submission.status !== "success" || !submission.value) {
      return submission.reply();
    }

    const { name, position, image } = submission.value;

    await createBoardMember({
      name,
      position,
      ...(image && { image: await fileToImageData(image) }),
    });

    return redirect("/admin/board-members/new");
  } finally {
    await uploadResult.discardImage();
  }
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Board Member" }];
};

export default function BoardMemberNewRoute({
  actionData,
}: Route.ComponentProps) {
  const location = useLocation();

  return <BoardMemberForm key={location.key} actionData={actionData} />;
}

function BoardMemberForm({
  actionData,
}: {
  actionData: Route.ComponentProps["actionData"];
}) {
  const [form, fields] = useForm({
    lastResult: actionData,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(MemberSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: MemberSchema });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl">Add a board member</h2>
        <p>
          This will add a new board member. Careful, information entered here
          will be displayed on the website.
        </p>
      </div>

      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="mt-6 flex flex-col gap-6"
        {...getFormProps(form)}
      >
        <Field
          labelProps={{ children: "Name" }}
          inputProps={{ ...getInputProps(fields.name, { type: "text" }) }}
          errors={fields.name.errors}
        />

        <Field
          labelProps={{ children: "Position" }}
          inputProps={{ ...getInputProps(fields.position, { type: "text" }) }}
          errors={fields.position.errors}
        />

        <Field
          labelProps={{ children: "Photo" }}
          inputProps={{
            ...getInputProps(fields.image, { type: "file" }),
            tabIndex: 0,
            accept: VALID_IMAGE_TYPES.join(","),
            className: fileFieldClassName,
          }}
          errors={fields.image.errors}
        />

        <Button type="submit">Add new board member</Button>
      </Form>
    </>
  );
}
