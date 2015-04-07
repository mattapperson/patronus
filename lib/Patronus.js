/*jslint node: true */

(function () {
    'use strict';

    var joiAssert = require('joi-assert'),
        internals = require('./internalUse.js'),
        assert = require('assert');

    exports.allTests = function (server, _options) {
        _options = _options || {};

        var tests = {
                user: [],
                coverage: [],
                security: []
            },
            connections = server.table(),
            table,
            options = {
                select: _options.select,
                ignore: _options.ignore && _options.ignore.map(function (x) {
                    if (x.method) x.method = x.method.toLowerCase();
                    return x;
                }) || []
            };

        connections.forEach(function (connection) {
            if (options && options.select && connection.labels.indexOf(options.select) === -1) {
                return; // ignore this connection as it does not have the requested tag
            }

            table = connection.table;

            table.forEach(function (route) {
                // If route patches one in the ignored array...
                if (options.ignore.map(internals.ignoredRoute(route)).indexOf(true) !== -1) {

                    return; // ignore this route
                }

                var hapiTests = internals.testsFromHapiRoute(route);

                if (hapiTests) {
                    tests.user = tests.user.concat(hapiTests.user);
                    tests.coverage = tests.coverage.concat(hapiTests.coverage);
                    tests.security = tests.security.concat(hapiTests.security);

                }
            });

        });
        return tests;

    };

    exports.testsFromRoute = function (method, path, server, _options) {
        _options = _options || {};

        var tests = {
                user: [],
                coverage: [],
                security: []
            },
            connections = server.table(),
            table,
            options = {
                select: _options.select
            };

        connections.forEach(function (connection) {
            if (options && options.select && connection.labels.indexOf(options.select) === -1) {
                return; // ignore this connection as it does not have the requested tag
            }

            table = connection.table;

            table.forEach(function (route) {
                if (route.method === method.toLowerCase() && route.path === path) {
                    var hapiTests = internals.testsFromHapiRoute(route);

                    if (hapiTests) {

                        tests.user = tests.user.concat(hapiTests.user);
                        tests.coverage = tests.coverage.concat(hapiTests.coverage);
                        tests.security = tests.security.concat(hapiTests.security);

                    }
                }
            });
        });

        return tests;
    };

    exports.assert = function (raw, schema) {
        if (schema && Object.keys(schema).length > 0) {
            return joiAssert(raw.result, schema, 'Response check');
        } else {
            return assert.equal(raw.statusCode, 200, "No responce spec, but failed to receve a 200 status code, receved: \nResult: " + JSON.stringify(raw.result) + "\nStatus Code:" + raw.statusCode);
        }
    };

    exports.assertTestCoverage = function (test) {
        test.issues.forEach(function(issue) {
            var message;

            switch(issue.reason) {
                case 'Example is missing':
                    message = "The " + issue.prop + " " + issue.propType + " is missing an example on the " + test.method + " " + test.path + " endpoint";
                    break;
                case 'Param missing':
                    message = "The " + issue.prop + " " + issue.propType + " is missing in one of your test value sets on the " + test.method + " " + test.path + " endpoint";
                    break;
            }
            assert.equal(issue.reason, undefined, message);
        });
        // TODO: assert that all variable combos are fully tested
    };

})();
