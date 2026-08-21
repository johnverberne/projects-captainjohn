const mongoose = require("mongoose");
const { Schema } = mongoose;

const FiringSegmentSchema = new Schema(
  {
    rate: { type: Number, min: 0, default: null },
    targetTemp: { type: Number, required: true },
    holdMinutes: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const FiringSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    technique: {
      type: String,
      enum: ["slump", "fuse", "cast", "custom"],
      required: false,
      default: null,
    },
    oven: {
      type: String,
      enum: ["klein", "groot", "overige"],
      required: false,
      default: null,
    },
    segments: { type: [FiringSegmentSchema], default: [] },
    ownerEmail: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FiringSchema", FiringSchema);
module.exports.FiringSegmentSchema = FiringSegmentSchema;
