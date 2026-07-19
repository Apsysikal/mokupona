import {
  createDinnerViaAdminForm,
  dinnerFormValues,
  expectHandlerLimitRejection,
  FILE_TOO_LARGE_ERROR,
  fillDinnerForm,
  getFirstAddressId,
  oversizedZodUpload,
  runUploadDbCommand,
  saveDinnerAndCaptureId,
  uploadDinnerCover,
  VALID_UPLOAD_FIXTURE_PATH,
  type DinnerRecord,
  type ImageRecord,
} from "../support/upload-test-utils";

describe("admin dinner uploads", () => {
  let dinnerIdsToCleanup: string[];

  function createDinnerAndOpenEdit(record: {
    title: string;
    description?: string;
  }) {
    return runUploadDbCommand<DinnerRecord>("create-dinner", record).then(
      (dinner) => {
        dinnerIdsToCleanup.push(dinner.id);

        cy.visitAndCheck(`/admin/dinners/${dinner.id}/edit`);
        return cy.wrap(dinner);
      },
    );
  }

  function saveEditAndFetch(id: string) {
    cy.findByRole("button", { name: /save dinner/i }).click();
    cy.location("pathname").should("eq", `/admin/dinners/${id}`);

    return runUploadDbCommand<DinnerRecord>("get-dinner", { id });
  }

  function submitOversizedCoverExpectingError(pathname: string) {
    uploadDinnerCover(oversizedZodUpload());
    cy.findByRole("button", { name: /save dinner/i }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.location("pathname").should("eq", pathname);
  }

  beforeEach(() => {
    dinnerIdsToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      dinnerIdsToCleanup.forEach((id) => {
        runUploadDbCommand("delete-dinner", { id });
      });
    });
  });

  it("creates a dinner with a valid uploaded cover", () => {
    const values = dinnerFormValues("new-success");

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnerIdsToCleanup.push(dinnerId);

      runUploadDbCommand<DinnerRecord>("get-dinner", { id: dinnerId }).then(
        (dinner) => {
          expect(dinner.title).to.equal(values.title);
          expect(dinner.imageId).to.be.a("string").and.not.be.empty;
          // uploads persist provider scalars now, never blob bytes
          expect(dinner.imageStorageKey).to.be.a("string").and.not.be.empty;
        },
      );
    });
  });

  it("shows a validation error when the uploaded cover is larger than the Zod limit", () => {
    const values = dinnerFormValues("new-zod-error");

    cy.visitAndCheck("/admin/dinners/new");
    fillDinnerForm(values);
    submitOversizedCoverExpectingError("/admin/dinners/new");
  });

  it("returns a server-side error when the uploaded cover exceeds the upload handler limit", () => {
    const values = dinnerFormValues("new-handler-error");

    cy.visitAndCheck("/admin/dinners/new");
    getFirstAddressId().then((addressId) => {
      expectHandlerLimitRejection({
        action: "/admin/dinners/new",
        fields: {
          ...values,
          addressId,
        },
        fileFieldName: "cover",
      });
    });
  });

  it("updates non-file fields without overriding the existing dinner image", () => {
    createDinnerAndOpenEdit({
      title: "Dinner edit keep image",
      description: "Original dinner description",
    }).then((dinner) => {
      const updatedTitle = "Dinner edit keep image updated";

      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      saveEditAndFetch(dinner.id).then((updatedDinner) => {
        expect(updatedDinner.title).to.equal(updatedTitle);
        expect(updatedDinner.imageId).to.equal(dinner.imageId);
      });
    });
  });

  it("replaces the dinner image when a new cover is uploaded during edit", () => {
    createDinnerAndOpenEdit({
      title: "Dinner edit replace image",
      description: "Original dinner description",
    }).then((dinner) => {
      const updatedTitle = "Dinner edit replace image updated";

      cy.findByLabelText(/^title$/i)
        .clear()
        .type(updatedTitle);
      uploadDinnerCover(VALID_UPLOAD_FIXTURE_PATH);
      saveEditAndFetch(dinner.id).then((updatedDinner) => {
        expect(updatedDinner.title).to.equal(updatedTitle);
        expect(updatedDinner.imageId).to.not.equal(dinner.imageId);
        // updateEvent deletes the replaced cover row in-transaction — no
        // orphan row survives, so no defensive extra-image cleanup either
        runUploadDbCommand<ImageRecord | null>("get-image", {
          id: dinner.imageId,
        }).then((oldImage) => {
          expect(oldImage).to.equal(null);
        });
      });
    });
  });

  it("shows a validation error on dinner edit when the uploaded cover is larger than the Zod limit", () => {
    createDinnerAndOpenEdit({ title: "Dinner edit zod error" }).then(
      (dinner) => {
        submitOversizedCoverExpectingError(`/admin/dinners/${dinner.id}/edit`);
      },
    );
  });

  it("returns a server-side error on dinner edit when the uploaded cover exceeds the upload handler limit", () => {
    createDinnerAndOpenEdit({ title: "Dinner edit handler error" }).then(
      (dinner) => {
        expectHandlerLimitRejection({
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
        });
      },
    );
  });
});
