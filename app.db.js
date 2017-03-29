/**
 * Sets up the db connection and sets a cleanup action that will forcibly close it.
 */

/**
 * The loaded config
 */
const config = require("./app.config.js");

const mongoose = require("mongoose");
mongoose.connect(config.dbUrl);
mongoose.Promise = global.Promise;

require("./zkitApi/utils/cleanup").cleanup(() => {
  console.log("\n\nDb disconnecting\n");
  mongoose.disconnect();
});
