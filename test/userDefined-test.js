(function() {
    'use strict';

    /* global require, expect, describe, it, before, beforeEach, after, afterEach */

    // Load modules
    var Joi = require('joi'),
        Hapi = require('hapi'),
        Path = require('path'),
        assert = require('assert'),
        Patronus = require('../');

    var genaricTestRun = function(server, tests) {
        tests.user.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request)
                    .then(res => {
                        Patronus.assert(res, test.response);
                    })
                    .then(done)
                    .catch(done);
            });
        });
    };

    var testShouldFail = function(server, tests) {
        tests.user.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    var error;
                    try {
                        Patronus.assert(res, test.response);
                    } catch(e) {
                        if (res.shouldFail) {
                            error = e;
                            assert.ifError(e);
                        }

                    } finally {
                        done(error);
                    }
                });
            });
        });
    };

    describe('Patronus', function() {
        var server = new Hapi.Server();
        server.connection({ port: 9999, labels: 'api' });
        server.connection({ port: 9998, labels: 'web' });

        var apiServer = server.select('api');


        describe('test basic route gathering', function() {
            var route = '/basic';
            var method = 'GET';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'No params, just a success reply',
                    response: {
                        schema: Joi.object({
                            success: Joi.boolean()
                        })
                    }
                },
                handler: function(request, reply) {
                    reply({success: true});
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, apiServer));
        });

        describe('test basic payload validation', function() {
            var route = '/payload/basic';
            var method = 'POST';

            apiServer.route({
                method: 'POST',
                path: route,
                config: {
                    description: 'username is required, password is optional',
                    validate: {
                        payload: Joi.object({
                            username: Joi.string().required().example('matt'),
                            password: Joi.string(),
                        })
                    },
                    response: {
                        schema: Joi.object({
                            username: Joi.string().required(),
                            password: Joi.string(),
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name',
                                password: 'password'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply(request.payload);
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test basic query validation', function() {
            var route = '/query/basic';
            var method = 'GET';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'query example',
                    validate: {
                        query: Joi.object({
                            test: Joi.string().required().example('matt')
                        })
                    },
                    response: {
                        schema: Joi.object({
                            test: Joi.string().required()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                test: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply({test: request.query.test || 'none'});
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test basic param validation', function() {
            var route = '/payload/basic/{test}/';
            var method = 'GET';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'param example',
                    validate: {
                        params: Joi.object({
                            test: Joi.string().required().example('matt').invalid('a')
                        })
                    },
                    response: {
                        schema: Joi.object({
                            test: Joi.string().required()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                test: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply(request.params);
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test basic headers validation', function() {
            var route = '/headers/basic/';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'headers example',
                    validate: {
                        headers: Joi.object({
                            test: Joi.string().required()
                        }).unknown()
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                test: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply(request.headers);
                }
            });



            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test alternative validations', function() {
            var route = '/payload/alternatives/';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'payload example w/alternative',
                    validate: {
                        payload: Joi.object({
                            test: [Joi.number(), Joi.string()]
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                test: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply(request.payload);
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test payload validation w/ref', function() {
            var route = '/payload/ref/';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'payload validation passwordConf ref password',
                    validate: {
                        payload: Joi.object({
                            username: Joi.string().required().example('matt'),
                            passwordConf: Joi.ref('password'),
                            password: Joi.string().required()
                        })
                    },
                    response: {
                        schema: Joi.object({
                            test: Joi.string().required()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name',
                                passwordConf: 'user-name',
                                password: 'user-name',
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply({test: 'success'});
                }
            });



            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test response code validation', function() {
            var route = '/response/code/';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'payload validation passwordConf ref password',
                    validate: {
                        payload: Joi.object({
                            username: Joi.string().required().example('matt'),
                            passwordConf: Joi.ref('password'),
                            password: Joi.string().required()
                        })
                    },
                    response: {
                        schema: Joi.object({
                            test: Joi.string().required()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name',
                                passwordConf: 'user-name',
                                password: 'user-name',
                                __responseCode: 400
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply({test: 'success'});
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test validation error msg', function() {
            var route = '/payload/bad/';
            var method = 'POST';

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'expect an assertion failure',
                    validate: {
                        payload: Joi.object({
                            username: Joi.string().required().example('matt'),
                            passwordBad: Joi.string().required()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name',
                                passwordBad: 'user-name'
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply({shouldFail: 'success'});
                }
            });


            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

            // var tests = Patronus.testsFromRoute(method, route, server);

            // tests.user.forEach(function (test) {
            //     it(test.description, function(done) {
            //         apiServer.inject(test.request, function(res) {
            //             try {
            //                 Patronus.assert(res, test.response);
            //             } catch(e) {
            //                 assert.ifError(e);
            //             } finally {
            //                 done();
            //             }
            //         });
            //     });
            // });
        });

        describe('should run tests from all routes', function() {
            var tests = Patronus.allTests(server);

            testShouldFail(apiServer, tests);
        });

        describe('should run tests from all routes except:', function() {
            var checkForEndpoint = function(tests) {
                tests.user.forEach(function (test) {
                    assert.notDeepEqual({
                        path: test.path,
                        method: test.method
                    }, {
                        method: 'POST',
                        path: '/payload/bad/'
                    });
                });
            };

            it('POST /payload/bad/', function(done) {
                var tests = Patronus.allTests(server, {
                    ignore: [{
                        method: 'POST',
                        path: '/payload/bad/'
                    }]
                });

                // assert that in the tests, no route has the method + payload above
                checkForEndpoint(tests);

                done();
            });

            it('POST containing /bad/', function(done) {
                var tests = Patronus.allTests(server, {
                    ignore: [{
                        method: 'POST',
                        pathContains: '/bad/'
                    }]
                });

                // assert that in the tests, no route has the method + partial payload above
                checkForEndpoint(tests);

                done();
            });
        });

        describe('should run tests from just select routes', function() {
            var webServer = server.select('web');

            var route = '/connection/selection/';
            var method = 'POST';

            webServer.route({
                method: method,
                path: route,
                config: {
                    description: 'A test you that should never be run',
                },
                handler: function(request, reply) {
                    assert.fail('Not to run', 'ran');
                    reply({test: 'fail'});
                }
            });

            var tests = Patronus.allTests(server, {select: 'api'});

            testShouldFail(apiServer, tests);

        });

        describe('test auth routes', function() {
            var route = '/auth';
            var method = 'POST';

            apiServer.register(require('hapi-auth-bearer-token'), function (err) {
                if(err) throw err;

                apiServer.auth.strategy('simple', 'bearer-access-token', {
                    validateFunc: function( token, callback ) {
                        if(token === "1234"){
                            callback(null, true, { token: token });
                        } else {
                            callback(null, false, { token: token });
                        }
                    }
                });

                apiServer.route({
                    method: method,
                    path: route,
                    config: {
                        description: 'Test for an auth token of 1234',
                        auth: 'simple',
                        response: {
                            schema: Joi.object({
                                success: Joi.boolean()
                            })
                        },
                        plugins:{
                            patronus: {
                                testValues: [{
                                    username: 'user-name',
                                    password: 'user-name',
                                    __auth: {
                                        headers: {
                                            authorization: 'Bearer 1234'
                                        }
                                    }
                                }]
                            }
                        }
                    },
                    handler: function(request, reply) {
                        reply({success: true});
                    }
                });

                apiServer.route({
                    method: 'POST',
                    path: '/auth/optional',
                    config: {
                        description: 'Test for an auth token of 1234',
                        auth: {
                            strategies: ['simple'],
                            mode: 'optional'
                        },
                        response: {
                            schema: Joi.object({
                                success: Joi.boolean()
                            })
                        },
                        plugins:{
                            patronus: {
                                testValues: [{
                                    username: 'user-name',
                                    password: 'user-name',
                                    __auth: {
                                        headers: {
                                            authorization: 'Bearer 1234'
                                        }
                                    }
                                }]
                            }
                        }
                    },
                    handler: function(request, reply) {
                        reply({success: true});
                    }
                });
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));

        });

        describe('test optional auth routes', function() {
            var route = '/auth/optional';
            var method = 'POST';

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));
        });

        describe('test server.decorate', function() {
            var route = '/server/decorate';
            var method = 'POST';

            apiServer.decorate('reply', 'success', function (results) {
                return this.response({
                    success: true,
                    results: results
                });
            });

            apiServer.route({
                method: method,
                path: route,
                config: {
                    description: 'Test to make sure server.decorate works',
                    response: {
                        schema: Joi.object({
                            success: Joi.boolean(),
                            results: Joi.object()
                        })
                    },
                    plugins:{
                        patronus: {
                            testValues: [{
                                username: 'user-name',
                                password: 'user-name',
                            }]
                        }
                    }
                },
                handler: function(request, reply) {
                    reply.success({success: true});
                }
            });

            genaricTestRun(apiServer, Patronus.testsFromRoute(method, route, server));
        });
    });
})();
