const uid = require("uid2");

const debugLog = require("../utils/debugLogger")("Methods:User");

const adminApi = require("../adminApi/zkitAdminApi");
const errors = require("../utils/errors");
const User = require("../db/User");

module.exports = function(callbackConfig) {
  return {
    getUserId,
    initUserReg,
    finishUserReg,
    validateUser
  };

  /**
   * Returns of the id that belongs to a user name if canGetUserId allowed it.
   * @param userName
   * @return {Promise}
   */
  function getUserId(userName) {
    debugLog("User id requested for %s", userName);

    return User.findOne({ userName: userName }).then(user => {
      if (!user || user.state === 0) throw errors.notFound("UserNotFound");

      debugLog("Found: %o", user);

      if (user.state === 1) throw errors.forbidden("UserNotValidated");

      return Promise.resolve() // This way sync and async errors are captured the same way.
        .then(() => callbackConfig.canGetUserId && !callbackConfig.canGetUserId(user.toObject()))
        .then(appApproved => {
          if (appApproved) throw errors.forbidden("ApplicationDenied");

          debugLog("Returning: %s", user.zkitId);
          return user.zkitId;
        });
    });
  }

  /**
   * Initiates a registration with the passed user name if initReg allowed it.
   * @param userName
   * @return {Promise}
   */
  function initUserReg(userName, profileData) {
    debugLog("Register initiated for %s with %s", userName, profileData);

    return User.findOne({ userName: userName })
      .then(user => {
        if (user) {
          if (user.state > 0)
            throw errors.badInput("UserNameTaken");
          else
            return user.remove(); // TODO: handle simultaneous regs
        }
      })
      .then(() => {
        return !callbackConfig.initReg || callbackConfig.initReg(userName, profileData);
      })
      .then(appApproved => {
        if (!appApproved) throw errors.forbidden("ApplicationDenied");

        return adminApi.initUserRegistration();
      })
      .then(initInfo => {
        debugLog("Tenant server returned: %o", initInfo);

        const user = new User({
          userName: userName,
          zkitId: initInfo.UserId,
          registrationData: {
            sessionId: initInfo.RegSessionId,
            sessionVerifier: initInfo.RegSessionVerifier
          },
          profileData: profileData || "",
          state: 0
        });

        debugLog("Saving %o", user);
        return user.save();
      });
  }

  /**
   * Finishes a registration with the passed user id, saving the validation verifier and generating a validation code if canFinishRegistration allowed it.
   * Calls finishedRegistration on the callbackConfig with the user and the validation code
   * @param userId
   * @param userVerifier
   * @return {Promise}
   */
  function finishUserReg(userId, userVerifier) {
    const validationCode = uid(32);

    debugLog("Finishing reg for %s with verifier %s", userId, userVerifier);
    debugLog("Validation code will be %s", validationCode);
    return User.findOne({ zkitId: userId, state: 0 }).then(user => {
      if (user.state !== 0) throw errors.badInput("UserInWrongState");

      return Promise.resolve()
        .then(() => !callbackConfig.canFinishRegistration || callbackConfig.canFinishRegistration(user.toObject()))
        .then(appApproved => {
          if (!appApproved) throw errors.forbidden("ApplicationDenied");

          user.registrationData.validationVerifier = userVerifier;
          user.registrationData.validationCode = validationCode;
          user.state = 1;

          return user.save();
        })
        .then(
          () =>
            !callbackConfig.finishedRegistration || callbackConfig.finishedRegistration(user.toObject(), validationCode)
        );
    });
  }

  /**
   * Validates the user with the given id and code if canValidateUser allowed it.
   * @param userId The id of the user
   * @param validationCode The validationCode the belongs to the user.
   * @return {Promise}
   */
  function validateUser(userId, validationCode) {
    debugLog("Validating user %s by code %s", userId, validationCode);

    return User.findOne({ zkitId: userId }).then(user => {
      if (!user || user.state === 0) throw errors.notFound("UserNotFound");
      if (user.state === 2) throw errors.badInput("UserAlreadyValidated");
      if (user.registrationData.validationCode !== validationCode) throw errors.forbidden("InvalidValidationCode");

      return Promise.resolve() // This way sync and async errors are captured the same way.
        .then(() => !callbackConfig.canValidateUser || callbackConfig.canValidateUser(user.toObject()))
        .then(appApproved => {
          if (!appApproved) throw errors.forbidden("ApplicationDenied");

          debugLog(
            "Validating using: %s, %s, %s, %s",
            user.zkitId,
            user.registrationData.sessionId,
            user.registrationData.sessionVerifier,
            user.registrationData.validationVerifier
          );
          return adminApi.validateUser(
            user.zkitId,
            user.registrationData.sessionId,
            user.registrationData.sessionVerifier,
            user.registrationData.validationVerifier
          );
        })
        .then(() => {
          user.registrationData = null;
          user.state = 2;

          return user.save();
        });
    });
  }
};
