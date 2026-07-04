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
