const errors = require("./utils/errors");

const apiAuthMiddleware = require("./apiAuthMiddleware");

module.exports = function(callbackConfig = {}) {
  const router = require("express").Router();
  const invitationLinkMethods = require("./methods/invitationLinkMethods")(callbackConfig);

  router.use(apiAuthMiddleware);

  router.post("/created", function(req, res, next) {
    const tresorId = req.body.tresorId;
    const cUser = req.user;

    if (!tresorId) next(errors.badInput("MissingTresorId"));

    return invitationLinkMethods.createdInvitationLink(tresorId, cUser).then(() => res.json({}), next);
  });

  router.post("/accepted", function(req, res, next) {
    const operationId = req.body.operationId;
    const cUser = req.user;

    if (!operationId) next(errors.badInput("MissingOperationId"));

    return invitationLinkMethods.acceptedInvitationLink(operationId, cUser).then(() => res.json({}), next);
  });

  router.post("/revoked", function(req, res, next) {
    const operationId = req.body.operationId;
    const cUser = req.user;

    if (!operationId) next(errors.badInput("MissingOperationId"));

    return invitationLinkMethods.revokedInvitationLink(operationId, cUser).then(() => res.json({}), next);
  });

  return {
    router,
    methods: invitationLinkMethods
  };
};
