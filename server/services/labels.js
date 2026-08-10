const Label = require("../model/label.model");

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeLabelName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKey(name) {
  return normalizeLabelName(name).toLowerCase();
}

function normalizeColor(color, fallback = "#2a5554") {
  const value = String(color || "").trim();
  if (!HEX_COLOR.test(value)) return fallback;
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return value.toLowerCase();
}

function parseLabelsInput(raw) {
  if (raw === undefined || raw === null || raw === "") return null;

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Labels zijn ongeldig");
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Labels moeten een lijst zijn");
  }

  const seen = new Set();
  const labels = [];

  for (const item of parsed) {
    const name = normalizeLabelName(item?.name);
    if (!name) continue;
    if (name.length > 40) {
      throw new Error("Een label mag maximaal 40 tekens zijn");
    }
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({
      name,
      color: normalizeColor(item?.color),
    });
  }

  if (labels.length > 20) {
    throw new Error("Maximaal 20 labels per project");
  }

  return labels;
}

async function upsertCatalogLabels(labels, email) {
  for (const label of labels || []) {
    const key = nameKey(label.name);
    if (!key) continue;
    await Label.findOneAndUpdate(
      { nameKey: key },
      {
        $set: {
          name: label.name,
          color: normalizeColor(label.color),
        },
        $setOnInsert: {
          nameKey: key,
          createdBy: email || null,
        },
      },
      { upsert: true, new: true }
    );
  }
}

async function listCatalogLabels() {
  return Label.find().sort({ name: 1 }).lean();
}

module.exports = {
  normalizeLabelName,
  nameKey,
  normalizeColor,
  parseLabelsInput,
  upsertCatalogLabels,
  listCatalogLabels,
};
