/*jslint nodejs:true, indent:4 */
var vows = require('vows'),
    assert = require('assert');

var __filenameTested = require('fs').realpathSync(__dirname + '../../../lib/argparse.js');
var argparse = require(__filenameTested),
    Namespace = argparse.Namespace,
    ArgumentParser = argparse.ArgumentParser;

function createParser(options) {
    options = options || {};
    options.debug = options.debug === undefined ? true: options.debug;
    options.stdout = options.stdout === undefined ? false: options.stdout;
    options.stderr = options.stderr === undefined ? false: options.stderr;
    return new ArgumentParser(options);
}

/*******************************************************************************
 * JSLint validation
 ******************************************************************************/
try {
    require('lint').vows.createTest([ __filename, __filenameTested ]).export(module);
} catch (e) {
    console.warn('Warning: JSLint not found try `npm install lint`');
}

/*******************************************************************************
 * ArgumentParser Test validation
 ******************************************************************************/
var ArgumentParserTest = vows.describe('ArgumentParser class').addBatch({
    "new ArgumentParser({}) ": {
        topic: function (item) {
            return createParser();
        },
        'should set program to "node"': function (topic) {
            assert.equal(topic.program, 'node');
        },
        'should set the default help formatter': function (topic) {
            assert.equal(topic.formatterClass, 'HelpFormatter');
        },
        'should set version as undefined': function (topic) {
            assert.isUndefined(topic.version);
        }
    },
    "new ArgumentParser({program: 'foo'}) ": {
        topic: function (item) {
            return createParser({
                program: 'foo'
            });
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
        topic: function (item) {
            return createParser({
                program: 'foo'
            });
        },
        "should return <HelpFormatter> object for default configuration": function (topic) {
            var formatter = topic._getFormatter();
            assert.ok(formatter instanceof argparse.HelpFormatter);
            // check that the program is set to foo
            assert.equal(formatter.program, 'foo');
        },
        "should return <other classes...> object if set in configuration": function (topic) {
            [ 'HelpFormatterArgumentDefaults',
              'HelpFormatterRawText',
              'HelpFormatterRawDescription' 
            ].forEach(function (className) {
                topic.formatterClass = className;
                var formatter = topic._getFormatter();
                assert.ok(formatter instanceof argparse[className]);
            });
    
        }
    },
    '_printMessage()': {
        topic: function (item) {
            return createParser({
                program: 'foo'
            });
        },
        "should print message into file": function (topic) {
            var buffer = new Buffer(1024),
                message = 'foo bar baz';
            topic._printMessage('foo bar baz', buffer);
            assert.equal(buffer.toString('utf8', 0, message.length), message);
        }
    },
    'formatUsage()': {
        topic: function (item) {
            return createParser({
                program: 'foo',
                help: false
            });
        },
        'should return "usage: %program%" without help': function (topic) {
            assert.equal(topic.formatUsage(), 'usage: foo\n');
        },
        'should return "usage: %program% help" with help': function (topic) {
            topic.addArgument(
                [ '-h', '--help' ], 
                {
                    action: 'help',
                    help: 'foo bar'
                }
            );
            assert.equal(topic.formatUsage(), 'usage: foo [-h]\n');
        }
    },
    'formatHelp()': {
        topic: function (item) {
            return createParser({
                program: 'foo',
                help: false
            });
        },
        'should return "usage: %program%" without help': function (topic) {
            assert.equal(topic.formatHelp(), 'usage: foo\n');
        },
        'should return "usage: %program% help" with help': function (topic) {
            topic.addArgument([ '-h', '--help' ], {
                action: 'help',
                help: 'foo bar'
            });
            assert.equal(topic.formatHelp(), 'usage: foo [-h]\n');
        }
        // TODO test more cases here
    },
    'parseArgs() / with default argument': {
        topic: function (item) {
            var parser = createParser({
                program: 'foo',
                help: false
            });
            parser.addArgument([ '-f', '--foo' ], {
                action: 'store',
                defaultValue: 'defaultVal'
                // help: 'foo bar'
            });
            return parser;
        },
        'should parse short syntax [-f, baz] to {foo:bar}': function (topic) {
            assert.deepEqual(
                topic.parseArgs([ '-f', 'baz' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
        },
        'should parse short explicit syntax [-f=baz] to {foo:bar}': function (topic) {
            assert.deepEqual(
                topic.parseArgs([ '-f=baz' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
            assert.deepEqual(
                topic.parseArgs([ '-f=baz=notparsed' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
        },
        'should parse long syntax [--foo baz] to {foo:baz}': function (topic) {
            assert.deepEqual(
                topic.parseArgs([ '--foo', 'baz' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
        },
        'should parse long explicit syntax [--foo=baz] to {foo:baz}': function (
                topic) {
            assert.deepEqual(
                topic.parseArgs([ '--foo=baz' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
            assert.deepEqual(
                topic.parseArgs([ '--foo=baz=notparsed' ]),
                new Namespace({
                    foo: 'baz'
                })
            );
        },
        'should parse [--foo] to {foo:defaultVal}': function (
                topic) {
            assert.deepEqual(
                topic.parseArgs([ '--foo' ]),
                new Namespace({
                    foo: 'defaultVal'
                })
            );
        },
        'should parse [] to {foo:defaultVal}': function (topic) {
            assert.deepEqual(
                topic.parseArgs([]), 
                new Namespace({
                    foo: 'defaultVal'
                })
            );
        }
    },
    'parseArgs() / with required argument': {
        topic: function (item) {
            var parser = createParser({
                program: 'foo'
            });
            parser.addArgument(
                [ '-r', '--required' ], 
                {
                    action: 'store',
                    required: true,
                    defaultValue: 'bar'
                }
            );
            return parser;
        },
        'should parse [] throwing an error': function (topic) {
            assert.throws(function () {
                topic.parseArgs([]);
            });
        },
        'should parse [--foo] throwing an error': function (topic) {
            assert.throws(function () {
                topic.parseArgs([ '--foo' ]);// TODO find way to check the error type
            });
        }
    },
    'parseArgs() / with type cast': {
        topic: function (item) {
            var parser = createParser({
                program: 'foo'
            });
            return parser;
        },
        'should parse integer': function (topic) {
            topic.addArgument(
                [ '--integer' ], 
                {
                    action: 'store',
                    type: 'int'
                }
            );
            var data = topic.parseArgs([ '--integer', '2' ]);
            assert.strictEqual(data.integer, 2);
            assert.notStrictEqual(data.integer, '2');
            assert.throws(function () {
                topic.parseArgs([ '--integer', 'fkldsjfl' ]);
            });
        },
        'should parse float': function (topic) {
            topic.addArgument(
                [ '--float' ], 
                {
                    action: 'store',
                    type: 'float'
                }
            );
            var data = topic.parseArgs([ '--float', '1.2' ]);
            assert.strictEqual(data.float, 1.2);
            assert.notStrictEqual(data.integer, '1.2');
            assert.throws(function () {
                topic.parseArgs([ '--float', 'fkldsjfl' ]);
            });
        },
        'should parse string': function (topic) {
            topic.addArgument(
                [ '--string' ], 
                {
                    action: 'store',
                    type: 'string'
                }
            );
            var data = topic.parseArgs([ '--string', 'toto' ]);
            assert.strictEqual(data.string, 'toto');
        }
    }
});

/**
 * Exports
 */
exports.ArgumentParserTest = ArgumentParserTest;