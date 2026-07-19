import { Link, redirect, useLocation } from "react-router";

import type { Route } from "./+types/admin.board-members.$userId.edit";

import { AdminBoardMemberForm } from "~/features/board-members/admin-board-member-form";
import { MemberSchema } from "~/features/board-members/schema";
import { withParsedImageForm } from "~/features/uploads/image-form-action.server";
import {
  getBoardMemberById,
  updateBoardMember,
} from "~/models/board-member.server";
import { fileToImageData } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";

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
    <AdminBoardMemberForm
      key={location.key}
      lastResult={actionData}
      defaultValue={{
        name: loaderData.boardMember.name,
        position: loaderData.boardMember.position,
      }}
      heading={
        <>
          Edit{" "}
          <span className="text-primary">{loaderData.boardMember.name}</span>
        </>
      }
      description={
        <>
          Or{" "}
          <Link to="/admin/board-members/new" className="underline">
            add a new one
          </Link>
        </>
      }
      submitText={`Update ${loaderData.boardMember.name}`}
    />
  );
}
