import type { SubmissionResult } from "@conform-to/react";
import { ImageIcon } from "@radix-ui/react-icons";
import { Form, NavLink, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.dinners.$dinnerId_.gallery";

import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { Field, fileFieldClassName } from "~/components/forms";
import { OptimizedImage } from "~/components/optimized-image";
import { RouteErrorContent } from "~/components/route-error-content";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import { getEventById } from "~/models/event.server";
import {
  createGalleryImagesForEvent,
  getGalleryEntriesForEventWithReuse,
  getLinkableImages,
  linkExistingImagesToEvent,
  removeGalleryEntry,
} from "~/models/gallery.server";
import { requireFound, unknownIntent } from "~/shared/http.server";
import {
  imageFileSchema,
  MAX_GALLERY_FILES,
  VALID_IMAGE_TYPES,
} from "~/shared/image";

// The files are validated one by one against imageFileSchema() below, so the
// schema only owns the batch's own fields.
const GalleryUploadSchema = z.object({
  intent: z.literal("upload"),
  caption: z.string().trim().optional(),
});

export async function loader({ params }: Route.LoaderArgs) {
  const { dinnerId } = params;

  const [dinner, entries, linkable] = await Promise.all([
    getEventById(dinnerId).then(requireFound),
    getGalleryEntriesForEventWithReuse(dinnerId),
    getLinkableImages(dinnerId),
  ]);

  return {
    dinner: { id: dinner.id, title: dinner.title },
    entries,
    linkable,
    // the file input's hint; the constant itself is server-only
    maxFiles: MAX_GALLERY_FILES,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { dinnerId } = params;
  const galleryPath = `/admin/dinners/${dinnerId}/gallery`;

  // before any upload is stored: a dinner deleted in another tab must yield
  // a 404, not stranded provider assets
  await getEventById(dinnerId).then(requireFound);

  // The upload arrives as multipart and has to stream through the image
  // parser before any field is readable; link and remove are plain posts, so
  // their intent is read straight off the parsed body.
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return withParsedImageForm(request, {
      fieldName: "images",
      schema: GalleryUploadSchema,
      maxFiles: MAX_GALLERY_FILES,
      async onSuccess({ value, formData }) {
        const files = formData
          .getAll("images")
          .filter(
            (entry): entry is File => entry instanceof File && entry.size > 0,
          );

        const fileSchema = imageFileSchema();
        const errors = files.flatMap((file) => {
          const result = fileSchema.safeParse(file);
          return result.success
            ? []
            : result.error.issues.map((issue) => issue.message);
        });
        if (files.length === 0) errors.push("Choose at least one image");

        if (errors.length > 0) {
          const failed: SubmissionResult = {
            status: "error",
            error: { images: [...new Set(errors)] },
          };
          return failed;
        }

        const stored = await Promise.all(
          files.map(async (file) => ({
            contentType: file.type,
            caption: value.caption || null,
            ...(await storeImage(file, "dinner-gallery")),
          })),
        );

        await createGalleryImagesForEvent(dinnerId, stored);

        return redirect(galleryPath);
      },
    });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "link") {
    const imageIds = formData
      .getAll("imageId")
      .filter((value): value is string => typeof value === "string");

    await linkExistingImagesToEvent(dinnerId, imageIds);

    return redirect(galleryPath);
  }

  if (intent === "remove") {
    const entryId = formData.get("entryId");

    if (typeof entryId === "string") {
      const removed = await removeGalleryEntry(dinnerId, entryId);
      // the image survives an unlink while anything still references it;
      // only the last unlink hands back a key to destroy, bytes last
      if (removed?.deletedStorageKey) {
        await destroyImages([removed.deletedStorageKey]);
      }
    }

    return redirect(galleryPath);
  }

  throw unknownIntent();
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: loaderData
      ? `Admin - Gallery - ${loaderData.dinner.title}`
      : "Admin - Gallery",
  },
];

