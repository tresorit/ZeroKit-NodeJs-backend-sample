// grab the things we need
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const dataSchema = new Schema({
  /**
   * The id of the stored data
   */
  id: { type: String, required: true, unique: true },
  /**
   * A reference to the tresor that was used to encrypt the data
   */
  tresor: { type: Schema.Types.ObjectId, ref: "Tresor", required: true },

  /**
   * The data itself
   */
  data: {}
});

module.exports = mongoose.model("Data", dataSchema);
