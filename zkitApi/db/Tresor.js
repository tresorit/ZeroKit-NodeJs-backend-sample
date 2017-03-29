const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tresorSchema = new Schema({
  /**
   * The id of the tresor
   */
  id: { type: String, required: true, unique: true, lowercase: true },
  /**
   * A list of ids of the members.
   * Denormalized because we don't usually need anything else, it's mostly just used to see if the current user is a member.
   */
  members: { type: [String], required: true }
});

module.exports = mongoose.model("Tresor", tresorSchema);
