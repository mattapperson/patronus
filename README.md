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
- [ ] Support creation of request objects for all param combos
- [ ] Pass in params via a JS object as well so as to acomidate more test cases
- [ ] Support joi optional params, creating all possible combos
- [ ] Support Joi `when` when creating combos
- [ ] Support joi `ref` when creating combos
- [ ] Support deep param validation
- [ ] support URL pased params
