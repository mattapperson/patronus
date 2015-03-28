(function() {
    'use strict';

    var joiAssert = require('joi-assert'),
        internals = require('./internalUse.js'),
        assert = require('assert');


    exports.loadValues = function(/* [arguments..] */) {
        throw "The loadValues API was removed, please define your params on a per route basis. using the routes plugin prop like so:\n" + JSON.stringify({
            plugins:{
                patronus: {
                    testValues: [{
                        username: 'user-name',
                        password: 'password'
                    }]
                }
            }
        }, null, 4);
    };

    exports.allTests = function(server, _options) {
        _options = _options || {};

        var tests = [], connections = server.table(), table,
            options = {
                select: _options.select,
                ignore: _options.ignore && _options.ignore.map(function(x) { if(x.method) x.method = x.method.toLowerCase(); return x; }) || []
            };



        connections.forEach(function (connection) {
            if(options && options.select && connection.labels.indexOf(options.select) === -1) {
                return; // ignore this connection as it does not have the requested tag
            }

            table = connection.table;

            table.forEach(function (route) {
                // If route patches one in the ignored array...
                if(options.ignore.map(internals.ignoredRoute(route)).indexOf(true) !== -1) {

                    return; // ignore this route
                }

                var hapiTests = internals.testsFromHapiRoute(route);

                if(hapiTests) {
                    tests = tests.concat(hapiTests);
                }
            });

        });
        return tests;

    };

    exports.testsFromRoute = function(method, path, server, options) {

        var tests = [], connections = server.table(), table;

        connections.forEach(function (connection) {
            table = connection.table;

            table.forEach(function (route) {
                if(route.method === method.toLowerCase() && route.path === path) {
                    var hapiTests = internals.testsFromHapiRoute(route);

                    if(hapiTests) {
                        tests = tests.concat(hapiTests);
                    }
                }
            });
        });

        return tests;
    };

    exports.assert = function(raw, schema) {
        if (schema.responseBodySchema && Object.keys(schema.responseBodySchema).length > 0) {
            return joiAssert(raw.result, schema.responseBodySchema, 'Response check');
        } else {
            return assert.equal(raw.statusCode, 200, "No responce spec, but failed to receve a 200 status code, receved: \nResult: " + JSON.stringify(raw.result) + "\nStatus Code:" + raw.statusCode);
        }
    };

    exports.assertTestCoverage = function() {
        // TODO: assert that all variable combos are fully tested
    };

})();
