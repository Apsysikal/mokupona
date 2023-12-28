import {
  ActionFunctionArgs,
  unstable_composeUploadHandlers,
  unstable_createFileUploadHandler,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { Form } from "@remix-run/react";

export async function action({ request }: ActionFunctionArgs) {
  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      directory: process.env.IMAGE_UPLOAD_FOLDER,
    }),
    unstable_createMemoryUploadHandler(),
  );

  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler,
  );

  const file = formData.get("image");
  console.log(file);
}

export default function FilePage() {
  return (
    <>
      <Form method="post" encType="multipart/form-data">
        <input type="file" accept="image/*" name="image" id="image" />
        <button type="submit">Upload</button>
      </Form>
    </>
  );
}
