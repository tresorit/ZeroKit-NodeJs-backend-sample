const User = require("../db/User");
const Tresor = require("../db/Tresor");

const debugLog = require("../utils/debugLogger")("Methods:Tresor");

const errors = require("../utils/errors");
const adminApi = require("../adminApi/zkitAdminApi");

module.exports = function(callbackConfig) {
  /**
   * Approves or rejects an invitation link created by a user in the sdk based on the result of canCreateInvitationLink.
   * @param operationId The invitation link create operation
   * @param cUser The current user
   * @return {Promise}
   */
  function createdInvitationLink(operationId, cUser) {
    const userId = cUser.zkitId;
    debugLog("%s created link with opid %s", userId, operationId);
    // TODO: handle calling with already registered tresors

    return adminApi
      .getInvitationLinkCreationDetails(operationId)
      .catch(err => {
        throw errors.badInput("InvalidOperationId", err);
      })
      .then(details => {
        const tresorId = details.TresorId;
        const inviterId = details.ByUserId;
        return Promise.all([
          Tresor.findOne({ id: tresorId }),
          User.findOne({ zkitId: inviterId }).lean()
        ]).then(([tresor, inviter]) => {
          debugLog("-----------");
          debugLog("tresor: %o", tresor);
          debugLog("inviter: %o", inviter);
          debugLog("caller: %o", cUser);
          debugLog("-----------");
          return Promise.resolve()
            .then(() => !callbackConfig.approveInvitationLinkCreation ||
                         callbackConfig.approveInvitationLinkCreation(cUser, tresor.toObject(), inviter.toObject()))
            .then(appApproved => {
              if (!appApproved) {
                return adminApi.rejectInvitationLinkCreation(operationId).then(() => {
                  throw errors.forbidden("ApplicationDenied");
                });
              }
              debugLog("Approving...");
              return adminApi.approveInvitationLinkCreation(operationId);
            });
        });
      });
  }
  /**
   * Approves or rejects an invitation link accept operation on the result of canAcceptInvitationLink.
   * @param operationId The id of the operation
   * @param cUser The current user
   * @return {Promise}
   */
  function acceptedInvitationLink(operationId, cUser) {
    const userId = cUser.zkitId;
    debugLog("Invitation link acception for %s operation approval requested by %s", operationId, userId);

    return adminApi
      .getInvitationLinkAcceptionDetails(operationId)
      .catch(err => {
        throw errors.badInput("InvalidOperationId", err);
      })
      .then(details => {
        const tresorId = details.TresorId;
        const inviterId = details.ByUserId;
        const inviteeId = details.ForUserId;

        debugLog("%s accepts a link from %s to %s", inviteeId, inviterId, tresorId);
        return Promise.all([
          Tresor.findOne({ id: tresorId }),
          User.findOne({ zkitId: inviterId }).lean(),
          User.findOne({ zkitId: inviteeId }).lean()
        ]).then(([tresor, inviter, invitee]) => {
          debugLog("-----------");
          debugLog("tresor: %o", tresor);
          debugLog("creator: %o", inviter);
          debugLog("accepter: %o", invitee);
          debugLog("caller: %o", cUser);
          debugLog("-----------");

          return Promise.resolve(
            !callbackConfig.approveInvitationLinkAcception ||
             callbackConfig.approveInvitationLinkAcception(tresor.toObject(), invitee.toObject(), inviter.toObject(), cUser)
          ).then(appApproved => {
            if (!appApproved) {
              return adminApi.rejectInvitationLinkAcception(operationId).then(() => {
                throw errors.forbidden("ApplicationDenied");
              });
            }
            return adminApi.approveInvitationLinkAcception(operationId).then(() => {
              tresor.members.push(inviteeId);
              return tresor.save();
            });
          });
        });
      });
  }
  /**
   * Approves or rejects an kick operation on the result of canRevokeInvitationLink.
   * @param operationId The id of the operation
   * @param cUser The current user
   * @return {Promise}
   */
  function revokedInvitationLink(operationId, cUser) {
    const userId = cUser.zkitId;
    debugLog("Approval requested to revoke invitation link by id %s by user %s", operationId, userId);

    if (!operationId) throw errors.badInput("MissingOperationId");

    return adminApi
      .getInvitationLinkRevocationDetails(operationId)
      .catch(err => {
        throw errors.badInput("InvalidOperationId", err);
      })
      .then(details => {
        const tresorId = details.TresorId;
        const revokerId = details.ByUserId;

        debugLog("%s revokes a link for %s", revokerId, tresorId);
        return Promise.all([
          Tresor.findOne({ id: tresorId }),
          User.findOne({ zkitId: revokerId })
        ]).then(([tresor, revoker]) => {
          debugLog("-----------");
          debugLog("tresor: \n%o", tresor);
          debugLog("revoker: \n%o", revoker);
          debugLog("caller: \n%o", cUser);
          debugLog("-----------");
          return Promise.resolve(
            !callbackConfig.approveInvitationLinkRevocation ||
             callbackConfig.approveInvitationLinkRevocation(tresor.toObject(), revoker.toObject(), cUser)
          ).then(appApproved => {
            if (!appApproved) {
              return adminApi.rejectInvitationLinkRevocation(operationId).then(() => {
                throw errors.forbidden("ApplicationDenied");
              });
            }
            return adminApi.approveInvitationLinkRevocation(operationId);
          });
        });
      });
  }

  return {
    createdInvitationLink,
    acceptedInvitationLink,
    revokedInvitationLink
  };
};
