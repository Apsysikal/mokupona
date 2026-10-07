describe("legacy event links", () => {
  const paths = [
    "/dinners",
    "/dinners/",
    "/dinners/event-1?from=email",
    "/admin/dinners",
    "/admin/dinners/new",
    "/admin/dinners/event-1",
    "/admin/dinners/event-1/edit",
    "/admin/dinners/event-1/gallery",
    "/admin/dinners/event-1/signups",
    "/admin/dinners/event-1/signups.csv?download=1",
  ];

  for (const path of paths) {
    it(`permanently redirects ${path} without requiring login`, () => {
      cy.request({ url: path, followRedirect: false }).then((response) => {
        expect(response.status).to.equal(308);
        expect(response.headers.location).to.equal(
          path.replace("/dinners", "/events"),
        );
      });
    });
  }

  it("permanently redirects cached signup and admin forms", () => {
    for (const path of ["/dinners/event-1", "/admin/dinners/event-1/delete"]) {
      cy.request({
        method: "POST",
        url: path,
        body: { intent: "submit" },
        form: true,
        followRedirect: false,
      }).then((response) => {
        expect(response.status).to.equal(308);
        expect(response.headers.location).to.equal(
          path.replace("/dinners", "/events"),
        );
      });
    }
  });

  it("opens the events page from an old bookmark", () => {
    cy.visit("/dinners");
    cy.location("pathname").should("eq", "/events");
    cy.findByRole("heading", { name: /^events$/i }).should("be.visible");
  });
});
