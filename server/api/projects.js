const express = require("express");
const fs = require("fs");
const multer = require("multer");
const Project = require("../model/project.model");
const {
  PROJECT_TYPES,
  GLASFUSION_TECHNIQUES,
  GLASFUSION_SPEEDS,
} = require("../model/project.model");
const {
  storePhotos,
  deletePhotoFile,
  deletePhotos,
  openPhotoStream,
  resolveLegacyPath,
  migrateLegacyPhoto,
  serializeProject,
} = require("../services/photoStorage");
const { isAuthenticated } = require("../middleware/auth");

const router = express.Router();

function canAccessProject(project, email) {
  if (!project) return false;
  if (!project.ownerEmail) return true;
  return project.ownerEmail === email;
}

function projectQueryForUser(email) {
  return {
    $or: [{ ownerEmail: email }, { ownerEmail: null }, { ownerEmail: { $exists: false } }],
  };
}

router.use(isAuthenticated);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Alleen afbeeldingen zijn toegestaan"));
    }
    cb(null, true);
  },
});

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Kilowattverbruik en kostprijs moeten geldige getallen ≥ 0 zijn");
  }
  return n;
}

function parseBody(body) {
  return {
    title: (body.title || "").trim(),
    type: body.type,
    glasfusionTechnique: body.glasfusionTechnique || undefined,
    glasfusionSpeed: body.glasfusionSpeed || undefined,
    notes: body.notes || "",
    kwhUsage: parseOptionalNumber(body.kwhUsage),
    costPrice: parseOptionalNumber(body.costPrice),
  };
}

function claimOwner(project, email) {
  if (!project.ownerEmail) project.ownerEmail = email;
}

async function loadAccessibleProject(req, res) {
  const project = await Project.findById(req.params.id);
  if (!project || !canAccessProject(project, req.session.email)) {
    res.status(404).json({ error: "Project niet gevonden" });
    return null;
  }
  return project;
}

async function sendPhotoFile(res, project, photo) {
  let current = photo;
  if (!current.fileId) {
    current = await migrateLegacyPhoto(project, current);
  }

  if (current.fileId) {
    res.set("Content-Type", current.mimetype || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    const stream = openPhotoStream(current.fileId);
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "Foto niet gevonden" });
    });
    return stream.pipe(res);
  }

  const legacyPath = resolveLegacyPath(current);
  if (legacyPath) {
    res.set("Content-Type", current.mimetype || "application/octet-stream");
    return fs.createReadStream(legacyPath).pipe(res);
  }

  return res.status(404).json({ error: "Foto niet gevonden" });
}

function applyFields(target, data, body) {
  if (typeof body.title === "string") target.title = data.title;
  if (data.type) target.type = data.type;
  target.glasfusionTechnique = data.glasfusionTechnique;
  target.glasfusionSpeed = data.glasfusionSpeed;
  if (typeof body.notes === "string") target.notes = data.notes;
  if (body.kwhUsage !== undefined) target.kwhUsage = data.kwhUsage;
  if (body.costPrice !== undefined) target.costPrice = data.costPrice;
}

router.get("/meta", (_req, res) => {
  res.json({
    types: PROJECT_TYPES,
    glasfusionTechniques: GLASFUSION_TECHNIQUES,
    glasfusionSpeeds: GLASFUSION_SPEEDS,
  });
});

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find(projectQueryForUser(req.session.email)).sort({
      createdAt: -1,
    });
    res.json(projects.map(serializeProject));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/photos/:photoId/file", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    return sendPhotoFile(res, project, photo);
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

    const photos = await storePhotos(req.files);
    const project = new Project({
      ...data,
      photos,
      steps: [],
      ownerEmail: req.session.email,
    });
    await project.save();
    res.status(201).json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    claimOwner(project, req.session.email);

    const data = parseBody(req.body);
    if (data.title) project.title = data.title;
    if (data.type) project.type = data.type;
    project.glasfusionTechnique = data.glasfusionTechnique;
    project.glasfusionSpeed = data.glasfusionSpeed;
    if (typeof req.body.notes === "string") project.notes = data.notes;
    if (req.body.kwhUsage !== undefined) project.kwhUsage = data.kwhUsage;
    if (req.body.costPrice !== undefined) project.costPrice = data.costPrice;

    if (req.files?.length) {
      project.photos.push(...(await storePhotos(req.files)));
    }

    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    if (!req.files?.length) {
      return res.status(400).json({ error: "Geen foto's ontvangen" });
    }
    claimOwner(project, req.session.email);
    project.photos.push(...(await storePhotos(req.files)));
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos/:photoId/thumb", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    photo.thumbsUp = (photo.thumbsUp || 0) + 1;
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/photos/:photoId", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    await deletePhotoFile(photo.fileId);
    const legacyPath = resolveLegacyPath(photo);
    if (legacyPath) fs.unlinkSync(legacyPath);

    photo.deleteOne();
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    claimOwner(project, req.session.email);

    const data = parseBody(req.body);
    if (!data.type) {
      return res.status(400).json({ error: "Stapsoort is verplicht" });
    }

    const photos = await storePhotos(req.files);
    project.steps.push({
      ...data,
      photos,
    });
    await project.save();
    res.status(201).json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id/steps/:stepId", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    claimOwner(project, req.session.email);

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    const data = parseBody(req.body);
    applyFields(step, data, req.body);
    if (!step.type) {
      return res.status(400).json({ error: "Stapsoort is verplicht" });
    }

    if (req.files?.length) {
      step.photos.push(...(await storePhotos(req.files)));
    }

    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/steps/:stepId", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    await deletePhotos(step.photos);
    step.deleteOne();
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/steps/:stepId/photos/:photoId/file", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    const photo = step.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    return sendPhotoFile(res, project, photo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps/:stepId/photos", upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;
    if (!req.files?.length) {
      return res.status(400).json({ error: "Geen foto's ontvangen" });
    }

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    claimOwner(project, req.session.email);
    step.photos.push(...(await storePhotos(req.files)));
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps/:stepId/photos/:photoId/thumb", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    const photo = step.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    photo.thumbsUp = (photo.thumbsUp || 0) + 1;
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/steps/:stepId/photos/:photoId", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    const photo = step.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    await deletePhotoFile(photo.fileId);
    const legacyPath = resolveLegacyPath(photo);
    if (legacyPath) fs.unlinkSync(legacyPath);

    photo.deleteOne();
    await project.save();
    res.json(serializeProject(project));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res);
    if (!project) return;

    await deletePhotos(project.photos);
    for (const step of project.steps || []) {
      await deletePhotos(step.photos);
    }

    await project.deleteOne();
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
