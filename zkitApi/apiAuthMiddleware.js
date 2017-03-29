const passport = require("passport");

const debugLog = require("./utils/debugLogger")("Middleware:Auth");
/**
 * An express middleware that checks if the user is authenticated by session or by token.
 * @param req Request object
 * @param res Result object
 * @param next Next middleware
 * @return {*}
 */
module.exports = (req, res, next) => {
  debugLog("PreBearerSession: %o", req.session);
  debugLog("PreBearerUser: %o", req.user);

  if (!req.isAuthenticated || !req.isAuthenticated())
    return passport.authenticate("bearer", { session: false })(req, res, next);

  return next();
};
