import {
  acceptPrivacyAndJoin,
  createDinnerViaAdminForm,
  dinnerFormValues,
  fillSignupContact,
  runUploadDbCommand,
  saveDinnerAndCaptureId,
  uniqueSuffix,
} from "../support/upload-test-utils";

describe("admin signup form builder", () => {
  let dinnersToCleanup: string[];

  beforeEach(() => {
    dinnersToCleanup = [];
    cy.loginAsRole("moderator");
  });

  afterEach(() => {
    cy.then(() => {
      dinnersToCleanup.forEach((id) => {
        runUploadDbCommand("delete-dinner", { id });
      });
    });
  });

  // A row header announces as "<label> <type> · <linked phrase>", so the two
  // copies of a linked question differ only in that phrase.
  const RESTRICTIONS = /dietary restrictions/i;
  const LINKED_RESTRICTIONS = /dietary restrictions.*linked/i;
  const FRIEND_RESTRICTIONS = /dietary restrictions.*linked to the signer/i;
  const FRIENDS_CARD = /^friends group/i;

  // Row bodies stay collapsed until their header is clicked; every field and
  // action button goes through here. Rows inside the collapsed friends card
  // are display:none, so they are invisible to the role queries until it is
  // opened.
  function openRow(name: RegExp) {
    cy.findAllByRole("button", { name }).first().click();
  }

  function withinRow(name: RegExp, run: () => void) {
    cy.findAllByRole("button", { name }).first().closest("li").within(run);
  }

  function openLastRow(name: RegExp) {
    cy.findAllByRole("button", { name }).last().click();
  }

  function withinLastRow(name: RegExp, run: () => void) {
    cy.findAllByRole("button", { name }).last().closest("li").within(run);
  }

  function relabelSignerRestrictions(label: string) {
    openRow(RESTRICTIONS);
    withinRow(RESTRICTIONS, () => {
      cy.findByLabelText(/^label$/i)
        .clear()
        .type(label);
    });
  }

  function saveDinnerExpectingDetail(title: string) {
    cy.findByRole("button", { name: /save dinner/i }).click();
    cy.findByRole("heading", { name: title }).should("be.visible");
  }

  it("authors a custom field that round-trips signup → admin table → CSV", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-${suffix}`);
    const signerName = `Builder Signer ${suffix}`;

    createDinnerViaAdminForm(values);

    // add a custom signer question; the field key derives from the label
    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Favorite dish")
      .blur();
    cy.findAllByLabelText(/^field key$/i)
      .last()
      .should("have.value", "favorite_dish");

    // and a select question with an options editor
    cy.findByRole("button", { name: /^add field$/i }).click();
    cy.findAllByLabelText(/^type$/i)
      .last()
      .select("select");
    cy.findAllByLabelText(/^label$/i)
      .last()
      .type("Menu choice")
      .blur();
    cy.findByLabelText(/options \(one per line\)/i).type("Meat\nVegan");

    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      // builder round-trip: the edit screen shows the authored field again
      // (stored rows load collapsed — expand via the row header first)
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      openRow(/favorite dish/i);
      cy.findByDisplayValue("Favorite dish").should("be.visible");
      cy.findByDisplayValue("favorite_dish").should("be.visible");

      // the public signup page renders the custom question
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      fillSignupContact({
        name: signerName,
        email: `builder-${suffix}@example.com`,
      });
      cy.findByRole("textbox", { name: /favorite dish/i }).type("Ramen");
      cy.findByRole("combobox", { name: /menu choice/i }).select("Vegan");
      acceptPrivacyAndJoin();

      // the answer reaches the admin table and the CSV column union
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
      cy.findByText(signerName);

      cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then((response) => {
        expect(response.body).to.include("Favorite dish");
        expect(response.body).to.include("Ramen");
        expect(response.body).to.include("Menu choice");
        expect(response.body).to.include("Vegan");
        expect(response.body).to.include(signerName);
      });
    });
  });

  it("versions a submitted form and exports mixed legacy + multi-version rows", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-versions-${suffix}`);
    const legacyName = `Legacy Guest ${suffix}`;
    const v1Signer = `V1 Signer ${suffix}`;
    const v1Friend = `V1 Friend ${suffix}`;
    const v2Signer = `V2 Signer ${suffix}`;

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      // legacy rows can't be written through the app anymore
      runUploadDbCommand("create-legacy-response", {
        eventId: dinnerId,
        name: legacyName,
      });

      // v1 signup with a friend
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      fillSignupContact({
        name: v1Signer,
        email: `v1-${suffix}@example.com`,
      });
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /^name$/i })
        .should("have.length", 2)
        .last()
        .type(v1Friend);
      acceptPrivacyAndJoin();

      // with submissions, existing field keys are locked and edits fork v2
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      cy.findAllByLabelText(/field key \(locked/i).should(
        "have.length.greaterThan",
        0,
      );
      relabelSignerRestrictions("Allergies");
      saveDinnerExpectingDetail(values.title);

      // v2 signup (solo) against the renamed field
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      fillSignupContact({
        name: v2Signer,
        email: `v2-${suffix}@example.com`,
      });
      cy.findAllByRole("textbox", { name: /allergies/i })
        .first()
        .type("pollen");
      acceptPrivacyAndJoin();

      // the roster groups each source into one party row — the v1 friend
      // isn't named, they bump the signer's party size; the CSV below
      // stays one row per person
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
      cy.findByText(legacyName);
      cy.findByText(v1Signer)
        .closest("tr")
        .within(() => {
          cy.findByText("2");
        });
      cy.findByText(v2Signer);

      cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then((response) => {
        expect(response.body).to.include("Allergies");
        expect(response.body).to.include(legacyName);
        expect(response.body).to.include(v1Signer);
        expect(response.body).to.include(v1Friend);
        expect(response.body).to.include(v2Signer);
        expect(response.body).to.include("pollen");
      });
    });
  });

  it("edits a form and shows the change after reload", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-edit-${suffix}`);

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      // relabel a default field and disable friends
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      relabelSignerRestrictions("Allergies");
      openRow(FRIENDS_CARD);
      cy.findByLabelText(/max per signup/i)
        .clear()
        .type("0");
      saveDinnerExpectingDetail(values.title);

      // reload shows the edited form
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      openRow(/allergies/i);
      withinRow(/allergies/i, () => {
        cy.findByLabelText(/^label$/i).should("have.value", "Allergies");
      });
      openRow(FRIENDS_CARD);
      cy.findByLabelText(/max per signup/i).should("have.value", "0");

      // the public page reflects it: relabeled field, no friends button
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      cy.findAllByRole("textbox", { name: /allergies/i }).should("exist");
      cy.findByRole("button", { name: /add a friend/i }).should("not.exist");
    });
  });

  it("mirrors the signer's wording onto the friend's row as it is typed", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-mirror-${suffix}`);

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      relabelSignerRestrictions("Allergies");

      // no save in between: the friend's copy follows the keystrokes
      openRow(FRIENDS_CARD);
      openRow(/allergies.*linked to the signer/i);
      withinRow(/allergies.*linked to the signer/i, () => {
        // cy.contains compiles a regex into a selector string, which cannot
        // carry the copy's curly quotes — match plainly, assert on the text
        cy.contains("Mirrors the signer")
          .should("be.visible")
          .and("contain.text", "signer’s “Allergies”");
        cy.findAllByDisplayValue("Allergies")
          .filter(":visible")
          .should("have.length", 1)
          .and("be.disabled");
      });

      saveDinnerExpectingDetail(values.title);

      // both questions ask the new wording on the public page
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      cy.findAllByRole("textbox", { name: /allergies/i }).should(
        "have.length",
        1,
      );
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /allergies/i }).should(
        "have.length",
        2,
      );
    });
  });

  it("unlinks a pair from the friend's row and links it back", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-unlink-${suffix}`);

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      openRow(FRIENDS_CARD);
      openLastRow(FRIEND_RESTRICTIONS);
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.findByRole("button", { name: /^unlink$/i }).click();
      });

      // the trigger opened a dialog instead of submitting the builder
      cy.location("pathname").should(
        "equal",
        `/admin/dinners/${dinnerId}/edit`,
      );
      cy.get("#unlink-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.findByRole("heading", {
            name: /unlink from the signer’s question\?/i,
          }).should("be.visible");
          // keep the offered key
          cy.findByLabelText(/new field key/i).should(
            "have.value",
            "restrictions_2",
          );
          cy.findByRole("button", { name: /^unlink$/i }).click();
        });

      // two ordinary questions now: the friend's row is editable and the
      // linked prose is gone from both headers
      cy.findByDisplayValue("restrictions_2").should("be.enabled");
      cy.findAllByRole("button", { name: LINKED_RESTRICTIONS }).should(
        "not.exist",
      );

      saveDinnerExpectingDetail(values.title);

      // the split survived the save
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      openRow(FRIENDS_CARD);
      cy.findAllByRole("button", { name: RESTRICTIONS }).should(
        "have.length",
        2,
      );
      openLastRow(RESTRICTIONS);
      withinLastRow(RESTRICTIONS, () => {
        cy.findByLabelText(/^field key$/i).should(
          "have.value",
          "restrictions_2",
        );
      });

      // and the signer's row offers the way back
      openRow(RESTRICTIONS);
      withinRow(RESTRICTIONS, () => {
        cy.findByRole("button", { name: /link to friends/i }).click();
      });
      cy.get("#link-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.findByRole("heading", {
            name: /also ask each friend this question\?/i,
          }).should("be.visible");
          // the friend's question matches by label, so it is offered as a
          // mirror target beside the "add a new row" default
          cy.contains("Mirror onto")
            .should("contain.text", "“Dietary restrictions”")
            .click();
          cy.findByRole("button", { name: /link to friends/i }).click();
        });

      // every linked friend row carries a mirror sentence, so scope the
      // assertion to the pair under test
      cy.findAllByRole("button", { name: FRIEND_RESTRICTIONS }).should(
        "have.length",
        1,
      );
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.contains("Mirrors the signer").should(
          "contain.text",
          "signer’s “Dietary restrictions”",
        );
      });
    });
  });

  it("warns about collected answers when unlinking an answered pair", () => {
    const suffix = uniqueSuffix();
    const values = dinnerFormValues(`builder-answers-${suffix}`);
    const signerName = `Answered Signer ${suffix}`;
    const friendName = `Answered Friend ${suffix}`;

    createDinnerViaAdminForm(values);
    saveDinnerAndCaptureId(values.title).then((dinnerId) => {
      dinnersToCleanup.push(dinnerId);

      // one signup answers the shared question on both sides
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      fillSignupContact({
        name: signerName,
        email: `answers-${suffix}@example.com`,
      });
      cy.findByRole("button", { name: /add a friend/i }).click();
      cy.findAllByRole("textbox", { name: /^name$/i })
        .should("have.length", 2)
        .last()
        .type(friendName);
      cy.findAllByRole("textbox", { name: RESTRICTIONS })
        .should("have.length", 2)
        .each(($field) => {
          cy.wrap($field).type("nuts");
        });
      acceptPrivacyAndJoin();

      // the pair is locked by the submissions, but unlinking stays on offer
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      cy.findAllByLabelText(/field key \(locked/i).should(
        "have.length.greaterThan",
        0,
      );
      openRow(FRIENDS_CARD);
      openLastRow(FRIEND_RESTRICTIONS);
      withinLastRow(FRIEND_RESTRICTIONS, () => {
        cy.findByRole("button", { name: /^unlink$/i }).click();
      });

      cy.get("#unlink-dialog-restrictions")
        .should("be.visible")
        .within(() => {
          cy.contains(/2 answers were collected under the shared key/i).should(
            "be.visible",
          );
          cy.contains("strong", "restrictions").should("be.visible");
        });
    });
  });
});
