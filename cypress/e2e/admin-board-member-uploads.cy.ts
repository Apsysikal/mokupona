import {
  boardMemberFormValues,
  expectHandlerLimitRejection,
  FILE_TOO_LARGE_ERROR,
  oversizedZodUpload,
  runUploadDbCommand,
  VALID_UPLOAD_FIXTURE_PATH,
  type BoardMemberRecord,
} from "../support/upload-test-utils";

describe("admin board member uploads", () => {
  let boardMemberIdsToCleanup: string[];

  function fillNewBoardMemberForm(values: { name: string; position: string }) {
    cy.visitAndCheck("/admin/board-members/new");
    cy.findByLabelText(/name/i).type(values.name);
    cy.findByLabelText(/position/i).type(values.position);
  }

  function selectPhoto(file: string | Cypress.FileReferenceObject) {
    cy.findByLabelText(/photo/i).selectFile(file, { force: true });
  }

  function createBoardMember(record: { name: string; position?: string }) {
    return runUploadDbCommand<BoardMemberRecord>(
      "create-board-member",
      record,
    ).then((boardMember) => {
      boardMemberIdsToCleanup.push(boardMember.id);
      return cy.wrap(boardMember);
    });
  }

  function submitUpdateAndFetch(id: string) {
    cy.findByRole("button", { name: /update /i }).click();
    cy.location("pathname").should("eq", "/admin/board-members");

    return runUploadDbCommand<BoardMemberRecord>("get-board-member", { id });
  }

  function submitExpectingZodLimitError(buttonName: RegExp, pathname: string) {
    selectPhoto(oversizedZodUpload());
    cy.findByRole("button", { name: buttonName }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.location("pathname").should("eq", pathname);
  }

  beforeEach(() => {
    boardMemberIdsToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      boardMemberIdsToCleanup.forEach((id) => {
        runUploadDbCommand("delete-board-member", { id });
      });
    });
  });

  it("creates a board member with a valid uploaded photo", () => {
    const values = boardMemberFormValues("new-success");

    fillNewBoardMemberForm(values);
    selectPhoto(VALID_UPLOAD_FIXTURE_PATH);
    cy.findByRole("button", { name: /add new board member/i }).click();
    cy.location("pathname").should("eq", "/admin/board-members/new");

    runUploadDbCommand<BoardMemberRecord>("get-board-member-by-name", {
      name: values.name,
    }).then((boardMember) => {
      expect(boardMember).to.not.equal(null);

      if (!boardMember) {
        throw new Error("Board member was not created");
      }

      boardMemberIdsToCleanup.push(boardMember.id);
      expect(boardMember.position).to.equal(values.position);
      expect(boardMember.imageId).to.be.a("string").and.not.be.empty;
      expect(boardMember.imageCount).to.equal(1);
    });
  });

  it("previews the selected photo and lets it be removed before saving", () => {
    const values = boardMemberFormValues("preview-remove");

    fillNewBoardMemberForm(values);
    selectPhoto(VALID_UPLOAD_FIXTURE_PATH);

    cy.findByRole("list", { name: /selected images/i })
      .findByRole("button", { name: /remove upload-image\.jpg/i })
      .should("be.visible");

    cy.findByRole("button", { name: /remove upload-image\.jpg/i }).click();
    cy.findByRole("list", { name: /selected images/i }).should("not.exist");

    cy.findByRole("button", { name: /add new board member/i }).click();
    cy.location("pathname").should("eq", "/admin/board-members/new");

    runUploadDbCommand<BoardMemberRecord | null>("get-board-member-by-name", {
      name: values.name,
    }).then((boardMember) => {
      if (!boardMember) {
        throw new Error("Board member was not created");
      }

      boardMemberIdsToCleanup.push(boardMember.id);
      expect(boardMember.imageId).to.equal(null);
    });
  });

  it("flags the previewed photo that failed validation", () => {
    const values = boardMemberFormValues("preview-error");

    fillNewBoardMemberForm(values);
    selectPhoto(oversizedZodUpload());
    cy.findByRole("button", { name: /add new board member/i }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.findByRole("list", { name: /selected images/i })
      .find("li")
      .should("have.attr", "data-invalid");
  });

  it("shows a validation error when the uploaded photo is larger than the Zod limit", () => {
    const values = boardMemberFormValues("new-zod-error");

    fillNewBoardMemberForm(values);
    submitExpectingZodLimitError(
      /add new board member/i,
      "/admin/board-members/new",
    );
  });

  it("returns a server-side error when the uploaded photo exceeds the upload handler limit", () => {
    const values = boardMemberFormValues("new-handler-error");

    cy.visitAndCheck("/admin/board-members/new");
    expectHandlerLimitRejection({
      action: "/admin/board-members/new",
      fields: values,
      fileFieldName: "image",
    });
  });

  it("updates non-file fields without overriding the existing board member image", () => {
    createBoardMember({
      name: "Board member edit keep image",
      position: "Original position",
    }).then((boardMember) => {
      const updatedName = "Board member edit keep image updated";

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      cy.findByLabelText(/name/i).clear().type(updatedName);
      submitUpdateAndFetch(boardMember.id).then((updatedBoardMember) => {
        expect(updatedBoardMember.name).to.equal(updatedName);
        expect(updatedBoardMember.imageId).to.equal(boardMember.imageId);
        expect(updatedBoardMember.imageCount).to.equal(1);
      });
    });
  });

  it("replaces the board member image when a new photo is uploaded during edit", () => {
    createBoardMember({
      name: "Board member edit replace image",
      position: "Original position",
    }).then((boardMember) => {
      const updatedPosition = "Updated position";

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      cy.findByLabelText(/position/i)
        .clear()
        .type(updatedPosition);
      selectPhoto(VALID_UPLOAD_FIXTURE_PATH);
      submitUpdateAndFetch(boardMember.id).then((updatedBoardMember) => {
        expect(updatedBoardMember.position).to.equal(updatedPosition);
        expect(updatedBoardMember.imageId).to.not.equal(boardMember.imageId);
        expect(updatedBoardMember.imageCount).to.equal(1);
      });
    });
  });

  it("shows a validation error on board member edit when the uploaded photo is larger than the Zod limit", () => {
    createBoardMember({ name: "Board member edit zod error" }).then(
      (boardMember) => {
        cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
        submitExpectingZodLimitError(
          /update /i,
          `/admin/board-members/${boardMember.id}/edit`,
        );
      },
    );
  });

  it("returns a server-side error on board member edit when the uploaded photo exceeds the upload handler limit", () => {
    createBoardMember({ name: "Board member edit handler error" }).then(
      (boardMember) => {
        cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
        expectHandlerLimitRejection({
          action: `/admin/board-members/${boardMember.id}/edit`,
          fields: {
            name: boardMember.name,
            position: boardMember.position,
          },
          fileFieldName: "image",
        });
      },
    );
  });
});
