'use strict';
function _interopDefault(e) {
  return e && 'object' == typeof e && 'default' in e ? e.default : e;
}
var React = _interopDefault(require('react')),
  moment = _interopDefault(require('moment')),
  name = 'Mycomp',
  version = '1.0.0',
  hostVersion = '1.3.0',
  main = './index.tsx',
  devDependencies = {
    '@types/moment': '^2.13.0',
    '@types/react': '^16.8.3',
    '@types/react-dom': '^16.8.3',
    moment: '^2.24.0',
    react: '^16.8.3',
    'react-dom': '^16.8.3',
    'ts-node': '^8.0.3',
    tslib: '^1.9.3',
    typescript: '^3.3.4000'
  },
  peerDependencies = { moment: '^2.24.0', react: '^16.8.3', 'react-dom': '^16.8.3' },
  pkg = {
    name: name,
    version: version,
    hostVersion: hostVersion,
    main: main,
    devDependencies: devDependencies,
    peerDependencies: peerDependencies
  },
  Mycomp = function(e) {
    var n = e.username;
    return React.createElement(
      'div',
      null,
      React.createElement('span', null, 'Hello ', n, ', this is your ', pkg.name, ' component'),
      React.createElement('div', null, React.createElement('span', null, 'Host version ', pkg.hostVersion)),
      React.createElement('div', null, React.createElement('span', null, 'Component version ', pkg.version)),
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            onClick: function() {
              alert(moment.duration(24, 'hours').humanize());
            }
          },
          'Click!'
        )
      )
    );
  };
module.exports = Mycomp;
//# sourceMappingURL=index.js.map