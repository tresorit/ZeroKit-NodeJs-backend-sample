const test = require('./lib/test');

const browsersToTest = [
  { browserName: 'chrome',  version: 55 },
  // By default we only test chrome
  // { browserName: 'firefox', version: 50 },
  // { browserName: 'ie', version: 11 },
  // { browserName: 'edge' },
  // { browserName: 'safari', version: "8" },
  // { browserName: 'safari', version: "9.1" },
  // driver (org.openqa.selenium.safari.SafariDriver) does not support org.openqa.selenium.html5.WebStorage. ...
  // { browserName: 'safari', version: "10" }
];
describe('API', function () {
  browsersToTest.forEach(({browserName, version}) => {
    describe(`${browserName}@${version}`, function () {
      before(() => {
        return test.setRemote(browserName, version);
      });

      after(() => {
        return test.client.remote.end();
      });

      afterEach(() => {
        test.resetServer();
      });

      require('./specs/registration.spec')();
      require('./specs/login.spec')();
      require('./specs/tresor.spec')();
      require('./specs/sharing.spec')();
      require('./specs/data.spec')();
      require('./specs/invitationLinks.spec')();
    });
  });
});
