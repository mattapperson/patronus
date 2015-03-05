(function() {
    'use strict';

    var Joi = require('joi');
    var joiAssert = require('joi-assert');
    var combinatorics = require('js-combinatorics').Combinatorics;

    var internals = {};

    // TODO This code should return in many cases several requests per route, so for instance, if
    // a route has 1 optional param, and one required, we would return 2 test objects, one with
    // and one without the optional param. In the same way, if a param is an enum, we would return
    // a test for every combo of that enum, with optional params, and so forth.
    //
    // We also need to give consideration to allowing users to test with multiple data sets.
    // So for instance, if we have a user ID as a param, we might want to test with 2 user IDs
    // one for a normal user and one for an admin as an example use case

    exports.allTests = function(server, options) {

        var routes = [], connections = server.table(), settings, route, table;

        connections.forEach(function (connection) {
            table = connection.table;

            table.forEach(function (route) {
                // all the Joi validations for the request
                var validate = {
                    query: route.settings.validate && Joi.compile(route.settings.validate.query),
                    path: route.settings.validate && Joi.compile(route.settings.validate.params),
                    payload: route.settings.validate && Joi.compile(route.settings.validate.payload),
                    header: route.settings.validate && Joi.compile(route.settings.validate.headers)
                };

                var combos = internals.getCombos(validate);

                console.log(combos);

                // TODO create request objects filled with values in the following format

                var method = route.method;
                var path = route.path;
                settings = route.settings;
                route = {};

                route.method      = method.toUpperCase();
                route.path        = path;
                route.description = settings.description;
                route.request     = {

                };
                route.response    = {
                    responseBodySchema: settings.response && Joi.compile(settings.response.schema)
                };

                routes.push(route);
            });
        });

        return routes;

    };

    exports.testsFromRoute = function(method, route, server, options) {

        return [{
            method: 'POST',
            route: '/route',
            description: 'A Test',
            request: {},
            response: {}
        }];
    };

    exports.assert = function(raw, schema){
        if (Object.keys(schema).length > 0) {
            return joiAssert(raw.result, schema.responseBodySchema);
        }
    };

    internals.getCombos = function(validations) {
        // TODO loop through all validations not just payload

        // Here we have the usable payload params to be able to build our request
        var payloadParams = internals.getParamsData(validations.payload.describe()).children;
        var combos = [];

        if(payloadParams) {
            var required = payloadParams.filter(function(params) {
                return params.flags && params.flags.required;
            });

            // This is all the combos
            combos = combinatorics.power(payloadParams).filter(function (params) {
                // Filter for just the optional param combos
                return !params.flags || !params.flags.required;
            }).map(function(combo) {
                // add the required params to each combo
                return combo.concat(required);
            });
        }

        return combos;
    };

    internals.getParamsData = function (param, name) {

        // Detection of "false" as validation rule
        if (!name && param.type === 'object' && param.children && Object.keys(param.children).length === 0) {

            return {
                isDenied: true
            };
        }

        // Detection of conditional alternatives
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

            if (param.patterns) {
                data.patterns = param.patterns.map(function (pattern) {

                    return internals.getParamsData(pattern.rule, pattern.regex);
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
            if (param.rules) {
                param.rules.forEach(function (rule) {

                    data.rules[internals.capitalize(rule.name)] = internals.processRuleArgument(rule);
                });
            }

            ['includes', 'excludes'].forEach(function (rule) {

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


    internals.capitalize = function (string) {

        return string.charAt(0).toUpperCase() + string.slice(1);
    };


    internals.formatPeers = function (condition) {

        if (condition.key) {

            return 'Requires ' + condition.peers.join(', ') + ' to ' + (condition.type === 'with' ? '' : 'not ') +
                'be present when ' + condition.key + ' is.';
        }

        return 'Requires ' + condition.peers.join(' ' + condition.type + ' ') + '.';
    };


    internals.formatReference = function (ref) {

        return (ref.isContext ? '$' : '') + ref.key;
    };


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
