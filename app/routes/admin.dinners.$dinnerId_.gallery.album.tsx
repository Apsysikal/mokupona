import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { ImageIcon } from "@radix-ui/react-icons";
import { Form, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.dinners.$dinnerId_.gallery.album";

import { AdminEmptyState } from "~/components/admin-ui";
import {
  ErrorList,
  Field,
  FieldDescription,
  fileFieldClassName,
  TextareaField,
} from "~/components/forms";
import { OptimizedImage } from "~/components/optimized-image";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { withParsedImageForm } from "~/features/images/image-form-action.server";
import {
  destroyImages,
  storeImage,
} from "~/features/images/image-storage.server";
import { MAX_GALLERY_FILES } from "~/features/images/image-upload.server";
import { getEventById } from "~/models/event.server";
import {
  addImagesToAlbum,
  createStandaloneAlbum,
  ensureAlbumForEvent,
  getAlbumForEvent,
  getAlbums,
  removeAlbumImage,
  updateAlbum,
} from "~/models/gallery-album.server";
import { requireFound, unknownIntent } from "~/shared/http.server";
import { imageFileSchema, VALID_IMAGE_TYPES } from "~/shared/image";

// The album title is the alt-text fallback for every image in it, so it may
// not be blank the way an optional field may.
const albumTitleSchema = z
  .string({ error: "You must give the album a title" })
  .trim()
  .min(1, "You must give the album a title");

const AlbumDetailsSchema = z.object({
  intent: z.literal("save-album"),
  title: albumTitleSchema,
  description: z.string().trim().optional(),
});

const NewAlbumSchema = z.object({
  intent: z.literal("create-album"),
  title: albumTitleSchema,
  description: z.string().trim().optional(),
});

const GalleryAlbumSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("upload") }),
  z.object({ intent: z.literal("remove"), imageId: z.string() }),
  AlbumDetailsSchema,
  NewAlbumSchema,
]);

// The files are validated after the union parse rather than inside it: the
// field is multi-valued, and each file needs its own message.
const UploadedImagesSchema = z
  .array(imageFileSchema())
  .min(1, "You must select at least one image");

