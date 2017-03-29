const errors = require("./utils/errors");

const apiAuthMiddleware = require("./apiAuthMiddleware");

module.exports = function(callbackConfig = {}) {
  const router = require("express").Router();
  const tresorMethods = require("./methods/tresorMethods")(callbackConfig);

  router.use(apiAuthMiddleware);

  router.post("/created", function(req, res, next) {
    const tresorId = req.body.tresorId;
    const cUser = req.user;

    if (!tresorId) next(errors.badInput("MissingTresorId"));

    return tresorMethods.createdTresor(tresorId, cUser).then(() => res.json({}), next);
  });

  router.post("/invited-user", function(req, res, next) {
    const operationId = req.body.operationId;
    const cUser = req.user;

    if (!operationId) next(errors.badInput("MissingOperationId"));

    return tresorMethods.invitedUser(operationId, cUser).then(() => res.json({}), next);
  });

  router.post("/kicked-user", function(req, res, next) {
    const operationId = req.body.operationId;
    const cUser = req.user;

    if (!operationId) next(errors.badInput("MissingOperationId"));

    return tresorMethods.kickedUser(operationId, cUser).then(() => res.json({}), next);
  });

  return {
    router,
    methods: tresorMethods
  };
};
