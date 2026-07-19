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

  // Both the signer field and the friend item carry this label; this edits
  // the signer one (first in DOM order — the friend twin's collapsed header
  // is hidden inside the collapsed friends row).
  function relabelDietaryToAllergies() {
    cy.findAllByRole("button", { name: /dietary restrictions/i })
      .first()
      .click();
    cy.findAllByDisplayValue("Dietary restrictions")
      .first()
      .clear()
      .type("Allergies");
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
      cy.findAllByRole("button", { name: /favorite dish/i })
        .first()
        .click();
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
      relabelDietaryToAllergies();
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
      relabelDietaryToAllergies();
      cy.findAllByRole("button", { name: /friends/i })
        .first()
        .click();
      cy.findByLabelText(/max per signup/i)
        .clear()
        .type("0");
      saveDinnerExpectingDetail(values.title);

      // reload shows the edited form
      cy.visitAndCheck(`/admin/dinners/${dinnerId}/edit`);
      cy.findAllByRole("button", { name: /allergies/i })
        .first()
        .click();
      cy.findByDisplayValue("Allergies").should("be.visible");
      cy.findByLabelText(/max per signup/i).should("have.value", "0");

      // the public page reflects it: relabeled field, no friends button
      cy.visitAndCheck(`/dinners/${dinnerId}`);
      cy.findAllByRole("textbox", { name: /allergies/i }).should("exist");
      cy.findByRole("button", { name: /add a friend/i }).should("not.exist");
    });
  });
});
