# Patronus
### Automated unit testing for your Hapi REST API

[![npm version](https://badge.fury.io/js/patronus.svg)](http://badge.fury.io/js/patronus)
[![Build Status](https://travis-ci.org/appersonlabs/patronus.svg?branch=master)](https://travis-ci.org/appersonlabs/patronus)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
[![Dependencies Status](https://david-dm.org/appersonlabs/patronus.svg)](https://david-dm.org/appersonlabs/patronus)
[![bitHound Score](https://www.bithound.io/github/appersonlabs/patronus/badges/score.svg)](https://www.bithound.io/github/appersonlabs/patronus)

[![NPM](https://nodei.co/npm/patronus.png?downloads=true)](https://nodei.co/npm/patronus/)

Patronus is a testing module used along with a testing framework (Mocha, Lab... whatever) so that all you have to do is provide a reference to your Hapi server object and supply a JS object with the values used in your API.

Patronus will generate every combo of params, payloads, and query args (based off of your routes Joi validations) and their values that you can think of and tests them all.

It even uses your route description for test names.

## Example of Patronus tests being run

![screenshot](https://s3.amazonaws.com/f.cl.ly/items/2o1Q1X3v1545360t3M0t/Screen%20Shot%202015-03-12%20at%201.57.58%20PM.png)

## Using Patronus

Load the npm module:

```javascript
var Patronus = require('patronus');
```

Load value objects on a route:

```javascript

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
                // Note it is an array, test with multiple value sets
                testValues: [{
                    username: 'user-name',
                    password: 'password',

                    // An example value object looks like this, where keys are param/payload/query names
                    // except for __auth, this is reserved for the params used for authentication
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
        reply(request.payload);
    }
});

```

Get all the tests for a single route from the server
```javascript
var server = new Hapi.Server().connection({ host: 'test' });
var tests = Patronus.testsFromRoute('GET', '/any/route', server);

```


Or just test all the endpoints
```javascript
var server = new Hapi.Server().connection({ host: 'test' });
var tests = Patronus.allTests(server);

```


The `tests` array contains a sequence of request/response pairs.  Test them against your service:

```javascript
// This will test every endpoint on your server using every combo of
// optional params you could think of. Multiplied by the number of param combos you
// provided
describe('specification-driven tests', function () {
    var tests = Patronus.allTests(server);

    tests.forEach(function (test) {
        it(test.description, function(done) {
            server.inject(test.request, function(res) {
                Patronus.assert(res, test.response);
                done();
            });
        });
    });
});
```
### #.allTests() options
You can also pass into #.allTests() an options param like so:
```javascript
var tests = Patronus.allTests(server, {
            select: 'api', // [optional] select a connection by label
            ignore: [{ // [optional] an array of objects defining routes you dont want to test

                pathContains: '/docs' // [optional] does an indexOf on the path, ignoring matches
                path: '/docs' // [optional] does a === on the path, ignoring matches
                method: 'GET' // [optional] does a === on the method, ignoring matches
            }, {
                pathContains: '/debug'
            }, {
                pathContains: '/documentation'
            }]
        });
```
Note that for each object in the ignore array, all params must match on a route to ignore it.

## To-Do
- [ ] Support deep object randomization (currently deep is all or nothing based on parent)
- [ ] Support extra headers / params / payload values not in spec


## Contribution Guidelines
We welcome contributions from the community and are pleased to have them. Please follow this guide when logging issues or making code changes.

#### Logging Issues

All issues should be created using the new issue form. Clearly describe the issue including steps to reproduce if there are any.
Just being honest here... issues that do not include a route and values object for testing will most likely not get worked on. Include those and we will do our best to fix it ASAP.

#### Fixes/New Issues

Code changes are welcome and should follow the guidelines below.

- All tests must pass using `npm test`
- Add tests for your new code ensuring that you have 100% code coverage (we can help you reach 100% but will not merge without it).
- Run `npm run coverage` to generate a report of test coverage
- Pull requests should be made to the master branch.
