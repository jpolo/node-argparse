var vows = require('vows');
var assert = require('assert');

var argparse = require('../lib/argparse');

vows
.describe('ArgumentParser class')
.addBatch({ // Batch are executed sequentially

	'The constructor': {// Context siblings are executed in parallel in an undefined order
	
		'with the arguments {"program" : "foo-bar"}': {// Sub-Context
		
			topic: function (item) {// Topic
				return new argparse.ArgumentParser({'program' : 'foo-bar'});
			},
            'should return the same program attribute': function (topic) {// Vow
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
            'should return have "node" as default program launched': function (topic) {// Vow
                assert.equal(topic.program, 'node');
            },
            'should have the right version': function (topic) {// Vow
                assert.equal(topic.version, '0.1');
            }
        }

    },
    
    'The exit/error methods': {
    	topic: function (item) {// Topic
			return new argparse.ArgumentParser({});
		},
	    'should return have "node" as default program launched': function (topic) {// Vow
	        assert.equal(topic.program, 'node');
	    },
	    'should have the right version': function (topic) {// Vow
	    	assert.equal(topic._printMessage('toto'), '0.1');
	    }
    }


}).export(module); // Export the Suite