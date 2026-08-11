describe("Resume Matcher - Home Page", () => {
  beforeEach(() => {
    cy.visit("http://localhost:3000");
  });

  it("loads the home page correctly", () => {
    cy.contains("Resume Matcher").should("be.visible");

    cy.contains("Resume to Active Roles").should("be.visible");

    cy.contains("Upload your resume to find matching jobs.")
      .should("be.visible");

    cy.get("#resume-upload")
      .should("be.visible")
      .and("have.attr", "accept", ".pdf,.docx,.txt");

    cy.get("#search-location")
      .should("be.visible")
      .and("have.value", "");

    cy.get("#work-mode")
      .should("be.visible")
      .and("have.value", "All");

    cy.contains("Upload & Match")
      .should("be.visible")
      .and("be.disabled");
  });

  it("allows the user to select a resume", () => {
    cy.get("#resume-upload").selectFile(
      {
        contents: Cypress.Buffer.from("fake resume content"),
        fileName: "test-resume.pdf",
        mimeType: "application/pdf",
      },
      { force: true }
    );

    cy.contains("Selected: test-resume.pdf")
      .should("be.visible");

    cy.contains("Upload & Match")
      .should("not.be.disabled");
  });

  it("allows the user to select location and work mode", () => {
    cy.get("#search-location")
      .select("India")
      .should("have.value", "India");

    cy.get("#work-mode")
      .select("Remote")
      .should("have.value", "Remote");

    cy.get("#work-mode")
      .select("Hybrid")
      .should("have.value", "Hybrid");
  });

  it("contains the main navigation links", () => {
    cy.contains("Home")
      .should("have.attr", "href", "/");

    cy.contains("About")
      .should("have.attr", "href", "/about");

    cy.contains("Connect")
      .should("have.attr", "href", "/connect");
  });
});