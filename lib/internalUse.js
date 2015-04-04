/*jslint node: true */

(function () {
    'use strict';

    var Joi = require('joi'),
        combinatorics = require('js-combinatorics').Combinatorics,
        queryString = require('query-string'),
        _ = require('lodash'),
        internals = {
            testValues: []
        };

    internals.testsFromHapiRoute = function (route) {
        var settings = route.settings,
            userTests = [];

        if (settings && settings.plugins && settings.plugins.patronus &&
            settings.plugins.patronus.testValues) {

            userTests = settings.plugins.patronus.testValues;

        }

        // all the Joi validations for the request
        var validations = {
            query: settings.validate && Joi.compile(settings.validate.query),
            path: settings.validate && Joi.compile(settings.validate.params),
            payload: settings.validate && Joi.compile(settings.validate.payload),
            headers: settings.validate && Joi.compile(settings.validate.headers)
        };

        var combos = internals.getCombos(settings, validations);

        return {
            user: internals.getUserTests(route, userTests, validations, combos),
            coverage: internals.getCoverageTests(route, userTests, validations, combos),
            security: internals.getSecurityTests(route, userTests, validations, combos),
        };

    };

    internals.buildTests = function (config) {
        var method = config.route.method,
            pathSpec = config.route.path,
            settings = config.route.settings;

        // Loop through each combo of params
        config.combos.forEach(function (combo) {
            // example combo: { payload: [ { name: 'username'...} ] }

            // reset the test
            var test = {
                description: settings.description,
                method: method.toUpperCase(),
                path: pathSpec,
                validations: config.validations,
                query: {},
                combo: {},
                request: {
                    method: method.toUpperCase(),
                    url: pathSpec,
                    payload: {},
                    headers: {}
                },
                coverage: false,
                response: settings.response && Joi.compile(settings.response.schema)
            };

            if (Object.keys(combo).length === 0) {
                config.testCallback(test);
            }

            // Then loop through each param type set in the combo
            Object.keys(combo).forEach(function (paramType) {
                // paramType might be "payload", "url", or "headers"

                test.combo[paramType] = {};

                // Lastly we loop through each param details object
                combo[paramType].forEach(function (paramSpec) {
                    // example paramSpec  { name: 'username', description: 'the id for the user' }

                    // Save this for fuzzing and for code coverage tests
                    test.combo[paramType][paramSpec.name] = paramSpec.type;

                    test = config.paramCallback(test, paramType, paramSpec) || test;
                });

            });

            config.testCallback(test);
        });
    };

    internals.getUserTests = function (route, userTests, validations, combos) {
        var tests = [];
        var internalUserTests = userTests.length > 0 ? userTests : [{}];

        // For each set of param values
        internalUserTests.forEach(function (paramValues) {
            // paramValues example: {username: 'test', password:'here'}

            internals.buildTests({
                route: route,
                validations: validations,
                combos: combos,

                // called on each param of each combo. process what and where it should go in the test
                paramCallback: function (test, paramType, paramSpec) {

                    // If we have the value... great! lets build this test!
                    if (paramValues[paramSpec.name]) {

                        test.request.url = test.request.url.replace('{' + paramSpec.name + '}', paramValues[paramSpec.name]);

                        if (test.request[paramType]) {
                            test.request[paramType][paramSpec.name] = paramValues[paramSpec.name];
                        } else if (paramType === 'query') {
                            test.query[paramSpec.name] = paramValues[paramSpec.name];
                        }

                        return test;

                        // If a param is required for the API but not in the test, then assert fail now...
                    } else if (paramSpec.wasReq) {

                        // We will catch missing required params in our coverage tests
                        return;
                    }
                },
                // called when the test building loop that calls paramCallback is done
                // This will be called once per param combo.
                testCallback: function (test) {
                    // Build out the URL query string if we need one
                    if (Object.keys(test.query).length > 0) {
                        test.request.url += '?' + queryString.stringify(test.query);
                    }

                    // if the route is auth, generate one test with and one without auth unless its required
                    if (route.settings.auth && route.settings.auth.strategies.length !== 0) {

                        // Push a version of the route without the auth and then later with to test both
                        if (route.settings.auth.mode !== 'required') {
                            test.description = route.settings.description + ' w/auth';

                            tests.push(test);
                            test.description = route.settings.description + ' without auth';

                        }

                        // For each set of param values
                        userTests.forEach(function (paramValues) {
                            // inject auth
                            Object.keys(paramValues.__auth).forEach(function (paramType) {
                                Object.keys(paramValues.__auth[paramType]).forEach(function (valueParam) {
                                    test.request[paramType][valueParam] = paramValues.__auth[paramType][valueParam];
                                });
                            });
                        });
                    }
                    tests.push(test);
                }
            });
        }); // end foreach Loop

        return internals.filteredTestsUsingJoi(tests);
    };

    internals.getCoverageTests = function (route, userTests, validations, combos) {
        var tests = []; // Tests passed back to the API
        var testCombos = []; // combos to validate before making a test out of them

        // // Loop through each combo of params
        // combos.forEach(function(combo, comboI) {
        //     // example combo: { payload: [ { name: 'username'...} ] }
        //
        //     var test = {
        //         conbo: {}
        //     };
        //
        //     // Then loop through each param type set in the combo
        //     Object.keys(combo).forEach(function(paramType) {
        //         // paramType might be "payload", "url", or "headers"
        //
        //         test.combo[paramType] = {};
        //
        //         // Lastly we loop through each param details object
        //         combo[paramType].forEach(function(paramSpec, iteration) {
        //
        //         });
        //     });
        // });


        return tests;
        // assert.notEqual(undefined, paramValues[paramSpec.name], "The " + paramType +" value '" + paramSpec.name + "' was undefined in one of your value files, and is required for " + method + " " + pathSpec);
    };

    internals.getSecurityTests = function () {
        return [];
    };

    internals.getCombos = function (settings, validations) {

        // OK these comments are about to get verbose because I am having issues
        // keeping this straight in my head

        // Here we have the usable payload params to be able to build our request
        var combos = []; // all the combos, but in the wrong format
        var returnedCombos = []; // The final filtered combos
        var required = []; // all the required params pre-processing
        var optional = []; // all the non-required params pre-processing

        // loop through the validation types such as query, headers, payload...
        Object.keys(validations).forEach(function (validation) {

            var params = internals.getParamsData(validations[validation].describe()).children;

            // if any are defined... if not ignore
            if (params) {
                // All required params that will be appended to each and every test
                required = required.concat(params.filter(function (param) {
                    // tag the param type so we know what we are looking at later
                    // We must do this becuase to get a truly random combo we must
                    // have a flat array of all param types
                    param.paramType = validation;

                    if (param.flags && param.flags.required) {
                        // Mark for later use when setting values
                        param.wasReq = true;
                    }

                    return param.flags && param.flags.required;
                }));

                // we mix all the optional params, of all types together so as to get all
                // mix and matched combos, later we will split it back out
                optional = optional.concat(params.filter(function (param) {

                    // tag the param type so we know what we are looking at later
                    // We must do this becuase to get a truly random combo we must
                    // have a flat array of all param types
                    param.paramType = validation;

                    // Filter for just the optional param combos
                    return !param.flags || !param.flags.required;
                }));

            }
        });

        // OK, now we get all the mix and matched combos, and append required params to each combo
        combos = combinatorics.power(optional).map(function (combo) {

            if (combo.length < 1) {
                combo.push({});
            }
            // add the required params to each combo
            return combo.concat(required);
        });

        // Transform the flat array into an array of objects, where there is a key for each type
        returnedCombos = combos.map(function (combo) {
            var object = {};
            var paramType;

            combo.forEach(function (param) {

                paramType = param.paramType;

                if (paramType) {
                    object[paramType] = object[paramType] || [];

                    object[paramType].push(param);
                }

            });

            // add the required params to each combo
            return object;
        });

        return returnedCombos;
    };

    internals.filteredTestsUsingJoi = function (tests) {
        // First remove duplicates
        tests = _.uniq(tests, false, JSON.stringify);

        tests = tests.filter(function (test) {
            var payload;

            // if we have something worth validating...
            if (Object.keys(test.request.payload).length > 0 ||
                test.validations.payload._inner.children) {

                payload = test.request.payload;
            }
            var payloadValidation = Joi.validate(payload, test.validations.payload);

            if (payloadValidation.error !== null) {
                return false;
            }
            return true;
        });

        return tests;
    };

    // pass in a route to get back a function that checks if the route matches
    internals.ignoredRoute = function (route) {
        return function (e) {
            if ((e.pathContains || e.path) && e.method && e.method !== route.method) {
                return false;
            }
            if (e.pathContains) {
                return (route.path.indexOf(e.pathContains) !== -1);
            } else if (e.path) {
                return (e.path === route.path);
            } else if (e.method) {
                if (e.method === route.method) {
                    return true;
                }
            }
        };
    };

    internals.getParamsData = function (param, name) {
        var type;

        if (param.valids && param.valids.some(Joi.isRef)) {
            type = 'reference';
        } else {
            type = param.type;
        }

        var data = {
            name: name,
            description: param.description,
            type: type,
            flags: param.flags && {
                allowUnknown: 'allowUnknown' in param.flags && param.flags.allowUnknown.toString(),
                encoding: param.flags.encoding, // binary specific
                required: param.flags.presence === 'required'
            }
        };

        if (data.type === 'object') {

            if (param.children) {
                var childrenKeys = Object.keys(param.children);
                data.children = childrenKeys.map(function (key) {

                    return internals.getParamsData(param.children[key], key);
                });
            }

        } else if (data.type === 'alternatives') {

            data.alternatives = param.alternatives.map(function (alternative) {

                return internals.getParamsData(alternative);
            });
        }

        return data;
    };

    module.exports = internals;
})();
