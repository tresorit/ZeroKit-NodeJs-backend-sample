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

const idpCodeRedirect = conf.zeroKit.idp.find((a) => a.clientID === process.env["ZKIT_CODE_CLIENT_ID"]).callbackURL;
const idpHybridRedirect = conf.zeroKit.idp.find((a) => a.clientID === process.env["ZKIT_HYBRID_CLIENT_ID"]).callbackURL;

function setupHelpers(remote) {
  return remote.execute(function () {
    function bytes_to_base64(arr){
      return btoa( bytes_to_string(arr) );
    }

    function base64_to_bytes(str){
      return string_to_bytes( atob( str ) );
    }

    function string_to_bytes ( str, utf8 ) {
      utf8 = !!utf8;

      var len = str.length,
        bytes = new Uint8Array( utf8 ? 4*len : len );

      for ( var i = 0, j = 0; i < len; i++ ) {
        var c = str.charCodeAt(i);

        if ( utf8 && 0xd800 <= c && c <= 0xdbff ) {
          if ( ++i >= len ) throw new Error( "Malformed string, low surrogate expected at position " + i );
          c = ( (c ^ 0xd800) << 10 ) | 0x10000 | ( str.charCodeAt(i) ^ 0xdc00 );
        }
        else if ( !utf8 && c >>> 8 ) {
          throw new Error("Wide characters are not allowed.");
        }

        if ( !utf8 || c <= 0x7f ) {
          bytes[j++] = c;
        }
        else if ( c <= 0x7ff ) {
          bytes[j++] = 0xc0 | (c >> 6);
          bytes[j++] = 0x80 | (c & 0x3f);
        }
        else if ( c <= 0xffff ) {
          bytes[j++] = 0xe0 | (c >> 12);
          bytes[j++] = 0x80 | (c >> 6 & 0x3f);
          bytes[j++] = 0x80 | (c & 0x3f);
        }
        else {
          bytes[j++] = 0xf0 | (c >> 18);
          bytes[j++] = 0x80 | (c >> 12 & 0x3f);
          bytes[j++] = 0x80 | (c >> 6 & 0x3f);
          bytes[j++] = 0x80 | (c & 0x3f);
        }
      }

      return bytes.subarray(0, j);
    }

    function bytes_to_string ( bytes, utf8 ) {
      utf8 = !!utf8;

      var len = bytes.length,
        chars = new Array(len);

      for ( var i = 0, j = 0; i < len; i++ ) {
        var b = bytes[i];
        if ( !utf8 || b < 128 ) {
          chars[j++] = b;
        }
        else if ( b >= 192 && b < 224 && i+1 < len ) {
          chars[j++] = ( (b & 0x1f) << 6 ) | (bytes[++i] & 0x3f);
        }
        else if ( b >= 224 && b < 240 && i+2 < len ) {
          chars[j++] = ( (b & 0xf) << 12 ) | ( (bytes[++i] & 0x3f) << 6 ) | (bytes[++i] & 0x3f);
        }
        else if ( b >= 240 && b < 248 && i+3 < len ) {
          var c = ( (b & 7) << 18 ) | ( (bytes[++i] & 0x3f) << 12 ) | ( (bytes[++i] & 0x3f) << 6 ) | (bytes[++i] & 0x3f);
          if ( c <= 0xffff ) {
            chars[j++] = c;
          }
          else {
            c ^= 0x10000;
            chars[j++] = 0xd800 | (c >> 10);
            chars[j++] = 0xdc00 | (c & 0x3ff);
          }
        }
        else {
          throw new Error("Malformed UTF8 character at byte offset " + i);
        }
      }

      var str = '',
        bs = 16384;
      for ( var i = 0; i < j; i += bs ) {
        str += String.fromCharCode.apply( String, chars.slice( i, i+bs <= j ? i+bs : j ) );
      }

      return str;
    }

    window.log = function log(str) {
      var node = document.createTextNode(str);
      document.body.appendChild(document.createElement('div').appendChild(node));
    };
    window.convertToPython = function convertToPython(obj) {
      if(!obj)
        return obj;

      if (obj.constructor.name === "Error")
        return obj;

      if(obj.constructor.name === "Uint8Array")
        return "@Uint8Array(" + bytes_to_base64(obj) + ")";

      if(typeof obj !== "object")
        return obj;

      Object.keys(obj).forEach(function(k){
        if(obj[k].constructor.name === "Uint8Array")
          obj[k] = "@Uint8Array(" + bytes_to_base64(obj[k]) + ")";
        else if(typeof obj[k] === "object")
          obj[k] = convertToPython(obj[k]);
      });

      return obj;
    };

    window.convertFromPython = function convertFromPython(obj) {
      if(!obj)
        return obj;
      if(typeof obj === "string" && obj.startsWith('@Uint8Array')){
        return base64_to_bytes(obj.replace(/@Uint8Array\((.*)\)/, '$1'));
      }

      if(typeof obj !== "object")
        return obj;
      const keys = Object.keys(obj);
      Object.keys(obj).forEach(function(k){
        if(typeof obj[k] === "string" && obj[k].startsWith('@Uint8Array'))
          obj[k] = base64_to_bytes(obj[k].replace(/@Uint8Array\((.*)\)/, '$1'));
        else if(typeof obj[k] === "object")
          obj[k] = convertFromPython(obj[k]);
      });

      return obj;
    };
  });
}

