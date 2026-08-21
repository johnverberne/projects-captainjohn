const express = require("express");
const FiringSchema = require("../model/firingSchema.model");
const { GLASFUSION_TECHNIQUES, OVEN_CODES } = require("../model/project.model");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();

function parseOptionalEnum(value, allowed, label) {
  if (value === undefined || value === null || value === "") return null;
  const code = String(value).trim();
  if (!allowed.includes(code)) {
    throw new Error(`Ongeldige ${label}`);
  }
  return code;
}

function parseSegments(value) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new Error("Stookschema is ongeldig");
    }
  }
  if (!Array.isArray(raw)) {
    throw new Error("Stookschema moet een lijst segmenten zijn");
  }
  return raw
    .map((segment, index) => {
      const targetRaw = segment?.targetTemp;
      if (targetRaw === undefined || targetRaw === null || targetRaw === "") {
        return null;
      }
      const targetTemp = Number(String(targetRaw).replace(",", "."));
      if (!Number.isFinite(targetTemp)) {
        throw new Error(`Segment ${index + 1}: doeltemperatuur is ongeldig`);
      }
      const holdRaw = segment?.holdMinutes;
      const holdMinutes =
        holdRaw === undefined || holdRaw === null || holdRaw === ""
          ? 0
          : Number(String(holdRaw).replace(",", "."));
      if (!Number.isFinite(holdMinutes) || holdMinutes < 0) {
        throw new Error(`Segment ${index + 1}: houdtijd moet ≥ 0 zijn`);
      }
      const rateRaw = segment?.rate;
      let rate = null;
      if (rateRaw !== undefined && rateRaw !== null && rateRaw !== "") {
        rate = Number(String(rateRaw).replace(",", "."));
        if (!Number.isFinite(rate) || rate < 0) {
          throw new Error(`Segment ${index + 1}: stijging moet ≥ 0 zijn`);
        }
      }
      return { rate, targetTemp, holdMinutes };
    })
    .filter(Boolean);
}

function parseBody(body) {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Geef het schema een naam");
  return {
    name,
    technique: parseOptionalEnum(body.technique, GLASFUSION_TECHNIQUES, "techniek"),
    oven: parseOptionalEnum(body.oven, OVEN_CODES, "oven"),
    segments: parseSegments(body.segments),
  };
}

function serialize(doc) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  return {
    _id: String(obj._id),
    name: obj.name,
    technique: obj.technique || null,
    oven: obj.oven || null,
    segments: obj.segments || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

router.get("/", isAuthenticated, async (_req, res) => {
  try {
    const items = await FiringSchema.find().sort({ name: 1 });
    res.json(items.map(serialize));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", isAuthenticated, async (req, res) => {
  try {
    const data = parseBody(req.body);
    const item = await FiringSchema.create({
      ...data,
      ownerEmail: req.session.email,
    });
    res.status(201).json(serialize(item));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const item = await FiringSchema.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Schema niet gevonden" });
    const data = parseBody(req.body);
    item.name = data.name;
    item.technique = data.technique;
    item.oven = data.oven;
    item.segments = data.segments;
    await item.save();
    res.json(serialize(item));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const item = await FiringSchema.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Schema niet gevonden" });
    await item.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
module.exports.parseSegments = parseSegments;
module.exports.parseOptionalEnum = parseOptionalEnum;
