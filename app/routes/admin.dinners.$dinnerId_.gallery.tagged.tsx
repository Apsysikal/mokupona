import type { SubmissionResult } from "@conform-to/react";
import { ImageIcon } from "@radix-ui/react-icons";
import { Form, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.dinners.$dinnerId_.gallery.tagged";

import { AdminEmptyState } from "~/components/admin-ui";
import { ErrorList, Field, fileFieldClassName } from "~/components/forms";
import { OptimizedImage } from "~/components/optimized-image";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { foundation } from "~/features/gallery/foundations/tagged.server";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import { MAX_GALLERY_FILES } from "~/features/images/image-upload.server";
import { getEventById } from "~/models/event.server";
import {
  addTaggedGalleryImages,
  removeTaggedGalleryImage,
} from "~/models/gallery-tagged.server";
import { requireFound } from "~/shared/http.server";
import { imageFileSchema, VALID_IMAGE_TYPES } from "~/shared/image";

// Both submissions this page makes go through one action because the upload
// is multipart: a separate delete route would have to re-parse the body
// anyway, and the remove button carries no fields of its own.
const GalleryUploadSchema = z.object({
  altText: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(500).optional(),
});

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const [dinner, images] = await Promise.all([
    getEventById(dinnerId).then(requireFound),
    foundation.listForEvent(dinnerId),
  ]);

  return { dinner: { id: dinner.id, title: dinner.title }, images };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { dinnerId } = params;
  const back = redirect(`/admin/dinners/${dinnerId}/gallery/tagged`);

  return withParsedImageForm(request, {
    fieldName: "images",
    maxFiles: MAX_GALLERY_FILES,
    schema: GalleryUploadSchema,
    async onSuccess({ value, formData }) {
      if (formData.get("intent") === "remove") {
        const imageId = formData.get("imageId");
        if (typeof imageId === "string") {
          const storageKey = await removeTaggedGalleryImage(imageId);
          // the row is gone and committed — the asset may follow
          await destroyImages([storageKey]);
        }
        return back;
      }

      const files = formData
        .getAll("images")
        .filter((entry): entry is File => entry instanceof File);

      const fileSchema = imageFileSchema();
      const errors = files.flatMap((file) => {
        const result = fileSchema.safeParse(file);
        return result.success
          ? []
          : result.error.issues.map((issue) => issue.message);
      });
      if (files.length === 0) errors.push("You must select at least one image");

      if (errors.length > 0) {
        // same shape withParsedImageForm reports its own upload failures in
        const rejected: SubmissionResult = {
          status: "error",
          error: { images: [...new Set(errors)] },
        };
        return rejected;
      }

      const stored = await Promise.all(
        files.map(async (file) => ({
          contentType: file.type,
          ...(await storeImage(file, "dinner-gallery")),
          altText: value.altText ?? null,
          caption: value.caption ?? null,
        })),
      );

      await addTaggedGalleryImages(dinnerId, stored);

      return back;
    },
  });
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return [
    {
      title: loaderData
        ? `Admin - Gallery - ${loaderData.dinner.title}`
        : "Admin - Gallery",
    },
  ];
};

export default function AdminDinnerGalleryTaggedPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { images } = loaderData;

  return (
    <div className="flex flex-col gap-8">
      <Form
        method="POST"
        encType="multipart/form-data"
        replace
        className="flex flex-col gap-6"
      >
        <Field
          labelProps={{ children: "Photos" }}
          inputProps={{
            type: "file",
            name: "images",
            multiple: true,
            accept: VALID_IMAGE_TYPES.join(","),
            className: fileFieldClassName,
          }}
          description={`Pick up to ${MAX_GALLERY_FILES} photos at a time. They are appended to the end of this dinner's gallery.`}
          errors={actionData?.error?.images}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            labelProps={{ children: "Alt text (optional)" }}
            inputProps={{ type: "text", name: "altText" }}
            description="Describes every photo in this upload. Empty falls back to the dinner title."
            errors={actionData?.error?.altText}
          />

          <Field
            labelProps={{ children: "Caption (optional)" }}
            inputProps={{ type: "text", name: "caption" }}
            description="Shown under every photo in this upload."
            errors={actionData?.error?.caption}
          />
        </div>

        <ErrorList errors={actionData?.error?.[""]} />

        <Button type="submit" className="self-start">
          Add photos
        </Button>
      </Form>

      {images.length === 0 ? (
        <AdminEmptyState
          icon={<ImageIcon className="size-6" />}
          title="No photos yet"
          description="Nothing has been tagged to this dinner. Upload the first batch above."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {images.map((image) => (
            <li key={image.id}>
              <Card className="flex h-full flex-col gap-3 overflow-hidden p-3">
                <OptimizedImage
                  image={image.image}
                  alt={image.alt}
                  width={480}
                  height={360}
                  className="rounded-md"
                />
                <p className="text-foreground/65 grow text-sm">
                  {image.caption ?? image.alt}
                </p>
                <Form method="POST" replace>
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="imageId" value={image.id} />
                  <Button
                    type="submit"
                    variant="destructive-outline"
                    size="sm"
                    className="w-full"
                  >
                    Remove
                  </Button>
                </Form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
