'use strict';

/* global require, expect, describe, it, before, beforeEach, after, afterEach */

// Load modules
var Joi = require('joi'),
    Hapi = require('hapi'),
    Path = require('path'),
    assert = require('assert'),
    hapiMocha = require('../');

describe('hapi-mocha', function() {

    var server = new Hapi.Server().connection({ host: 'test' });

    describe('load test data into the system', function() {
        hapiMocha.loadValues(require('./values/basic-login.js'));
    });

    describe('test basic route gathering', function() {
        var route = '/basic';
        var method = 'GET';

        server.route({
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

        var tests = hapiMocha.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('test basic payload validation', function() {
        var route = '/payload/basic';
        var method = 'POST';

        server.route({
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

        var tests = hapiMocha.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('test basic param validation', function() {
        var route = '/payload/basic/{test}/';
        var method = 'GET';

        server.route({
            method: method,
            path: route,
            config: {
                description: 'param example',
                validate: {
                    params: Joi.object({
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
                reply(request.params);
            }
        });



        var tests = hapiMocha.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('test payload validation w/ref', function() {
        var route = '/payload/ref/';
        var method = 'POST';

        server.route({
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



        var tests = hapiMocha.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('test validation error msg', function() {
        var route = '/payload/bad/';
        var method = 'POST';

        server.route({
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



        var tests = hapiMocha.testsFromRoute(method, route, server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    try {
                        hapiMocha.assert(res, test.response);
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
        var tests = hapiMocha.allTests(server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject(test.request, function(res) {
                    var error;
                    try {
                        hapiMocha.assert(res, test.response);
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
});