class RemoteClient {
  constructor(remote) {
    this.remote = setupHelpers(
      remote.init()
      .url(`${conf.zeroKit.serviceUrl}/static/v${conf.zeroKit.sdkVersion}/api.html`)
      .timeouts('script', 30000)
    );
  }

  call(method, ...args) {
    return this.remote.executeAsync(function(methodName, argList, done) {
      log(methodName + '(\'' + argList.join('\', \'') + '\');');
      if(window.mobileCmd[methodName]) {
        log('Called on mobileCmd');
        window.mobileCmd[methodName].apply(null, argList.map(convertFromPython)).then(
          function(val){ log('resolve w/ ' + JSON.stringify(convertToPython(val))); done([null, convertToPython(val)]); },
          function(err){ log('reject w/ ' + JSON.stringify(err)); done([err, null]); });
      } else {
        log('Called on cmd.api');
        window.cmd.api[methodName].apply(null, argList.map(convertFromPython)).then(
          function(val){ log('resolve w/ ' + JSON.stringify(convertToPython(val))); done([null, convertToPython(val)]); },
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

  createInvitationLink(linkBase, tresorId, message, password) {
    return this.call('createInvitationLink', linkBase, tresorId, message, password);
  }

  getInvitationLinkInfo(secret) {
    return this.call('getInvitationLinkInfo', secret);
  }

  acceptInvitationLink(token, password) {
    return this.call('acceptInvitationLink', token, password);
  }

  revokeInvitationLink(containerId, secret) {
    return this.call('revokeInvitationLink', containerId, secret);
  }

  logout() {
    return this.call('logout');
  }

  whoAmI() {
    return this.call('whoAmI');
  }

  continueCodeFlow(url) {
    return setupHelpers(this.remote.newWindow(url, 'idpCodeLogin'))
      .waitUntil(
        () =>  this.remote.url().then(url => url.value.startsWith(idpCodeRedirect)),
        10000)
      .then(() => this.remote.url())
      .then((url) => this.remote.close().then(() => url.value))
  }

  hybridLogin(clientId, state) {
    const cbPath = idpHybridRedirect;
    const authUrl = conf.zeroKit.serviceUrl + '/idp/connect/authorize?' +
      'client_id=' + encodeURI(clientId) +
      '&redirect_uri=' + encodeURI(cbPath) +
      '&response_type=' + encodeURI('id_token code') +
      '&scope=' + encodeURI('profile openid') +
      '&state=' + encodeURI(state) +
      '&nonce=' + encodeURI(state) +
      '&response_mode=fragment&prompt=none';

    return setupHelpers(this.remote.newWindow(authUrl, 'idpHybridLogin'))
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
