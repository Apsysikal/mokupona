import { faker } from "@faker-js/faker";

describe("smoke tests", () => {
  afterEach(() => {
    cy.cleanupUser();
  });

  it("should allow you to register and login", () => {
    const loginForm = {
      email: `${faker.internet.userName()}@example.com`,
      password: faker.internet.password(),
    };

    cy.then(() => ({ email: loginForm.email })).as("user");

    cy.visitAndCheck("/");

    cy.findByRole("link", { name: /login/i }).click();
    cy.findByRole("link", { name: /sign up/i }).click();

    cy.findByRole("textbox", { name: /email/i }).type(loginForm.email);
    cy.findAllByLabelText(/password/i)
      .first()
      .type(loginForm.password);
    cy.findAllByLabelText(/password/i)
      .last()
      .type(loginForm.password);
    cy.findByLabelText(/agree to privacy policy/i).click();
    cy.findByRole("button", { name: /create account/i }).click();

    // cy.findByRole("button", { name: loginForm.email }).click();
    cy.findByRole("button", { name: /logout/i }).click();
    cy.findByRole("link", { name: /login/i });
  });

  it("should allow you to join a dinner", () => {
    const testCredentials = {
      name: faker.person.fullName(),
      email: `${faker.internet.userName()}@example.com`,
    };

    cy.login();
    cy.visitAndCheck("/");

    cy.findByRole("link", { name: /join a dinner/i }).click();
    cy.location("pathname").should("equal", "/dinners");
    cy.findAllByRole("link", { name: /read more/i }).first().click();

    cy.findByRole("textbox", { name: /name/i }).type(testCredentials.name);
    cy.findByRole("textbox", { name: /email/i }).type(testCredentials.email);
    cy.findByLabelText(/agree to privacy policy/i).click();
    cy.findByRole("button", { name: /join/i }).click();
  });
});
