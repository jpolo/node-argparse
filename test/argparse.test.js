var vows = require('vows');
var assert = require('assert');

var argparse = require('../lib/argparse');

var ArgumentParserTest = vows
.describe('ArgumentParser class')
.addBatch({ // Batch are executed sequentially
	"new ArgumentParser({}) ": {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({});
		},
		'should set program to "node"': function (topic) {// Vow
			assert.equal(topic.program, 'node');
		},
		'should set the default help formatter': function (topic) {// Vow
            assert.equal(topic.formatterClass, 'HelpFormatter');
        },
		'should set version as undefined': function (topic) {// Vow
            assert.isUndefined(topic.version);
        }
	},
	"new ArgumentParser({program : 'foo'}) ": {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({program: 'foo'});
		},
		"should set program to 'foo'": function (topic) {// Vow
			assert.equal(topic.program, 'foo');
		},
		'should set the default help formatter': function (topic) {// Vow
            assert.equal(topic.formatterClass, 'HelpFormatter');
        },
		'should set version as undefined': function (topic) {// Vow
            assert.isUndefined(topic.version);
        }
	}

}); // Export the Suite


/**
 *
 */
var ActionTest = vows
.describe('Action class')
.addBatch({
	'new Action({options}) ': {
		topic: function (item) {// Topic
			return new argparse.Action({nargs : 5});
		},
		'should initialize arguments': function(topic) {
			assert.equal(topic.nargs, 5);
		},
		'should be represented as <className:{attributes}>': function (topic) {// Vow
		    assert.equal(topic.toString(), '<Action:{optionStrings=[], nargs=5, required=false}>');
		}
	},
	'call() ': {
		topic: function (item) {// Topic
			return new argparse.Action();
		},
		'should throw exception': function (topic) {// Vow
		    assert.throws("topic.call();");
		}
	}
});

/**
 * Namespace
 */
var NamespaceTest = vows
.describe('Namespace class')
.addBatch({
	"new Namespace({options}) ": {
		topic: function (item) {// Topic
			return new argparse.Namespace({foo : 'bar', baz:6});
		},
		'should initialize the attributes transparently': function (topic) {// Vow
		    assert.equal(topic.foo, 'bar');
		    assert.equal(topic.baz, 6);
		}
	}, 
	"Namespace.get(key) ": {
		topic: function (item) {// Topic
			return new argparse.Namespace({foo : 'bar', baz:6});
		},
		'should return correct value': function (topic) {// Vow
			assert.equal(topic.get('foo'), 'bar');
		    assert.equal(topic.get('baz'), 6);
		},
		'should return the same as attributes value': function (topic) {// Vow
			assert.equal(topic.get('foo'), topic.foo);
		    assert.equal(topic.get('baz'), topic.baz);
		}
	},
	"Namespace.set(key, value) ": {
		topic: function (item) {// Topic
			return new argparse.Namespace({foo : 'bar', baz:6});
		},
		'should return (this)': function (topic) {// Vow
			assert.equal(topic.set('foo', 'foofoo'), topic);
		},
		'should set the right value': function (topic) {// Vow
			topic.set('foo', 'bar');
			assert.equal(topic.get('foo'), 'bar');
			topic.set('foo', 'foofoo');
			assert.equal(topic.get('foo'), 'foofoo');
		}
	}
});

exports.NamespaceTest = NamespaceTest;
exports.ArgumentParserTest = ArgumentParserTest;
exports.ActionTest = ActionTest;
