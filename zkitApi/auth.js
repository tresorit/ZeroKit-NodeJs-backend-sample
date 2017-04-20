const passport = require("passport");
const passport_openidconnect = require("passport-openidconnect");
const passport_bearer = require("passport-http-bearer");

const debugLog = require("./utils/debugLogger")("Auth");

const OAuth2 = require("oauth").OAuth2;
const jwt = require("jsonwebtoken");

const config = require("./../app.config.js");
const tokenStore = require("./utils/memoryTokenStore");

const User = require("./db/User");

const errors = require("./utils/errors");

const oauthClients = new Map();

function init(callbackConfig) {
  passport.serializeUser(function(user, done) {
    // Stores the whole user object in the session
    // We have small user objects, so this is fine
    debugLog("Saved user into session: %o", user);
    done(null, user);
  });

  passport.deserializeUser(function(obj, done) {
    // The whole user object is stored in session, nothing extra to restore
    debugLog("Loaded user from session: %o", obj);
    done(null, obj);
  });

  function openidVerifyCallback(iss, sub, profile, jwtClaims, accessToken, refreshToken, params, verifiedCb) {
    // We could verify if the user is able to sign in (but we accept every login through openid)
    // and assemble the user object that will be stored for the session (in memory).
    // The brunt of the verification is done before this is called (proper issuer, audience, etc)
    debugLog("OpenId: logged in user: %s", profile.id);

    return User.findOne({ zkitId: profile.id, state: 2 })
      .then(
        user =>
          callbackConfig.openIdVerify
            ? callbackConfig.openIdVerify(user, iss, sub, profile, jwtClaims, accessToken, refreshToken, params)
            : { error: null, user: user }
      )
      .then(({ error, user }) => {
        debugLog("After cb got error: %o", error);
        debugLog("After cb got user: %o", user);
        verifiedCb(error, user);
      });
  }

  config.zeroKit.idp.map(client => {
    client.params = client.params || {};
    passport.use(`openid-${client.clientID}`, new passport_openidconnect.Strategy(client, openidVerifyCallback));

    const currClient = new OAuth2(client.clientID, client.clientSecret, "", client.authorizationURL, client.tokenURL);
    currClient.callbackURL = client.callbackURL;
    currClient.issuer = client.issuer;
    oauthClients.set(client.clientID, currClient);
  });

  passport.use(
    new passport_bearer(function(tokenId, verifiedCb) {
      const res = tokenStore.checkToken(tokenId);
      if (res) {
        debugLog("Bearer: passed with token %s, as %s", tokenId, res.user.zkitId);
        verifiedCb(null, res.user);
      } else {
        debugLog("Bearer: failed with token %s", tokenId);
        verifiedCb(null, null, { message: "TokenNotFoundOrInvalid" });
      }
    })
  );
}

