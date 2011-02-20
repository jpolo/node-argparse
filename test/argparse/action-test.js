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
 * ActionTest Test class
 ******************************************************************************/
var ActionTest = vows.describe('Action class').addBatch({
    'new Action({options}) ': {
        topic: function (item) {
            return new argparse.Action({
                nargs: 5
            });
        },
        'should initialize arguments': function (topic) {
            assert.equal(topic.nargs, 5);
        }
    },
    'getName() ': {
        topic: function (item) {
            return new argparse.Action({
                optionStrings: [ '-f', '--foo' ],
                destination: 'baz',
                metavar: 'BAR'
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
            topic.metavar = undefined;
            assert.equal(topic.getName(), 'baz');
        }
    },
    'call() ': {
        topic: function (item) {
            return new argparse.Action();
        },
        'should throw exception': function (topic) {
            assert.throws(function () {
                topic.call();
            });
        }
    }
});

var ActionAppendTest = vows.describe('ActionAppend class').addBatch({
    'call(parser, namespace, values)': {
        topic: function (item) {
            return new argparse.ActionAppend({
                destination: 'foo'
            });
        },
        'should store false into namespace (ignoring values)': function (topic) {
            var namespace = new Namespace();

            topic.call(undefined, namespace, 'bar');
            assert.deepEqual(namespace.foo, [ 'bar' ]);

            topic.call(undefined, namespace, 'baz');
            assert.deepEqual(namespace.foo, [ 'bar', 'baz' ]);
        }
    }
});

var ActionAppendConstantTest = vows.describe('ActionAppendConstant class').addBatch({
    'call(parser, namespace, values)': {
        topic: function (item) {
            return new argparse.ActionAppendConstant({
                destination: 'foo',
                constant: 'const'
            });
        },
        'should store false into namespace (ignoring values)': function (topic) {
            var namespace = new Namespace();

            topic.call(undefined, namespace, 'bar');
            assert.deepEqual(namespace.foo, [ 'const' ]);

            topic.call(undefined, namespace, 'baz');
            assert.deepEqual(namespace.foo, [ 'const', 'const' ]);
        }
    }
});

var ActionCountTest = vows.describe('ActionCount class').addBatch({
    'call(parser, namespace, values)': {
        topic: function (item) {
            return new argparse.ActionCount({
                destination: 'foo',
                constant: 'const'
            });
        },
        'should store false into namespace (ignoring values)': function (
                topic) {
            var namespace = new Namespace();

            assert.deepEqual(namespace.foo, undefined);

            topic.call(undefined, namespace, 'bar');
            assert.deepEqual(namespace.foo, 1);

            topic.call(undefined, namespace, 'baz');
            assert.deepEqual(namespace.foo, 2);
        }
    }
});

/**
 * Action Test class
 */
var ActionStoreTest = vows.describe('ActionStore class').addBatch({
    'call(parser, namespace, values)': {
        topic: function (item) {
            return new argparse.ActionStore({
                destination: 'foo'
            });
        },
        'should store values into namespace': function (topic) {
            var namespace = new Namespace();
            topic.call(undefined, namespace, 'bar');
            assert.equal(namespace.foo, 'bar');
        }
    }
});

/**
 * Action Test class
 */
var ActionStoreConstantTest = vows.describe('ActionStoreConstant class').addBatch({
    'call(parser, namespace, values)': {
		topic: function (item) {
			return new argparse.ActionStoreConstant({
				destination: 'foo',
				constant: 'const'
			});
		},
		'should store constant into namespace (ignoring values)': function (topic) {
			var parser = new ArgumentParser();
			var namespace = new Namespace();
			var values = 'bar';
			topic.call(parser, namespace, values);

			assert.equal(namespace.foo, 'const');
		}
	}
});

var ActionStoreTrueTest = vows.describe('ActionStoreTrue class').addBatch({
    'call(parser, namespace, values)': {
        topic: function (item) {
            return new argparse.ActionStoreTrue({
                destination: 'foo',
                constant: 'const'
            });
        },
        'should store true into namespace (ignoring values)': function (topic) {
            var parser = new ArgumentParser();
            var namespace = new Namespace();
            var values = 'bar';
            topic.call(parser, namespace, values);

            assert.equal(namespace.foo, true);
        }
    }
});

var ActionStoreFalseTest = vows.describe('ActionStoreFalse class').addBatch({
	'call(parser, namespace, values)': {
		topic: function (item) {
			return new argparse.ActionStoreFalse({
				destination: 'foo',
				constant: 'const'
			});
		},
		'should store false into namespace (ignoring values)': function (topic) {
			var parser = new ArgumentParser();
			var namespace = new Namespace();
			var values = 'bar';
			topic.call(parser, namespace, values);

			assert.equal(namespace.foo, false);
		}
	}
});

/**
 * Exports
 */
exports.ActionTest = ActionTest;
exports.ActionAppendTest = ActionAppendTest;
exports.ActionAppendConstantTest = ActionAppendConstantTest;
exports.ActionCountTest = ActionCountTest;
exports.ActionStoreTest = ActionStoreTest;
exports.ActionStoreConstantTest = ActionStoreConstantTest;
exports.ActionStoreTrueTest = ActionStoreTrueTest;
exports.ActionStoreFalseTest = ActionStoreFalseTest;