const uid = require('uid2');

const test = require('../lib/test');
const c = require('../lib/common');

module.exports = function () {
  describe('InvitationLinks', function () {
    let user1, user2;
    let userId2;
    let token;
    let tresorId;

    beforeEach(() => {
      user1 = uid(8);
      user2 = uid(8);

      return c.register(user1, 'a')
        .then(() => c.login(user1, 'a'))
        .then(() => c.tokenLogin())
        .then((id) => token = id)
        .then(() => c.createTresor(token))
        .then((id) => tresorId = id);
    });

    describe('create', () => {
      it('should approve links', () => {
        return test.client.createInvitationLink("", tresorId, "", "asdf")
          .then(resp => {
            return test.server.post('/api/invitationLinks/created')
              .set('Authorization', `Bearer ${token}`)
              .send({operationId: resp.id})
              .should.be.fulfilled
              .then(() => test.client.getInvitationLinkInfo(resp.url.substr(1)))
              .should.be.fulfilled
          })
      });
    });

    describe('revoke', () => {
      it('should revoke links', () => {
        return test.client.createInvitationLink("", tresorId, "", "asdf")
          .then(resp => {
            return test.server.post('/api/invitationLinks/created')
              .set('Authorization', `Bearer ${token}`)
              .send({operationId: resp.id})
              .should.be.fulfilled
              .then(() => test.client.revokeInvitationLink(tresorId, resp.url.substr(1)))
              .then(opId => {
                console.log(opId);
                return test.server.post('/api/invitationLinks/revoked')
                  .set('Authorization', `Bearer ${token}`)
                  .send({operationId: opId})
                  .should.be.fulfilled
              });
          })
      });
    });

    describe('accept', () => {
      it('should add user to tresor', () => {
        return test.client.createInvitationLink("", tresorId, "", "asdf")
          .then(resp => {
            return test.server.post('/api/invitationLinks/created')
              .set('Authorization', `Bearer ${token}`)
              .send({operationId: resp.id})
              .should.be.fulfilled
              .then(() => c.register(user2, 'a'))
              .then(id => userId2 = id)
              .then(() => c.login(user2, 'a'))
              .then(() => c.tokenLogin())
              .then((id) => token = id)
              .then(() => test.client.getInvitationLinkInfo(resp.url.substr(1)))
              .then((info) => test.client.acceptInvitationLink(info.$token, "asdf"))
              .then(opId => {
                return test.server.post('/api/invitationLinks/accepted')
                  .set('Authorization', `Bearer ${token}`)
                  .send({operationId: opId})
                  .should.be.fulfilled
              }).then(() => {
                return test.Tresor.findOne({id: tresorId}).then(tresor => [
                  tresor.should.be.ok,
                  tresor.should.have.property('members'),
                  tresor.members.should.have.length(2),
                  tresor.members.should.include(userId2)
                ]);
              });
          })
      });
    });

  });
};
