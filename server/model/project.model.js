const mongoose = require("mongoose");
const { Schema } = mongoose;

const PROJECT_TYPES = [
  "glasfusion",
  "tiffany",
  "glas-in-lood",
  "hout",
  "keramiek",
  "tassen",
  "overige",
];

const GLASFUSION_TECHNIQUES = ["slump", "fuse", "cast"];
const GLASFUSION_SPEEDS = ["fast", "medium", "slow", "ultra-slow"];
const SALE_STATUSES = ["showroom", "te_koop", "verkocht"];

const PhotoSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, required: false },
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    thumbsUp: { type: Number, default: 0, min: 0 },
    thumbedBy: { type: [String], default: [] },
    isCover: { type: Boolean, default: false },
  },
  { _id: true }
);

const ProjectLabelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
  },
  { _id: false }
);

function applyGlasfusionValidation(doc) {
  if (doc.type === "glasfusion") {
    if (!doc.glasfusionTechnique) {
      doc.invalidate(
        "glasfusionTechnique",
        "Techniek is verplicht bij glasfusion"
      );
    }
    if (!doc.glasfusionSpeed) {
      doc.invalidate("glasfusionSpeed", "Type is verplicht bij glasfusion");
    }
  } else {
    doc.glasfusionTechnique = undefined;
    doc.glasfusionSpeed = undefined;
  }
}

const StepSchema = new Schema(
  {
    title: { type: String, trim: true, default: "" },
    type: { type: String, required: true, enum: PROJECT_TYPES },
    glasfusionTechnique: {
      type: String,
      enum: GLASFUSION_TECHNIQUES,
      required: false,
    },
    glasfusionSpeed: {
      type: String,
      enum: GLASFUSION_SPEEDS,
      required: false,
    },
    notes: { type: String, default: "" },
    kwhUsage: { type: Number, min: 0, default: null },
    costPrice: { type: Number, min: 0, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    photos: [PhotoSchema],
  },
  { timestamps: true }
);

StepSchema.pre("validate", function (next) {
  applyGlasfusionValidation(this);
  next();
});

const ProjectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: PROJECT_TYPES },
    glasfusionTechnique: {
      type: String,
      enum: GLASFUSION_TECHNIQUES,
      required: false,
    },
    glasfusionSpeed: {
      type: String,
      enum: GLASFUSION_SPEEDS,
      required: false,
    },
    notes: { type: String, default: "" },
    kwhUsage: { type: Number, min: 0, default: null },
    costPrice: { type: Number, min: 0, default: null },
    sellingPrice: { type: Number, min: 0, default: null },
    saleStatus: { type: String, default: null },
    saleDescription: { type: String, default: "" },
    ownerEmail: { type: String, index: true, default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },
    labels: { type: [ProjectLabelSchema], default: [] },
    photos: [PhotoSchema],
    steps: [StepSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProjectSchema.pre("validate", function (next) {
  applyGlasfusionValidation(this);
  next();
});

module.exports = mongoose.model("Project", ProjectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;
module.exports.GLASFUSION_TECHNIQUES = GLASFUSION_TECHNIQUES;
module.exports.GLASFUSION_SPEEDS = GLASFUSION_SPEEDS;
module.exports.SALE_STATUSES = SALE_STATUSES;
