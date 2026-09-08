const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("project zoeken", async () => {
  const { matchesQuery, projectSearchText } = await import(
    "../../client/src/labels.js"
  );

  const project = {
    title: "Interne werktitel",
    saleTitle: "Guardian angel",
    saleDescription: "Handgemaakt glasfusion object",
    type: "glasfusion",
    saleStatus: "showroom",
    labels: [{ name: "Kerst", color: "#b85c38" }],
    notes: "COE96 restjes uit de bak",
  };

  it("vindt op verkooptitel, materiaal, status en label", () => {
    assert.ok(matchesQuery(project, "guardian"));
    assert.ok(matchesQuery(project, "GLASFUSION"));
    assert.ok(matchesQuery(project, "showroom"));
    assert.ok(matchesQuery(project, "kerst"));
  });

  it("eist dat alle woorden voorkomen", () => {
    assert.ok(matchesQuery(project, "guardian kerst"));
    assert.equal(matchesQuery(project, "guardian tassen"), false);
  });

  it("lege zoekterm laat alles door", () => {
    assert.ok(matchesQuery(project, ""));
    assert.ok(matchesQuery(project, "   "));
  });

  it("zoekt alleen in notities voor editors", () => {
    assert.equal(matchesQuery(project, "restjes"), false);
    assert.ok(matchesQuery(project, "restjes", { includeInternal: true }));
  });

  it("valt niet om zonder velden", () => {
    assert.equal(projectSearchText(undefined), "");
    assert.ok(matchesQuery(undefined, ""));
    assert.equal(matchesQuery(undefined, "iets"), false);
  });
});
