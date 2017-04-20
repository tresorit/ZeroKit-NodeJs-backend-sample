const uid = require('uid2');

const test = require('../lib/test');
const c = require('../lib/common');

module.exports = function () {
  describe('Data', function () {
    let userName, userId;
    let token;

    beforeEach(() => {
      userName = uid(8);

      return c.register(userName, 'a')
        .then(id => userId = id)
        .then(() => c.login(userName, 'a'))
        .then(() => c.tokenLogin())
        .then((id) => token = id);
    });

    describe('profile', () => {
      it('should return data stored on init', () => {
        return test.server.get('/api/data/profile')
          .set('Authorization', `Bearer ${token}`)
          .then(({body}) => [
            body.should.equal('{"autoValidate":true}')
          ]);
      });

      it('store should set the proper profileData in db', () => {
        const testData = uid(64);
        return test.server.post('/api/data/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({data: testData})
          .should.be.fulfilled
          .then(() =>
            test.User.findOne({zkitId: userId}).then(
              user => user.profileData.should.equal(testData)
            )
          );
      });

      it('should be able to get previously set data', () => {
        const testData = uid(64);
        return test.server.post('/api/data/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({data: testData})
          .should.be.fulfilled
          .then(() =>
            test.server.get('/api/data/profile')
              .set('Authorization', `Bearer ${token}`)
          ).then(({body}) => [
            body.should.be.ok,
            body.should.equal(testData)
          ]);
      });
    });

    describe('normal', () => {
      let tresorId;
      let dataId;
      let testData;

      beforeEach(() => {
        dataId = uid(16);
        testData = uid(64);

        return c.createTresor(token).then((id) => tresorId = id);
      });

      describe('store', () => {
        it('should store data in the db', () => {
          return test.server.post(`/api/data/store?id=${dataId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({tresorId: tresorId, data: testData})
            .should.be.fulfilled
            .then(() =>
              test.Data.findOne({id: dataId}).then((data) => [
                data.should.be.ok,
                data.data.should.equal(testData)
              ])
            );
        });

        it('should overwrite data in the db', () => {
          return test.server.post(`/api/data/store?id=${dataId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({tresorId: tresorId, data: testData})
            .then(() =>
              test.server.post(`/api/data/store?id=${dataId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({tresorId: tresorId, data: testData + '2'})
            ).should.be.fulfilled
            .then(() =>
              test.Data.findOne({id: dataId}).then((data) => [
                data.should.be.ok,
                data.data.should.equal(testData + '2')
              ])
            );
        });

        it('should return data stored', () => {
          return test.server.post(`/api/data/store?id=${dataId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({tresorId: tresorId, data: testData})
            .should.be.fulfilled
            .then(() =>
              test.server.get(`/api/data/get?id=${dataId}`)
                .set('Authorization', `Bearer ${token}`)
                .should.be.fulfilled
                .then(({body}) => [
                  body.should.equal(testData)
                ])
            );
        });

        it('should deny access to non-members', () => {
          return test.server.post(`/api/data/store?id=${dataId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({tresorId: tresorId, data: testData})
            .then(() => c.register(userName + '2', 'a'))
            .then(id => userId = id)
            .then(() => c.login(userName + '2', 'a'))
            .then(() => c.tokenLogin())
            .then((id) => token = id)
            .then(() =>
              test.server.get(`/api/data/get?id=${dataId}`)
                .set('Authorization', `Bearer ${token}`)
                .should.be.rejected
                .then(error => [
                  error.should.have.property('status').equal(403),
                  error.response.should.have.property('body')
                    .that.has.property('code').equal('ApplicationDenied')
                ])
            );
        });
      });
    });
  });
};
