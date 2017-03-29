const uid = require('uid2');

const test = require('../lib/test');
const c = require('../lib/common');

module.exports = function () {
  describe('Tresors', function () {
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

    describe('created', () => {
      it('should return 401 if with no login info', function () {
        return test.client.createTresor()
          .then((tresorId) => test.server
            .post('/api/tresor/created')
            .send({tresorId})
            .then(() => tresorId)
          ).should.be.rejected.then(error => [
            error.should.have.property('status').equal(401)
          ]);
      });

      it('should save the tresor with the proper members', function () {
        return test.client.createTresor()
          .then((tresorId) => test.server
            .post('/api/tresor/created')
            .set('Authorization', `Bearer ${token}`)
            .send({tresorId})
            .then(() => {
              return test.Tresor.findOne({id: tresorId}).then(tresor => [
                tresor.should.be.ok,
                tresor.should.have.property('members'),
                tresor.members.should.have.length(1),
                tresor.members.should.include(userId)
              ]);
            })
          );
      });
    });

  });
};
