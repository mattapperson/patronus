'use strict';

// TODO This code should return in many cases several requests per route, so for instance, if
// a route has 1 optional param, and one required, we would return 2 test objects, one with
// and one without the optional param. In the same way, if a param is an enum, we would return
// a test for every combo of that enum, with optional params, and so forth.
//
// We also need to give consideration to allowing users to test with multiple data sets.
// So for instance, if we have a user ID as a param, we might want to test with 2 user IDs
// one for a normal user and one for an admin as an example use case

function allTests(server, options) {

    return [{
        method: 'POST',
        route: '/route',
        request: {},
        response: {}
    }];

}

function testsFromRoute(method, route, server, options) {

    return [{
        method: 'POST',
        route: '/route',
        request: {},
        response: {}
    }];
}


exports.allTests = allTests;
exports.testsFromRoute = testsFromRoute;
