const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("firing chart series", async () => {
  const {
    firingChartSeries,
    formatFiringDuration,
    FIRING_FULL_RATE,
    FIRING_START_TEMP,
    defaultFiringSchedule,
  } = await import("../../client/src/labels.js");

  it("bouwt een tijd-temperatuurlijn inclusief hold", () => {
    const series = firingChartSeries([
      { rate: 150, targetTemp: 150, holdMinutes: 20 },
    ]);
    assert.equal(series.points[0].temp, FIRING_START_TEMP);
    assert.equal(series.points.at(-1).kind, "hold");
    assert.equal(series.maxTemp, 150);
    assert.ok(series.durationMin > 20);
  });

  it("tekent een lege stijging als vol", () => {
    const series = firingChartSeries([
      { rate: "", targetTemp: FIRING_START_TEMP + FIRING_FULL_RATE, holdMinutes: 0 },
    ]);
    assert.equal(series.points.at(-1).kind, "full");
    assert.ok(Math.abs(series.durationMin - 60) < 0.01);
  });

  it("formatteert duur", () => {
    assert.equal(formatFiringDuration(45), "45 min");
    assert.equal(formatFiringDuration(60), "1 u");
    assert.equal(formatFiringDuration(90), "1 u 30 min");
  });

  it("tekent het standaardschema tot onder de 50 °C", () => {
    const series = firingChartSeries(defaultFiringSchedule());
    assert.ok(series.points.length > 2);
    assert.equal(series.points.at(-1).temp, 50);
    assert.ok(series.maxTemp >= 800);
  });
});
