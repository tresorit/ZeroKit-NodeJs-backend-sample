const uid = require('uid2');

const test = require('../lib/test');

module.exports = function () {
  describe('Registration', function () {
    let user1;
    beforeEach(() => {
      user1 = 'test-user-'+uid(8);
    });
    describe('init-user-registration', function () {
      it('should work without profileData', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((resp) =>
            test.User.findOne({userName: user1})
              .should.eventually.be.ok.then(user => ([
                user.should.have.property('userName').equal(user1),
                user.should.have.property('zkitId').equal(resp.body.userId),
                user.should.have.property('state').equal(0),
                user.should.have.property('registrationData'),
                user.registrationData.should.have.property('sessionId').that.is.ok,
                user.registrationData.should.have.property('sessionVerifier').that.is.ok
              ]))
          );
      });

      it('should work with non-json string profileData',  function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1, profileData: "nonJSON"})
          .then((initResp) =>
            initResp.should.have.property('status').equal(200)
          );
      });

      it('should work again on unfinished registrations', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((fResp) =>
            test.server
              .post('/api/user/init-user-registration')
              .send({userName: user1})
              .then(sResp => {
                console.log(fResp.body, sResp.body);
                sResp.body.userId.should.not.equal(fResp.userId);
                sResp.body.regSessionId.should.not.equal(fResp.userId);

                return Promise.all([
                  test.User.findOne({userName: user1, zkitId: sResp.body.userId, state: 0})
                    .should.eventually.be.ok,
                  test.User.findOne({userName: user1, zkitId: fResp.body.userId, state: 0})
                    .should.eventually.be.not.ok]);
              })
          );
      });

      it('should set the proper profileData', function () {
        const profileData = uid(64);
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1, profileData})
          .then((resp) =>
            test.User.findOne({userName: user1, zkitId: resp.body.userId, state: 0})
              .should.eventually.have.property('profileData').equal(profileData)
          );
      });

      it('should return proper error code on empty username', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: ''})
          .should.be.rejected
          .then(error => {
            error.should.have.property('status').equal(400);
            error.response.body.should.have.property('code').equal('MissingUserName');
          });
      });

      it('should return proper error code on application denial', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1, profileData: JSON.stringify({canInitReg: false})})
          .should.be.rejected
          .then(error => {
            error.should.have.property('status').equal(403);
            error.response.body.should.have.property('code').equal('ApplicationDenied');
          });
      });
    });

    describe('finish-user-registration', function () {
      beforeEach(() => {
        user1 = 'test-user-' + uid(8);
      });

      it('should update the user', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((initResp) =>
            test.client.register(initResp.body.userId, initResp.body.regSessionId, '').then((finishRes) =>
              test.server.post('/api/user/finish-user-registration')
                .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
                .then(() => test.User.findOne({userName: user1}).lean())
                .then(user => [
                  user.should.have.property('zkitId').equal(initResp.body.userId),
                  user.should.have.property('state').equal(1),
                  user.should.have.property('registrationData')
                    .that.has.property('validationVerifier').equal(finishRes.RegValidationVerifier)
                ])
            )
          );
      });
    });

    describe('validate-user', function () {
      it('should update the user', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((initResp) =>
            test.client.register(initResp.body.userId, initResp.body.regSessionId, '').then((finishRes) =>
              test.server.post('/api/user/finish-user-registration')
                .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
                .then(() => test.User.findOne({userName: user1}).lean())
                .then(user =>
                  test.server.post('/api/user/validate-user')
                    .send({validationCode: user.registrationData.validationCode, userId: user.zkitId})
                    .should.be.fulfilled
                ).then(() => test.User.findOne({userName: user1}).lean())
                .then(user => [
                  user.should.have.property('registrationData').that.is.null,
                  user.state.should.equal(2)
                ])
            )
          );
      });


      it('should return 400 for already validated users', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((initResp) =>
            test.client.register(initResp.body.userId, initResp.body.regSessionId, '').then((finishRes) =>
              test.server.post('/api/user/finish-user-registration')
                .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
                .then(() => test.User.findOne({userName: user1}).lean())
                .then(user =>
                  test.server.post('/api/user/validate-user')
                    .send({validationCode: user.registrationData.validationCode, userId: user.zkitId})
                    .then(() =>
                      test.server.post('/api/user/validate-user')
                        .send({validationCode: user.registrationData.validationCode, userId: user.zkitId})
                        .should.be.rejected.then(error => [
                          error.should.have.property('status').equal(400),
                          error.response.should.have.property('body')
                          .that.has.property('code').equal('UserAlreadyValidated')
                        ])
                    )
                )
            )
          );
      });
    });
  });
};
