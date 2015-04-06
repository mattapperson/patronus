(function() {
    'use strict';

    /*jslint node: true */
    /* global, expect, describe, it, before, beforeEach, after, afterEach */

    // Load modules
    var Joi = require('joi'),
        Hapi = require('hapi'),
        assert = require('assert'),
        Patronus = require('../');

    describe('Patronus Coverage', function() {
        var server = new Hapi.Server();
        server.connection({ port: 9999, labels: 'api' });
        var apiServer = server.select('api');

        describe('testing missing testValues', function() {
            var route = '/basic';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'No params, just a success reply',
                    validate: {
                        payload: Joi.object({
                            username: Joi.string().required().example('matt'),
                            password: Joi.string().example('password'),
                        })
                    },
                    response: {
                        schema: Joi.object({
                            success: Joi.boolean()
                        })
                    },
                     plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply({success: true});
                }
            });

            var tests = Patronus.testsFromRoute(method, route, apiServer);

            it('should return one missing param', function() {
                assert(tests.coverage.length, 1, "Expect one test to have been created");

                assert(tests.coverage[0].issues.length, 1, "Expect one coverage error due to missing password value");

                assert(tests.coverage[0].issues[0] , { prop: 'password', reason: 'Param missing' });

            });

        });
    });

})();
