var vows = require('vows');
var assert = require('assert');

var argparse = require('../lib/argparse');

function ArgumentParser(options) {
	options = options || {};
	options.debug = options.debug == undefined ? true : options.debug;
	options.stdout = options.stdout == undefined ? false : options.stdout;
	options.stderr = options.stderr == undefined ? false : options.stderr;
	return new argparse.ArgumentParser(options);
}

function Namespace(options) {
	options = options || {};
	return new argparse.Namespace(options);
}

/**
 * Action Test class
 */
exports.ActionTest = vows.describe('Action class').addBatch( {
	'new Action({options}) ' : {
		topic : function(item) {// Topic
			return new argparse.Action( {
				nargs : 5
			});
		},
		'should initialize arguments' : function(topic) {
			assert.equal(topic.nargs, 5);
		}
	},
	'getName() ' : {
		topic : function(item) {// Topic
			return new argparse.Action( {
				optionStrings : [ '-f', '--foo' ],
				destination : 'baz',
				metavar : 'BAR'
			});
		},
		'should return formatted optionStrings if set.' : function(topic) {
			assert.equal(topic.getName(), '-f/--foo');
		},
		'should return metavar if optionStrings is not set.' : function(topic) {
			topic.optionStrings = [];
			assert.equal(topic.getName(), 'BAR');
		},
		'should return metavar if optionStrings/metavar is not set.' : function(topic) {
			topic.optionStrings = [];
			topic.metavar = undefined;
			assert.equal(topic.getName(), 'baz');
		}
	},
	'call() ' : {
		topic : function(item) {// Topic
			return new argparse.Action();
		},
		'should throw exception' : function(topic) {// Vow
			assert.throws(function() {
				topic.call();
			});
		}
	}
});

exports.ActionAppendTest = vows.describe('ActionAppend class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionAppend( {
				destination : 'foo'
			});
		},
		'should store false into namespace (ignoring values)' : function(topic) {
			var namespace = new Namespace();

			topic.call(undefined, namespace, 'bar');
			assert.deepEqual(namespace.foo, [ 'bar' ]);

			topic.call(undefined, namespace, 'baz');
			assert.deepEqual(namespace.foo, [ 'bar', 'baz' ]);
		}
	}
});

exports.ActionAppendConstantTest = vows.describe('ActionAppendConstant class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionAppendConstant( {
				destination : 'foo',
				constant : 'const'
			});
		},
		'should store false into namespace (ignoring values)' : function(topic) {
			var namespace = new Namespace();

			topic.call(undefined, namespace, 'bar');
			assert.deepEqual(namespace.foo, [ 'const' ]);

			topic.call(undefined, namespace, 'baz');
			assert.deepEqual(namespace.foo, [ 'const', 'const' ]);
		}
	}
});

exports.ActionCountTest = vows.describe('ActionCount class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionCount( {
				destination : 'foo',
				constant : 'const'
			});
		},
		'should store false into namespace (ignoring values)' : function(topic) {
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
exports.ActionStoreTest = vows.describe('ActionStore class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionStore( {
				destination : 'foo'
			});
		},
		'should store values into namespace' : function(topic) {
			var namespace = new Namespace();
			topic.call(undefined, namespace, 'bar');
			assert.equal(namespace.foo, 'bar');
		}
	}
});

/**
 * Action Test class
 */
exports.ActionStoreConstantTest = vows.describe('ActionStoreConstant class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionStoreConstant( {
				destination : 'foo',
				constant : 'const'
			});
		},
		'should store constant into namespace (ignoring values)' : function(topic) {
			var parser = new ArgumentParser();
			var namespace = new Namespace();
			var values = 'bar';
			topic.call(parser, namespace, values);

			assert.equal(namespace.foo, 'const');
		}
	}
});

exports.ActionStoreTrueTest = vows.describe('ActionStoreTrue class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionStoreTrue( {
				destination : 'foo',
				constant : 'const'
			});
		},
		'should store true into namespace (ignoring values)' : function(topic) {
			var parser = new ArgumentParser();
			var namespace = new Namespace();
			var values = 'bar';
			topic.call(parser, namespace, values);

			assert.equal(namespace.foo, true);
		}
	}
});

exports.ActionStoreFalseTest = vows.describe('ActionStoreFalse class').addBatch( {
	'call(parser, namespace, values)' : {
		topic : function(item) {// Topic
			return new argparse.ActionStoreFalse( {
				destination : 'foo',
				constant : 'const'
			});
		},
		'should store false into namespace (ignoring values)' : function(topic) {
			var parser = new ArgumentParser();
			var namespace = new Namespace();
			var values = 'bar';
			topic.call(parser, namespace, values);

			assert.equal(namespace.foo, false);
		}
	}
});

/**
 * Namespace
 */
