/**
 * Stores, issues and checks tokens in the server memory
 */

const uid = require("uid2");
const debugLogger = require("./debugLogger")("TokenStore");

const tokenStore = new Map();

/**
 * Stores information about a token that can be used to access the api
 */
class Token {
  constructor(id, user, validUntil) {
    this.id = id;
    this.user = user;
    this.validUntil = validUntil;
  }
}

/**
 * Issues a new token for the user
 * @param user The id of the user the token can be used for
 * @param validityDelta Validity of the token in seconds
 * @return {Token} The token info that is also stored in memory.
 */
exports.newToken = function(user, validityDelta = 3600) {
  const tokenId = uid(64);
  const token = new Token(tokenId, user, new Date(Date.now() + validityDelta * 1000));

  tokenStore.set(tokenId, token);
  debugLogger("Issued token for %o with id %s until %o", token.user, token.id, token.validUntil);

  return token;
};

/**
 * Checks if the token by the given id is valid.
 * @param tokenId The id of the token to check
 * @return {Token|null} Returns the token if it was valid.
 */
exports.checkToken = function(tokenId) {
  const token = tokenStore.get(tokenId);
  debugLogger("Checking token %s", tokenId);
  debugLogger("Found: %o", token);
  if (token) {
    debugLogger("Token Found");
    if (Date.now() < token.validUntil) {
      debugLogger("Validated");
      return token;
    }
    debugLogger("Invalid, deleting from store");
    tokenStore.delete(tokenId);
  }
  return null;
};

/**
 * Revokes the token
 * @param tokenId The id of the token to revoke
 * @return {boolean} True if there was a token to revoke by that id
 */
exports.revokeToken = function(tokenId) {
  debugLogger("Revoking token %s", tokenId);
  return tokenStore.delete(tokenId);
};
