/*jslint nodejs:true, indent:4 */
var vows = require('vows'),
	assert = require('assert');

var argparse = require('../../lib/argparse.js'),
	ArgumentParser = argparse.ArgumentParser,
	Namespace = argparse.Namespace;

/*******************************************************************************
 * JSLint validation
 ******************************************************************************/
try {
    require('lint').vows.createTest([ __filename ]).export(module);
} catch (e) {
    console.warn('Warning: JSLint not found try `npm install lint`');
}

/*******************************************************************************
 * Namespace Test class
 ******************************************************************************/
var NamespaceTest = vows.describe('Namespace class').addBatch({
    "new Namespace({options}) ": {
        topic: function (item) {
            return new Namespace({
                foo: 'bar',
                baz: 6
            });
        },
        'should initialize the attributes transparently': function (topic) {
            assert.equal(topic.foo, 'bar');
            assert.equal(topic.baz, 6);
        }
    },
    "get(key) ": {
        topic: function (item) {
            return new Namespace({
                foo: 'bar',
                baz: 6
            });
        },
        'should return correct value': function (topic) {
            assert.equal(topic.get('foo'), 'bar');
            assert.equal(topic.get('baz'), 6);
        },
        'should return the same as attributes value': function (
                topic) {
            assert.equal(topic.get('foo'), topic.foo);
            assert.equal(topic.get('baz'), topic.baz);
        }
    },
    "set(key, value) ": {
        topic: function (item) {
            return new Namespace({
                foo: 'bar',
                baz: 6
            });
        },
        'should return (this)': function (topic) {
            assert.equal(topic.set('foo', 'foofoo'), topic);
        },
        'should set the right value': function (topic) {
            topic.set('foo', 'bar');
            assert.equal(topic.get('foo'), 'bar');
            topic.set('foo', 'foofoo');
            assert.equal(topic.get('foo'), 'foofoo');
        },
        'should return set many value if called as set({key: value, ...})': function (
                topic) {
            topic.set({
                myId: 'helloworld2',
                key2: 'lol'
            });
            assert.equal(topic.get('myId'), 'helloworld2');
            assert.equal(topic.get('key2'), 'lol');
        }
    },
    "isset() ": {
        topic: function (item) {
            return new Namespace();
        },
        'should return false if key does not exists': function (
                topic) {
            assert.equal(topic.isset('fsdqfjdlk'), false);
        },
        'should return true if key exists': function (topic) {
            topic.set('myId', 'helloworld');
            assert.equal(topic.isset('myId'), true);
        }
    },
    "unset()": {
        topic: function (item) {
            return new Namespace();
        },
        'should return default param if key does not exist': function (
                topic) {
            assert.equal(topic.unset('jakhhk', 'defaultValue'),
            'defaultValue');
        },
        'should delete element and return this element': function (
                topic) {
            topic.set('myId', 'helloworld');
            assert.equal(topic.isset('myId'), true);
            var result = topic.unset('myId', 'defaultValue');
            assert.equal(topic.isset('myId'), false);
            assert.equal(result, 'helloworld');
        }
    },
    "keys()": {
        topic: function (item) {
            return new Namespace();
        },
        'should return array containing all data keys': function (
                topic) {
            topic.set('foo', 1);
            assert.deepEqual(topic.keys(), [ 'foo' ]);
            topic.set('bar', 2);
            assert.deepEqual(topic.keys(), [ 'foo', 'bar' ]);
            topic.unset('foo');
            assert.deepEqual(topic.keys(), [ 'bar' ]);
        }
    },
    "values()": {
        topic: function (item) {
            return new Namespace();
        },
        'should return array containing all data keys': function (
                topic) {
            topic.set('foo', 1);
            assert.deepEqual(topic.values(), [ 1 ]);
            topic.set('bar', 2);
            assert.deepEqual(topic.values(), [ 1, 2 ]);
            topic.unset('foo');
            assert.deepEqual(topic.values(), [ 2 ]);
        }
    }
});

exports.NamespaceTest = NamespaceTest;