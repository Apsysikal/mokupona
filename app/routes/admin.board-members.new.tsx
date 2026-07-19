import { redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members.new";

import { AdminBoardMemberForm } from "~/features/board-members/admin-board-member-form";
import { MemberSchema } from "~/features/board-members/schema";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import { createBoardMember } from "~/models/board-member.server";
import { fileToImageData } from "~/models/image.server";

export async function action({ request }: Route.ActionArgs) {
  return withParsedImageForm(request, {
    fieldName: "image",
    schema: MemberSchema,
    async onSuccess({ value }) {
      const { name, position, image } = value;

      await createBoardMember({
        name,
        position,
        ...(image && { image: await fileToImageData(image) }),
      });

      return redirect("/admin/board-members/new");
    },
  });
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Create Board Member" }];
};

export default function BoardMemberNewRoute({
  actionData,
}: Route.ComponentProps) {
  const location = useLocation();

  return (
    <AdminBoardMemberForm
      key={location.key}
      lastResult={actionData}
      heading="Add a board member"
      description="This will add a new board member. Careful, information entered here will be displayed on the website."
      submitText="Add new board member"
    />
  );
}
