(function() {
    'use strict';

    var Joi = require('joi');
    var joiAssert = require('joi-assert');
    var combinatorics = require('js-combinatorics').Combinatorics;
    var queryString = require('query-string');
    var assert = require('assert');

    var internals = {
        testValues: []
    };

    exports.loadValues = function(/* [arguments..] */) {
        var array = arguments[0] instanceof Array ? arguments[0] : [].slice.call(arguments);

        array.forEach(function(args, i) {
            if(args instanceof Object) {
                internals.testValues.push(args);
            }
        });
    };

    exports.allTests = function(server, options) {

        var routes = [], connections = server.table(), table;

        connections.forEach(function (connection) {
            table = connection.table;

            table.forEach(function (route) {
                routes = routes.concat(internals.testsFromHapiRoute(route));
            });

        });

        return routes;

    };

    exports.testsFromRoute = function(method, path, server, options) {

        var routes = [], connections = server.table(), table;

        connections.forEach(function (connection) {
            table = connection.table;

            table.forEach(function (route) {
                if(route.method === method.toLowerCase() && route.path === path) {
                    routes = routes.concat(internals.testsFromHapiRoute(route));
                }
            });
        });

        return routes;
    };

    exports.assert = function(raw, schema) {
        if (schema.responseBodySchema && Object.keys(schema.responseBodySchema).length > 0) {
            return joiAssert(raw.result, schema.responseBodySchema, 'Response check');
        }
    };

    internals.testsFromHapiRoute = function(route) {
        var routes = [];
        var method = route.method;
        var path = route.path;
        var settings = route.settings;

        var combos = internals.getCombos(settings);

        // TODO break this code out... we are too many callbacks deep
        combos.forEach(function(combo, comboI) {

            internals.testValues.forEach(function(params, iteration) {
                route = {};

                (combo.path || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required");

                    path = path.replace('{' + paramSpec.name + '}', params[paramSpec.name]);
                });

                if(combo.query) {
                    var query = {};

                    (combo.query || []).forEach(function(paramSpec) {
                        assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required");

                        query[paramSpec.name] = params[paramSpec.name];
                    });

                    path += '?' + queryString.stringify(query);
                }

                route.method      = method.toUpperCase();
                route.path        = path;
                route.request     = {
                    method: method.toUpperCase(),
                    url: path,
                    payload: {},
                    headers: {}
                };

                (combo.payload || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required");

                    route.request.payload[paramSpec.name] = params[paramSpec.name];
                });

                (combo.header || []).forEach(function(paramSpec) {
                    assert.notEqual(undefined, params[paramSpec.name], "The param '" + paramSpec.name + "' was undefined in one of your value files, and is required");

                    route.request.headers[paramSpec.name] = params[paramSpec.name];
                });

                route.description = "[values #" + iteration + " combo #"+comboI+"] " + settings.description;

                route.response = {
                    responseBodySchema: settings.response && Joi.compile(settings.response.schema)
                };

                if(settings.auth && settings.auth.strategies.length !== 0) {

                    // Push a version of the route without the auth and then later with to test both
                    if(settings.auth.mode !== 'required') {
                        routes.push(route);
                    }

                    // inject auth
                    Object.keys(params.__auth).forEach(function(param) {
                        Object.keys(params.__auth[param]).forEach(function(valueParam) {
                            route.request[param][valueParam] = params.__auth[param][valueParam];
                        });
                    });
                }

                routes.push(route);
            });

        });

        return routes;
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
