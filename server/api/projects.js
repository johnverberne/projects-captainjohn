const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const Project = require("../model/project.model");
const {
  PROJECT_TYPES,
  GLASFUSION_TECHNIQUES,
  GLASFUSION_SPEEDS,
  SALE_STATUSES,
} = require("../model/project.model");
const {
  storePhotos,
  deletePhotoFile,
  deletePhotos,
  openPhotoStream,
  resolveLegacyPath,
  migrateLegacyPhoto,
  serializePhoto,
  serializeProject,
  ensureProjectCover,
  setProjectCover,
  reorderProjectPhotos,
} = require("../services/photoStorage");
const { isAuthenticated } = require("../middleware/auth");
const {
  parseLabelsInput,
  upsertCatalogLabels,
  listCatalogLabels,
} = require("../services/labels");
const { sendMail, smtpConfigured } = require("../services/mail");

const router = express.Router();
const adminEmail = process.env.ADMIN_EMAIL || "john.verberne@gmail.com";

function isAdminUser(req) {
  const email = String(req.session?.email || "").toLowerCase();
  const adminEmail = String(
    process.env.ADMIN_EMAIL || "john.verberne@gmail.com"
  ).toLowerCase();
  const roles = req.session?.roles || [];
  return email === adminEmail || roles.includes("admin");
}

function canAccessProject(project, email, req) {
  if (!project) return false;
  if (isAdminUser(req)) return true;
  if (!project.ownerEmail) return true;
  return project.ownerEmail === email;
}

function projectQueryForUser(email) {
  return {
    $or: [{ ownerEmail: email }, { ownerEmail: null }, { ownerEmail: { $exists: false } }],
  };
}

function notDeletedFilter() {
  return {
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  };
}

function assertActiveProject(project, res) {
  if (project?.deletedAt) {
    res.status(400).json({
      error: "Dit project is verwijderd. Alleen een admin kan het herstellen.",
    });
    return false;
  }
  return true;
}

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
    throw new Error(
      "Kilowattverbruik, kostprijs en verkoopprijs moeten geldige getallen ≥ 0 zijn"
    );
  }
  return n;
}

function parseSaleStatus(value) {
  if (value === undefined || value === null) return null;
  const status = String(value).trim();
  if (!status) return null;
  if (!SALE_STATUSES.includes(status)) {
    throw new Error("Ongeldige verkoopstatus");
  }
  return status;
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
    sellingPrice: parseOptionalNumber(body.sellingPrice),
    saleStatus: parseSaleStatus(body.saleStatus),
    saleDescription:
      typeof body.saleDescription === "string" ? body.saleDescription : "",
    labels: parseLabelsInput(body.labels),
  };
}

function claimOwner(project, email) {
  if (!project.ownerEmail) project.ownerEmail = email;
}

function isStepDeleted(step) {
  return Boolean(step?.deletedAt);
}

function assertActiveStep(step, res) {
  if (isStepDeleted(step)) {
    res.status(400).json({
      error: "Deze stap is verwijderd. Herstel hem eerst of verwijder hem definitief.",
    });
    return false;
  }
  return true;
}

function peekVoterId(req) {
  if (req.session?.email) return `user:${req.session.email}`;
  if (req.session?.voterId) return `anon:${req.session.voterId}`;
  return null;
}

function ensureVoterId(req) {
  if (req.session?.email) return `user:${req.session.email}`;
  if (!req.session.voterId) {
    req.session.voterId = crypto.randomUUID();
  }
  return `anon:${req.session.voterId}`;
}

function applyThumb(photo, voterId) {
  if (!Array.isArray(photo.thumbedBy)) photo.thumbedBy = [];
  if (photo.thumbedBy.includes(voterId)) {
    return { ok: false, already: true };
  }
  photo.thumbedBy.push(voterId);
  photo.thumbsUp = photo.thumbedBy.length;
  return { ok: true, already: false };
}

function stripInternalCosts(obj) {
  delete obj.kwhUsage;
  delete obj.costPrice;
  for (const step of obj.steps || []) {
    delete step.kwhUsage;
    delete step.costPrice;
  }
  return obj;
}

