import {
  boardMemberFormValues,
  FILE_TOO_LARGE_ERROR,
  runUploadDbCommand,
  submitMultipartRequest,
  UPLOAD_HANDLER_LIMIT_BYTES,
  uploadFileInput,
  VALID_UPLOAD_FIXTURE_PATH,
  type BoardMemberRecord,
  ZOD_LIMIT_BYTES,
} from "../support/upload-test-utils";

describe("admin board member uploads", () => {
  let boardMemberIdsToCleanup: string[];

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

    cy.visitAndCheck("/admin/board-members/new");
    cy.findByLabelText(/name/i).type(values.name);
    cy.findByLabelText(/position/i).type(values.position);
    cy.findByLabelText(/photo/i).selectFile(VALID_UPLOAD_FIXTURE_PATH, {
      force: true,
    });
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

  it("shows a validation error when the uploaded photo is larger than the Zod limit", () => {
    const values = boardMemberFormValues("new-zod-error");

    cy.visitAndCheck("/admin/board-members/new");
    cy.findByLabelText(/name/i).type(values.name);
    cy.findByLabelText(/position/i).type(values.position);
    cy.findByLabelText(/photo/i).selectFile(
      uploadFileInput(ZOD_LIMIT_BYTES + 1, { fileName: "zod-too-large.jpg" }),
      { force: true },
    );
    cy.findByRole("button", { name: /add new board member/i }).click();

    cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
    cy.location("pathname").should("eq", "/admin/board-members/new");
  });

  it("returns a server-side error when the uploaded photo exceeds the upload handler limit", () => {
    const values = boardMemberFormValues("new-handler-error");

    cy.visitAndCheck("/admin/board-members/new");
    submitMultipartRequest({
      action: "/admin/board-members/new",
      fields: values,
      fileFieldName: "image",
      file: {
        size: UPLOAD_HANDLER_LIMIT_BYTES + 1,
        name: "handler-too-large.jpg",
      },
    }).then((response) => {
      expect(response.status).to.not.equal(500);
      expect(response.body).to.include(FILE_TOO_LARGE_ERROR);
    });
  });

  it("updates non-file fields without overriding the existing board member image", () => {
    runUploadDbCommand<BoardMemberRecord>("create-board-member", {
      name: "Board member edit keep image",
      position: "Original position",
    }).then((boardMember) => {
      boardMemberIdsToCleanup.push(boardMember.id);
      const updatedName = "Board member edit keep image updated";

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      cy.findByLabelText(/name/i).clear().type(updatedName);
      cy.findByRole("button", { name: /update /i }).click();
      cy.location("pathname").should("eq", "/admin/board-members/new");

      runUploadDbCommand<BoardMemberRecord>("get-board-member", {
        id: boardMember.id,
      }).then((updatedBoardMember) => {
        expect(updatedBoardMember.name).to.equal(updatedName);
        expect(updatedBoardMember.imageId).to.equal(boardMember.imageId);
        expect(updatedBoardMember.imageCount).to.equal(1);
      });
    });
  });

  it("replaces the board member image when a new photo is uploaded during edit", () => {
    runUploadDbCommand<BoardMemberRecord>("create-board-member", {
      name: "Board member edit replace image",
      position: "Original position",
    }).then((boardMember) => {
      boardMemberIdsToCleanup.push(boardMember.id);
      const updatedPosition = "Updated position";

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      cy.findByLabelText(/position/i)
        .clear()
        .type(updatedPosition);
      cy.findByLabelText(/photo/i).selectFile(VALID_UPLOAD_FIXTURE_PATH, {
        force: true,
      });
      cy.findByRole("button", { name: /update /i }).click();
      cy.location("pathname").should("eq", "/admin/board-members/new");

      runUploadDbCommand<BoardMemberRecord>("get-board-member", {
        id: boardMember.id,
      }).then((updatedBoardMember) => {
        expect(updatedBoardMember.position).to.equal(updatedPosition);
        expect(updatedBoardMember.imageId).to.not.equal(boardMember.imageId);
        expect(updatedBoardMember.imageCount).to.equal(1);
      });
    });
  });

  it("shows a validation error on board member edit when the uploaded photo is larger than the Zod limit", () => {
    runUploadDbCommand<BoardMemberRecord>("create-board-member", {
      name: "Board member edit zod error",
    }).then((boardMember) => {
      boardMemberIdsToCleanup.push(boardMember.id);

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      cy.findByLabelText(/photo/i).selectFile(
        uploadFileInput(ZOD_LIMIT_BYTES + 1, { fileName: "zod-too-large.jpg" }),
        { force: true },
      );
      cy.findByRole("button", { name: /update /i }).click();

      cy.findByText(FILE_TOO_LARGE_ERROR).should("be.visible");
      cy.location("pathname").should(
        "eq",
        `/admin/board-members/${boardMember.id}/edit`,
      );
    });
  });

  it("returns a server-side error on board member edit when the uploaded photo exceeds the upload handler limit", () => {
    runUploadDbCommand<BoardMemberRecord>("create-board-member", {
      name: "Board member edit handler error",
    }).then((boardMember) => {
      boardMemberIdsToCleanup.push(boardMember.id);

      cy.visitAndCheck(`/admin/board-members/${boardMember.id}/edit`);
      submitMultipartRequest({
        action: `/admin/board-members/${boardMember.id}/edit`,
        fields: {
          name: boardMember.name,
          position: boardMember.position,
        },
        fileFieldName: "image",
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
