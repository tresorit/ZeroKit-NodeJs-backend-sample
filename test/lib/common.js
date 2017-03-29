const test = require('./test');
const tokenStore = require('../../zkitApi/utils/memoryTokenStore');

module.exports = {
  register,
  login,
  tokenLogin,
  createTresor,
  shareTresor,
  kickFromTresor
};

function register(userName, pw, autoValidate = true) {
  return test.server
    .post('/api/user/init-user-registration')
    .send({userName: 'test-user-'+userName, profileData: JSON.stringify({autoValidate})})
    .then((initResp) =>
      test.client.register(initResp.body.userId, initResp.body.regSessionId, pw).then((finishRes) =>
        test.server.post('/api/user/finish-user-registration')
          .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
      ).then(() => initResp.body.userId)
    );
}

function login(userName, pw){
  return test.server
    .get(`/api/user/get-user-id?userName=test-user-${userName}`)
    .then((idResp) => idResp.body)
    .then((userId) => test.client.login(userId, pw));
}

function tokenLogin() {
  return test.client.whoAmI()
    .then(zkitId => test.User.findOne({zkitId: zkitId}).lean())
    .then(user => tokenStore.newToken(user).id);
}

function createTresor(token) {
  return test.client.createTresor()
    .then((tresorId) => test.server
      .post('/api/tresor/created')
      .set('Authorization', `Bearer ${token}`)
      .send({tresorId})
      .then(() => tresorId)
    );
}

function shareTresor(tresorId, inviteeUserName, token) {
  return test.server
    .get(`/api/user/get-user-id?userName=test-user-${inviteeUserName}`)
    .then((idResp) => idResp.body)
    .then((userId) => test.client.shareTresor(tresorId, userId))
    .then((operationId) => test.server
      .post('/api/tresor/invited-user')
      .set('Authorization', `Bearer ${token}`)
      .send({operationId})
    );
}

function kickFromTresor(tresorId, inviteeUserName, token) {
  return test.server
    .get(`/api/user/get-user-id?userName=test-user-${inviteeUserName}`)
    .then((idResp) => idResp.body)
    .then((userId) => test.client.kickFromTresor(tresorId, userId))
    .then((operationId) => test.server
      .post('/api/tresor/kicked-user')
      .set('Authorization', `Bearer ${token}`)
      .send({operationId})
    );
}
