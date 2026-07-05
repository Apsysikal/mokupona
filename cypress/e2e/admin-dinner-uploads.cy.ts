import {
  dinnerFormValues,
  FILE_TOO_LARGE_ERROR,
  fillDinnerForm,
  getDinnerIdFromPathname,
  getFirstAddressId,
  runUploadDbCommand,
  submitMultipartRequest,
  UPLOAD_HANDLER_LIMIT_BYTES,
  uploadDinnerCover,
  uploadFileInput,
  VALID_UPLOAD_FIXTURE_PATH,
  type DinnerRecord,
  ZOD_LIMIT_BYTES,
} from "../support/upload-test-utils";

type DinnerCleanup = {
  id: string;
  extraImageIds?: string[];
};

describe("admin dinner uploads", () => {
  let dinnersToCleanup: DinnerCleanup[];

  beforeEach(() => {
    dinnersToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      dinnersToCleanup.forEach(({ id, extraImageIds }) => {
        runUploadDbCommand("delete-dinner", { id, extraImageIds });
      });
    });
  });

  it("creates a dinner with a valid uploaded cover", () => {
    const values = dinnerFormValues("new-success");

    cy.visitAndCheck("/admin/dinners/new");
    fillDinnerForm(values);
    uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);
    cy.findByRole("button", { name: /save dinner/i }).click();

    cy.findByRole("heading", { name: values.title }).should("be.visible");

    cy.location("pathname")
      .should("match", /\/admin\/dinners\/[^/.]+$/)
      .then((pathname) => {
        const dinnerId = getDinnerIdFromPathname(pathname);
        dinnersToCleanup.push({ id: dinnerId });

        runUploadDbCommand<DinnerRecord>("get-dinner", { id: dinnerId }).then(
          (dinner) => {
            expect(dinner.title).to.equal(values.title);
            expect(dinner.imageId).to.be.a("string").and.not.be.empty;
          },
        );
      });
  });

  it("shows a validation error when the uploaded cover is larger than the Zod limit", () => {
    const values = dinnerFormValues("new-zod-error");

    cy.visitAndCheck("/admin/dinners/new");
    fillDinnerForm(values);
    uploadDinnerCover(
      uploadFileInput(ZOD_LIMIT_BYTES + 1, { fileName: "zod-too-large.jpg" }),
    );
    cy.findByRole("button", { name: /save dinner/i }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.location("pathname").should("eq", "/admin/dinners/new");
  });

  it("returns a server-side error when the uploaded cover exceeds the upload handler limit", () => {
    const values = dinnerFormValues("new-handler-error");

    cy.visitAndCheck("/admin/dinners/new");
    getFirstAddressId().then((addressId) => {
      submitMultipartRequest({
        action: "/admin/dinners/new",
        fields: {
          ...values,
          addressId,
        },
        fileFieldName: "cover",
        file: {
          size: UPLOAD_HANDLER_LIMIT_BYTES + 1,
          name: "handler-too-large.jpg",
        },
      }).then((response) => {
        expect(response.status).to.not.equal(500);
        expect(response.body).to.include(FILE_TOO_LARGE_ERROR);
      });
    });
  });

  it("updates non-file fields without overriding the existing dinner image", () => {
    runUploadDbCommand<DinnerRecord>("create-dinner", {
      title: "Dinner edit keep image",
      description: "Original dinner description",
    }).then((dinner) => {
      dinnersToCleanup.push({ id: dinner.id });

      const updatedTitle = "Dinner edit keep image updated";

      cy.visitAndCheck(`/admin/dinners/${dinner.id}/edit`);
      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      cy.findByRole("button", { name: /save dinner/i }).click();
      cy.location("pathname").should("eq", `/admin/dinners/${dinner.id}`);

      runUploadDbCommand<DinnerRecord>("get-dinner", { id: dinner.id }).then(
        (updatedDinner) => {
          expect(updatedDinner.title).to.equal(updatedTitle);
          expect(updatedDinner.imageId).to.equal(dinner.imageId);
        },
      );
    });
  });

  it("replaces the dinner image when a new cover is uploaded during edit", () => {
    runUploadDbCommand<DinnerRecord>("create-dinner", {
      title: "Dinner edit replace image",
      description: "Original dinner description",
    }).then((dinner) => {
      const cleanup = { id: dinner.id } as DinnerCleanup;
      dinnersToCleanup.push(cleanup);
      const updatedTitle = "Dinner edit replace image updated";

      cy.visitAndCheck(`/admin/dinners/${dinner.id}/edit`);
      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);
      cy.findByRole("button", { name: /save dinner/i }).click();
      cy.location("pathname").should("eq", `/admin/dinners/${dinner.id}`);

      runUploadDbCommand<DinnerRecord>("get-dinner", { id: dinner.id }).then(
        (updatedDinner) => {
          expect(updatedDinner.title).to.equal(updatedTitle);
          expect(updatedDinner.imageId).to.not.equal(dinner.imageId);
          cleanup.extraImageIds = [dinner.imageId];
        },
      );
    });
  });

  it("shows a validation error on dinner edit when the uploaded cover is larger than the Zod limit", () => {
    runUploadDbCommand<DinnerRecord>("create-dinner", {
      title: "Dinner edit zod error",
    }).then((dinner) => {
      dinnersToCleanup.push({ id: dinner.id });

      cy.visitAndCheck(`/admin/dinners/${dinner.id}/edit`);
      uploadDinnerCover(
        uploadFileInput(ZOD_LIMIT_BYTES + 1, { fileName: "zod-too-large.jpg" }),
      );
      cy.findByRole("button", { name: /save dinner/i }).click();

      cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
      cy.location("pathname").should("eq", `/admin/dinners/${dinner.id}/edit`);
    });
  });

  it("returns a server-side error on dinner edit when the uploaded cover exceeds the upload handler limit", () => {
    runUploadDbCommand<DinnerRecord>("create-dinner", {
      title: "Dinner edit handler error",
    }).then((dinner) => {
      dinnersToCleanup.push({ id: dinner.id });

      cy.visitAndCheck(`/admin/dinners/${dinner.id}/edit`);
      submitMultipartRequest({
        action: `/admin/dinners/${dinner.id}/edit`,
        fields: {
          title: dinner.title,
          description: dinner.description,
          menuDescription: dinner.menuDescription ?? "",
          donationDescription: dinner.donationDescription ?? "",
          date: dinner.date.slice(0, 16),
          slots: String(dinner.slots),
          price: String(dinner.price),
          discounts: dinner.discounts ?? "",
          addressId: dinner.addressId,
        },
        fileFieldName: "cover",
        file: {
          size: UPLOAD_HANDLER_LIMIT_BYTES + 1,
          name: "handler-too-large.jpg",
        },
      }).then((response) => {
        expect(response.status).to.not.equal(500);
        expect(response.body).to.include(FILE_TOO_LARGE_ERROR);
      });
    });
  });
});