exports.NamespaceTest = vows.describe('Namespace class').addBatch( {
	"new Namespace({options}) " : {
		topic : function(item) {// Topic
			return Namespace( {
				foo : 'bar',
				baz : 6
			});
		},
		'should initialize the attributes transparently' : function(topic) {// Vow
			assert.equal(topic.foo, 'bar');
			assert.equal(topic.baz, 6);
		}
	},
	"get(key) " : {
		topic : function(item) {// Topic
			return Namespace( {
				foo : 'bar',
				baz : 6
			});
		},
		'should return correct value' : function(topic) {// Vow
			assert.equal(topic.get('foo'), 'bar');
			assert.equal(topic.get('baz'), 6);
		},
		'should return the same as attributes value' : function(topic) {// Vow
			assert.equal(topic.get('foo'), topic.foo);
			assert.equal(topic.get('baz'), topic.baz);
		}
	},
	"set(key, value) " : {
		topic : function(item) {// Topic
			return Namespace( {
				foo : 'bar',
				baz : 6
			});
		},
		'should return (this)' : function(topic) {// Vow
			assert.equal(topic.set('foo', 'foofoo'), topic);
		},
		'should set the right value' : function(topic) {// Vow
			topic.set('foo', 'bar');
			assert.equal(topic.get('foo'), 'bar');
			topic.set('foo', 'foofoo');
			assert.equal(topic.get('foo'), 'foofoo');
		},
		'should return set many value if called as set({key: value, ...})' : function(topic) {
			topic.set( {
				myId : 'helloworld2',
				key2 : 'lol'
			});
			assert.equal(topic.get('myId'), 'helloworld2');
			assert.equal(topic.get('key2'), 'lol');
		}
	},
	"isset() " : {
		topic : function(item) {// Topic
			return Namespace();
		},
		'should return false if key does not exists' : function(topic) {
			assert.equal(topic.isset('fsdqfjdlk'), false);
		},
		'should return true if key exists' : function(topic) {
			topic.set('myId', 'helloworld');
			assert.equal(topic.isset('myId'), true);
		}
	},
	"unset()" : {
		topic : function(item) {// Topic
			return Namespace();
		},
		'should return this' : function(topic) {
			assert.equal(topic.unset('jakhhk', {}), topic);
		},
		'should delete element if existing' : function(topic) {
			topic.set('myId', 'helloworld');
			assert.equal(topic.isset('myId'), true);
			topic.unset('myId');
			assert.equal(topic.isset('myId'), false);
		}
	},
	"pop()" : {
		topic : function(item) {
			return Namespace();
		},
		'should return default param if key does not exist' : function(topic) {
			assert.equal(topic.pop('jakhhk', 'defaultValue'), 'defaultValue');
		},
		'should delete element and return this element' : function(topic) {
			topic.set('myId', 'helloworld');
			assert.equal(topic.isset('myId'), true);
			var result = topic.pop('myId', 'defaultValue');
			assert.equal(topic.isset('myId'), false);
			assert.equal(result, 'helloworld');
		}
	},
	"keys()" : {
		topic : function(item) {
			return Namespace();
		},
		'should return array containing all data keys' : function(topic) {
			topic.set('foo', 1);
			assert.deepEqual(topic.keys(), [ 'foo' ]);
			topic.set('bar', 2);
			assert.deepEqual(topic.keys(), [ 'foo', 'bar' ]);
			topic.unset('foo');
			assert.deepEqual(topic.keys(), [ 'bar' ]);
		}
	},
	"values()" : {
		topic : function(item) {
			return Namespace();
		},
		'should return array containing all data keys' : function(topic) {
			topic.set('foo', 1);
			assert.deepEqual(topic.values(), [ 1 ]);
			topic.set('bar', 2);
			assert.deepEqual(topic.values(), [ 1, 2 ]);
			topic.unset('foo');
			assert.deepEqual(topic.values(), [ 2 ]);
		}
	}
});

/**
 * ArgumentParser Test class
 */
