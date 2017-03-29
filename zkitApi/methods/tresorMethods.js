const User = require("../db/User");
const Tresor = require("../db/Tresor");

const debugLog = require("../utils/debugLogger")("Methods:Tresor");

const errors = require("../utils/errors");
const adminApi = require("../adminApi/zkitAdminApi");

module.exports = function(callbackConfig) {
  /**
   * Approves or rejects a tresor created by a user in the sdk based on the result of canCreateTresor.
   * @param tresorId The id of the tresor
   * @param cUser The current user
   * @return {Promise}
   */
  function createdTresor(tresorId, cUser) {
    const userId = cUser.zkitId;
    debugLog("%s created tresor %s", userId, tresorId);
    // TODO: handle calling with already registered tresors

    return adminApi
      .listTresorMembers(tresorId)
      .catch(err => {
        throw errors.badInput("InvalidTresorId", err);
      })
      .then(resp => {
        const members = resp.Members;
        debugLog("Members of the tresor: %o", members);

        return Promise.resolve()
          .then(() => !callbackConfig.canCreateTresor || callbackConfig.canCreateTresor(cUser, members, tresorId))
          .then(appApproved => {
            if (!appApproved) {
              return adminApi.rejectTresorCreation(tresorId).then(() => {
                throw errors.forbidden("ApplicationDenied");
              });
            }
            debugLog("Approving...");
            return adminApi.approveTresorCreation(tresorId);
          })
          .then(() => {
            const tresor = new Tresor({ id: tresorId, members: members });
            debugLog("Saving %o", tresor);
            return tresor.save();
          });
      });
  }
  /**
   * Approves or rejects an invite operation on the result of approveShare.
   * @param operationId The id of the operation
   * @param cUser The current user
   * @return {Promise}
   */
  function invitedUser(operationId, cUser) {
    const userId = cUser.zkitId;
    debugLog("Share %s approval requested by %s", operationId, userId);

    return adminApi
      .getShareDetails(operationId)
      .catch(err => {
        throw errors.badInput("InvalidOperationId", err);
      })
      .then(details => {
        const tresorId = details.TresorId;
        const inviterId = details.ByUserId;
        const inviteeId = details.ForUserId;

        debugLog("%s invites %s to %s", inviterId, inviteeId, tresorId);
        return Promise.all([
          Tresor.findOne({ id: tresorId }),
          User.findOne({ zkitId: inviterId }).lean(),
          User.findOne({ zkitId: inviteeId }).lean()
        ]).then(([tresor, inviter, invitee]) => {
          debugLog("-----------");
          debugLog("tresor: %o", tresor);
          debugLog("inviter: %o", inviter);
          debugLog("invited: %o", invitee);
          debugLog("caller: %o", cUser);
          debugLog("-----------");

          return Promise.resolve(
            !callbackConfig.approveShare || callbackConfig.approveShare(tresor.toObject(), invitee, inviter, cUser)
          ).then(appApproved => {
            if (!appApproved) {
              return adminApi.rejectShare(operationId).then(() => {
                throw errors.forbidden("ApplicationDenied");
              });
            }
            return adminApi.approveShare(operationId).then(() => {
              tresor.members.push(inviteeId);
              return tresor.save();
            });
          });
        });
      });
  }
  /**
   * Approves or rejects an kick operation on the result of approveShare.
   * @param operationId The id of the operation
   * @param cUser The current user
   * @return {Promise}
   */
  function kickedUser(operationId, cUser) {
    const userId = cUser.zkitId;
    debugLog("Kick %s approval requested by %s", operationId, userId);

    if (!operationId) throw errors.badInput("MissingTresorId");

    return adminApi
      .getKickDetails(operationId)
      .catch(err => {
        throw errors.badInput("InvalidOperationId", err);
      })
      .then(details => {
        const tresorId = details.TresorId;
        const kickerId = details.ByUserId;
        const kickedId = details.ForUserId;

        debugLog("%s kicks %s from %s", kickerId, kickedId, tresorId);
        return Promise.all([
          Tresor.findOne({ id: tresorId }),
          User.findOne({ zkitId: kickerId }).lean(),
          User.findOne({ zkitId: kickedId }).lean()
        ]).then(([tresor, kicker, kicked]) => {
          debugLog("-----------");
          debugLog("tresor: \n%o", tresor);
          debugLog("kicker: \n%o", kicker);
          debugLog("kicked: \n%o", kicked);
          debugLog("caller: \n%o", cUser);
          debugLog("-----------");
          return Promise.resolve(
            !callbackConfig.approveKick || callbackConfig.approveKick(tresor.toObject(), kicked, kicker, cUser)
          ).then(appApproved => {
            if (!appApproved) {
              return adminApi.rejectKick(operationId).then(() => {
                throw errors.forbidden("ApplicationDenied");
              });
            }
            return adminApi.approveKick(operationId).then(() => {
              const ind = tresor.members.indexOf(kickedId);
              if (ind !== -1) {
                tresor.members.splice(ind, 1);
                return tresor.save();
              } // TODO: else branch may be an error
            });
          });
        });
      });
  }

  return {
    createdTresor,
    invitedUser,
    kickedUser
  };
};
