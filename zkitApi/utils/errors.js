/**
 *  Common error cases that an error code and the returned status by default and an optional message and exception info
 */

/**
 * Unexpected error
 * @param message Error message
 * @param innerException Detailed inner exception that will only be displayed in debug mode
 * @return {Error}
 */
exports.unexpected = function(message, innerException) {
  const ret = new Error(message);
  ret.status = 500;
  ret.code = "UnexpectedException";
  ret.innerException = innerException;
  return ret;
};

/**
 * Error caused by bad input
 * @param message Error message
 * @param innerException Detailed inner exception that will only be displayed in debug mode
 * @return {Error}
 */
exports.badInput = function(message, innerException) {
  const ret = new Error(message);
  ret.status = 400;
  ret.code = message || "BadInput";
  ret.innerException = innerException;
  return ret;
};

/**
 * Error caused by not sufficient user privileges
 * @param message Error message
 * @param innerException Detailed inner exception that will only be displayed in debug mode
 * @return {Error}
 */
exports.forbidden = function(message, innerException) {
  const ret = new Error(message);
  ret.status = 403;
  ret.code = message || "Forbidden";
  ret.innerException = innerException;
  return ret;
};

/**
 * Error caused by not sufficient user privileges
 * @param message Error message
 * @param innerException Detailed inner exception that will only be displayed in debug mode
 * @return {Error}
 */
exports.notFound = function(message, innerException) {
  const ret = new Error(message);
  ret.status = 404;
  ret.code = message || "Forbidden";
  ret.innerException = innerException;
  return ret;
};
