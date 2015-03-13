'use strict';

/* global require, expect, describe, it, before, beforeEach, after, afterEach */

// Load modules
var Joi = require('joi'),
    Hapi = require('hapi'),
    Path = require('path'),
    assert = require('assert'),
    Patronus = require('../');

describe('Patronus', function() {

    var server = new Hapi.Server();
    server.connection({ port: 9999, labels: 'api' });
    var apiServer = server.select('api');

    describe('load test data into the system', function() {
        Patronus.loadValues(require('./values/basic-login.js'));
    });

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

        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply(request.payload);
            }
        });

        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply(request.query);
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply(request.params);
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply(request.headers);
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply(request.payload);
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply({test: 'success'});
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
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
                }
            },
            handler: function(request, reply) {
                reply({shouldFail: 'success'});
            }
        });



        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    try {
                        Patronus.assert(res, test.response);
                    } catch(e) {
                        assert.ifError(e);
                    } finally {
                        done();
                    }
                });
            });
         });
    });

    describe('should run tests from all routes', function() {
        var tests = Patronus.allTests(server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
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
    });

    describe('should run tests from all routes except:', function() {

        it('POST /payload/bad/', function(done) {
            var tests = Patronus.allTests(server, {
                ignore: [{
                    method: 'POST',
                    path: '/payload/bad/'
                }]
            });

            // assert that in the tests, no route has the method + payload above
            tests.forEach(function (test) {
                assert.notDeepEqual({
                    path: test.path,
                    method: test.method
                }, {
                    method: 'POST',
                    path: '/payload/bad/'
                });
            });
            done();
        });
    });

    describe('should run tests from just select routes', function() {
        server.connection({ port: 9998, labels: 'web' });
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

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
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
                }
            },
            handler: function(request, reply) {
                reply({success: true});
            }
        });

        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('test optional auth routes', function() {
        var route = '/auth/optional';
        var method = 'POST';

        apiServer.route({
            method: method,
            path: route,
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
                }
            },
            handler: function(request, reply) {
                reply({success: true});
            }
        });

        var tests = Patronus.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                apiServer.inject(test.request, function(res) {
                    Patronus.assert(res, test.response);
                    done();
                });
            });
         });
    });
});
