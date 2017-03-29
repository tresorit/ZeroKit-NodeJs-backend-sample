const crypto = require("crypto");

const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const passport = require("passport");

const errors = require("./zkitApi/utils/errors");

const config = require("./app.config");

const app = express();
// You should ALWAYS use TLS, but here we omit this to keep the example simple

// helmet is a security middleware, adding it at the top to make sure all headers get set
const helmet = require("helmet");
app.use(helmet());
app.use(helmet.noCache());
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));

app.use(
  helmet.hsts({
    setIf: function(req) {
      return ["localhost", "127.0.0.1"].indexOf(req.hostname) === -1;
    }
  })
);

// This tiny middleware protects against dns rebinding attacks only letting through calls coming to explicitly set hosts
function dnsRebindingProtection(allowedHosts) {
  return function(req, res, next) {
    if (allowedHosts.indexOf(req.hostname) !== -1) return next();
    console.log("rebinding block", req.hostname);
    return res.status(403).send();
  };
}
// You should add all addresses that are bound to the app here, localhost added by default
app.use(
  dnsRebindingProtection([
    "localhost",
    "127.0.0.1",
    /^https?:\/\/(.*)/.exec(config.baseUrl)[1]
  ])
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
const sessionOptions = {
  name: "sessionId",
  genid: () => "t-" + crypto.randomBytes(32).toString("hex"),
  // secret is not really needed (only for tamper detection, but good luck for tampering a 64byte random), see:
  // http://security.stackexchange.com/questions/92122/why-is-it-insecure-to-store-the-session-id-in-a-cookie-directly
  secret: "dummy",
  resave: false,
  saveUninitialized: false,
  cookie: {}
};
// Azure sets this explicitly
if (app.get("NODE_ENV") === "production") {
  app.set("trust proxy", 1); // trust first proxy
  sessionOptions.cookie.secure = true; // serve secure cookies
}
// Add session handling
app.use(session(sessionOptions));

// Add passport to the app
app.use(passport.initialize());
app.use(passport.session());

// Initialize db connection
require("./app.db");

function isTestUser(user) {
  return user.userName.startsWith("test-user");
}

function checkProfileProp(dataStr, property, defVal) {
  let profile = dataStr;
  if (typeof profile === "string") {
    try {
      profile = JSON.parse(dataStr);
    } catch (ex) {
      return defVal;
    }
  }

  return profile.hasOwnProperty(property) ? profile[property] : defVal;
}

const callbackConfig = {
  openIdVerify: null,

  initReg: function(userName, profileData) {
    if (isTestUser({ userName }))
      return checkProfileProp(profileData, "canInitReg", true);
    return true;
  },

  canFinishRegistration: null,

  finishedRegistration: function(user, validationCode) {
    if (isTestUser(user) && checkProfileProp(user.profileData, "autoValidate", false)) {
      return zkitApi.user.methods
        .validateUser(user.zkitId, validationCode)
        .then(() => true);
    }

    return true;
  },

  canValidateUser: null,

  canGetUserId: null,

  canCreateTresor: function(user, tresorId) {
    if (isTestUser(user))
      return checkProfileProp(user.profileData, "canCreateTresor", true);
    return true;
  },

  approveShare: function(tresor, invitee, invited, user) {
    if (isTestUser(user))
      return checkProfileProp(user.profileData, "canShare", true);
    return true;
  },

  approveKick: function(tresor, kicker, kicked, user) {
    if (isTestUser(user))
      return checkProfileProp(user.profileData, "canKick", true);
    return true;
  },

  canAccessData: function(user, entry) {
    let testVal;
    if (isTestUser(user))
      testVal = checkProfileProp(user.profileData, "canAccessData", null);
    return testVal === null ? entry.tresor.members.indexOf(user.zkitId) !== -1 : testVal;
  },

  transformDataToGet: function(entry) {
    return entry.data;
  },

  canStoreData: function(user, dataid, body, tresor, oldEntry) {
    let testVal;
    if (isTestUser(user))
      testVal = checkProfileProp(user.profileData, "canStoreData", null);
    return testVal === null ? !oldEntry || oldEntry.tresor.members.indexOf(user.zkitId) !== -1 : testVal;
  },

  transformDataToStore: function(user, id, body, oldEntry) {
    return body;
  },

  transformProfileToGet: function(user, profileData) {
    return profileData;
  },

  canStoreProfile: function(user, profileData) {
    if (isTestUser(user))
      return checkProfileProp(user.profileData, "canStoreProfile", true);
    return true;
  },

  transformProfileToStore: function(user, profileData) {
    return profileData;
  }
};

const zkitApi = require("./zkitApi")(config, callbackConfig);
app.use("/api", zkitApi.router);
app.use("/zkit-sdk.js", (req, res) =>
  res.redirect(
    `${config.zeroKit.serviceUrl}/static/v${config.zeroKit.sdkVersion}/zkit-sdk.js`
  ));

/* Uncomment these lines to also serve static files
app.use(express.static(path.join(__dirname, 'static/')));
app.use('/', (req,res,next) => res.redirect('/index.html'));
*/

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  err.code = "NotFound";
  next(err);
});

// Error handler
// Error-handling middleware always takes four arguments.
app.use(function(err, req, res, next) {
  err = err && err.code ? err : errors.unexpected("", err);
  // Set the status
  console.log("Error: \n%O", err);
  res.status(err.status || 500);

  res.json({
    code: err.code,
    message: err.message,
    exception: process.env.DEBUG ? err : undefined
  });
});

module.exports = app;
