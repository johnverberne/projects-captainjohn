const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSegments,
  parseOptionalEnum,
} = require("../../server/api/firingSchemas");

describe("firing schema parsing", () => {
  it("parst segmenten en slaat lege stijging op als vol", () => {
    const segments = parseSegments([
      { rate: 150, targetTemp: 540, holdMinutes: 20 },
      { rate: "", targetTemp: "50", holdMinutes: "" },
      { targetTemp: "" },
    ]);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].rate, 150);
    assert.equal(segments[1].rate, null);
    assert.equal(segments[1].holdMinutes, 0);
  });

  it("accepteert oven-codes en wijst ongeldige af", () => {
    assert.equal(parseOptionalEnum("klein", ["klein", "groot"], "oven"), "klein");
    assert.equal(parseOptionalEnum("", ["klein"], "oven"), null);
    assert.throws(
      () => parseOptionalEnum("mega", ["klein"], "oven"),
      /ongeldige oven/i
    );
  });
});
