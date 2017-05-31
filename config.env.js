module.exports = {
  "dbUrl": process.env.ZKIT_DB_URL,
  "baseUrl": process.env.ZKIT_BASE_URL,
  "appOrigins": ["localhost:3000", "localhost:3002"],
  "zeroKit": {
    "serviceUrl": `https://${process.env.ZKIT_TENANT_ID}.api.tresorit.io`,
    "adminUserId": `admin@${process.env.ZKIT_TENANT_ID}.tresorit.io`,
    "adminKey": process.env.ZKIT_ADMIN_KEY,
    "sdkVersion": process.env.ZKIT_SDK_VERSION,
    "idp": [
      {
        "clientID": process.env.ZKIT_CODE_CLIENT_ID,
        "clientSecret": process.env.ZKIT_CODE_CLIENT_SECRET,
        "callbackURL": process.env.ZKIT_CODE_REDIR_URL
      }, {
        "clientID": process.env.ZKIT_HYBRID_CLIENT_ID,
        "clientSecret": process.env.ZKIT_HYBRID_CLIENT_SECRET,
        "callbackURL": process.env.ZKIT_HYBRID_REDIR_URL
      }
    ]
  }
};
