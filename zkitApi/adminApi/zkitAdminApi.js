const adminApiCall = require("./adminApiCall");

module.exports = {
  initUserRegistration,
  validateUser,

  listTresorMembers,
  approveTresorCreation,
  rejectTresorCreation,

  getShareDetails,
  approveShare,
  rejectShare,

  getKickDetails,
  approveKick,
  rejectKick
};

/*
 This endpoint on the server returns an object containing:
 UserId: This is the new user's id, used for operations like tresor sharing. Uniquely identifies the new user.
 RegSessionId: This is a public information that identifies this registration process.
 RegSessionVerifier: This is a server side secret, that should never touch the client device. Used during validation.
 */
function initUserRegistration() {
  return adminApiCall("/user/init-user-registration", {}); // we need to make this a post
}

/*
 This server call will enable the user: now it can be used to log in.
 The parameters are described above: the server gets them from the initUserRegistration call, and will need to be
 stored on the application server until validation.
 The regValidationVerifier is returned by the sdk registration call, and is sent to and stored on the app server.
 */
function validateUser(id, regSessionId, regSessionVerifier, regValidationVerifier) {
  return adminApiCall("/user/validate-user-registration", {
    RegSessionId: regSessionId,
    RegSessionVerifier: regSessionVerifier,
    RegValidationVerifier: regValidationVerifier,
    UserId: id
  });
}

/*
 This method lists the ids of the members of the tresor
 */
function listTresorMembers(tresorId) {
  return adminApiCall("/tresor/list-members?tresorid=" + tresorId);
}
/*
 This method is used to commit the tresor creation operation, before that the tresor is unusable.
 This provides control over the flow of information in your application and serves to synchronize the application and
 the tenant database
 */
function approveTresorCreation(tresorId) {
  return adminApiCall("/tresor/approve-tresor-creation", { TresorId: tresorId });
}
/*
 This method is used to reject the tresor creation operation, rendering the tresor completely unusable.
 */
function rejectTresorCreation(tresorId) {
  return adminApiCall("/tresor/reject-tresor-creation", { TresorId: tresorId });
}

/*
  This method can be used to get details of the operation, it returns the id of the tresor and the ids of both the inviter and the invited
 */
function getShareDetails(operationId) {
  return adminApiCall("/tresor/get-share-details?operationid=" + operationId);
}
/*
 This method is used to commit the share operation, before approval, the share has no effect on the database and on
 the tresor data downloaded by other users. After approval the tresor changes and the invited user can now decrypt
 data encrypted by this tresor.
 This provides control over the flow of information in your application and serves to synchronize the application and
 the tenant database
 */
function approveShare(operationId) {
  return adminApiCall("/tresor/approve-share", { OperationId: operationId });
}
/*
 This method is used to reject the share operation, rendering it completely ineffective.
 */
function rejectShare(operationId) {
  return adminApiCall("/tresor/reject-share", { OperationId: operationId });
}

/*
 This method can be used to get details of the operation, it returns the id of the tresor and the ids of both the kickerer and the kicked
 */
function getKickDetails(operationId) {
  return adminApiCall("/tresor/get-kick-details?operationid=" + operationId);
}
/*
 This method is used to approve and commit the kick operation making the uploaded tresor effective.
 */
function approveKick(operationId) {
  return adminApiCall("/tresor/approve-kick", { OperationId: operationId });
}
/*
 This method is used to reject the kick operation, rendering it completely ineffective.
 */
function rejectKick(operationId) {
  return adminApiCall("/tresor/reject-kick", { OperationId: operationId });
}
