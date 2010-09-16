var vows = require('vows');
var assert = require('assert');

var argparse = require('../lib/argparse');

/**
 * ArgumentParser Test class
 */
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
		"should set program to 'foo'": function (topic) {
			assert.equal(topic.program, 'foo');
		},
		'should set the default help formatter': function (topic) {
            assert.equal(topic.formatterClass, 'HelpFormatter');
        },
		'should set version as undefined': function (topic) {
            assert.isUndefined(topic.version);
        }
	},
	"_getFormatter() ": {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({program: 'foo'});
		},
		"should return <HelpFormatter> object for default configuration": function (topic) {
			var formatter = topic._getFormatter();
			assert.ok(formatter instanceof argparse.HelpFormatter);
			//check that the program is set to foo
			assert.equal(formatter.program, 'foo');
		},
		"should return <other classes...> object if set in configuration": function (topic) {
			['ArgumentDefaultsHelpFormatter', 'RawTextHelpFormatter', 'RawDescriptionHelpFormatter'].forEach(function(className) {
				topic.formatterClass = className;
				var formatter = topic._getFormatter();
				assert.ok(formatter instanceof argparse[className]);
			});
			
		}
	},
	'_printMessage()': {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({program: 'foo'});
		},
		"should print message into file": function (topic) {
			var buffer = new Buffer(1024);
			var message = 'foo bar baz';
			topic._printMessage('foo bar baz', buffer);
			assert.equal(buffer.toString('utf8', 0, message.length), message);
		}
	},
	'formatUsage()': {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({program: 'foo', help: false});
		},
		'should return "usage: %program%" without help': function (topic) {
			assert.equal(topic.formatUsage(), 'usage: foo\n');
		},
		'should return "usage: %program% help" with help': function (topic) {
			topic.addArgument(['-h', '--help'], {
				action : 'help',
	        	help : 'foo bar'
			});
			assert.equal(topic.formatUsage(), 'usage: foo help\n');
		}
	},
	'formatHelp()': {
		topic: function (item) {// Topic
			return new argparse.ArgumentParser({program: 'foo', help: false});
		},
		'should return "usage: %program%" without help': function (topic) {
			assert.equal(topic.formatHelp(), 'usage: foo\n');
		},
		'should return "usage: %program% help" with help': function (topic) {
			topic.addArgument(['-h', '--help'], {
				action : 'help',
	        	help : 'foo bar'
			});
			assert.equal(topic.formatHelp(), 'usage: foo help\n');
		}
		//TODO test more cases here
	},
	'parseArgs()': {
		topic: function (item) {// Topic
			var parser = new argparse.ArgumentParser({program: 'foo', help: false});
			parser.addArgument(['-f', '--foo'], {
				action : 'store',
				defaultValue: 'bar'
	        	//help : 'foo bar'
			});
			return parser;
		},
		'should do lol': function(topic) {
			assert.equal(topic.parseArgs(['--foo', 'baz']), 'usage: foo help\n');
		}
	}
		
});


/**
 * Action Test class
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
		    assert.equal(topic.toString(), '<Action:{optionStrings:[], nargs:5, required:false}>');
			//TODO correct bug
		}
	},
	'getName() ': {
		topic: function (item) {// Topic
			return new argparse.Action({
				optionStrings: ['-f', '--foo'],
				destination: 'baz',
				metavar:'BAR'
			});
		},
		'should return formatted optionStrings if set.': function (topic) {
			assert.equal(topic.getName(), '-f/--foo');
		},
		'should return metavar if optionStrings is not set.': function (topic) {
			topic.optionStrings = [];
			assert.equal(topic.getName(), 'BAR');
		},
		'should return metavar if optionStrings/metavar is not set.': function (topic) {
			topic.optionStrings = [];
			topic.metavar =  undefined;
			assert.equal(topic.getName(), 'baz');
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
exports.ActionTest = ActionTest;
exports.ArgumentParserTest = ArgumentParserTest;
