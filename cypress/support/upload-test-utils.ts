import { faker } from "@faker-js/faker";

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
  imageStorageKey: string | null;
}

export interface BoardMemberRecord {
  id: string;
  name: string;
  position: string;
  imageId: string | null;
  imageStorageKey: string | null;
  imageCount: number;
}

export interface ImageRecord {
  id: string;
  contentType: string;
  storageKey: string | null;
}

type UploadDbAction =
  | "create-dinner"
  | "get-dinner"
  | "delete-dinner"
  | "get-image"
  | "delete-image"
  | "create-legacy-response"
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

/** A file just over the Zod schema limit — rejected client-side with a form error. */
export function oversizedZodUpload() {
  return uploadFileInput(ZOD_LIMIT_BYTES + 1, {
    fileName: "zod-too-large.jpg",
  });
}

export function runUploadDbCommand<T>(
  action: UploadDbAction,
  payload?: unknown,
) {
  const encodedPayload = payload
    ? Cypress.Buffer.from(JSON.stringify(payload)).toString("base64")
    : "";
  const payloadArg = encodedPayload ? ` "${encodedPayload}"` : "";

  // This script's stdout is its return channel, but importing app modules emits
  // the boot lines onto the same descriptor. Without silencing them JSON.parse
  // receives the pretty-printed log first.
  return cy
    .exec(
      `npx cross-env LOG_LEVEL=silent tsx ./cypress/support/upload-test-records.ts "${action}"${payloadArg}`,
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

/**
 * Posts the form with a file just over the upload handler limit and asserts
 * the server rejects it gracefully (no 500, form error in the response).
 */
export function expectHandlerLimitRejection({
  action,
  fields,
  fileFieldName,
}: {
  action: string;
  fields: Record<string, string>;
  fileFieldName: string;
}) {
  return submitMultipartRequest({
    action,
    fields,
    fileFieldName,
    file: {
      size: UPLOAD_HANDLER_LIMIT_BYTES + 1,
      name: "handler-too-large.jpg",
    },
  }).then((response) => {
    expect(response.status).to.not.equal(500);
    expect(response.body).to.include(FILE_TOO_LARGE_ERROR);
  });
}

export function getFirstAddressId() {
  return cy
    .findByLabelText(/^address$/i)
    .find("option")
    .first()
    .then(($option) => {
      const addressId = $option.val();

      if (typeof addressId !== "string") {
        throw new Error("Address value missing from dinner form");
      }

      return addressId;
    });
}

export function selectFirstAddress() {
  getFirstAddressId().then((addressId) => {
    cy.findByLabelText(/^address$/i).select(addressId);
  });
}

export function fillDinnerForm(values: ReturnType<typeof dinnerFormValues>) {
  cy.findByLabelText(/^title$/i)
    .clear()
    .type(values.title);
  // the friends card in the signup-form builder carries a Description of its
  // own further down the page; the dinner's is the first one
  cy.findAllByLabelText(/^description$/i)
    .first()
    .clear()
    .type(values.description);
  cy.findByLabelText(/^menu$/i)
    .clear()
    .type(values.menuDescription);
  cy.findByLabelText(/^donation$/i)
    .clear()
    .type(values.donationDescription);
  cy.findByLabelText(/^date$/i)
    .clear()
    .type(values.date);
  cy.findByLabelText(/^slots$/i)
    .clear()
    .type(values.slots);
  cy.findByLabelText(/^price$/i)
    .clear()
    .type(values.price);
  cy.findByLabelText(/^discounts$/i)
    .clear()
    .type(values.discounts);
  selectFirstAddress();
}

export function uploadDinnerCover(file: string | Cypress.FileReferenceObject) {
  cy.findByLabelText(/^cover$/i).selectFile(file, { force: true });
}

/** Visits the new-dinner form and fills it with a valid cover attached. */
export function createDinnerViaAdminForm(
  values: ReturnType<typeof dinnerFormValues>,
) {
  cy.visitAndCheck("/admin/dinners/new");
  fillDinnerForm(values);
  uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);
}

/**
 * Saves the dinner form, waits for the detail page, and yields the created
 * dinner's id (so the caller can register cleanup).
 */
export function saveDinnerAndCaptureId(
  title: string,
): Cypress.Chainable<string> {
  cy.findByRole("button", { name: /save dinner/i }).click();
  cy.findByRole("heading", { name: title }).should("be.visible");

  return cy
    .location("pathname")
    .should("match", /\/admin\/dinners\/[^/.]+$/)
    .then((pathname) => getDinnerIdFromPathname(pathname));
}

export function getDinnerIdFromPathname(pathname: string) {
  const dinnerId = pathname.match(
    /\/admin\/dinners\/([^/.]+)(?:\.data)?$/,
  )?.[1];

  if (!dinnerId) {
    throw new Error(`Unable to determine dinner id from pathname: ${pathname}`);
  }

  return dinnerId;
}

// Signup-page interactions shared by the specs that submit real signups.
export function fillSignupContact({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  cy.findAllByRole("textbox", { name: /^name$/i })
    .first()
    .type(name);
  cy.findByRole("textbox", { name: /email/i }).type(email);
  cy.findByRole("textbox", { name: /phone number/i }).type(
    faker.phone.number({ style: "international" }),
  );
}

export function acceptPrivacyAndJoin() {
  cy.findByLabelText(/agree to the privacy policy/i).click();
  cy.findByRole("button", { name: /join/i }).click();
  cy.location("pathname").should("equal", "/dinners");
  cy.findByText(/signup complete/i);
}
