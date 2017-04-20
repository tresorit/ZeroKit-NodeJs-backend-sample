const uid = require('uid2');

const test = require('../lib/test');
const c = require('../lib/common');

module.exports = function () {
  describe('Login', function () {
    let user1;
    beforeEach(() => {
      user1 = 'test-user-'+uid(8);
    });
    describe('get-user-id', function () {
      it('should return 404 for unregistered users', function () {
        return test.server
          .get(`/api/user/get-user-id?userName=${user1}`)
          .should.be.rejected
          .then(error => [
            error.should.have.property('status').equal(404),
            error.response.should.have.property('body')
              .that.has.property('code').equal('UserNotFound')
          ]);
      });

      it('should return 404 for users after only init-user-registration', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then(() =>
            test.server
              .get(`/api/user/get-user-id?userName=${user1}`)
              .should.be.rejected
              .then(error => [
                error.should.have.property('status').equal(404),
                error.response.should.have.property('body')
                  .that.has.property('code').equal('UserNotFound')
              ])
          );
      });

      it('should return 403 for unvalidated users', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1})
          .then((initResp) =>
            test.client.register(initResp.body.userId, initResp.body.regSessionId, '').then((finishRes) =>
              test.server.post('/api/user/finish-user-registration')
                .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
                .then(() =>
                  test.server
                    .get(`/api/user/get-user-id?userName=${user1}`)
                    .should.be.rejected
                    .then(error => [
                      error.should.have.property('status').equal(403),
                      error.response.should.have.property('body')
                        .that.has.property('code').equal('UserNotValidated')
                    ])
                )
            )
          );
      });

      it('should return the user id for validated users', function () {
        return test.server
          .post('/api/user/init-user-registration')
          .send({userName: user1, profileData: JSON.stringify({autoValidate: true})})
          .then((initResp) =>
            test.client.register(initResp.body.userId, initResp.body.regSessionId, '').then((finishRes) =>
              test.server.post('/api/user/finish-user-registration')
                .send({userId: initResp.body.userId, validationVerifier: finishRes.RegValidationVerifier})
                .then(() =>
                  test.server
                    .get(`/api/user/get-user-id?userName=${user1}`)
                    .should.be.fulfilled
                    .then(resp => [
                      resp.should.have.property('status').equal(200),
                      resp.body.should.equal(initResp.body.userId)
                    ])
                )
            )
          );
      });
    });
    
    describe('IDP Code', function () {
      afterEach(function () {
        test.client.remote.deleteCookie();
        test.client.remote.sessionStorage('DELETE');
        test.client.remote.localStorage('DELETE');
      });

      it('shouldn\'t work logged out', function () {
        return test.client.logout()
          .then(() => test.server.get(`/api/auth/login?clientId=${test.codeClientId}`).redirects(0))
          .then(null, ({response}) => {
            response.should.have.status(302).and.header('Location');
            return test.client.continueCodeFlow(response.headers.location);
          }).then((url) => url.should.contain('error=login_required'));
      });
      it('should work logged in', function () {
        const userName = Date.now();
        return c.register(userName, 'a')
          .then(() => c.login(userName, 'a'))
          .then(() => test.server.get(`/api/auth/login?clientId=${test.codeClientId}&reto=${encodeURIComponent('/api/data/profile')}`).redirects(0))
          .then(null, ({response}) => {
            response.should.have.status(302).and.header('Location');
            return test.client.continueCodeFlow(response.headers.location);
          }).then((url) => {
            return test.server.get('/api/auth/callback'+ url.substr(url.indexOf('?')));
          }).should.be.fulfilled
          .then(() => c.createTresor().should.be.fulfilled);
      });

      describe('server logout', function () {
        it('should work', function () {
          const userName = Date.now();
          return c.register(userName, 'a')
            .then(() => c.login(userName, 'a'))
            .then(() => test.server.get(`/api/auth/login?clientId=${test.codeClientId}&reto=${encodeURIComponent('/api/data/profile')}`).redirects(0))
            .catch(({response}) => test.client.continueCodeFlow(response.headers.location))
            .then((url) => test.server.get('/api/auth/callback'+ url.substr(url.indexOf('?'))))
            .then(() => test.server.get(`/api/auth/logout`))
            .then(() =>
              c.createTresor().should.be.rejected
                .then(error => error.should.have.property('status').equal(401))
            );
        });
      });
    });

    describe('IDP Hybrid flow', function () {
      afterEach(function () {
        test.client.remote.deleteCookie();
        test.client.remote.sessionStorage('DELETE');
        test.client.remote.localStorage('DELETE');
      });
      it('shouldn\'t work logged out', function () {
        const state = Date.now() + Math.random();
        return test.client.logout()
          .then(() => test.client.hybridLogin(test.hybridClientId, state))
          .then((url) => url.should.contain('error=login_required'));
      });

      it('should work logged in', function () {
        const state = (Date.now()).toString() + Math.random().toString();
        const userName = Date.now();
        let userId;
        return c.register(userName, 'a')
          .then(id => userId = id)
          .then(() => c.login(userName, 'a'))
          .then(() => test.client.hybridLogin(test.hybridClientId, state))
          .then((url) => {
            const hash = url.substr(url.indexOf('#') + 1);

            const result = hash.split('&').reduce(function (result, item) {
              const parts = item.split('=').map(decodeURIComponent);
              result[parts[0]] = parts[1];
              return result;
            }, {});
            result.should.not.have.property('error');
            result.should.have.property('state').equal(state);
            result.should.have.property('code');
            return test.server.post(`/api/auth/login-by-code?clientId=${test.hybridClientId}`)
              .send({code: result.code});
          }).then(({body}) => {
            body.should.have.property('id').that.is.a('string');
            body.should.have.property('user')
              .that.that.has.a.property('zkitId')
              .that.is.a('string').equal(userId);
            return c.createTresor(body.id).should.be.successfull;
          });
      });

      describe('server logout', function () {
        it('should work', function () {
          const state = (Date.now()).toString() + Math.random().toString();
          const userName = Date.now();
          let userId;
          return c.register(userName, 'a')
            .then(id => userId = id)
            .then(() => c.login(userName, 'a'))
            .then(() => test.client.hybridLogin(test.hybridClientId, state))
            .then((url) => {
              const hash = url.substr(url.indexOf('#') + 1);

              const result = hash.split('&').reduce(function (result, item) {
                const parts = item.split('=').map(decodeURIComponent);
                result[parts[0]] = parts[1];
                return result;
              }, {});
              result.should.not.have.property('error');
              result.should.have.property('state').equal(state);
              result.should.have.property('code');
              return test.server.post(`/api/auth/login-by-code?clientId=${test.hybridClientId}`)
                .send({code: result.code});
            }).then(({body}) => {
              body.should.have.property('id').that.is.a('string');
              body.should.have.property('user')
                .that.that.has.a.property('zkitId')
                .that.is.a('string').equal(userId);
              return test.server.get(`/api/auth/logout-token`)
                .set('Authorization', `Bearer ${body.id}`)
                .send()
                .then(() => c.createTresor(body.id).should.be.rejected)
                .then(error => error.should.have.property('status').equal(401))
            })

            .then(() =>
              c.createTresor().should.be.rejected
                .then(error => error.should.have.property('status').equal(401))
            );
        });
      });
    });
  });
};
