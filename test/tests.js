'use strict';

/* global require, expect, describe, it, before, beforeEach, after, afterEach */

// Load modules
var Joi = require('joi'),
    Hapi = require('hapi'),
    Path = require('path'),
    hapiMocha = require('../');

describe('hapi-mocha', function() {

    var server = new Hapi.Server().connection({ host: 'test' });

    describe('test basic route gathering', function() {
        var route = '/basic';
        var method = 'GET';

        server.route({
            method: method,
            path: route,
            config: {
                description: 'User Login Register',
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
                server.inject({
                    method: test.method,
                    url: test.path
                }, function(res) {
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
                description: 'User Login Register',
                validate: {
                    payload: Joi.object({
                        username: Joi.string().required(),
                        password: Joi.string().required(),
                    })
                },
                response: {
                    schema: Joi.object({
                        username: Joi.string().required(),
                        password: Joi.string().required(),
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
                server.inject({
                    method: test.method,
                    url: test.path
                }, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });

    describe('should run tests from all routes', function() {
        var tests = hapiMocha.allTests(server);

        tests.forEach(function (test) {
            it(test.description, function(done) {
                server.inject({
                    method: test.method,
                    url: test.path
                }, function(res) {
                    hapiMocha.assert(res, test.response);
                    done();
                });
            });
         });
    });
});