function serializeForClient(project, req) {
  const obj = serializeProject(project, { voterId: peekVoterId(req) });
  const canSeeInternal =
    Boolean(req.session?.email) &&
    canAccessProject(project, req.session.email, req);
  if (!canSeeInternal) {
    obj.steps = (obj.steps || []).filter((step) => !step.deletedAt);
    return stripInternalCosts(obj);
  }
  return obj;
}

/** Publiek lezen; verwijderde projecten alleen voor eigenaar/admin. */
async function loadReadableProject(
  req,
  res,
  { allowDeleted = false, requireActive = false } = {}
) {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project niet gevonden" });
    return null;
  }
  if (project.deletedAt) {
    if (requireActive) {
      assertActiveProject(project, res);
      return null;
    }
    const canSeeDeleted =
      allowDeleted &&
      req.session?.email &&
      canAccessProject(project, req.session.email, req);
    if (!canSeeDeleted) {
      res.status(404).json({ error: "Project niet gevonden" });
      return null;
    }
  }
  return project;
}

/** Bewerken: alleen eigenaar / admin / project zonder eigenaar. */
async function loadAccessibleProject(
  req,
  res,
  { allowDeleted = false, requireActive = false } = {}
) {
  const project = await Project.findById(req.params.id);
  if (!project || !canAccessProject(project, req.session?.email, req)) {
    res.status(404).json({ error: "Project niet gevonden" });
    return null;
  }
  if (project.deletedAt) {
    if (requireActive) {
      assertActiveProject(project, res);
      return null;
    }
    if (!allowDeleted) {
      res.status(404).json({ error: "Project niet gevonden" });
      return null;
    }
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

router.get("/meta", async (_req, res) => {
  try {
    const catalog = await listCatalogLabels();
    res.json({
      types: PROJECT_TYPES,
      glasfusionTechniques: GLASFUSION_TECHNIQUES,
      glasfusionSpeeds: GLASFUSION_SPEEDS,
      saleStatuses: SALE_STATUSES,
      labels: catalog.map((item) => ({
        name: item.name,
        color: item.color,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Foto met de meeste duimpjes (project- + stapfoto’s), voor de homepage. */
router.get("/featured", async (req, res) => {
  try {
    const projects = await Project.find(notDeletedFilter());
    let best = null;

    for (const project of projects) {
      const projectId = String(project._id);
      for (const photo of project.photos || []) {
        const thumbsUp = photo.thumbsUp || 0;
        if (thumbsUp <= 0) continue;
        if (!best || thumbsUp > best.thumbsUp) {
          best = {
            projectId,
            stepId: null,
            projectTitle: project.title,
            thumbsUp,
            photo,
          };
        }
      }
      for (const step of project.steps || []) {
        if (isStepDeleted(step)) continue;
        const stepId = String(step._id);
        for (const photo of step.photos || []) {
          const thumbsUp = photo.thumbsUp || 0;
          if (thumbsUp <= 0) continue;
          if (!best || thumbsUp > best.thumbsUp) {
            best = {
              projectId,
              stepId,
              projectTitle: project.title,
              thumbsUp,
              photo,
            };
          }
        }
      }
    }

    if (!best) {
      return res.json(null);
    }

    const url = best.stepId
      ? `/api/projects/${best.projectId}/steps/${best.stepId}/photos/${String(
          best.photo._id
        )}/file`
      : `/api/projects/${best.projectId}/photos/${String(best.photo._id)}/file`;

    res.json({
      projectId: best.projectId,
      stepId: best.stepId,
      projectTitle: best.projectTitle,
      photo: serializePhoto(best.photo, url, peekVoterId(req)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const showDeleted =
      req.query.deleted === "1" || req.query.deleted === "true";
    const mineOnly =
      req.query.mine === "1" || req.query.mine === "true";

    if (showDeleted && !req.session?.email) {
      return res.status(401).json({ error: "Session expired" });
    }

    if (mineOnly && !req.session?.email) {
      return res.status(401).json({ error: "Session expired" });
    }

    const parts = [];
    if (showDeleted) {
      parts.push({ deletedAt: { $ne: null } });
      if (!isAdminUser(req)) {
        parts.push({ ownerEmail: req.session.email });
      }
    } else {
      parts.push(notDeletedFilter());
      if (mineOnly) {
        parts.push(projectQueryForUser(req.session.email));
      }
    }

    const query = parts.length === 1 ? parts[0] : { $and: parts };
    const projects = await Project.find(query).sort({
      ...(showDeleted ? { deletedAt: -1 } : { createdAt: -1 }),
    });
    res.json(projects.map((project) => serializeForClient(project, req)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function deliverOrLog(to, subject, html, logLabel) {
  if (smtpConfigured()) {
    return sendMail(to, subject, html);
  }
  console.log(`[${logLabel}] SMTP ontbreekt — mail naar ${to}`);
  console.log(subject);
  console.log(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
  return { messageId: "local-log" };
}

router.get("/:id", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, {
      allowDeleted: Boolean(req.session?.email),
    });
    if (!project) return;
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/interest", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, { requireActive: true });
    if (!project) return;

    if (project.saleStatus !== "te_koop") {
      return res.status(400).json({
        error: "Interesse doorgeven kan alleen bij stukken die te koop zijn",
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const city = String(req.body?.city || "").trim();
    const interest = String(req.body?.interest || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Naam is verplicht" });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Geldig e-mailadres is verplicht" });
    }
    if (!city) {
      return res.status(400).json({ error: "Woonplaats is verplicht" });
    }
    if (!interest) {
      return res.status(400).json({ error: "Interesse is verplicht" });
    }
    if (!adminEmail) {
      return res.status(500).json({ error: "ADMIN_EMAIL is niet geconfigureerd" });
    }

    const subject = `Interesse te koop: ${project.title}`;
    const html = `
      <p><strong>Nieuwe interesse via het verkoophoekje</strong></p>
      <p>
        <strong>Product:</strong> ${escapeHtml(project.title)}<br/>
        <strong>Project-id:</strong> ${escapeHtml(String(project._id))}<br/>
        <strong>Status:</strong> te koop<br/>
        <strong>Verkoopprijs:</strong> ${
          project.sellingPrice != null
            ? escapeHtml(String(project.sellingPrice))
            : "—"
        }
      </p>
      <p>
        <strong>Naam:</strong> ${escapeHtml(name)}<br/>
        <strong>E-mail:</strong> ${escapeHtml(email)}<br/>
        <strong>Woonplaats:</strong> ${escapeHtml(city)}<br/>
        <strong>Interesse:</strong><br/>
        ${escapeHtml(interest).replace(/\n/g, "<br/>")}
      </p>
    `;

    await deliverOrLog(adminEmail, subject, html, "sale-interest");
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/photos/:photoId/file", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, {
      allowDeleted: Boolean(req.session?.email),
    });
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    return sendPhotoFile(res, project, photo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const data = parseBody(req.body);
    if (!data.title) {
      return res.status(400).json({ error: "Titel is verplicht" });
    }
    if (!data.type) {
      return res.status(400).json({ error: "Projectsoort is verplicht" });
    }

    const photos = await storePhotos(req.files);
    if (photos.length) photos[0].isCover = true;
    const labels = data.labels || [];
    const project = new Project({
      title: data.title,
      type: data.type,
      glasfusionTechnique: data.glasfusionTechnique,
      glasfusionSpeed: data.glasfusionSpeed,
      notes: data.notes,
      kwhUsage: data.kwhUsage,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      saleStatus: data.saleStatus,
      saleDescription: data.saleDescription,
      labels,
      photos,
      steps: [],
      ownerEmail: req.session.email,
    });
    await project.save();
    if (labels.length) {
      await upsertCatalogLabels(labels, req.session.email);
    }
    res.status(201).json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
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
    if (req.body.sellingPrice !== undefined) {
      project.sellingPrice = data.sellingPrice;
    }
    if (req.body.saleStatus !== undefined) {
      project.saleStatus = data.saleStatus;
    }
    if (typeof req.body.saleDescription === "string") {
      project.saleDescription = data.saleDescription;
    }
    if (data.labels !== null) {
      project.labels = data.labels;
      await upsertCatalogLabels(data.labels, req.session.email);
    }

    if (req.files?.length) {
      project.photos.push(...(await storePhotos(req.files)));
      ensureProjectCover(project);
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;
    if (!req.files?.length) {
      return res.status(400).json({ error: "Geen foto's ontvangen" });
    }
    claimOwner(project, req.session.email);
    project.photos.push(...(await storePhotos(req.files)));
    ensureProjectCover(project);
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos/:photoId/thumb", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, { requireActive: true });
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    const voterId = ensureVoterId(req);
    const result = applyThumb(photo, voterId);
    if (result.already) {
      return res.status(409).json({
        error: "Je hebt deze foto al een duimpje gegeven",
        project: serializeForClient(project, req),
      });
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/photos/:photoId/cover", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;
    claimOwner(project, req.session.email);

    if (!setProjectCover(project, req.params.photoId)) {
      return res.status(404).json({ error: "Foto niet gevonden" });
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id/photos/order", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;
    claimOwner(project, req.session.email);

    const photoIds = req.body?.photoIds;
    if (!reorderProjectPhotos(project, photoIds)) {
      return res.status(400).json({ error: "Ongeldige foto-volgorde" });
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/photos/:photoId", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;

    const photo = project.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    await deletePhotoFile(photo.fileId);
    const legacyPath = resolveLegacyPath(photo);
    if (legacyPath) fs.unlinkSync(legacyPath);

    photo.deleteOne();
    ensureProjectCover(project);
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
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
    res.status(201).json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/:id/steps/:stepId", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;
    claimOwner(project, req.session.email);

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (!assertActiveStep(step, res)) return;

    const data = parseBody(req.body);
    applyFields(step, data, req.body);
    if (!step.type) {
      return res.status(400).json({ error: "Stapsoort is verplicht" });
    }

    if (req.files?.length) {
      step.photos.push(...(await storePhotos(req.files)));
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/steps/:stepId", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (isStepDeleted(step)) {
      return res.json(serializeForClient(project, req));
    }

    step.deletedAt = new Date();
    step.deletedBy = req.session.email;
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps/:stepId/restore", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });

    step.deletedAt = null;
    step.deletedBy = null;
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/steps/:stepId/permanent", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (!isStepDeleted(step)) {
      return res.status(400).json({
        error: "Zet de stap eerst in de prullenbak voordat je definitief verwijdert",
      });
    }

    await deletePhotos(step.photos);
    step.deleteOne();
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/steps/:stepId/photos/:photoId/file", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, {
      allowDeleted: Boolean(req.session?.email),
    });
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

router.post("/:id/steps/:stepId/photos", isAuthenticated, upload.array("photos", 20), async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;
    if (!req.files?.length) {
      return res.status(400).json({ error: "Geen foto's ontvangen" });
    }

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (!assertActiveStep(step, res)) return;

    claimOwner(project, req.session.email);
    step.photos.push(...(await storePhotos(req.files)));
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/steps/:stepId/photos/:photoId/thumb", async (req, res) => {
  try {
    const project = await loadReadableProject(req, res, { requireActive: true });
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (!assertActiveStep(step, res)) return;

    const photo = step.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    const voterId = ensureVoterId(req);
    const result = applyThumb(photo, voterId);
    if (result.already) {
      return res.status(409).json({
        error: "Je hebt deze foto al een duimpje gegeven",
        project: serializeForClient(project, req),
      });
    }

    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/steps/:stepId/photos/:photoId", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { requireActive: true });
    if (!project) return;

    const step = project.steps.id(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Stap niet gevonden" });
    if (!assertActiveStep(step, res)) return;

    const photo = step.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ error: "Foto niet gevonden" });

    await deletePhotoFile(photo.fileId);
    const legacyPath = resolveLegacyPath(photo);
    if (legacyPath) fs.unlinkSync(legacyPath);

    photo.deleteOne();
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/restore", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { allowDeleted: true });
    if (!project) return;
    if (!project.deletedAt) {
      return res.json(serializeForClient(project, req));
    }

    project.deletedAt = null;
    project.deletedBy = null;
    await project.save();
    res.json(serializeForClient(project, req));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/:id/permanent", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { allowDeleted: true });
    if (!project) return;
    if (!project.deletedAt) {
      return res.status(400).json({
        error: "Zet het project eerst in de prullenbak voordat je definitief verwijdert",
      });
    }

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

router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const project = await loadAccessibleProject(req, res, { allowDeleted: true });
    if (!project) return;

    if (project.deletedAt) {
      return res.json({ ok: true, alreadyDeleted: true });
    }

    project.deletedAt = new Date();
    project.deletedBy = req.session.email;
    await project.save();
    res.json({ ok: true, project: serializeForClient(project, req) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

