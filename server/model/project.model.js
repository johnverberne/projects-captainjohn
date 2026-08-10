const mongoose = require("mongoose");
const { Schema } = mongoose;

const PROJECT_TYPES = [
  "glasfusion",
  "tiffany",
  "glas-in-lood",
  "hout",
  "tassen",
  "overige",
];

const GLASFUSION_TECHNIQUES = ["slump", "fuse", "cast"];
const GLASFUSION_SPEEDS = ["fast", "medium", "slow", "ultra-slow"];

const PhotoSchema = new Schema(
  {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    thumbsUp: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

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
    photos: [PhotoSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProjectSchema.pre("validate", function (next) {
  if (this.type === "glasfusion") {
    if (!this.glasfusionTechnique) {
      this.invalidate(
        "glasfusionTechnique",
        "Techniek is verplicht bij glasfusion"
      );
    }
    if (!this.glasfusionSpeed) {
      this.invalidate("glasfusionSpeed", "Type is verplicht bij glasfusion");
    }
  } else {
    this.glasfusionTechnique = undefined;
    this.glasfusionSpeed = undefined;
  }
  next();
});

module.exports = mongoose.model("Project", ProjectSchema);
module.exports.PROJECT_TYPES = PROJECT_TYPES;
module.exports.GLASFUSION_TECHNIQUES = GLASFUSION_TECHNIQUES;
module.exports.GLASFUSION_SPEEDS = GLASFUSION_SPEEDS;
