'use strict';

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
