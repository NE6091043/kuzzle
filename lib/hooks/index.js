/**
 * Hooks will build all hooks defined in config/hooks file
 * A file and a function are associated with an event name
 *
 */

var
// library for execute asynchronous methods
  async = require('async'),
  _ = require('lodash');

module.exports = function Hooks (kuzzle) {

  this.list = {};
  this.kuzzle = kuzzle;

  this.init = function () {
    var
    // hooks = this in order to avoid too many bind in callback functions bellow
      hooks = this,
      hookName,
      functionName;

    async.each(this.kuzzle.config.hooks, function parseHooks (groupHooks) {
      _.forEach(groupHooks, function parseGroupHooks (definitions, event) {
        async.each(definitions, function parseDefinitions (definition) {

          definition = definition.split(':');
          hookName = definition[0];
          functionName = definition[1];

          if (!hooks.kuzzle.hooks[hookName]) {
            hooks.list[hookName] = require('./' + hookName);
            hooks.list[hookName].init(hooks.kuzzle);
          }

          hooks.kuzzle.on(event, function (object) {
            hooks.list[hookName][functionName](object);
          });

        });
      });
    });
  };

};