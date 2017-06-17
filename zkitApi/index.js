const logger = require("morgan");
const cors = require("cors");

module.exports = function(config, callbackConfig) {
  const router = require("express").Router();

  const userApi = require("./user.js")(callbackConfig);
  const tresorApi = require("./tresor")(callbackConfig);
  const invitationLinksApi = require("./invitationLinks")(callbackConfig);
  const dataApi = require("./data")(callbackConfig);

  require("./auth.js").init(callbackConfig);

  // Adding loggers
  router.use(logger("dev", { immediate: true })); // Log start of request
  router.use(logger("dev", { immediate: false })); // Log end of request

  // Setting up cors
  router.use(cors({ origin: config.appOrigins, credentials: true }));

  // Add apis
  router.use("/user", userApi.router);
  router.use("/auth", require("./auth").router(callbackConfig));
  router.use("/tresor", tresorApi.router);
  router.use("/invitationLinks", invitationLinksApi.router);
  router.use("/data", dataApi.router);

  return {
    router,
    user: userApi,
    tresor: tresorApi,
    data: dataApi
  };
};
