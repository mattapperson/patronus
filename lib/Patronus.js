(function() {
    'use strict';

    var Joi = require('joi'),
        joiAssert = require('joi-assert'),
        combinatorics = require('js-combinatorics').Combinatorics,
        queryString = require('query-string'),
        assert = require('assert'),
        glob = require("glob"),
        internals = {
            testValues: []
        };

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
        }, null, 4)
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

    internals.testsFromHapiRoute = function(route) {
        var tests = [];
        var method = route.method;
        var pathSpec = route.path;
        var settings = route.settings;
        var test = {
            description: "[values #0 combo #0] " + settings.description,
            method: method.toUpperCase(),
            path: pathSpec,
            request: {
                method: method.toUpperCase(),
                url: pathSpec,
                payload: {},
                headers: {}
            },
            response: {
                responseBodySchema: settings.response && Joi.compile(settings.response.schema)
            }
        };


        if(!settings || !settings.plugins || !settings.plugins.patronus || !settings.plugins.patronus.testValues) {
            tests.push(test);
            return tests;
        }

        var combos = internals.getCombos(settings);

        settings.description = settings.description || method + ' ' + pathSpec;

        combos.forEach(function(combo, comboI) {
            // reset the test
            test.payload = {};
            test.headers = {};

            settings.plugins.patronus.testValues.forEach(function(params, iteration) {

                (combo.path || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required for " + method + " " + pathSpec);

                    test.request.url = test.request.url.replace('{' + paramSpec.name + '}', params[paramSpec.name]);
                });

                if(combo.query) {
                    var query = {};

                    (combo.query || []).forEach(function(paramSpec) {
                        assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required for " + method + " " + pathSpec);

                        query[paramSpec.name] = params[paramSpec.name];
                    });

                    test.request.url += '?' + queryString.stringify(query);
                }

                (combo.payload || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required for " + method + " " + pathSpec);

                    test.request.payload[paramSpec.name] = params[paramSpec.name];
                });

                (combo.header || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required for " + method + " " + pathSpec);

                    test.request.headers[paramSpec.name] = params[paramSpec.name];
                });

                test.description = "[values #" + iteration + " combo #"+comboI+"] " + settings.description;



                if(settings.auth && settings.auth.strategies.length !== 0) {

                    // Push a version of the route without the auth and then later with to test both
                    if(settings.auth.mode !== 'required') {
                        tests.push(test);
                    }

                    // inject auth
                    Object.keys(params.__auth).forEach(function(param) {
                        Object.keys(params.__auth[param]).forEach(function(valueParam) {
                            test.request[param][valueParam] = params.__auth[param][valueParam];
                        });
                    });
                }

                tests.push(test);
            });

        });

        return tests;
    };

    internals.getCombos = function(settings) {
        // all the Joi validations for the request
        var validations = {
            query: settings.validate && Joi.compile(settings.validate.query),
            path: settings.validate && Joi.compile(settings.validate.params),
            payload: settings.validate && Joi.compile(settings.validate.payload),
            header: settings.validate && Joi.compile(settings.validate.headers)
        };

        // OK these comments are about to get verbose because I am having issues
        // keeping this straight in my head

        // Here we have the usable payload params to be able to build our request
        var combos = []; // all the combos, but in the wrong format
        var returnedCombos = []; // The final filtered combos
        var required = []; // all the required params pre-processing
        var optional = []; // all the non-required params pre-processing

        // loop through the validation types such as query, headers, payload...
        Object.keys(validations).forEach(function(validation) {
            // TODO go deep, if a value is an object/array we need to be able to deal with that

            var params = internals.getParamsData(validations[validation].describe()).children;

            // if any are defined... if not ignore
            if(params) {
                // All required params that will be appended to each and every test
                required = required.concat(params.filter(function(params) {
                    // tag the param type so we know what we are looking at later
                    // We must do this becuase to get a truly random combo we must
                    // have a flat array of all param types
                    params.paramType = validation;

                    return params.flags && params.flags.required;
                }));

                // we mix all the optional params, of all types together so as to get all
                // mix and matched combos, later we will split it back out
                optional = optional.concat( params.filter(function (params) {

                    // tag the param type so we know what we are looking at later
                    // We must do this becuase to get a truly random combo we must
                    // have a flat array of all param types
                    params.paramType = validation;

                    // Filter for just the optional param combos
                    return !params.flags || !params.flags.required;
                }) );

            }
        });

        // OK, now we get all the mix and matched combos, and append required params to each combo
        combos = combinatorics.power(optional).map(function(combo) {
            if(combo.length < 1) {
                combo.push({});
            }
            // add the required params to each combo
            return combo.concat(required);
        });

        // Transform the flat array into an array of objects, where there is a key for each type
        returnedCombos = combos.map(function(combo) {
            var object = {};
            var paramType;

            combo.forEach(function(param) {

                paramType = param.paramType;

                if(paramType) {
                    object[paramType] = object[paramType] || [];

                    object[paramType].push(param);
                }

            });

            // add the required params to each combo
            return object;
        });

        return returnedCombos;
    };

    // pass in a route to get back a function that checks if the route matches
    internals.ignoredRoute = function(route) {
        return function(e) {
            if(e.method) {
                if(e.method !== route.method) {
                    return false;
                }
            }
            if(e.pathContains) {
                return (route.path.indexOf(e.pathContains) !== -1);
            } else if(e.path){
                return (e.path === route.path);
            }
        };
    };

    internals.getParamsData = function (param, name) {
        // ignore this, used for in-progress feature
        /* istanbul ignore if  */
        if (!name && param.type === 'object' && param.children && Object.keys(param.children).length === 0) {

            return {
                isDenied: true
            };
        }

        // Detection of conditional alternatives
        // ignore this, used for in-progress feature
        /* istanbul ignore if  */
        if (param.ref && param.is) {

            return {
                condition: {
                    key: param.ref.substr(4), // removes 'ref:'
                    value: internals.getParamsData(param.is)
                },
                then: param.then,
                otherwise: param.otherwise
            };
        }

        var type;
        if (param.valids && param.valids.some(Joi.isRef)) {
            type = 'reference';
        }
        else {
            type = param.type;
        }

        var data = {
            name: name,
            description: param.description,
            notes: param.notes,
            tags: param.tags,
            meta: param.meta,
            unit: param.unit,
            type: type,
            allowedValues: type !== 'reference' && param.valids ? internals.getExistsValues(param.valids) : null,
            disallowedValues: type !== 'reference' && param.invalids ? internals.getExistsValues(param.invalids) : null,
            examples: param.examples,
            peers: param.dependencies && param.dependencies.map(internals.formatPeers),
            target: type === 'reference' ? internals.getExistsValues(param.valids) : null,
            flags: param.flags && {
                allowUnknown: 'allowUnknown' in param.flags && param.flags.allowUnknown.toString(),
                default: param.flags.default,
                encoding: param.flags.encoding, // binary specific
                insensitive: param.flags.insensitive, // string specific
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
        }

        if (data.type === 'alternatives') {
            data.alternatives = param.alternatives.map(function (alternative) {

                return internals.getParamsData(alternative);
            });
        }
        else  {
            data.rules = {};

            // ignore this, used for in-progress feature
            /* istanbul ignore if  */
            if (param.rules) {
                param.rules.forEach(function (rule) {

                    data.rules[internals.capitalize(rule.name)] = internals.processRuleArgument(rule);
                });
            }

            ['includes', 'excludes'].forEach(function (rule) {
                // ignore this, used for in-progress feature
                /* istanbul ignore if  */
                if (param[rule]) {
                    data.rules[internals.capitalize(rule)] = param[rule].map(function (type) {

                        return internals.getParamsData(type);
                    });
                }
            });
        }

        return data;
    };

    internals.getExistsValues = function (exists) {

        var values = exists.filter(function (value) {

            if (typeof value === 'string' && value.length === 0) {
                return false;
            }

            return true;
        }).map(function (value) {

            if (Joi.isRef(value)) {

                return (value.isContext ? '$' : '') + value.key;
            }

            return value;
        });

        return values.length ? values : null;
    };

    /* istanbul ignore next */ // Not yet used
    internals.capitalize = function (string) {

        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    /* istanbul ignore next */ // Not yet used
    internals.formatPeers = function (condition) {

        if (condition.key) {

            return 'Requires ' + condition.peers.join(', ') + ' to ' + (condition.type === 'with' ? '' : 'not ') +
                'be present when ' + condition.key + ' is.';
        }

        return 'Requires ' + condition.peers.join(' ' + condition.type + ' ') + '.';
    };

    /* istanbul ignore next */ // Not yet used
    internals.formatReference = function (ref) {

        return (ref.isContext ? '$' : '') + ref.key;
    };

    /* istanbul ignore next */ // Not yet used
    internals.processRuleArgument = function (rule) {

        var arg = rule.arg;
        if (rule.name === 'assert') {

            return {
                key: internals.formatReference(arg.ref),
                value: internals.describe(arg.cast)
            };
        }
        else if (Joi.isRef(arg)) {
            return {
                ref: internals.formatReference(arg)
            };
        }

        return arg;
    };
})();
