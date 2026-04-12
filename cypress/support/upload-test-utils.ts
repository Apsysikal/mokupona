export const ZOD_LIMIT_BYTES = 1024 * 1024 * 3;
export const UPLOAD_HANDLER_LIMIT_BYTES = 1024 * 1024 * 4;
export const FILE_TOO_LARGE_ERROR = "File cannot be greater than 3MB";
export const VALID_UPLOAD_FIXTURE_PATH = "cypress/fixtures/upload-image.jpg";

export interface DinnerRecord {
  id: string;
  title: string;
  description: string;
  menuDescription: string | null;
  donationDescription: string | null;
  date: string;
  slots: number;
  price: number;
  discounts: string | null;
  addressId: string;
  imageId: string;
}

export interface BoardMemberRecord {
  id: string;
  name: string;
  position: string;
  imageId: string | null;
  imageCount: number;
}

type UploadDbAction =
  | "create-dinner"
  | "get-dinner"
  | "delete-dinner"
  | "delete-image"
  | "delete-page"
  | "create-board-member"
  | "get-board-member"
  | "get-board-member-by-name"
  | "delete-board-member";

export function uniqueSuffix() {
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function dinnerFormValues(suffix: string) {
  return {
    title: `Cypress dinner ${suffix}`,
    description: `Dinner description ${suffix}`,
    menuDescription: `Dinner menu ${suffix}`,
    donationDescription: `Dinner donation ${suffix}`,
    date: "2035-02-01T18:30",
    slots: "12",
    price: "28",
    discounts: `Dinner discount ${suffix}`,
  };
}

export function boardMemberFormValues(suffix: string) {
  return {
    name: `Cypress board ${suffix}`,
    position: `Cypress position ${suffix}`,
  };
}

export function uploadFileInput(
  size: number,
  {
    fileName = "upload.jpg",
    mimeType = "image/jpeg",
  }: {
    fileName?: string;
    mimeType?: string;
  } = {},
) {
  return {
    contents: Cypress.Buffer.alloc(size, 1),
    fileName,
    mimeType,
    lastModified: Date.now(),
  };
}

export function runUploadDbCommand<T>(
  action: UploadDbAction,
  payload?: unknown,
) {
  const encodedPayload = payload
    ? Cypress.Buffer.from(JSON.stringify(payload)).toString("base64")
    : "";
  const payloadArg = encodedPayload ? ` "${encodedPayload}"` : "";

  return cy
    .exec(
      `npx tsx ./cypress/support/upload-test-records.ts "${action}"${payloadArg}`,
    )
    .then(({ stdout }) => JSON.parse(stdout) as T) as Cypress.Chainable<T>;
}

export function submitMultipartRequest({
  action,
  fields,
  fileFieldName,
  file,
}: {
  action: string;
  fields: Record<string, string>;
  fileFieldName: string;
  file: {
    size: number;
    name?: string;
    type?: string;
  };
}) {
  return cy.window().then(async (win) => {
    const formData = new win.FormData();

    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const fileContents = new Uint8Array(file.size);
    const formFile = new win.File([fileContents], file.name ?? "upload.jpg", {
      type: file.type ?? "image/jpeg",
    });

    formData.append(fileFieldName, formFile);

    const response = await win.fetch(action, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    return {
      status: response.status,
      redirected: response.redirected,
      url: response.url,
      body: await response.text(),
    };
  });
}
