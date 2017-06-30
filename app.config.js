const config = require(process.env.ZKIT_CONFIG_FILE || "./config");

const idpBaseUrl = `${config.zeroKit.serviceUrl}/idp`;

if (Number.parseInt(config.zeroKit.sdkVersion).toString() !== config.zeroKit.sdkVersion)
  throw new Error("sdkVersion should be a number");

if (!config.dbUrl.startsWith("mongodb://"))
  throw new Error("dbUrl should be a link to a mongo db, e.g.: mongodb://user:pass@ds123456.mlab.com:49479/backend-sample");

if (!config.baseUrl.match(/^https?:\/\/[^:]+$/))
  throw new Error("baseUrl should start with http(s) and not contain the port");

if (!config.zeroKit.serviceUrl.match(/^https?:\/\/\w+\.api\.tresorit\.io$/))
  throw new Error("serviceUrl should be the same as on the portal");

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
