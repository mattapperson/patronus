# Hapi Mocha
### Because even your mocha should be hapi!

Load the npm module:

```javascript
var hapiMocha = require('hapi-mocha');
```

Get all the tests for a single route from the server
```javascript
var server = new Hapi.Server().connection({ host: 'test' });
var tests = hapiMocha.testsFromRoute('GET', '/any/route', server);

```


Or just test all the endpoints
```javascript
var server = new Hapi.Server().connection({ host: 'test' });
var tests = hapiMocha.allTests(server);

```


The `tests` array contains a sequence of request/response pairs.  Test them against your service:

```javascript
var preq = require('preq');

describe('specification-driven tests', function () {
    tests.forEach(function (test) {
        it(test.description, function() {
            server.inject({
                method: test.method,
                url: test.route
            }, function(res) {
                assert.deepEqual(res, test.response);
                done();
            });
        });
    });
});
```

## To-DO
* We need to pass in params to tests, what is the best & yet most automated way to do this?
* Build this out (it is TDD after all :) )
