const errors = require("../utils/errors");
const Tresor = require("../db/Tresor");
const Data = require("../db/Data");

const User = require("../db/User");

const debugLog = require("../utils/debugLogger")("Methods:Data");

module.exports = function(callbackConfig) {
  /**
   * Gets the profile data of the user passing it through transformProfileToGet of the callbackConfig.
   * @param cUser The current user (the user to query)
   * @return {Promise}
   */
  function getProfile(cUser) {
    return User.findOne({ zkitId: cUser.zkitId }).then(user => {
      if (
        !user // This is unexpected, as the user is from the session
      )
        throw errors.unexpected("UserNotFound");

      return callbackConfig.transformProfileToGet
        ? callbackConfig.transformProfileToGet(user, user.profileData, cUser)
        : user.profileData;
    });
  }

  /**
   * Stores the profile data of the user if canStoreProfile allowed it, passing it through transformProfileToStore.
   * @param cUser The current user (the user to query)
   * @param data The data to store
   * @return {Promise}
   */
  function storeProfile(cUser, data) {
    return User.findOne({ zkitId: cUser.zkitId }).then(user => {
      if (
        !user // This is unexpected, as the user is from the session
      )
        throw errors.unexpected("UserNotFound");

      return Promise.resolve()
        .then(() => !callbackConfig.canStoreProfile || callbackConfig.canStoreProfile(user.toObject(), data, cUser))
        .then(appApproved => {
          if (!appApproved) throw errors.forbidden("ApplicationDenied");
          debugLog("App approved");
          return callbackConfig.transformProfileToStore ? callbackConfig.transformProfileToStore(user, data) : data;
        })
        .then(data => {
          user.profileData = data;
          return user.save();
        })
        .then(result => result.profileData);
    });
  }

  /**
   * Returns the data stored by the given id if canAccessData allowed it, passing it through transformDataToGet
   * @param dataId The id of the data
   * @param cUser The current user
   * @return {Promise}
   */
  function getData(dataId, cUser) {
    debugLog("Data requested by %s id: %s", cUser.zkitId, dataId);
    return Data.findOne({ id: dataId }).populate("tresor").lean().then(entry => {
      if (!entry) throw errors.notFound("DataEntryNotFound");

      return Promise.resolve()
        .then(() => !callbackConfig.canAccessData || callbackConfig.canAccessData(cUser, entry))
        .then(appApproved => {
          if (!appApproved) throw errors.forbidden("ApplicationDenied");
          debugLog("App approved");
          debugLog("Stored data is %o", entry.data);
          return callbackConfig.transformDataToGet ? callbackConfig.transformDataToGet(entry) : entry.data;
        })
        .then(data => {
          debugLog("Returning %o", data);
          return data;
        });
    });
  }

  /**
   * Stores the data stored by the given id if canStoreData allowed it, passing it through transformDataToStore
   * @param dataId The id of the data
   * @param tresorId The id of the tresor that was used to encrypt the data
   * @param cUser The current user
   * @param data The data to store
   * @return {Promise}
   */
  function storeData(dataId, tresorId, cUser, data) {
    debugLog("%s requested to store data by id %s for tresor %s", dataId, tresorId);
    return Promise.all([Tresor.findOne({ id: tresorId }), Data.findOne({ id: dataId }).populate("tresor")]).then(([
      tresor,
      entry
    ]) => {
      if (entry) debugLog("An entry already exists:\n%O", entry);

      return Promise.resolve(
        !callbackConfig.canStoreData || callbackConfig.canStoreData(cUser, dataId, data, tresor, entry)
      )
        .then(hasAppAccess => {
          if (!hasAppAccess) throw errors.forbidden("ApplicationDenied");
          debugLog("App approved");
          debugLog("Uploaded data is %o", data);

          if (!entry) entry = new Data({ id: dataId });

          return callbackConfig.transformDataToStore
            ? callbackConfig.transformDataToStore(cUser, dataId, data, entry)
            : data;
        })
        .then(d => {
          entry.tresor = tresor;
          entry.data = d;
          debugLog("Saving %o", entry);
          return entry.save();
        });
    });
  }

  return {
    getProfile,
    storeProfile,
    getData,
    storeData
  };
};
