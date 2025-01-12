import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { FileUpload, parseFormData } from "@mjackson/form-data-parser";
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { Form, useActionData, useLocation } from "react-router";
import { z } from "zod";

import { Field } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import {
  fileStorage,
  getStorageKey,
} from "~/utils/dinner-image-storage.server";
import { requireUserWithRole } from "~/utils/session.server";

const MemberSchema = z.object({
  name: z
    .string({ required_error: "You must enter a name for the board member" })
    .trim(),
  position: z
    .string({
      required_error: "You must enter a position for the board member",
    })
    .trim(),
  image: z
    .instanceof(File, { message: "You must select a file" })
    .optional()
    .refine((file) => {
      if (!file) return true;
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      if (!file) return true;
      return file.size <= 1024 * 1024 * 3;
    }, "File cannot be greater than 3MB"),
});

const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const uploadHandler = async (fileUpload: FileUpload) => {
    let storageKey = getStorageKey("temporary-key");
    await fileStorage.set(storageKey, fileUpload);
    return fileStorage.get(storageKey);
  };

  const formData = await parseFormData(request, uploadHandler);

  console.log(formData);

  const submission = parseWithZod(formData, {
    schema: (intent) =>
      MemberSchema.superRefine((data) => {
        if (intent !== null) return { ...data };
      }),
  });

  console.log(submission.status);
  console.log(submission.payload);

  if (
    submission.status !== "success" &&
    submission.payload &&
    submission.payload.image
  ) {
    // Remove the uploaded file from disk.
    // It will be sent again when submitting.
    await fileStorage.remove(getStorageKey("temporary-key"));
  }

  if (submission.status !== "success" || !submission.value) {
    return submission.reply();
  }

  await prisma.boardMember.create({
    data: {
      name: submission.value.name,
      position: submission.value.position,
      ...(submission.value.image && {
        image: {
          create: {
            contentType: submission.value.image.type,
            blob: Buffer.from(await submission.value.image.arrayBuffer()),
          },
        },
      }),
    },
  });

  return redirect("/admin/board-members/new");
}

export default function BoardMemberNewRoute() {
  const location = useLocation();
  const lastSubmission = useActionData<typeof action>();
  const [form, fields] = useForm({
    // This id makes sure to clear out the form when redirecting to the same page
    lastResult: lastSubmission,
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
          className="flex flex-col gap-3"
        />

        <Field
          labelProps={{ children: "Position" }}
          inputProps={{ ...getInputProps(fields.position, { type: "text" }) }}
          errors={fields.position.errors}
          className="flex flex-col gap-3"
        />

        <Field
          labelProps={{ children: "Photo" }}
          inputProps={{
            ...getInputProps(fields.image, { type: "file" }),
            tabIndex: 0,
            accept: validImageTypes.join(","),
            className: "file:text-foreground",
          }}
          errors={fields.image.errors}
          className="flex flex-col gap-3"
        />

        <Button type="submit">Add new board member</Button>
      </Form>
    </>
  );
}
