const errors = require("./utils/errors.js");

module.exports = function(callbackConfig = {}) {
  const userMethods = require("./methods/userMethods")(callbackConfig);
  const router = require("express").Router();

  /**
   * Returns the zkit user id that belongs to the username in the request
   */
  router.get("/get-user-id", function(req, res, next) {
    const userName = req.query.userName;

    if (!userName) return next(errors.badInput("MissingUserName"));

    return userMethods.getUserId(userName).then(id => res.json(id), next);
  });

  router.post("/init-user-registration", function(req, res, next) {
    const userName = req.body.userName;
    const profileData = req.body.profileData || "";

    if (!userName) return next(errors.badInput("MissingUserName"));

    return userMethods.initUserReg(userName, profileData).then(
      user =>
        res.json({
          userId: user.zkitId,
          regSessionId: user.registrationData.sessionId
        }),
      next
    );
  });

  router.post("/finish-user-registration", function(req, res, next) {
    const userId = req.body.userId;
    const userVerifier = req.body.validationVerifier;

    if (!userId) return next(errors.badInput("MissingUserId"));
    if (!userVerifier) return next(errors.badInput("MissingValidationVerifier"));

    userMethods.finishUserReg(userId, userVerifier).then(() => res.json({}), next);
  });

  router.post("/validate-user", function(req, res, next) {
    const userId = req.body.userId;
    const validationCode = req.body.validationCode;

    if (!userId) return next(errors.badInput("MissingUserId"));
    if (!validationCode) return next(errors.badInput("MissingValidationCode"));

    return userMethods.validateUser(userId, validationCode).then(() => res.json({}), next);
  });

  return {
    router,
    methods: userMethods
  };
};