exports.ArgumentParserTest = vows.describe('ArgumentParser class').addBatch( { // Batch are executed sequentially
			"new ArgumentParser({}) " : {
				topic : function(item) {// Topic
					return ArgumentParser();
				},
				'should set program to "node"' : function(topic) {// Vow
					assert.equal(topic.program, 'node');
				},
				'should set the default help formatter' : function(topic) {// Vow
					assert.equal(topic.formatterClass, 'HelpFormatter');
				},
				'should set version as undefined' : function(topic) {// Vow
					assert.isUndefined(topic.version);
				}
			},
			"new ArgumentParser({program : 'foo'}) " : {
				topic : function(item) {// Topic
					return ArgumentParser( {
						program : 'foo'
					});
				},
				"should set program to 'foo'" : function(topic) {
					assert.equal(topic.program, 'foo');
				},
				'should set the default help formatter' : function(topic) {
					assert.equal(topic.formatterClass, 'HelpFormatter');
				},
				'should set version as undefined' : function(topic) {
					assert.isUndefined(topic.version);
				}
			},
			"_getFormatter() " : {
				topic : function(item) {// Topic
					return ArgumentParser( {
						program : 'foo'
					});
				},
				"should return <HelpFormatter> object for default configuration" : function(topic) {
					var formatter = topic._getFormatter();
					assert.ok(formatter instanceof argparse.HelpFormatter);
					// check that the program is set to foo
				assert.equal(formatter.program, 'foo');
			},
			"should return <other classes...> object if set in configuration" : function(topic) {
				[ 'HelpFormatterArgumentDefaults', 'HelpFormatterRawText', 'HelpFormatterRawDescription' ].forEach(function(className) {
					topic.formatterClass = className;
					var formatter = topic._getFormatter();
					assert.ok(formatter instanceof argparse[className]);
				});

			}
			},
			'_printMessage()' : {
				topic : function(item) {// Topic
					return ArgumentParser( {
						program : 'foo'
					});
				},
				"should print message into file" : function(topic) {
					var buffer = new Buffer(1024);
					var message = 'foo bar baz';
					topic._printMessage('foo bar baz', buffer);
					assert.equal(buffer.toString('utf8', 0, message.length), message);
				}
			},
			'formatUsage()' : {
				topic : function(item) {// Topic
					return ArgumentParser( {
						program : 'foo',
						help : false
					});
				},
				'should return "usage: %program%" without help' : function(topic) {
					assert.equal(topic.formatUsage(), 'usage: foo\n');
				},
				'should return "usage: %program% help" with help' : function(topic) {
					topic.addArgument( [ '-h', '--help' ], {
						action : 'help',
						help : 'foo bar'
					});
					assert.equal(topic.formatUsage(), 'usage: foo [-h]\n');
				}
			},
			'formatHelp()' : {
				topic : function(item) {// Topic
					return ArgumentParser( {
						program : 'foo',
						help : false
					});
				},
				'should return "usage: %program%" without help' : function(topic) {
					assert.equal(topic.formatHelp(), 'usage: foo\n');
				},
				'should return "usage: %program% help" with help' : function(topic) {
					topic.addArgument( [ '-h', '--help' ], {
						action : 'help',
						help : 'foo bar'
					});
					assert.equal(topic.formatHelp(), 'usage: foo [-h]\n');
				}
			// TODO test more cases here
			},
			'parseArgs() / with default argument' : {
				topic : function(item) {// Topic
					var parser = ArgumentParser( {
						program : 'foo',
						help : false
					});
					parser.addArgument( [ '-f', '--foo' ], {
						action : 'store',
						defaultValue : 'defaultVal'
					// help : 'foo bar'
							});
					return parser;
				},
				'should parse short syntax [-f, baz] to {foo:bar}' : function(topic) {
					assert.deepEqual(topic.parseArgs( [ '-f', 'baz' ]), Namespace( {
						foo : 'baz'
					}));
				},
				'should parse short explicit syntax [-f=baz] to {foo:bar}' : function(topic) {
					assert.deepEqual(topic.parseArgs( [ '-f=baz' ]), Namespace( {
						foo : 'baz'
					}));
					assert.deepEqual(topic.parseArgs( [ '-f=baz=notparsed' ]), Namespace( {
						foo : 'baz'
					}));
				},
				'should parse long syntax [--foo baz] to {foo:baz}' : function(topic) {
					assert.deepEqual(topic.parseArgs( [ '--foo', 'baz' ]), Namespace( {
						foo : 'baz'
					}));
				},
				'should parse long explicit syntax [--foo baz] to {foo:baz}' : function(topic) {
					assert.deepEqual(topic.parseArgs( [ '--foo=baz' ]), Namespace( {
						foo : 'baz'
					}));
					assert.deepEqual(topic.parseArgs( [ '--foo=baz=notparsed' ]), Namespace( {
						foo : 'baz'
					}));
				},

				'should parse [--foo] to {foo:defaultVal}' : function(topic) {
					assert.deepEqual(topic.parseArgs( [ '--foo' ]), Namespace( {
						foo : 'defaultVal'
					}));
				},
				'should parse [] to {foo:defaultVal}' : function(topic) {
					assert.deepEqual(topic.parseArgs( []), Namespace( {
						foo : 'defaultVal'
					}));
				}
			},
			'parseArgs() / with required argument' : {
				topic : function(item) {// Topic
					var parser = ArgumentParser( {
						program : 'foo'
					});
					parser.addArgument( [ '-r', '--required' ], {
						action : 'store',
						required : true,
						defaultValue : 'bar'
					});
					return parser;
				},
				'should parse [] throwing an error' : function(topic) {
					assert.throws(function() {
						topic.parseArgs( []);
					});
				},
				'should parse [--foo] throwing an error' : function(topic) {
					assert.throws(function() {
						topic.parseArgs( [ '--foo' ]);
					});// TODO : find way to check the error type
			}
			}

		});
