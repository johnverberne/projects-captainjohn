const mongoose = require("mongoose");

const connectDB = async (MONGO_URI) => {
  try {
    await mongoose.connect(MONGO_URI, {});
    mongoose.set("debug", { shell: true });
    console.log("Database is connected");
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

module.exports = connectDB;
