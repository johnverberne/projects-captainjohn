const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLabelName,
  nameKey,
  normalizeColor,
  parseLabelsInput,
} = require("../../server/services/labels");

describe("labels service", () => {
  it("normaliseert naam en nameKey", () => {
    assert.equal(normalizeLabelName("  Cadeau  "), "Cadeau");
    assert.equal(nameKey("  Cadeau  "), "cadeau");
  });

  it("normaliseert hex-kleuren", () => {
    assert.equal(normalizeColor("#B85"), "#bb8855");
    assert.equal(normalizeColor("#b85c38"), "#b85c38");
    assert.equal(normalizeColor("rood"), "#2a5554");
  });

  it("parst labels uit JSON en dedupe’t op naam", () => {
    const labels = parseLabelsInput(
      JSON.stringify([
        { name: "A", color: "#b85c38" },
        { name: "a", color: "#1a3a3a" },
        { name: "B", color: "#2f6b4f" },
      ])
    );
    assert.equal(labels.length, 2);
    assert.equal(labels[0].name, "A");
    assert.equal(labels[1].name, "B");
  });

  it("gooit bij ongeldige labels input", () => {
    assert.throws(() => parseLabelsInput("{"), /ongeldig/i);
    assert.throws(() => parseLabelsInput("{}"), /lijst/i);
  });
});
