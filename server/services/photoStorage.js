const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const uploadsDir = path.join(__dirname, "..", "uploads");

function getBucket() {
  if (!mongoose.connection?.db) {
    throw new Error("MongoDB is nog niet verbonden");
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "photos",
  });
}

function safeName(name) {
  return String(name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storePhotoBuffer(file) {
  return new Promise((resolve, reject) => {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(
      `${Date.now()}-${safeName(file.originalname)}`,
      {
        contentType: file.mimetype,
        metadata: { originalName: file.originalname },
      }
    );

    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id,
        filename: uploadStream.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        thumbsUp: 0,
        thumbedBy: [],
      });
    });

    uploadStream.end(file.buffer);
  });
}

async function storePhotos(files) {
  const photos = [];
  for (const file of files || []) {
    photos.push(await storePhotoBuffer(file));
  }
  return photos;
}

function deletePhotoFile(fileId) {
  if (!fileId) return Promise.resolve();
  return getBucket()
    .delete(fileId)
    .catch(() => undefined);
}

function openPhotoStream(fileId) {
  return getBucket().openDownloadStream(fileId);
}

function resolveLegacyPath(photo) {
  const names = [photo.filename, photo.url?.replace(/^\/uploads\//, "")].filter(
    Boolean
  );
  for (const name of names) {
    const filePath = path.join(uploadsDir, path.basename(name));
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

async function migrateLegacyPhoto(project, photo) {
  if (photo.fileId) return photo;
  const filePath = resolveLegacyPath(photo);
  if (!filePath) return photo;

  const buffer = fs.readFileSync(filePath);
  const stored = await storePhotoBuffer({
    buffer,
    originalname: photo.originalName || path.basename(filePath),
    mimetype: photo.mimetype || "image/jpeg",
    size: buffer.length,
  });

  photo.fileId = stored.fileId;
  photo.filename = stored.filename;
  photo.size = stored.size;
  photo.mimetype = stored.mimetype;
  photo.url = undefined;
  await project.save();
  return photo;
}

function serializePhoto(photo, url, voterId = null) {
  const thumbedBy = Array.isArray(photo.thumbedBy) ? photo.thumbedBy : [];
  return {
    _id: photo._id,
    filename: photo.filename,
    originalName: photo.originalName,
    mimetype: photo.mimetype,
    size: photo.size,
    thumbsUp: photo.thumbsUp || 0,
    thumbedByMe: Boolean(voterId && thumbedBy.includes(voterId)),
    fileId: photo.fileId,
    url,
  };
}

function serializeProject(project, { voterId = null } = {}) {
  const obj =
    typeof project.toObject === "function"
      ? project.toObject({ virtuals: true })
      : { ...project };

  const projectId = String(obj._id);

  obj.photos = (obj.photos || []).map((photo) =>
    serializePhoto(
      photo,
      `/api/projects/${projectId}/photos/${String(photo._id)}/file`,
      voterId
    )
  );

  obj.steps = (obj.steps || []).map((step) => {
    const stepId = String(step._id);
    return {
      ...step,
      photos: (step.photos || []).map((photo) =>
        serializePhoto(
          photo,
          `/api/projects/${projectId}/steps/${stepId}/photos/${String(
            photo._id
          )}/file`,
          voterId
        )
      ),
    };
  });

  return obj;
}

async function deletePhotos(photos) {
  for (const photo of photos || []) {
    await deletePhotoFile(photo.fileId);
    const legacyPath = resolveLegacyPath(photo);
    if (legacyPath) fs.unlinkSync(legacyPath);
  }
}

module.exports = {
  uploadsDir,
  storePhotos,
  deletePhotoFile,
  deletePhotos,
  openPhotoStream,
  resolveLegacyPath,
  migrateLegacyPhoto,
  serializePhoto,
  serializeProject,
};
