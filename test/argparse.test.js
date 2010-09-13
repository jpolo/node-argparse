var vows = require('vows');
var assert = require('assert');

var argparse = require('../lib/argparse');

var ArgumentParserTest = vows
.describe('ArgumentParser class')
.addBatch({ // Batch are executed sequentially

	'The constructor': {// Context siblings are executed in parallel in an undefined order
	
		'with the arguments {"program" : "foo-bar"}': {// Sub-Context
		
			topic: function (item) {// Topic
				return new argparse.ArgumentParser({'program' : 'foo-bar'});
			},
            'should return "foo-bar" as program attribute': function (topic) {// Vow
                assert.equal(topic.program, 'foo-bar');
            },
			'should have the default help formatter': function (topic) {// Vow
                assert.equal(topic.formatterClass, 'HelpFormatter');
            },
            'should have no version': function (topic) {// Vow
                assert.isUndefined(topic.version);
            }
        },
		'with the arguments {"version" : "0.1"}': {// Sub-Context
			topic: function (item) {// Topic
				return new argparse.ArgumentParser({'version' : '0.1'});
			},
            'should return have "node" as program attribute': function (topic) {// Vow
                assert.equal(topic.program, 'node');
            },
            'should have the right version': function (topic) {// Vow
                assert.equal(topic.version, '0.1');
            }
        }

    }

}); // Export the Suite


/**
 *
 */
var ActionTest = vows
.describe('Action class')
.addBatch({
	'Constructor ': {
		topic: function (item) {// Topic
			return new argparse.Action({nargs : 5});
		},
		'should return the action like className(attributes)': function (topic) {// Vow
		    assert.equal(topic.toString(), 'Action({"optionStrings":[],"nargs":5,"required":false})');
		},
		'should throw exception': function (topic) {// Vow
		    assert.throws("topic.call();");
		}
	}
});

exports.ArgumentParserTest = ArgumentParserTest;
exports.ActionTest = ActionTest;
