const mongoose = require("mongoose");
const { Schema } = mongoose;

const LabelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, index: true },
    color: { type: String, required: true, trim: true },
    createdBy: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Label", LabelSchema);
