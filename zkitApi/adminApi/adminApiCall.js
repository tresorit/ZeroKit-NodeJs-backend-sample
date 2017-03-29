const rp = require("request-promise-native");
const crypto = require("crypto");
const config = require("../../app.config.js").zeroKit;

/**
 * Convenience function to call admin endpoints on the tenant server.
 * Calls the api endpoint in the first parameter, using post if there is an object in the second parameter, GET otherwise.
 * @param urlPart Path to the endpoint
 * @param contentObj Object to post, use undefined for GET
 * @return {Promise<*>} Returns a promise to whatever the server returns.
 */
//
module.exports = function(urlPart, contentObj) {
  urlPart = config.apiPath + urlPart;
  const contentBuffer = contentObj ? contentify(contentObj) : null;
  const headers = adminCallAuth(urlPart, contentBuffer);

  return rp({
    method: contentObj ? "POST" : "GET",
    uri: config.apiBase + urlPart,
    headers: headers,
    body: contentBuffer
  }).then(body => body.length > 0 ? JSON.parse(body) : {});
};

/**
 * Concatenates the headers into a canonical format used to sign the request
 * @param verb Verb of the call
 * @param path Path to the endpoint
 * @param headers Headers of the call
 * @param hmacHeaders Headers to include in hmac
 * @return {string} Canonical string
 */
function getHeaderStringToHash(verb, path, headers, hmacHeaders) {
  return verb + "\n" + path + "\n" + hmacHeaders.map(key => key + ":" + headers[key]).join("\n");
}

/**
 * Calculates the necessary headers for authentication. The exact definitions and a detailed guide on this type of
 * authentication can be found in the in the provided documentation.
 * @param path The path to the endpoint
 * @param contentBuffer The bytes that will be sent or undefined (or null) for GET
 * @return {*} The headers to pass
 */
function adminCallAuth(path, contentBuffer) {
  // Format ISO8601 with no milliseconds
  const date = new Date().toISOString().substr(0, 19) + "Z";
  const headers = {
    UserId: config.adminUserId,
    TresoritDate: date,
    "Content-Type": "application/json"
  };

  if (contentBuffer) headers["Content-SHA256"] = sha256hex(contentBuffer);

  const hmacHeaders = Object.keys(headers);
  hmacHeaders.push("HMACHeaders");
  headers["HMACHeaders"] = hmacHeaders.join(",");

  const headerStringToHash = getHeaderStringToHash(contentBuffer ? "POST" : "GET", path, headers, hmacHeaders);
  headers["Authorization"] = "AdminKey " + hmacSha256base64(headerStringToHash, config.adminKey);
  return headers;
}

// Convenience functions to make the code above more concise
// Encode an object into a buffer to be sent.
function contentify(obj) {
  return new Buffer(JSON.stringify(obj));
}

function sha256hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hmacSha256base64(data, key) {
  return crypto.createHmac("sha256", new Buffer(key, "hex")).update(data).digest("base64");
}