function router(callbackConfig) {
  const authApi = require("express").Router();

  authApi.get("/login", function(req, res, next) {
    debugLog("login called");
    const clientId = req.query.clientId || req.session.clientID || config.zeroKit.idp[0].clientID;
    if (!clientId) return res.json(errors.badInput("NoClientId"));
    debugLog("got clientid");
    debugLog("requested a redirect to: %s on success", req.query.reto);
    req.session.clientID = clientId;
    req.session.returnTo = req.query.reto;

    return passport.authenticate("openid-" + clientId)(req, res, next);
  });

  authApi.get("/callback", function(req, res, next) {
    const clientId = req.session.clientID;
    debugLog("login-cb called");
    debugLog("returnTo is: %s", req.session.returnTo);
    if (!clientId) return res.json({ code: "BadInput", message: "NoClientId" }).status(400);

    return passport.authenticate("openid-" + clientId, {
      successRedirect: req.session.returnTo,
      failureRedirect: req.session.returnTo + "#error"
    })(req, res, next);
  });

  authApi.post("/login-by-code", function(req, res, next) {
    const clientId = req.query.clientId || config.zeroKit.idp[0].clientID;
    const code = req.body.code;

    debugLog("login requested with %s @ %s", code, clientId);
    if (!clientId) return next(errors.badInput("NoClientId"));
    const ouathClient = oauthClients.get(clientId);

    if (!ouathClient) return next(errors.badInput("UnknownClientId"));

    if (!code) return next(errors.badInput("NoCodeProvided"));

    ouathClient.getOAuthAccessToken(
      code,
      {
        grant_type: "authorization_code",
        redirect_uri: ouathClient.callbackURL
      },
      function(err, access_token, refresh_token, results) {
        if (err) return next(errors.unexpected("", err));

        const idtoken = jwt.decode(results.id_token, { complete: true });

        // TODO: Check/think through https://tools.ietf.org/html/rfc6749#section-10.12

        // http://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
        // 2. The Issuer Identifier for the OpenID Provider (which is typically obtained during Discovery) MUST exactly match the value of the iss (issuer) Claim.
        if (idtoken.payload.iss !== ouathClient.issuer) next(errors.forbidden("Invalid issuer"));

        // 3. The Client MUST validate that the aud (audience) Claim contains its client_id value registered at the Issuer identified by the iss (issuer) Claim as an audience. The aud (audience) Claim MAY contain an array with more than one element. The ID Token MUST be rejected if the ID Token does not list the Client as a valid audience, or if it contains additional audiences not trusted by the Client.
        // TODO: multiple audience
        if (idtoken.payload.aud !== clientId) next(errors.forbidden("Invalid audience"));

        // TODO: We don't serve tokens with multiple audiences and there is no azp claim (but we should still do the validation)
        // 4. If the ID Token contains multiple audiences, the Client SHOULD verify that an azp Claim is present.
        // 5. If an azp (authorized party) Claim is present, the Client SHOULD verify that its client_id is the Claim Value.

        // 6. If the ID Token is received via direct communication between the Client and the Token Endpoint (which it is in this flow), the TLS server validation MAY be used to validate the issuer in place of checking the token signature. The Client MUST validate the signature of all other ID Tokens according to JWS [JWS] using the algorithm specified in the JWT alg Header Parameter. The Client MUST use the keys provided by the Issuer.
        // This is direct communication in our case
        /* but it can be done if specified in the config
        if (config.zeroKit.idp.validateSignature && config.zeroKit.idp.keyValidationFile) {
          const path = require("path"); // Should be moved up top if used
          const pems = require(path.join(__dirname, config.zeroKit.idp.keyValidationFile));
          try {
            jwt.verify(results.id_token, pems[idtoken.header.kid], {
              algorithms: ["RS256"]
            });
          } catch (ex) {
            return next(errors.forbidden("TokenValidationError", ex));
          }
        }
        */
        // 7. The alg value SHOULD be the default of RS256 or the algorithm sent by the Client in the id_token_signed_response_alg parameter during Registration.
        if (idtoken.header.alg !== "RS256") next(errors.forbidden("Invalid signing alg"));

        // 8. The current time MUST be before the time represented by the exp Claim.

        if (idtoken.payload.exp * 1000 < Date.now())
          next(errors.forbidden("Expired token"));

        // 9. The iat Claim can be used to reject tokens that were issued too far away from the current time, limiting the amount of time that nonces need to be stored to prevent attacks. The acceptable range is Client specific.
        if (idtoken.payload.iat * 1000 < Date.now() - 300000)
          next(errors.forbidden("Token too old"));

        if (idtoken.payload.iat * 1000 > Date.now())
          next(errors.forbidden("Token issued in future"));

        /* TODO: we don't requiest anything else, but we should think about implementing some kind of validation
         10. If a nonce value was sent in the Authentication Request, a nonce Claim MUST be present and its value checked to verify that it is the same value as the one that was sent in the Authentication Request. The Client SHOULD check the nonce value for replay attacks. The precise method for detecting replay attacks is Client specific.
         11. If the acr Claim was requested, the Client SHOULD check that the asserted Claim Value is appropriate. The meaning and processing of acr Claim Values is out of scope for this specification.
         12. If the auth_time Claim was requested, either through a specific request for this Claim or by using the max_age parameter, the Client SHOULD check the auth_time Claim value and request re-authentication if it determines too much time has elapsed since the last End-userSchema authentication.
         */

        return User.findOne({ zkitId: idtoken.payload.sub, state: 2 })
          .lean()
          .then(
            user =>
              callbackConfig.openIdVerify ?
                callbackConfig.openIdVerify(
                    user,
                    idtoken.payload.iss,
                    idtoken.payload.sub,
                    idtoken.payload.profile,
                    idtoken.payload,
                    access_token,
                    refresh_token,
                    results
                  ) :
                { error: null, user: user }
          )
          .then(({ error, user }) => {
            debugLog("After cb got error: %o", error);
            debugLog("After cb got user: %o", user);
            if (error) throw new errors.forbidden("Application denied", error);

            res.json(tokenStore.newToken(user, config.defaultTokenValidity || 3600));
          });
      }
    );
  });

  authApi.get("/logout", function(req, res) {
    req.logout();
    res.json({});
  });

  authApi.get("/logout-token", function(req, res) {
    const authorization = req.header("Authorization");
    const token = /Bearer (.*)/.exec(authorization)[1];

    tokenStore.revokeToken(token);

    res.json({});
  });

  return authApi;
}

module.exports = {
  init,
  router
};
