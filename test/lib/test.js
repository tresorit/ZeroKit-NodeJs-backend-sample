const conf = require('../../' + (process.env.ZKIT_CONFIG_FILE || "./config"));
let client;

const webdriverio = require('webdriverio');

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../app');

const User = require('../../zkitApi/db/User');
const Tresor = require('../../zkitApi/db/Tresor');
const Data = require('../../zkitApi/db/Data');

chai.use(chaiHttp);
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
require('chai').should();


class RemoteClient {
  constructor(remote) {
    this.remote = remote.init().url(`${conf.zeroKit.serviceUrl}/static/v${conf.zeroKit.sdkVersion}/api.html`);
  }

  call(method, ...args) {
    this.remote.timeoutsAsyncScript(30000);
    return this.remote.executeAsync(function(methodName, argList, done) {
      function log(str) {
        var node = document.createTextNode(str);
        document.body.appendChild(document.createElement('div').appendChild(node));
      }

      log(methodName + '(\'' + argList.join('\', \'') + '\');');
      if(window.mobileCmd[methodName]) {
        log('Called on mobileCmd');
        window.mobileCmd[methodName].apply(null, argList).then(
          function(val){ log('resolve w/ ' + JSON.stringify(val)); done([null, val]); },
          function(err){ log('reject w/ ' + JSON.stringify(err)); done([err, null]); });
      } else {
        log('Called on cmd.api');
        window.cmd.api[methodName].apply(null, argList).then(
          function(val){ log('resolve w/ ' + JSON.stringify(val)); done([null, val]); },
          function(err){ log('reject w/ ' + JSON.stringify(err)); done([err, null]); });
      }
    }, method, args).then((res) => {
      if(res.value[0])
        throw res.value[0];
      else
        return res.value[1];
    });
  }

  register(userId, regId, password) {
    return this.call('register', userId, regId, password);
  }

  login(alias, password) {
    return this.call('login', alias, password);
  }

  encrypt(tresorId, plainText) {
    return this.call('encrypt', tresorId, plainText);
  }

  decrypt(cipherText) {
    return this.call('decrypt', cipherText);
  }

  createTresor() {
    return this.call('createTresor');
  }

  shareTresor(tresorId, userId) {
    return this.call('shareTresor', tresorId, userId);
  }

  kickFromTresor(tresorId, userId) {
    return this.call('kickFromTresor', tresorId, userId);
  }

  logout() {
    return this.call('logout');
  }

  whoAmI() {
    return this.call('whoAmI');
  }

  continueCodeFlow(url) {
    return this.remote.newWindow(url, 'idpCodeLogin')
      .waitUntil(
        () =>  this.remote.url().then(url => url.value.startsWith('http://localhost:3000/api/auth/callback')),
        10000)
      .then(() => this.remote.url())
      .then((url) => this.remote.close().then(() => url.value))
  }

  hybridLogin(clientId, state) {
    const cbPath = `${conf.zeroKit.serviceUrl}/static/v${conf.zeroKit.sdkVersion}/embedded-login.html`;
    const authUrl = conf.zeroKit.serviceUrl + '/idp/connect/authorize?' +
      'client_id=' + encodeURI(clientId) +
      '&redirect_uri=' + encodeURI(cbPath) +
      '&response_type=' + encodeURI('id_token code') +
      '&scope=' + encodeURI('profile openid') +
      '&state=' + encodeURI(state) +
      '&nonce=' + encodeURI(state) +
      '&response_mode=fragment&prompt=none';

    return this.remote.newWindow(authUrl, 'idpHybridLogin')
      .waitUntil(
        () => this.remote.url().then(url => url.value.startsWith(cbPath)),
        10000)
      .then(() => this.remote.url())
      .then((url) => this.remote.close().then(() => url.value));
  }
}

function setRemote(browserName, version) {
  const opts = {
    user: process.env.BROWSERSTACK_USERNAME,
    key: process.env.BROWSERSTACK_ACCESS_KEY,
    desiredCapabilities: {
      browserName: browserName,
      version: version,
    }
  };
  const remote = webdriverio.remote(opts);

  module.exports.client = new RemoteClient(remote);
  return module.exports.client;
}

module.exports = {
  server: chai.request.agent(app),
  resetServer: () => {module.exports.server = chai.request.agent(app); },
  client,

  codeClientId: process.env.ZKIT_CODE_CLIENT_ID,
  hybridClientId: process.env.ZKIT_HYBRID_CLIENT_ID,

  setRemote,

  User,
  Tresor,
  Data
};
