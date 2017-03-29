const apiAuthMiddleware = require("./apiAuthMiddleware");

module.exports = function(callbackConfig = {}) {
  const dataMethods = require("./methods/dataMethods")(callbackConfig);
  const router = require("express").Router();

  router.use(apiAuthMiddleware);

  router.get("/get", function(req, res, next) {
    const dataId = req.query.id;
    const cUser = req.user;

    return dataMethods.getData(dataId, cUser).then(data => res.json(data), next);
  });

  router.post("/store", function(req, res, next) {
    const cUser = req.user;
    const dataId = req.query.id;
    const tresorId = req.body.tresorId;
    const data = req.body.data;

    dataMethods.storeData(dataId, tresorId, cUser, data).then(() => res.json({}), next);
  });

  router.get("/profile", function(req, res, next) {
    return dataMethods.getProfile(req.user).then(result => res.json(result), next);
  });

  router.post("/profile", function(req, res, next) {
    return dataMethods.storeProfile(req.user, req.body.data).then(profileData => res.json(profileData || {}), next);
  });

  return {
    router,
    methods: dataMethods
  };
};
