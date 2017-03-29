const config = require(process.env.ZKIT_CONFIG_FILE || "./config");

const idpBaseUrl = `${config.zeroKit.serviceUrl}/idp`;

module.exports = {
  dbUrl: config.dbUrl,
  baseUrl: config.baseUrl,
  appOrigins: config.appOrigins,

  zeroKit: {
    adminUserId: config.zeroKit.adminUserId,
    adminKey: config.zeroKit.adminKey,

    sdkVersion: config.zeroKit.sdkVersion,

    serviceUrl: config.zeroKit.serviceUrl,
    apiBase: `${config.zeroKit.serviceUrl}/`,
    apiPath: `api/v${config.zeroKit.sdkVersion}/admin`,
    idp: config.zeroKit.idp.map(client => ({
      clientID: client.clientID,
      clientSecret: client.clientSecret,

      authorizationURL: client.authorizationURL ||
        `${idpBaseUrl}/connect/authorize`,
      tokenURL: client.tokenURL || `${idpBaseUrl}/connect/token`,
      callbackURL: client.callbackURL || `${config.baseUrl}/api/auth/callback`,
      userInfoURL: client.userInfoURL || `${idpBaseUrl}/connect/userInfo`,
      issuer: `${idpBaseUrl}`,
      prompt: "none",
      scope: "profile"
    }))
  }
};
