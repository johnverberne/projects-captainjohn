const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Project = require("../model/project.model");
const {
  PROJECT_TYPES,
  GLASFUSION_TECHNIQUES,
  GLASFUSION_SPEEDS,
} = require("../model/project.model");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Alleen afbeeldingen zijn toegestaan"));
    }
    cb(null, true);
  },
});

function mapPhotos(files) {
  return (files || []).map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: `/uploads/${file.filename}`,
  }));
}

function parseBody(body) {
  return {
    title: (body.title || "").trim(),
    type: body.type,
    glasfusionTechnique: body.glasfusionTechnique || undefined,
    glasfusionSpeed: body.glasfusionSpeed || undefined,
    notes: body.notes || "",
  };
}

router.get("/meta", (_req, res) => {
  res.json({
    types: PROJECT_TYPES,
    glasfusionTechniques: GLASFUSION_TECHNIQUES,
    glasfusionSpeeds: GLASFUSION_SPEEDS,
  });
});

router.get("/", async (_req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).json({ error: "Project niet gevonden" });
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/", upload.array("photos", 20), async (req, res) => {
  try {
    const data = parseBody(req.body);
    if (!data.title) {
      return res.status(400).json({ error: "Titel is verplicht" });
    }
    if (!data.type) {
      return res.status(400).json({ error: "Projectsoort is verplicht" });
    }

    const project = new Project({
      ...data,
      photos: mapPhotos(req.files),
    });
    await project.save();
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project niet gevonden" });

    const data = parseBody(req.body);
    if (data.title) project.title = data.title;
    if (data.type) project.type = data.type;
    project.glasfusionTechnique = data.glasfusionTechnique;
    project.glasfusionSpeed = data.glasfusionSpeed;
    if (typeof req.body.notes === "string") project.notes = data.notes;

    if (req.files?.length) {
      project.photos.push(...mapPhotos(req.files));
    }

    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project niet gevonden" });
    if (!req.files?.length) {
      return res.status(400).json({ error: "Geen foto's ontvangen" });
    }
    project.photos.push(...mapPhotos(req.files));
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/photos/:photoId", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project niet gevonden" });

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    const filePath = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    photo.deleteOne();
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project niet gevonden" });

    for (const photo of project.photos) {
      const filePath = path.join(uploadsDir, photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await project.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
