import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members.$userId.edit";

import { Field, fileFieldClassName } from "~/components/forms";
import { Button } from "~/components/ui/button";
import { MemberSchema } from "~/features/board-members/schema";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import {
  getBoardMemberById,
  updateBoardMember,
} from "~/models/board-member.server";
import { fileToImageData } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { VALID_IMAGE_TYPES } from "~/shared/image";

export async function loader({ params }: Route.LoaderArgs) {
  const { userId } = params;

  const boardMember = requireFound(await getBoardMemberById(userId));

  return { boardMember };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { userId } = params;

  return withParsedImageForm(request, {
    fieldName: "image",
    schema: MemberSchema,
    async onSuccess({ value }) {
      const { name, position, image } = value;

      await updateBoardMember(userId, {
        name,
        position,
        ...(image && { image: await fileToImageData(image) }),
      });

      return redirect("/admin/board-members");
    },
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Board Member - ${loaderData.boardMember.name} - Edit`
        : "Admin - Board Member - Edit",
    },
  ];
};

export default function BoardMemberEditRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const location = useLocation();

  return (
    <BoardMemberEditForm
      key={location.key}
      loaderData={loaderData}
      actionData={actionData}
    />
  );
}

function BoardMemberEditForm({
  loaderData,
  actionData,
}: {
  loaderData: Route.ComponentProps["loaderData"];
  actionData: Route.ComponentProps["actionData"];
}) {
  const { boardMember } = loaderData;
  const [form, fields] = useForm({
    lastResult: actionData,
    shouldValidate: "onBlur",
    constraint: getZodConstraint(MemberSchema),
    defaultValue: {
      name: boardMember.name,
      position: boardMember.position,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: MemberSchema });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl">
          Edit <span className="text-primary">{boardMember.name}</span>
        </h2>
        <p>
          Or{" "}
          <Link to="/admin/board-members/new" className="underline">
            add a new one
          </Link>
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

        <Button type="submit">Update {boardMember.name}</Button>
      </Form>
    </>
  );
}