export default function AdminDinnerGalleryPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { dinner, entries, linkable, maxFiles } = loaderData;

  return (
    <div className="animate-page-in flex flex-col gap-5">
      <AdminPageHeader
        eyebrow={dinner.title}
        title="Gallery"
        subtitle="The photos hanging in this dinner's gallery. Images stay reusable — the same photo can hang in several dinners, each with its own caption."
        actions={
          <Button variant="outline" asChild>
            <NavLink to={`/admin/dinners/${dinner.id}`}>Back to dinner</NavLink>
          </Button>
        }
      />

      <div className="flex flex-col gap-10">
        <section>
          <h2 className="text-xl font-semibold">Add photos</h2>
          <p className="text-foreground/65 mt-1 text-sm">
            Uploads land in this dinner&apos;s gallery. The image itself stays
            ownerless, so you can hang it in another dinner later.
          </p>

          <Form
            method="POST"
            encType="multipart/form-data"
            replace
            className="mt-4 flex flex-col gap-4"
          >
            <input type="hidden" name="intent" value="upload" />

            <Field
              labelProps={{ children: "Photos" }}
              inputProps={{
                name: "images",
                type: "file",
                multiple: true,
                tabIndex: 0,
                accept: VALID_IMAGE_TYPES.join(","),
                className: fileFieldClassName,
              }}
              description={`Up to ${maxFiles} images at a time.`}
              errors={actionData?.error?.images}
            />

            <Field
              labelProps={{ children: "Caption (optional)" }}
              inputProps={{ name: "caption", type: "text" }}
              description="Applies to every photo in this upload. Captions live on the link, not on the image, so the same photo can read differently under another dinner."
              errors={actionData?.error?.caption}
            />

            <Button type="submit" className="self-start">
              Upload to this dinner
            </Button>
          </Form>
        </section>

        <section>
          <h2 className="text-xl font-semibold">
            In this gallery{" "}
            <span className="text-foreground/50 font-normal">
              ({entries.length})
            </span>
          </h2>

          {entries.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyState
                icon={<ImageIcon className="size-6" />}
                title="No photos yet"
                description="Upload a few, or reuse an image from another dinner below."
              />
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Card className="flex h-full flex-col overflow-hidden">
                    <OptimizedImage
                      image={entry.image}
                      width={480}
                      height={320}
                      alt={entry.altText ?? dinner.title}
                    />
                    <div className="flex grow flex-col gap-3 p-4">
                      <p className="text-sm">
                        {entry.caption ?? (
                          <span className="text-foreground/50">No caption</span>
                        )}
                      </p>

                      {entry.sharedWith.length > 0 ? (
                        <Badge variant="info" pill className="self-start">
                          Also in{" "}
                          {entry.sharedWith.map((e) => e.title).join(", ")}
                        </Badge>
                      ) : null}

                      <Form method="POST" replace className="mt-auto">
                        <input type="hidden" name="intent" value="remove" />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <Button
                          type="submit"
                          variant="destructive-outline"
                          size="sm"
                        >
                          Remove from this dinner
                        </Button>
                      </Form>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold">Reuse an existing image</h2>
          <p className="text-foreground/65 mt-1 text-sm">
            Photos already uploaded elsewhere. Adding one here does not move it
            — it hangs in both galleries, and removing it from either leaves
            the other untouched.
          </p>

          {linkable.length === 0 ? (
            <p className="text-foreground/50 mt-4 text-sm">
              Nothing to reuse yet.
            </p>
          ) : (
            <Form method="POST" replace className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="intent" value="link" />

              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {linkable.map(({ image, altText, usedIn }) => (
                  <li key={image.id}>
                    <Card
                      as="label"
                      interactive
                      className="flex h-full cursor-pointer flex-col overflow-hidden"
                    >
                      <OptimizedImage
                        image={image}
                        width={320}
                        height={240}
                        alt={altText ?? ""}
                      />
                      <div className="flex grow items-start gap-2 p-3">
                        <Checkbox
                          name="imageId"
                          value={image.id}
                          className="mt-0.5"
                        />
                        <span className="text-foreground/65 text-xs">
                          {usedIn.length > 0
                            ? `Already in ${usedIn.map((e) => e.title).join(", ")}`
                            : "Not used by any dinner"}
                        </span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>

              <Button type="submit" variant="outline" className="self-start">
                Add selected to this dinner
              </Button>
            </Form>
          )}
        </section>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorContent error={error} />;
}
