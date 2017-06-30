const uid = require('uid2');

const test = require('../lib/test');
const c = require('../lib/common');

module.exports = function () {
  describe('Sharing', function () {
    let user1, user2;
    let token;
    let tresorId;

    beforeEach(() => {
      user1 = uid(8);
      user2 = uid(8);

      return Promise.all([
        c.register(user1, 'a'),
        c.register(user2, 'b')
      ]).then(() => c.login(user1, 'a'))
        .then(() => c.tokenLogin())
        .then((id) => token = id)
        .then(() => c.createTresor(token))
        .then((id) => tresorId = id);
    });

    describe('shareTresor', () => {
      it('should make the invitee able to encrypt with tresor after approval', () => {
        return c.shareTresor(tresorId, user2, token)
          .then(() => c.login(user2, 'b'))
          .then(() => test.client.whoAmI())
          .then(() => test.client.encrypt(tresorId, 'asdf'))
          .should.be.fulfilled;
      });
    });

    describe('kickFromTresor', () => {
      beforeEach(() => {
        return c.shareTresor(tresorId,user2, token);
      });

      it('should make the invitee not able to encrypt with tresor after approval', () => {
        return c.kickFromTresor(tresorId, user2, token)
          .then(() => c.login(user2, 'b'))
          .then(() =>
            test.client.encrypt(tresorId, 'asdf').should.be.rejected
          );
      });
    });
  });
};