export async function loader({ params }: Route.LoaderArgs) {
  const dinner = requireFound(await getEventById(params.dinnerId));
  const [album, albums] = await Promise.all([
    getAlbumForEvent(dinner.id),
    getAlbums(),
  ]);

  return {
    dinner: { id: dinner.id, title: dinner.title },
    album,
    // this foundation's differentiator: albums that are about no dinner at all
    standaloneAlbums: albums.filter((candidate) => !candidate.event),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { dinnerId } = params;

  return withParsedImageForm(request, {
    fieldName: "images",
    maxFiles: MAX_GALLERY_FILES,
    schema: GalleryAlbumSchema,
    async onSuccess({ value, formData }) {
      const back = redirect(`/admin/dinners/${dinnerId}/gallery/album`);

      switch (value.intent) {
        case "upload": {
          const uploads = UploadedImagesSchema.safeParse(
            formData.getAll("images"),
          );
          if (!uploads.success) {
            // ErrorList keys by message, so repeated per-file messages collapse
            const messages = new Set(
              uploads.error.issues.map((issue) => issue.message),
            );
            const failed: SubmissionResult = {
              status: "error",
              error: { images: [...messages] },
            };
            return failed;
          }

          const dinner = requireFound(await getEventById(dinnerId));
          const images = await Promise.all(
            uploads.data.map(async (file) => ({
              contentType: file.type,
              ...(await storeImage(file, "dinner-gallery")),
            })),
          );

          const album = await ensureAlbumForEvent(dinnerId, {
            title: dinner.title,
          });
          await addImagesToAlbum(album.id, images);
          return back;
        }

        case "save-album": {
          const { title, description = "" } = value;
          // the album may not exist yet — saving the header is what creates it
          const album = await ensureAlbumForEvent(dinnerId, {
            title,
            description,
          });
          if (album.title !== title || album.description !== description) {
            await updateAlbum(album.id, { title, description });
          }
          return back;
        }

        case "create-album": {
          await createStandaloneAlbum({
            title: value.title,
            description: value.description ?? "",
          });
          return back;
        }

        case "remove": {
          const { storageKey } = await removeAlbumImage(value.imageId);
          await destroyImages([storageKey]);
          return back;
        }

        default:
          throw unknownIntent();
      }
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

export default function AdminDinnerGalleryAlbumPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { dinner, album, standaloneAlbums } = loaderData;

  // Every form on this page posts to the same action, so each one only takes
  // the result back when the submitted intent was its own.
  const resultFor = (intent: string) =>
    actionData?.initialValue?.intent === intent ? actionData : undefined;

  const [albumForm, albumFields] = useForm({
    id: "album-details",
    lastResult: resultFor("save-album"),
    shouldValidate: "onBlur",
    constraint: getZodConstraint(AlbumDetailsSchema),
    defaultValue: {
      title: album?.title ?? dinner.title,
      description: album?.description ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: AlbumDetailsSchema });
    },
  });

  const [newAlbumForm, newAlbumFields] = useForm({
    id: "new-album",
    lastResult: resultFor("create-album"),
    shouldValidate: "onBlur",
    constraint: getZodConstraint(NewAlbumSchema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: NewAlbumSchema });
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Album</h2>
          <FieldDescription>
            {album
              ? "This dinner has an album. Everything you upload below lands in it."
              : "This dinner has no album yet. Saving here creates it — so does the first upload."}
          </FieldDescription>
        </div>

        <Form
          method="POST"
          replace
          className="flex flex-col gap-4"
          {...getFormProps(albumForm)}
        >
          <input type="hidden" name="intent" value="save-album" />

          <Field
            labelProps={{ children: "Title" }}
            inputProps={{ ...getInputProps(albumFields.title, { type: "text" }) }}
            errors={albumFields.title.errors}
          />

          <TextareaField
            labelProps={{ children: "Description" }}
            textareaProps={{ ...getTextareaProps(albumFields.description) }}
            errors={albumFields.description.errors}
          />

          <div>
            <Button type="submit">
              {album ? "Save album" : "Create album"}
            </Button>
          </div>
        </Form>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Add photos</h2>
          <FieldDescription>
            {`Up to ${MAX_GALLERY_FILES} images per upload. They are appended to the end of the album.`}
          </FieldDescription>
        </div>

        <Form
          method="POST"
          encType="multipart/form-data"
          replace
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="intent" value="upload" />

          <input
            type="file"
            name="images"
            multiple
            accept={VALID_IMAGE_TYPES.join(",")}
            className={fileFieldClassName}
          />
          <ErrorList errors={actionData?.error?.images} />

          <div>
            <Button type="submit">Upload</Button>
          </div>
        </Form>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">
          In this album
          {album ? ` (${album.images.length})` : ""}
        </h2>

        {album && album.images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {album.images.map((entry) => (
              <li key={entry.image.id} className="flex flex-col gap-2">
                <OptimizedImage
                  image={entry.image}
                  width={480}
                  height={360}
                  alt={entry.altText ?? album.title}
                  className="rounded-lg"
                />
                {entry.caption ? (
                  <p className="text-foreground/65 text-sm">{entry.caption}</p>
                ) : null}
                <Form method="POST" replace>
                  <input type="hidden" name="intent" value="remove" />
                  <input
                    type="hidden"
                    name="imageId"
                    value={entry.image.id}
                  />
                  <Button type="submit" variant="destructive" size="sm">
                    Remove
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        ) : (
          <AdminEmptyState
            icon={<ImageIcon className="size-6" />}
            title="No photos yet"
            description="Upload a few images and they will show up here in album order."
          />
        )}
      </section>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Albums without a dinner</h2>
          <FieldDescription>
            Only this foundation has them: an album that documents the kitchen
            or the team belongs to no dinner and still shows up in the gallery.
          </FieldDescription>
        </div>

        {standaloneAlbums.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {standaloneAlbums.map((standalone) => (
              <li
                key={standalone.id}
                className="border-foreground/10 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{standalone.title}</span>
                <span className="text-foreground/65">
                  {standalone.imageCount === 1
                    ? "1 photo"
                    : `${standalone.imageCount} photos`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <Form
          method="POST"
          replace
          className="flex flex-col gap-4"
          {...getFormProps(newAlbumForm)}
        >
          <input type="hidden" name="intent" value="create-album" />

          <Field
            labelProps={{ children: "Title" }}
            inputProps={{
              ...getInputProps(newAlbumFields.title, { type: "text" }),
              placeholder: "kitchen life",
            }}
            errors={newAlbumFields.title.errors}
          />

          <TextareaField
            labelProps={{ children: "Description" }}
            textareaProps={{ ...getTextareaProps(newAlbumFields.description) }}
            errors={newAlbumFields.description.errors}
          />

          <div>
            <Button type="submit" variant="outline">
              Create album
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
