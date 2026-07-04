import { faker } from "@faker-js/faker";

describe("dinner signup", () => {
  function visitFirstDinner() {
    cy.visitAndCheck("/dinners");
    cy.findAllByRole("link", { name: /read more/i })
      .first()
      .click();
  }

  function fillSigner() {
    cy.findAllByRole("textbox", { name: /^name$/i })
      .first()
      .type(faker.person.fullName());
    cy.findByRole("textbox", { name: /email/i }).type(
      `${faker.internet.username()}@example.com`,
    );
    cy.findByRole("textbox", { name: /phone number/i }).type(
      faker.phone.number({ style: "international" }),
    );
  }

  it("allows signing up for a dinner", () => {
    visitFirstDinner();

    fillSigner();
    cy.findByLabelText(/agree to privacy policy/i).click();
    cy.findByRole("button", { name: /join/i }).click();

    cy.location("pathname").should("equal", "/dinners");
    cy.findByText(/signup complete/i);
  });

  it("allows signing up with a friend", () => {
    visitFirstDinner();

    fillSigner();
    cy.findByRole("button", { name: /add a friend/i }).click();
    cy.findAllByRole("textbox", { name: /^name$/i })
      .should("have.length", 2)
      .last()
      .type(faker.person.fullName());
    cy.findByLabelText(/agree to privacy policy/i).click();
    cy.findByRole("button", { name: /join/i }).click();

    cy.location("pathname").should("equal", "/dinners");
    cy.findByText(/signup complete/i);
  });

  it("shows a new signup in the admin table and CSV export", () => {
    const suffix = `${Date.now()}`;
    const signerName = `Cypress Signer ${suffix}`;
    const friendName = `Cypress Friend ${suffix}`;

    visitFirstDinner();
    // wait for the client-side navigation to commit before capturing the id
    cy.location("pathname")
      .should("match", /^\/dinners\/[^/]+$/)
      .then((pathname) => {
        const dinnerId = pathname.split("/").pop();

        cy.findAllByRole("textbox", { name: /^name$/i })
          .first()
          .type(signerName);
        cy.findByRole("textbox", { name: /email/i }).type(
          `signer-${suffix}@example.com`,
        );
        cy.findByRole("textbox", { name: /phone number/i }).type(
          faker.phone.number({ style: "international" }),
        );
        cy.findByRole("button", { name: /add a friend/i }).click();
        cy.findAllByRole("textbox", { name: /^name$/i })
          .should("have.length", 2)
          .last()
          .type(friendName);
        cy.findByLabelText(/agree to privacy policy/i).click();
        cy.findByRole("button", { name: /join/i }).click();
        cy.location("pathname").should("equal", "/dinners");
        cy.findByText(/signup complete/i);

        cy.loginAsRole("moderator");

        // both party members appear in the admin table, one row per person
        cy.visitAndCheck(`/admin/dinners/${dinnerId}/signups`);
        cy.findByText(signerName);
        cy.findByText(friendName);

        cy.request(`/admin/dinners/${dinnerId}/signups.csv`).then(
          (response) => {
            expect(response.body).to.include(signerName);
            expect(response.body).to.include(friendName);
          },
        );
      });
  });

  it("shows validation errors for an empty submission", () => {
    visitFirstDinner();

    cy.findByRole("button", { name: /join/i }).click();

    cy.findByText("Name is required");
    cy.findByText("Email is required");
    cy.findByText("Phone number is required");
    cy.findByText("You must agree to signup");
    cy.location("pathname").should("not.equal", "/dinners");
  });
});
