const debug = require("debug");
/**
 * Console logger. It can be enabled by setting DEBUG=ZeroKit-NodeJs-sample-backend::* in your environment
 * If you only want a part of it displayed you can filter by setting the filter like above,
 * e.g.: DEBUG=ZeroKit-backend-sample:Api:Data*
 * @param sub
 */
module.exports = sub => debug("ZeroKit-NodeJs-sample-backend:" + sub);
