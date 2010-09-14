/**
 * Object for parsing command line strings into Javascript objects.
 *
 * Keyword Arguments:
 *      - program -- The name of the program (default: process.argv[0])
 *      - usage -- A usage message (default: auto-generated from arguments)
 *      - description -- A description of what the program does
 *      - epilog -- Text following the argument descriptions
 *      - parents -- Parsers whose arguments should be copied into this one
 *      - formatterClass -- HelpFormatter class for printing help messages
 *      - prefixChars -- Characters that prefix optional arguments
 *      - prefixCharsFile -- Characters that prefix files containing additional arguments
 *      - argument_default -- The default value for all arguments
 *      - conflict_handler -- String indicating how to handle conflicts
 *      - add_help -- Add a -h/-help option
 */

var sys = require('sys');
var path = require('path');
var fs = require('fs');
var assert = require('assert');


/**
 * Utils methods
 */
/**
 * Class Helper
 */
function debug(obj) {
	
}

var Class;
(function(){
	var isFn = function(fn) { return typeof fn == 'function'; };
	Class = function(){};
	Class.create = function(className, proto) {
		var k = function(magic) { // call initialize only if there's no magic cookie
			if (magic != isFn && isFn(this.initialize)) {
				this.initialize.apply(this, arguments);
			}
		};
		k.prototype = new this(isFn); // use our private method as magic cookie
		k.prototype.toRepr = function() {
			
			
			return '#<' + this.constructor.__class__ + ':{' + JSON.stringify(this) + '}';
		};
		k.prototype.toString = function() {
			return this.toRepr();
		};
		
		for (key in proto) (function(fn, sfn) { // create a closure
			k.prototype[key] = (!isFn(fn) || !isFn(sfn)) ? fn : function() {this._super = sfn;return fn.apply(this, arguments);};// add _super method
		})(proto[key], k.prototype[key]);

		k.prototype.constructor = k;
		k.prototype.constructor.__class__ = className;
		k.extend = this.extend || this.create;
		return k;
	};
})();

/** 
 * Return defaultValue if value is not set
 * 
 * @param value
 * @param defaultValue
 * @return
 */


var $defined = function(obj) {
	return (obj != undefined);
};

var $value = function(value, defaultValue) {
	return (!$defined(value) ? defaultValue : value);
};

var $extend = function(original, extended){
	for (var key in (extended || {})) original[key] = extended[key];
	return original;
};

var $isCallable = function(c) {
	if (!c) {
		return false;
	}
	if (c instanceof Function || $defined(c.call)) {
		return true;
	}
	
	try {
		c.__call = c.__call;
		return false;
	} catch(e) {
		console.log(e);
		return true;
	}
} ;

/*var $arrayCollect = function (array, iterator, context) {
    iterator = iterator || function(x) { return x; };
    var results = [];
    array.forEach(function(value, index) {
    	results.push(iterator.call(context, value, index));
    });
    return results;
};*/

/*var $arrayFindAll = function(array, iterator, context) {
    var results = [];
    array.forEach(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
};*/

var $stringRepeat = function (string, count){
	return count < 1 ? '' : new Array(count + 1).join(string);
};

var $stringStrip = function(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
};

var $stringLStrip = function(string, chars) {
	chars = chars || "\\s";
	return string.replace(new RegExp("^[" + chars + "]+", "g"), "");
};

var $stringPrint = function(string, obj) {
	var tag = '%';
	var result = string.substring();
	obj = obj || {};
	for(property in obj) {
		result = result.replace(tag + property + tag, obj[property]);
	}
	return result;
};

var _ = function(string) {
	return string;
};

/**
 * Constants
 */
EOL = '\n';
SUPPRESS = '==SUPPRESS==';

OPTIONAL = '?';
ZERO_OR_MORE = '*';
ONE_OR_MORE = '+';
PARSER = 'A...';
REMAINDER = '...';


/**
 * Formatting Help
 */

/**
 * Formatter for generating usage messages and argument help strings.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var HelpFormatter = Class.create('HelpFormatter', {
	initialize: function(options) {
		options = options || {};
	
		this.program = $value(options['program']);
	
		this.indentation = $value(options['indentation'], 2);
		this.indentationCurrent = 0;
		this.indentationLevel = 0;
		
		this.helpPositionMax = $value(options['helpPositionMax'], 24);
		this.width = $value(options['width'], $value(process.env['COLUMNS'], 80) - 2);
	
		this.actionLengthMax = 0;
	
		this.sectionRoot = new this._HelpSection(this, null);
	    this.sectionCurrent = this.sectionRoot;
	
	    this._regexpWhitespace = '\s+';
	    this._regexpLongBreak = EOL + EOL + EOL + '+';
	},
	_indent: function() {
		this.indentationCurrent += this.indentation;
		this.indentationLevel += 1;
		return this;
	},
	_dedent: function() {
		this.indentationCurrent -= this.indentation;
		this.indentationLevel -= 1;
		assert.ok(this.indentationCurrent >= 0, 'Indent decreased below 0.');
		return this;
	},
	_addItem: function(callback, args) {
	    this.sectionCurrent.items.push([callback, args]);
	    return this;
	},
	
	/**
	 * Internal Section class
	 */
	_HelpSection: Class.create('_HelpSection', {
		initialize: function(formatter, parent, heading) {
	        this.formatter = formatter;
	        this.parent = parent;
	        this.heading = heading;
	        this.items = [];
		},
	    formatHelp: function() {
	        //format the indented section
	        if(this.parent) {
	            this.formatter._indent();
	        }
	        
	        var itemHelp = [];
	        this.items.forEach(function(item, itemIndex) {
	        	var callback = item[0];
	        	var args = item[1];
	        	itemHelp.push(callback(args));
	        });
	        itemHelp = this.formatter._joinParts(itemHelp);
	        
	        if(this.parent) {
	            this.formatter._dedent();
	        }

	        //return nothing if the section was empty
	        if(!itemHelp) {
	            return '';
	        }

	        //add the heading if the section was non-empty
	        heading = (this.heading && this.heading != SUPPRESS) ? 
	        		$stringRepeat(' ', this.formatter.indentationCurrent) + this.heading + ':' + EOL : 
	        		'';

	        //join the section-initialize newline, the heading and the help
	        return this.formatter._joinParts([EOL, heading, itemHelp, EOL]);
		}
	}),
	
	/**
	 * Message building methods
	 */
	startSection: function(/*string*/ heading) {
		this._indent();
	    var section = new this._HelpSection(this, this.sectionCurrent, heading);
	    this._addItem(section.formatHelp, []);
	    this._sectionCurrent = section;
	    return this;
	},
	endSection: function() {
		this.sectionCurrent = this.sectionCurrent.parent;
		this._dedent();
		return this;
	},
	addText: function(/*string*/ text) {
		if (text && text != SUPPRESS) {
	        this._addItem(this._formatText, [text]);
		}
		return this;
	},
	addUsage: function(/*string*/ usage, actions, groups, /*string*/ prefix) {
		if(usage != SUPPRESS ) {
	        this._addItem(this._formatUsage, [usage, actions, groups, prefix]);
		}
		return this;
	},
	addArgument: function(action) {
	    if(action.help != SUPPRESS) {

	        //find all invocations
	        var invocations = [this._formatActionInvocation(action)];
	        var invocationLength = invocations[0].length;
	        
	        if($defined(action._getSubactions)) {
				this._indent();
				action._getSubactions().forEach(function(subaction) {
					
					var invocationNew = this._formatActionInvocation(subaction);
		        	invocations.push(invocationNew);
		        	invocationLength = Math.max(invocationLength, invocationNew.length);
		        	
				});
	            this._dedent();
			}

	        //update the maximum item length
	        var actionLength = invocationLength + this.indentationCurrent;
	        this.actionLengthMax = Math.max(this.actionLengthMax, actionLength);

	        //add the item to the list
	        this._addItem(this._formatAction, [action]);
	    }
	    return this;
	},
	addArguments: function(/*array*/ actions) {
		actions.forEach(function(action) {
			this.addArgument(action);
		});
		return this;
	},
	
	/**
	 * Help-formatting methods
	 */
	formatHelp: function() {
        var help = this.sectionRoot.formatHelp();
        if(help) {
            help = help.replace(this._regexpLongBreak, EOL + EOL);
            help = help.strip(EOL) + EOL;
        }
        return help;
	},
	_joinParts: function(partStrings) {
		return partStrings.filter(function(part) {
			return (part && part != SUPPRESS);
		}).join('');
	},
	_formatUsage: function(/*string*/ usage, actions, groups, /*string*/ prefix) {
        var prefix = $value(prefix, _('usage: '));

        //if usage is specified, use that
        if(usage) {
        	usage = $stringPrint(usage, {program : this.program});
        	
        //if no optionals or positionals are available, usage is just prog
		} else if(!usage && !actions) {
            usage = '' + this.program;

        //if optionals and positionals are available, calculate usage
		} else if(!usage) {
            var program = '' + this.program;

            //split optionals from positionals
            var optionals = [];
            var positionals = [];
            actions.forEach(function(action) {
            	if(action.optionStrings) {
                    optionals.push(action);
            	} else {
                    positionals.push(action);
            	}
            });

            //build full usage string
            var format = this._formatActionsUsage;
            var actionUsage = format([].concat(optionals, positionals), groups);
            
            var usage = '';
            if(program) usage += program + ' ';
            if(actionUsage) usage += actionUsage;

            //wrap the usage parts if it's too long
            var textWidth = this.width - this.indentationCurrent;
            if ((prefix.length + usage.length) > textWidth) {

                //break usage into wrappable parts
            	var regexpPart = '\(.*?\)+|\[.*?\]+|\S+';
                var optionalUsage = format(optionals, groups);
                var positionalUsage = format(positionals, groups);
                var optionalParts = optionalUsage.match(regexpPart);
                var positionalParts = positionalUsage.match(regexpPart);
                //assert ' '.join(opt_parts) == optionalUsage
                //assert ' '.join(pos_parts) == positionalUsage

                //helper for wrapping lines
                var __getLines = function(parts, indent, prefix) {
                    var lines = [];
                    var line = [];
  
                    var lineLength = prefix ? prefix.length - 1 : indent.length - 1;
                    parts.forEach(function(part) {
                    	if(lineLength + 1 + part.length > textWidth){
                            lines.push(indent + line.join(' '));
                            line = [];
                            lineLength = indent.length - 1;
                    	}
                        line.push(part);
                        lineLength += part.length + 1;
                    });

                    if(line) {
                        lines.push(indent + line.join(' '));
                    }
                    if(prefix) {
                        lines[0] = lines[0].sub(indent.length);
                    }
                    return lines;
                };
                
                var lines;
                // if prog is short, follow it with optionals or positionals
                if(prefix.length + program.length <= 0.75 * textWidth) {
                    var indent = $stringRepeat(' ', (prefix.length + program.length + 1));
                    if(optionalParts) {
                        lines = [].concat(
                        		__getLines([program].concat(optionalParts), indent, prefix),
                        		__getLines(positionalParts, indent)
                        	);
                    } else if(positionalParts) {
                        lines = __getLines([program].concat(positionalParts), indent, prefix);
                    } else {
                        lines = [program];
                    }

                // if prog is long, put it on its own line
                } else {
                    indent = $stringRepeat(' ', prefix.length);
                    parts = optionalParts + positionalParts;
                    lines = __getLines(parts, indent);
                    if(lines.length > 1) {
                        lines = [].concat(
                        		__getLines(optionalParts, indent), 
                        		__getLines(positionalParts, indent)
                        	);
                    }
                    lines = [program] + lines;
                }
                // join lines into usage
                usage = lines.join(EOL);
            }
        }
        // prefix with 'usage:'
        return prefix + usage + EOL + EOL;
	},
	_formatActionsUsage: function(actions, groups) {
		//find group indices and identify actions in groups
        var groupActions = [];
        var inserts = {};
        
        groups.forEach(function(group) {
        	var start = actions.indexOf(group._groupActions[0]);
        	if(start >= 0) {
	            var end = start + group._groupActions.length;
	            
	            if (actions.slice(start, end) == group._groupActions) {
	            	group._groupActions.forEach(function(action) {
	            		groupActions.add(action);
	            	});
	                    
	                if(!group.required) {
	                    inserts[start] = '[';
	                    inserts[end] = ']';
	                } else {
	                    inserts[start] = '(';
	                    inserts[end] = ')';
	                }
	                for(i = start + 1; i < end; i++) {
	                	inserts[i] = '|';
	                }
	           }
        	}
        });
        //collect all actions format strings
        var parts = [];
        actions.forEach(function(action, actionIndex) {
        	//suppressed arguments are marked with None
            //remove | separators for suppressed arguments
            if(action.help == SUPPRESS) {
                parts.push(null);
                if(inserts[i] == '|') {
                    inserts.splice(i);
                } else if(inserts[i + 1] == '|') {
                    inserts.splice(i + 1);
                }

            //produce all arg strings
            } else if(!action.optionStrings) {
                var part = this._formatArgs(action, action.destination);

                //if it's in a group, strip the outer []
                if(groupActions.indexOf(action) >= 0) {
                    if(part[0] == '[' && part[part.length - 1] == ']') {
                        part = part.slice(1, -1);
                    }
                }                    		
                //add the action string to the list
                parts.push(part);

            //produce the first way to invoke the option in brackets
            } else {
                optionString = action.optionStrings[0];

                //if the Optional doesn't take a value, format is: -s or --long
                if(action.nargs == 0) {
                    part = '' + optionString;
                
                // if the Optional takes a value, format is: -s ARGS or --long ARGS
                } else {
                    argsDefault = action.destination.toUpperCase();
                    argsString = this._formatArgs(action, argsDefault);
                    part = optionString + ' ' + argsString;
                }
                //make it look optional if it's not required or in a group
                if(!action.required && groupActions.indexOf(action) < 0) {
                    part = '[' + part + ']';
                }
                //add the action string to the list
                parts.push(part);
            }
        });
        
        //insert things at the necessary indices
        inserts.reverse().forEach(function(insert) {
        	parts = parts.slice(0, insertIndex).concat([insert], parts.slice(insertIndex + 1, parts.length - 1));
        });

        //join all the action items with spaces
        var text = parts.filter(
        		function(part) {
        			if(part) {return true;}
        			return false;
        		}
        ).join(' ');

        //clean up separators for mutually exclusive groups
        var regexpOpen = '[\[(]';
        var regexpClose = '[\])]';
        text = text.replace('(' + regexpOpen + ') ', '\1');
        text = text.replace(' (' + regexpClose + ')', '\1');
        text = text.replace(regexpOpen + ' *' + regexpClose, '');
        text = text.replace('\(([^|]*)\)', '\1');
        text = $stringStrip(text);

        //return the text
        return text;
	},
	_formatText: function(/*string*/ text) {
        text = $stringPrint(text, {program:  this.program});
        var textWidth = this.width - this.indentationCurrent;
        var indentation = $stringRepeat(' ', this.indentationCurrent);
        return this._fillText(text, textWidth, indentation) + EOL + EOL;
	},
	_formatAction: function(action) {
        //determine the required width and the entry label
        var helpPosition = Math.min(this.actionLengthMax + 2, this.helpPositionMax);
        var helpWidth = this.width - helpPosition;
        var actionWidth = helpPosition - this.indentationCurrent - 2;
        var actionHeader = this._formatActionInvocation(action);

        //no help; start on same line and add a final newline
        if(!action.help) {
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + actionHeader + EOL;

        //short action name; start on the same line and pad two spaces
        } else if(actionHeader.length <= actionWidth) {
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + '-' + actionHeader + '  ';
            indentFirst = 0;

        //long action name; start on the next line
        } else {
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + actionHeader + EOL;
            indentFirst = helpPosition;
        }
        //collect the pieces of the action help
        parts = [actionHeader];

        //if there was help for the action, add lines of help text
        if(action.help) {
            helpText = this._expandHelp(action);
            helpLines = this._splitLines(helpText, helpWidth);
            parts.push($stringRepeat(' ', indentFirst) + helpLines[0] + EOL);
            helpLines.slice(1).forEach(function(line) {
            	parts.push($stringRepeat(' ', helpPosition) + line + EOL);
            });

        //or add a newline if the description doesn't end with one
        } else {
        	var diff = this.length - EOL.length;            
        	if(!(diff >= 0 && this.indexOf(EOL, diff) === diff)) {
        		parts.push(EOL);
        	}
        }
        //if there are any sub-actions, add their help as well
        if($defined(action._getSubactions)) {
			this._indent();
			action._getSubactions().forEach(function(subaction) {
				parts.push(this._formatAction(subaction));
			});
            this._dedent();
		}

        //return a single string
        return this._joinParts(parts);
	},
	_formatActionInvocation: function(action) {
        if(!action.optionStrings) {
            var metavar = this._metavarFormatter(action, action.destination)(1);
            return metavar;
        } else {
            var parts = [];

            //if the Optional doesn't take a value, format is: -s, --long
            if(action.nargs == 0) {
                parts = parts.concat(action.optionStrings);

            //if the Optional takes a value, format is: -s ARGS, --long ARGS
            } else {
                argsDefault = action.destination.toUpperCase();
                argsString = this._formatArgs(action, argsDefault);
                action.optionStrings.forEach(function(optionString) {
                	parts.push(optionString + ' ' + argsString);
                });
            }
            return parts.join(', ');
        }
	},
	_metavarFormatter: function(action, /*string*/ metavarDefault) {
        if(action.metavar) {
            result = action.metavar;
        } else if(action.choices) {
            result = '{' + action.choices.join(',') + '}';
        } else {
            result = metavarDefault;
        }
        var format = function(size) {
            if (result instanceof Array) {
                return result;
        	} else {
        		var metavars = [];
            	for(i = 0; i < size; ++i) {
            		metavars.push(result);
            	}
                return metavars;
        	}
        };
        return format;
	},
    _formatArgs: function(action, /*string*/ metavarDefault) {
        buildMetavar = this._metavarFormatter(action, metavarDefault);
        var result;
        var metavars;
        
        if (!action.nargs) {
        	metavars = buildMetavar(1);
        	result = '' + metavars[0];
		} else if(action.nargs == OPTIONAL) {
			metavars = buildMetavar(1);
        	result = '[' + metavars[0] + ']';
        } else if(action.nargs == ZERO_OR_MORE) {
        	metavars = buildMetavar(2);
        	result = '[' + metavars[0] + '[' + metavars[1] + ' ...]]';
        } else if(action.nargs == ONE_OR_MORE) {
        	metavars = buildMetavar(2);
        	result = '' + metavars[0] + '[' + metavars[1] + ' ...]';
        } else if(action.nargs == REMAINDER) {
        	result = '...';
        } else if(action.nargs == PARSER) {
        	metavars = buildMetavar(1);
        	result = metavars[0] + ' ...';
        } else {
        	metavars = buildMetavar(action.nargs);
            result = metavars.join(' ');
        }
        return result;
	},
    _expandHelp: function(action) {
		params = {};
        params['program'] = this.program;
		
		for(var actionProperty in action) {
			actionValue = params[actionProperty];
			
		    if(actionValue != SUPPRESS) {
		    	params[actionProperty] = actionValue;
		    }
		}
		
		if(params['choices']) {
			params['choices'] = params['choices'].join(', ');
		}
		
        /*for name in list(params):
            if hasattr(params[name], '__name__'):
                params[name] = params[name].__name__*/
       
        return this._getHelpString(action) % params;
	},
    _splitLines: function(/*string*/ text, /*int*/ width) {
		var lines = [];
		
		text = text.replace(this._regexpWhitespace, ' ');
		text = $stringStrip(text);
		text.split(EOL).forEach(function(line) {
			var wrapStart = 0;
			var wrapEnd = width;
			while(wrapStart < line.length) {
				wrapped = line.split(wrapStart, wrapEnd);
				lines.push(wrapped);
				wrapStart += width;
				wrapEnd += width;
			}
		});
		
        return lines;
	},
    _fillText: function (/*string*/ text, /*int*/ width, /*string*/ indent) {
		var lines = this._splitLines(text, width);
		lines.forEach(function(line) {
			line = indent + line;
		});
		return lines.join(EOL);
	},
    _getHelpString: function(action) {
        return action.help;
	}
});

/**
 * Help message formatter which retains any formatting in descriptions.
 * 
 * Only the name of this class is considered a public API. All the methods provided by the class are considered an implementation detail.
 * @return
 */
var RawDescriptionHelpFormatter = HelpFormatter.extend('RawDescriptionHelpFormatter', {
	_fillText: function(text, width, indent) {
		var lines = text.split(EOL);
		lines.forEach(function(line) {
			line = indent + line;
		});
		return lines.join(EOL);
	}
});

/**
 * Help message formatter which retains formatting of all help text.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var RawTextHelpFormatter = RawDescriptionHelpFormatter.extend('RawTextHelpFormatter', {
	_splitLines: function(text, width) {
	    return text.split(EOL);
	}
});

/**
 * Help message formatter which adds default values to argument help.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var ArgumentDefaultsHelpFormatter = HelpFormatter.extend('ArgumentDefaultsHelpFormatter', {
	_getHelpString: function(action) {
	    var help = action.help;
	    if(action.help.indexOf('%(default)') < 0) {
	        if(action.defaultValue != SUPPRESS) {
	            if(action.optionStrings || [OPTIONAL, ZERO_OR_MORE].indexOf(action.nargs) < 0) {
	                help += ' (default: %(default)s)';
	            }
	        }
	    }
	    return help;
	}
});


/**
 * Action classes
 */
/**
 * Information about how to convert command line strings to Javascript objects.
 * 
 * Action objects are used by an ArgumentParser to represent the information
 * needed to parse a single argument from one or more strings from the
 * command line. The keyword arguments to the Action constructor are also
 * all attributes of Action instances.
 * 
 * Keyword Arguments:
 * 
 * - optionStrings -- A list of command-line option strings which should be associated with this action.
 * 
 * - destination -- The name of the attribute to hold the created object(s)
 * 
 * - nargs -- The number of command-line arguments that should be
 *          consumed. By default, one argument will be consumed and a single
 *          value will be produced.  Other values include:
 *              - N (an integer) consumes N arguments (and produces a list)
 *              - '?' consumes zero or one arguments
 *              - '*' consumes zero or more arguments (and produces a list)
 *              - '+' consumes one or more arguments (and produces a list)
 *          Note that the difference between the default and nargs=1 is that
 *          with the default, a single value will be produced, while with
 *          nargs=1, a list containing a single value will be produced.
 *          
 * - constant -- The value to be produced if the option is specified and the option uses an action that takes no values.
 * 
 * - defaultValue -- The value to be produced if the option is not specified.
 * 
 * - type -- The type which the command-line arguments should be converted
 *          to, should be one of 'string', 'int', 'float', 'complex' or a
 *          callable object that accepts a single string argument. If None,
 *          'string' is assumed.
 *          
 * - choices -- A container of values that should be allowed. If not None,
 *          after a command-line argument has been converted to the appropriate
 *          type, an exception will be raised if it is not a member of this
 *          collection.
 *
 * - required -- True if the action must always be specified at the
 *          command line. This is only meaningful for optional command-line
 *          arguments.
 *
 * - help -- The help string describing the argument.
 *
 * - metavar -- The name to be used for the option's argument with the help string. 
 *                   If None, the 'destination' value will be used as the name.
 */
var Action = Class.create('Action', {
	initialize: function(options) {
		options = options || {};
		this.optionStrings = $value(options['optionStrings'], []);
		this.destination = options['destination'];
		this.nargs = options['nargs'];
		this.constant = options['constant'];
		this.defaultValue = options['defaultValue'];
		this.type = options['type'];
		this.choices = options['choices'];
		this.required = $value(options['required'], false);
		this.help = options['help'];
		this.metavar = options['metavar'];
	},
	call: function(parser, namespace, values, optionString) {
	    throw new Error(_('.call() not defined'));//Not Implemented error
	}
});

var _StoreAction = Action.extend('StoreAction', {
    initialize: function(options) {
        this._super(options);
        if(this.nargs <= 0) {
            throw new Error('nargs for store actions must be > 0; if you '+
                             'have nothing to store, actions such as store '+
                             'true or store const may be more appropriate');//ValueError
            
        }
        if($defined(this.constant) && this.nargs != OPTIONAL) {
            throw new Error('nargs must be OPTIONAL to supply const');//ValueError
        }
	},
    call: function (parser, namespace, values, optionString) {
        namespace.set(this.destination, values);
	}
});

var _StoreConstantAction = Action.extend('StoreConstantAction', {
	
	initialize : function(options) {
		options = options || {};
		options.nargs = 0;
		this._super(options);
	},
	call: function(parser, namespace, values, optionString) {
		namespace.set(this.destination, this.constant);
	}
});

var _StoreTrueAction = _StoreConstantAction.extend('StoreTrueAction', {
	initialize : function(options) {
		options = options || {};
		options.constant = true;
		options.defaultValue = $value(options.defaultValue, false);
		this._super(options);
	}
});

var _StoreFalseAction = _StoreConstantAction.extend('StoreFalseAction', {
	initialize : function(options) {
		options = options || {};
		options.constant = false;
		options.defaultValue = $value(options.defaultValue, true);
		this._super(options);
	}
});

var _AppendAction = Action.extend('AppendAction', {
	initialize : function(options) {
		this._super(options);
		if(nargs <= 0){
            throw new Error('nargs for append actions must be > 0; if arg '+
                             'strings are not supplying the value to append, '+
                             'the append const action may be more appropriate');//ValueError
		}
		if($defined(this.constant) && this.nargs != OPTIONAL) {
	        throw new Error('nargs must be OPTIONAL to supply const');//ValueError
	    }
	},
	call: function(parser, namespace, values, optionString) {
        items = _copy.copy($value(namespace[this.destination], []));
        items.push(values);
        namespace.set(this.destination, items);
	}
});

var _AppendConstantAction = Action.extend('AppendConstantAction', {
	initialize : function(options) {
		this._super(options);
		this.nargs = 0;
	},
	call: function(parser, namespace, values, optionString) {
        items = _copy.copy($(namespace[this.destination], []));
        items.push(this.constant);
        namespace.set(this.destination, items);
	}
});

var _CountAction = Action.extend('CountAction', {
	initialize : function(options) {
		this._super(options);
	},
	call: function(parser, namespace, values, optionString) {
        namespace.set(this.destination, $value(namespace[this.destination], 0) + 1);
	}
});

var _HelpAction = Action.extend('HelpAction', {
	initialize : function(options) {
		options = options || {};
		options.defaulValue = $value(options.defaultValue, SUPPRESS);
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = 0;
		this._super(options);
	},
	call: function(parser, namespace, values, optionString) {
        parser.printHelp();
        parser.exit();
	}
});

var _VersionAction = Action.extend('VersionAction', {
	initialize : function(options) {
		options = options || {};
		options.defaulValue = $value(options.defaultValue, SUPPRESS);
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = 0;
		this._super(options);
		this.version = options.version;
	},
	call: function(parser, namespace, values, optionString) {
        version = $value(this.version, parser.version);
        formatter = parser._getFormatter();
        formatter.addText(version);
        parser.exit(0, formatter.formatHelp());
	}
});

var _SubParsersAction = Action.extend('SubParsersAction', {
	initialize: function(options) {
		options = options || {};
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = PARSER;
		
		this._programPrefix = $value(options['program']);
	    this._parserClass = $value(options['parserClass']);
	    this._nameParserMap = {};
	    this._choicesActions = [];
	    
	    options.choices = this._nameParserMap;
	    this._super(options);
	},
	addParser: function(name, options) {
        //set program from the existing prefix
        if(!$defined(options['program'])) {
        	options['program'] = this._programPrefix + ' ' + name;
        }

        //create a pseudo-action to hold the choice help 
        if($defined(options['help'])) {
            help = options['help'];
            delete options['help'];
            
            choiceAction = this._ChoicesPseudoAction(name, help);
            this._choicesActions.push(choiceAction);
        }
        
        //create the parser and add it to the map
        var parser = new this._parserClass(options);
        this._nameParserMap[name] = parser;
        return parser;
	},
	_getSubactions: function() {
        return this._choicesActions;
	},
	call: function(parser, namespace, values, optionString) {
        var parserName = values[0];
        var argStrings = values.slice(1);

        //set the parser name if requested
        if(this.destination != SUPPRESS) {
            namespace[this.destination] = parserName;
        }

        //select the parser
        if($defined(this._nameParserMap[parserName])) {
            parser = this._nameParserMap[parserName];
        } else {
            var message = _('unknown parser ' + parserName + ' (choices: ' + this._nameParserMap.join(', ') + ')');
            throw new Error(this, message);//ArgumentError
        }

        //parse all the remaining options into the namespace
        parser.parseArgs(argStrings, namespace);
	}
});

    /*class _ChoicesPseudoAction(Action):

        def __init__(this, name, help):
            sup = super(_SubParsersAction._ChoicesPseudoAction, this)
            sup.__init__(optionStrings=[], dest=name, help=help)*/

/**
 * Simple object for storing attributes.
 * 
 * Implements equality by attribute names and values, and provides a simple string representation.
 */
var Namespace = Class.create('Namespace', {
	initialize: function(options) {
		options = options || {};
		for (var key in (options)) {
			this[key] = options[key];
		}
	},
	set: function(key, value) {
		this[key] = value;
		return this;
	},
	get: function(key) {
		return this[key];
	}
});

var _ActionContainer = Class.create('_ActionContainer', {
	initialize: function(options) {
		options = options || {};

		this.description = $value(options['description']);
	    this.argumentDefault = $value(options['argumentDefault']);
	    this.prefixChars = $value(options['prefixChars'], '');
	    this.conflictHandler = $value(options['conflictHandler'], 'error');
	  
	    //set up registries
        this._registries = {};
        
        //register actions
        this.register('action', null, _StoreAction);
        this.register('action', 'store', _StoreAction);
        this.register('action', 'store_constant', _StoreConstantAction);
        this.register('action', 'store_true', _StoreTrueAction);
        this.register('action', 'store_false', _StoreFalseAction);
        this.register('action', 'append', _AppendAction);
        this.register('action', 'append_constant', _AppendConstantAction);
        this.register('action', 'count', _CountAction);
        this.register('action', 'help', _HelpAction);
        this.register('action', 'version', _VersionAction);
        this.register('action', 'parsers', _SubParsersAction);
        
        //throw an exception if the conflict handler is invalid
        this._getHandler();
        
        //action storage
        this._actions = [];
        this._optionStringActions = {};
        
        //groups
        this._actionGroups = [];
        this._mutuallyExclusiveGroups = [];
        
        //defaults storage
        this._defaults = {};
        
        //determines whether an "option" looks like a negative number
        this._regexpNegativeNumber = '^-\d+$|^-\d*\.\d+$';
        
        // whether or not there are any optionals that look like negative
        // numbers -- uses a list so it can be shared and edited
        this._hasNegativeNumberOptionals = [];
	},
	/**
	 * Registration methods
	 */
	register: function(registryName, value, object) {
		this._registries[registryName] = this._registries[registryName] || {};
        this._registries[registryName][value] = object;
        return this;
	},
	_registryGet: function(registryName, value, defaultValue) {
		return $value(this._registries[registryName][value], defaultValue);
	},
	
	/**
	 * Namespace default accessor methods
	 */
	setDefaults: function(options) {
        $extend(this._defaults, options);

        //if these defaults match any existing arguments, replace the previous default on the object with the new one
        this._actions.forEach(function(action) {
            if(options.indexOf(action.destination) >= 0) {
                action.defaultValue = options[action.destination];
            }
        });
	},
    getDefault: function(destination) {
        this._actions.forEach(function(action) {
            if(action.destination == destination && $defined(action.defaultValue)) {
                return action.defaultValue;
            }
        });
        return this._defaults[destination];
	},
	
	/**
	 * Adding argument actions
	 */
	/**
	 * addArgument(dest, ..., name=value, ...)
	 * addArgument(optionString, optionString, ..., name=value, ...)
	 */
	addArgument: function(args, kwargs) {

		args = args || [];
		kwargs = kwargs || {};
		
	    //if no positional args are supplied or only one is supplied and
	    //it doesn't look like an option string, parse a positional argument	        
	    if(!args || args.length == 1 && this.prefixChars.indexOf(args[0][0]) < 0) {
            if(args && $defined(kwargs['destination'])) {
                throw new Error('destination supplied twice for positional argument');//ValueError
            }
            kwargs = this._getPositionalKwargs(args, kwargs);

        //otherwise, we're adding an optional argument
		} else {
	        kwargs = this._getOptionalKwargs(args, kwargs);
		}

        //if no default was supplied, use the parser-level default
        if(! $defined(kwargs['default'])) {
            destination = kwargs['destination'];
            if($defined(this._defaults[destination])) {
                kwargs['default'] = this._defaults[destination];
            } else if($defined(this.argumentDefault)) {
                kwargs['default'] = this.argumentDefault;
            }
        }
        
        //create the action object, and add it to the parser
        var actionClass = this._popActionClass(kwargs);
        if(! $isCallable(actionClass)) {
            throw new Error('unknown action "' + actionClass + '"');//ValueError
        }
        var action = new actionClass(kwargs);
        
        
        //throw an error if the action type is not callable
        typeFunc = this._registryGet('type', action.type, action.type);
        if( $isCallable(typeFunc)) {
            throw new Error(typeFunc + ' is not callable');
        }

        return this._addAction(action);
	},
	addArgumentGroup: function(args, kwargs) {
		args = args || [];
		kwargs = kwargs || {};
        var group = new _ArgumentGroup(this, args, kwargs);
        this._actionGroups.push(group);
        return group;
	},
	addMutuallyExclusiveGroup: function(options) {
        var group = new _MutuallyExclusiveGroup(this, options);
        this._mutuallyExclusiveGroups.push(group);
        return group;
	},
	_addAction: function(action) {
		
        //resolve any conflicts
        this._checkConflict(action);

        //add to actions list
        this._actions.push(action);
        action.container = this;

        //index the action by any option strings it has
        action.optionStrings.forEach(function(optionString) {
        	this._optionStringActions[optionString] = action;
        }.bind(this));

        //set the flag if any option strings look like negative numbers
        action.optionStrings.forEach(function(optionString) {
        	if(optionString.match(this._regexpNegativeNumber)) {
                if(!this._hasNegativeNumberOptionals) {
                    this._hasNegativeNumberOptionals.push(true);
                }
        	}
        }.bind(this));

        //return the created action
        return action;
	},
    _removeAction: function(action) {
		var actionIndex = this._actions.indexOf(action);
        this._actions.splice(actionIndex);
	},
	 _addContainerActions: function(container) {
		
        // collect groups by titles
        var titleGroupMap = {};
        this._actionGroups.forEach(function(group) {
        	if(titleGroupMap.indexOf(group.title) >= 0) {
                throw new Error(_('cannot merge actions - two groups are named ') + group.title);//ValueError
        	}
            titleGroupMap[group.title] = group;
        });
            
        // map each action to its group
        var groupMap = {};
        container._actionGroups.forEach(function(group) {

            // if a group with the title exists, use that, otherwise
            // create a new group matching the container's group
            if(titleGroupMap.indexOf(group.title) < 0) {
                titleGroupMap[group.title] = this.addArgumentGroup([], {
                    title:group.title,
                    description:group.description,
                    conflictHandler:group.conflictHandler
                });
            }
            
            // map the actions to their new group
            group._groupActions.forEach(function(action) {
            	groupMap[action] = titleGroupMap[group.title];
            });
        });

        // add container's mutually exclusive groups
        // NOTE: if add_mutually_exclusive_group ever gains title= and
        // description= then this code will need to be expanded as above
        container._mutuallyExclusiveGroups.forEach(function(group) {
        	var mutexGroup = this.addMutuallyExclusiveGroup({required: group.required});

            // map the actions to their new mutex group
            group._groupActions.forEach(function(action) {
            	groupMap[action] = mutexGroup;
            });
        }); 

        // add all actions to this container or their group
        container._actions.forEach(function(action) {
        	groupMap.get(action, this)._addAction(action);
        });
	},
	_getPositionalKwargs: function(destination, kwargs) {
        // make sure required is not specified
        if($defined(kwargs['required'])) {
            throw new Error(_("'required' is an invalid argument for positionals"));//TypeError
        }

        // mark positional arguments as required if at least one is
        // always required
        if([OPTIONAL, ZERO_OR_MORE].indexOf(kwargs['nargs']) < 0) {
            kwargs['required'] = true;
        }
        if(kwargs['nargs'] == ZERO_OR_MORE && !$defined(kwargs['default'])) {
            kwargs['required'] = true;
        }

        // return the keyword arguments with no option strings
        kwargs['destination'] = destination;
        kwargs['optionStrings'] = [];
        return kwargs;
	},
	_getOptionalKwargs: function(args, kwargs) {
		var prefixChars = this.prefixChars;
		
        // determine short and long option strings
        optionStrings = [];
        longOptionStrings = [];
        args.forEach(function(optionString) {
        	// error on strings that don't start with an appropriate prefix
            if(prefixChars.indexOf(optionString[0]) < 0) {
            	throw Error(_('invalid option string ' + optionString + ': must start with a character ' + prefixChars));//ValueError
            }

            // strings starting with two prefix characters are long options
            optionStrings.push(optionString);
            if(prefixChars.indexOf(optionString[0]) >= 0) {
                if(optionString.length > 1 && prefixChars.indexOf(optionString[1]) >= 0) {
                	longOptionStrings.push(optionString);
                }
            }
        });
            

        // infer destination, '--foo-bar' -> 'foo_bar' and '-x' -> 'x'
        destination = kwargs['destination'];
        delete kwargs['destination'];
        
        if(!$defined(destination)) {
            if(longOptionStrings) {
                destination_optionString = longOptionStrings[0];
            } else {
            	destination_optionString = optionStrings[0];
            }
            //destination = destination_optionString.lstrip(this.prefixChars);
            destination = $stringLStrip(destination_optionString, this.prefixChars);
            
            if(!destination) {
                throw Error(_('destination= is required for options like ' + optionString));
            }
            destination = destination.replace('-', '_');
		}
        
        // return the updated keyword arguments
        kwargs['destination'] = destination;
        kwargs['optionStrings'] = optionStrings;
        
        return kwargs;
	},
	_popActionClass: function(kwargs, defaultValue) {
        var action = $value(kwargs['action'], defaultValue);
        delete kwargs['action'];
        var actionClass = this._registryGet('action', action, action);
        //var actionFunc = new actionClass(kwargs);
        return actionClass;
	},
	_getHandler: function() {
        // determine function from conflict handler string
		var handlerFuncName = '';
		handlerFuncName += '_handleConflict';
		handlerFuncName += this.conflictHandler.charAt(0).toUpperCase() + this.conflictHandler.substr(1);
		
        if(!$defined(this[handlerFuncName])) {
        	throw (_('invalid conflictResolution value: ') + $value(this.conflictHandler, 'undefined'));//ValueError
        }
        return this[handlerFuncName];
	},
	_checkConflict: function(action) {
		var optionStringActions = this._optionStringActions;
		
        // find all options that conflict with this option
        var conflictOptionals = [];
        action.optionStrings.forEach(function(optionString) {
        	if($defined(optionStringActions[optionString])) {
            	conflictOptionals.push([
            	   optionString, //#1, 
            	   optionStringActions[optionString]//#2
            	]);
        	}
        });

        // resolve any conflicts
        if(conflictOptionals.length > 0) {
            conflictHandler = this._getHandler();
            conflictHandler(action, conflictOptionals);
        }
	},
	_handleConflictError: function(action, conflictingActions) {
        var optionStrings = [];
        conflictingActions.forEach(function(tuple) {
        	optionString = tuple[0];
        	action = tuple[1];
        	optionStrings.push(optionString);
        });
        
        conflictString = optionStrings.join(', ');
        
        throw new Error(action, _('conflicting option string(s)') + ' : ' + conflictString);//ArgumentError
	},
	_handleConflictResolve: function(action, conflictingActions) {

        // remove all conflicting options
        conflictingActions.forEach(function(tuple) {
        	var optionString = tuple[0];
        	var action = tuple[1];
        	
        	// remove the conflicting option
            action.optionStrings.splice(action.optionStrings.indexOf(optionString));
            delete this._optionStringActions[optionString];

            // if the option now has no option string, remove it from the
            // container holding it
            if(!action.optionStrings) {
                action.container._removeAction(action);
            }
        });
	}
});


var _ArgumentGroup = _ActionContainer.extend('_ArgumentGroup', {
	initialize: function(container, title, description, options) {
		options = options || {};
		
		//add any missing keyword arguments by checking the container
		options['conflictHandler'] = $value(options['conflictHandler'], container.conflictHandler);
		options['prefixChars'] = $value(options['prefixChars'], container.prefixChars);
		options['argumentDefault'] = $value(options['argumentDefault'], container.argumentDefault);
		options['description'] = description;
		
	    this._super(options);
	
	    //group attributes
	    this.title = title;
	    this._groupActions = [];
	
	    //share most attributes with the container
	    this._registries = container._registries;
	    this._actions = container._actions;
	    this._optionStringActions = container._optionStringActions;
	    this._defaults = container._defaults;
	    this._hasNegativeNumberOptionals = container._hasNegativeNumberOptionals;
	},
	_addAction: function(action) {
        action = this._super(action);//Parent add action
        this._groupActions.push(action);
        return action;
	},
	_removeAction: function(action) {
		action = this._super(action);//Parent remove action
        this._groupActions.remove(action);
	}
});

var _MutuallyExclusiveGroup = _ArgumentGroup.extend('_MutuallyExclusiveGroup', {
	initialize: function(container, required) {
        this._super(container);
        this._container = container;
        this.required = $value(required, false);
	},
	_addAction: function(action) {
		if(action.required) {
            throw new Error(_('mutually exclusive arguments must be optional'));//ValueError
		}
        action = this._container._addAction(action);
        this._groupActions.push(action);
        return action;
	},
	_removeAction: function(action) {
        this._container._removeAction(action);
        var actionIndex = this._groupActions.indexOf(action);
        this._groupActions.splice(actionIndex);
	}
});


/**
 * ArgumentParser declaration
 */
var ArgumentParser = _ActionContainer.extend('ArgumentParser', {
	/**
	 * Constructor
	 */
	initialize: function(options) {
		//argument_default=None,
		options = options || {};
		options['prefixChars'] = $value(options['prefixChars'], '-');
		options['addHelp'] = $value(options['addHelp'], true);
		
		this._super(options);
		this.program = $value(options['program'], path.basename(process.execPath));
		this.usage = $value(options['usage']);
		this.epilog = $value(options['epilog']);
		this.version = $value(options['version']);
		
		this.parents = $value(options['parents'], []);
		this.formatterClass = $value(options['formatterClass'], 'HelpFormatter');
		//this.prefixCharsFile = $value(options['prefixCharsFile']);
		
		
	    //this._positionals = this.addArgumentGroup(_('positional arguments'));
	    //this._optionals = this.addArgumentGroup(_('optional arguments'));
	    this._subparsers = [];
	
	    //register types
	    this.register('type', null, function(x) { return x; });
		
		// add help and version arguments if necessary
	    // (using explicit default to override global argument_default)
	    if (options['addHelp']) {
	        this.addArgument(
	        	['-h', '--help'],
	        	{
		        	action : 'help', 
		        	defaultValue : SUPPRESS, 
		        	help : _('show this help message and exit')
	        	}
	        );
	    }
	    if ($defined(this.version)) {
	        this.addArgument(
	            ['-v', '--version'],
	            {
		            action : 'version', 
		            defaultValue : SUPPRESS,
		            version: this.version,
		            help : _("show program's version number and exit")
	            }
	        );
	    }
	},
	
	/*_addAction: function(action) {
	    if (action.optionStrings) {
	        this._optionals._addAction(action);
	    } else {
	        this._positionals._addAction(action);
	    }
	    return action;
	},*/

	_getActionsOptional : function() {
		var actionsOptionals = [];
		this._actions.forEach(function(action, actionIndex) {  
			if (action.optionStrings) {
				actionsOptionals.push(action);
			}
		});
		return actionsOptionals;
	},
	_getActionsPositional : function() {
		var actionsOptionals = [];
		this._actions.forEach(function(action, actionIndex) {  
			if (!action.optionStrings) {
				actionsOptionals.push(action);
			}
		});
		return actionsOptionals;
	},
	
	
	/*********************************
	 * Command line argument parsing methods
	 *********************************/
	parseArgs: function(args, namespace) {
	    args, argv = this.parseArgsKnown(args, namespace);
	    if (argv) {
	        this.error(_('unrecognized arguments: ') + argv.join(' '));
	    }
	    return args;
	},
	parseArgsKnown: function(args, namespace) {
		//args default to the system args
        if(!$defined(args)) {
            args = process.argv.slice(1);
        }

        //default Namespace built from parser defaults
        if(!$defined(namespace)) {
            namespace = new Namespace();
        }

        //add any action defaults that aren't present
        this._actions.forEach(function(action) {
            if(action.destination != SUPPRESS 
            		&& !$defined(namespace[action.destination])
            		&& action.defaultValue != SUPPRESS
            ) {
            	var defaultValue = action.defaultValue;
                if(typeof(action.defaultValue) == 'string') {
                	defaultValue = this._getValue(action, defaultValue);
                }
                namespace[action.destination] = defaultValue;
            }
        });
        
        //add any parser defaults that aren't present
        this._defaults.forEach(function(destination) {
        	if(!$defined(namespace[destination])) {
        		namespace[destination] = this._defaults[destination];
        	}
        });

        //parse the arguments and exit if there are any errors
        try {
            return this._parseArgsKnown(args, namespace);
        } catch (e) {
            this.error(e.message);//_sys.exc_info()[1];
        }
	},
	_parseArgsKnown: function(argStrings, namespace) {
	        //replace arg strings that are file references
	        if($defined(this.prefixCharsFile)) {
	            argStrings = this._readArgsFromFiles(argStrings);
	        }

	        //map all mutually exclusive arguments to the other arguments
	        //they can't occur with
	        var actionConflicts = {};
	        this._mutuallyExclusiveGroups.forEach(function(mutexGroup) {
	            mutexGroup._groupActions.forEach(function(mutexAction, mutexIndex) {
	            	actionConflicts[mutexAction] = $value(actionConflicts[mutexAction], []);
	            	actionConflicts[mutexAction] = actionConflicts[mutexAction].concat(
	            		mutexGroup._groupActions.slice(0, mutexIndex),
	            		mutexGroup._groupActions.slice(mutexIndex + 1)
	            	);
	            });
	        });
	            

	        //find all option indices, and determine the argString_pattern
	        //which has an 'O' if there is an option at an index,
	        //an 'A' if there is an argument, or a '-' if there is a '--'
	        var optionStringIndices = {};
	        var argStringPatternParts = [];
	        var found = false;//-- if is found
	        argStrings.forEach(function(argString, argStringIndex) {
	        	if(found) {
	        		argStringPatternParts.push('A');
	        	} else {
		            //all args after -- are non-options
		            if(argString == '--') {
		                argStringPatternParts.push('-');
		                found = true;
		            //otherwise, add the arg to the arg strings
		            //and note the index if it was an option
		            } else {
		                var optionTuple = this._parseOptional(argString);
		                var pattern = 'A';
		                if($defined(optionTuple)) {
		                    optionStringIndices[i] = optionTuple;
		                    pattern = 'O';
		                }
		                argStringPatternParts.push(pattern);
		            }
	        	}
	        });
	        //join the pieces together to form the pattern
	        var argStringsPattern = argStringPatternParts.join('');

	        //converts arg strings to the appropriate and then takes the action
	        var seen_actions = [];
	        var seen_non_default_actions = [];
	        var extras = [];
	        var startIndex = 0;

	        function takeAction(action, argumentStrings, optionString) {
	            seen_actions.push(action);
	            argValues = this._getValues(action, argumentStrings);

	            //error if this argument is not allowed with other previously
	            //seen arguments, assuming that actions that use the default
	            //value don't really count as "present"
	            if(argValues != action.defaultValue) {
	                seen_non_default_actions.push(action);
	                $value(actionConflicts[action], []).forEach(function(actionConflict) {
	                    if(seen_non_default_actions.indexOf(actionConflict) >= 0) {
	                        throw new Error(action, _('not allowed with argument ') + _getActionName(actionConflict));//ArgumentError
	                    }
	                });
	            }
	            //take the action if we didn't receive a SUPPRESS value
	            //(e.g. from a default)
	            if(argValues != SUPPRESS) {
	                action(this, namespace, argValues, optionString);
	            }
	        }
	        
	        //function to convert argStrings into an optional action
	        function consumeOptional(startIndex) {

	            //get the optional identified at this index
	            var optionTuple = optionStringIndices[startIndex];
	            var action = optionTuple[0];
	            var optionString = optionTuple[1];
	            var argExplicit = optionTuple[2];

	            //identify additional optionals in the same arg string
	            //(e.g. -xyz is the same as -x -y -z if no args are required)
	            var actionTuples = [];
	            while(true) {

	                //if we found no optional action, skip it
	                if(!$defined(action)) {
	                    extras.push(argStrings[startIndex]);
	                    return startIndex + 1;
	                }

	                //if there is an explicit argument, try to match the
	                //optional's string arguments to only this
	                if($defined(argExplicit)) {
	                    argCount = this._matchArgument(action, 'A');

	                    //if the action is a single-dash option and takes no
	                    //arguments, try to parse more single-dash options out
	                    //of the tail of the option string
	                    if(argCount == 0 && this.prefixChars.indexOf(optionString[1]) < 0) {
	                        actionTuples.push([action, [], optionString]);
	                        this.prefixChars.forEach(function(prefixChar) {
	                        	var optionString = prefixChar + argExplicit.substr(0, 1);
	                            var argExplicit = argExplicit.substr(1);
	                            if($defined(this._optionStringActions[optionString])) {
	                                action = this._optionStringActions[optionString];
	                                break;
	                            } else {
		                            throw new Error(action, _('ignored explicit argument ') + argExplicit);//ArgumentError
	                            }
	                        });

	                    //if the action expect exactly one argument, we've
	                    //successfully matched the option; exit the loop
	                	} else if(argCount == 1) {
	                        var stop = startIndex + 1;
	                        var args = [argExplicit];
	                        actionTuples.push([action, args, optionString]);
	                        break;

	                    //error if a double-dash option did not use the
	                    //explicit argument
	                	} else {
	                        throw new Error(action, _('ignored explicit argument ') + argExplicit);//ArgumentError
	                	}

	                //if there is no explicit argument, try to match the
	                //optional's string arguments with the following strings
	                //if successful, exit the loop
	                } else {
	                    var start = startIndex + 1;
	                    var argStringsPatternSelected = argStringsPattern.substr(start);
	                    var argCount = this._matchArgument(action, argStringsPatternSelected);
	                    var args = argStrings.slice(start, start + argCount);
	                    actionTuples.push([action, args, optionString]);
	                    break;
	                }
	            }

	            //add the Optional to the list and return the index at which
	            //the Optional's string args stopped
	            assert.ok(actionTuples.length > 0);
	            actionTuples.forEach(function(actionTuple) {
	                takeAction.apply(this, actionTuple);
	            });
	            return stop;
	        }

	        //the list of Positionals left to be parsed; this is modified
	        //by consumePositionals()
	        var positionals = this._getPositionalActions();

	        //function to convert argStrings into positional actions
	        function consumePositionals(startIndex) {
	            //match as many Positionals as possible
	        	var argStringsPatternSelected = argStringsPattern.substr(startIndex);
	            var argCounts = this._matchArgumentsPartial(positionals, argStringsPatternSelected);

	            //slice off the appropriate arg strings for each Positional
	            //and add the Positional and its args to the list
	            for(i = 0; i < positionals.length; i++) {
	            	var action = positionals[i];
	            	var argCount = argCounts[i];
	            	startIndex += argCount;
	                takeAction(action, args);
	            }
	            
	            //slice off the Positionals that we just parsed and return the
	            //index at which the Positionals' string args stopped
	            //positionals[:] = positionals.slice(argCounts.length);
	            positionals = positionals.slice(argCounts.length);
	            return startIndex;
	        }

	        //consume Positionals and Optionals alternately, until we have
	        //passed the last option string
	        var optionStringIndexMax = optionStringIndices ?  Math.max.apply(Math, optionStringIndices) : -1;

	        while(startIndex <= optionStringIndexMax) {

	            //consume any Positionals preceding the next option
	            optionStringIndexNext = Math.min.apply(
	            	Math,
	            	optionStringIndices.filter(function(index) {
	                	return (index >= startIndex);
	                })
	            );
	            if(startIndex != optionStringIndexNext) {
	                positionalsEndIndex = consumePositionals(startIndex);

	                //only try to parse the next optional if we didn't consume
	                //the option string during the positionals parsing
	                if(positionalsEndIndex > startIndex) {
	                    startIndex = positionalsEndIndex;
	                    continue;
	                } else {
	                    startIndex = positionalsEndIndex;
	                }
	            }

	            //if we consumed all the positionals we could and we're not
	            //at the index of an option string, there were extra arguments
	            if(!$defined(optionStringIndices[startIndex])) {
	                strings = argStrings.slice(startIndex, optionStringIndexNext);
	                extras = extras.concat(strings);
	                startIndex = optionStringIndexNext;
	            }

	            //consume the next optional and any arguments for it
	            startIndex = consumeOptional(startIndex);
	        }

	        //consume any positionals following the last Optional
	        stopIndex = consumePositionals(startIndex);

	        //if we didn't consume all the argument strings, there were extras
	        extras.extend(argStrings.slice(stopIndex));

	        //if we didn't use all the Positional objects, there were too few
	        //arg strings supplied.
	        if(positionals) {
	            this.error(_('too few arguments'));
	        }

	        //make sure all required actions were present
	        this._actions.forEach(function(action) {
	        	if(action.required && seen_actions.indexOf(action) < 0) {
                    name = _getActionName(action);
                    this.error(_('argument ' + name + ' is required'));
	        	}
	        });

	        //make sure all required groups had one option present
	        this._mutuallyExclusiveGroups.forEach(function(group) {
	        	if(group.required) {
	        		var found = false;
	                for(actionIndex in group._groupActions) {
	                	var action = group._groupActions[actionIndex];
	                    if(seen_non_default_actions.indexOf(action) >= 0) {
	                    	found = true;
	                        break;
	                    }
	                }
	                //if no actions were used, report the error
	                if(found) {
	                	var names = [];
	                	group._groupActions.forEach(function(action) {
	                		if(action.help != SUPPRESS) {
	                			names.push(_getActionName(action));
	                		}
	                	});
	                    this.error(_('one of the arguments ' + names.join(' ') + ' is required'));
	                }
	        	}
	        });
	            

	        //return the updated namespace and the extra arguments
	        return [namespace, extras];
	},
	_readArgsFromFiles: function(argStrings) {
        //expand arguments referencing files
        var argStringsNew = [];
        argStrings.forEach(function(argString) {

            //for regular arguments, just add them back into the list
            if(this.prefixCharsFile.indexOf(argString[0]) < 0) {
                argStringsNew.push(argString);

            //replace arguments referencing files with the file content
            } else {
                try {
                	//TODO: optimize IO reading?
                    var argsFileContent = fs.readFileSync(argString.substr(1), 'r');
                    var argLines = argsFileContent.split(EOL);
                    
                    var argStrings = [];
                    argLines.forEach(function(argLine) {
                    	argLine = [argLine];//convert arg line to args
                    	argLine.forEach(function(arg) {
                    		argStrings.push(arg);
                    	});
                    });
                    argStrings = this._readArgsFromFiles(argStrings);
                    argStringsNew = argStringsNew.concat(argStrings);

                } catch (e) {//IOError
                    error = _sys.exc_info()[1];
                    this.error(error);
                }
            }
        });
        //return the modified argument list
        return argStringsNew;
	},
	_matchArgument: function(action, regexpArgStrings) {
        //match the pattern for this action to the arg strings
        var regexpNargs = this._getRegexpNargs(action);
        var matches = regexpArgStrings.match(regexpNargs);

        //throw an exception if we weren't able to find a match
        if(!$defined(matches)) {
        	if(!$defined(action.nargs)) {
        		message = _('expected one argument');
        	} else if(action.nargs == OPTIONAL) {
        		message = _('expected at most one argument');
        	} else if(action.nargs == ONE_OR_MORE) {
        		message = _('expected at least one argument');
        	} else {
        		message = _('expected ' + action.nargs + ' argument(s)');
        	}
            throw new Error(action, message);//ArgumentError
        }
        //return the number of arguments matched
        return matches[1].length;
	},
	_matchArgumentsPartial: function(actions, regexpArgStrings) {
        //progressively shorten the actions list by slicing off the
        //final actions until we find a match
        var result = [];
        for(i = actions.length;i > 0; i--) {
            actionSlice = actions.slice(0, i);
        	var pattern = '';
        	actionSlice.forEach(function(action) {
        		pattern += this._getRegexpNargs(action);
        	});

            matches = regexpArgStrings.match(pattern);
            if($defined(matches)) {            	
            	matches.forEach(function(string) {
            		result.push(string.length);
            	});
                break;
            }
        }

        //return the list of arg string counts
        return result;
	},
	_parseOptional: function(argString) {
        //if it's an empty string, it was meant to be a positional
        if(!$defined(argString)) {
            return undefined;
        }

        //if it doesn't start with a prefix, it was meant to be positional
        if(this.prefixChars.indexOf(argString[0]) < 0) {
            return undefined;
        }

        //if the option string is present in the parser, return the action
        if(this._optionStringActions.indexOf(argString) >= 0) {
            var action = this._optionStringActions[argString];
            return [action, argString, undefined];
        }

        //if it's just a single character, it was meant to be positional
        if(argString.length == 1) {
            return undefined;
        }

        //if the option string before the "=" is present, return the action
        if(argString.indexOf('=') >= 0) {
        	var argStringSplit = argString.split('=', 1);
            var optionString =  argStringSplit[0];
            var argExplicit = argStringSplit[1];
            if($defined(this._optionStringActions[optionString])) {
                var action = this._optionStringActions[optionString];
                return [action, optionString, argExplicit];
            }
		}

        //search through all possible prefixes of the option string
        //and all actions in the parser for possible interpretations
        optionTuples = this._getOptionTuples(argString);

        //if multiple actions match, the option string was ambiguous
        if(optionTuples.length > 1) {
        	var optionStrings = optionTuples.map(function(optionTuple) { 
        		return optionTuple[1];//optionTuple(action, optionString, argExplicit)
        	});
            this.error(_('ambiguous option: ' + argString + ' could match ' + optionStrings.join(', ')));

        //if exactly one action matched, this segmentation is good,
        //so return the parsed action
        } else if(optionTuples.length == 1) {
            return optionTuples[0];
        }
        
        //if it was not found as an option, but it looks like a negative
        //number, it was meant to be positional
        //unless there are negative-number-like options
        if(argString.match(this._regexpNegativeNumber) && !this._hasNegativeNumberOptionals) {
        	return undefined;
        }
        //if it contains a space, it was meant to be a positional
        if(argString.search(' ') >= 0) {
            return undefined;
		}

        //it was meant to be an optional but there is no such option
        //in this parser (though it might be a valid option in a subparser)
        return [undefined, argString, undefined];
	 },
	 _getOptionTuples: function(optionString) {
	        var result = [];
	        var chars = this.prefixChars;
	        var optionPrefix;
	        var argExplicit;
	        var action;
	        
	        //option strings starting with two prefix characters are only
	        //split at the '='
	        if(chars.indexOf(optionString[0]) >= 0 && chars.indexOf(optionString[1]) >= 0) {
	            if(optionString.indexOf('=') >= 0) {
	            	var optionStringSplit = optionString.split('=', 1);
	            	
	                optionPrefix = optionStringSplit[0];
	                argExplicit = optionStringSplit[1];
	            } else {
	                optionPrefix = optionString;
	                argExplicit = undefined;
	            }
	            this._optionStringActions.forEach(function(optionString) {
	            	if(optionString.substr(0, optionPrefix.length) == optionPrefix) {
	                    action = this._optionStringActions[optionString];
	                    result.push([action, optionString, argExplicit]);
	            	}
	            }.bind(this));
	                

	        //single character options can be concatenated with their arguments
	        //but multiple character options always have to have their argument
	        //separate
	 		} else if(chars.indexOf(optionString[0]) >= 0 && chars.indexOf(optionString[1]) < 0) {
	            optionPrefix = optionString;
	            argExplicit = undefined;
	            var optionPrefixShort = optionString.substr(0, 2);
	            var argExplicitShort = optionString.substr(2);

	            this._optionStringActions.forEach(function(optionString) {
	            	action = this._optionStringActions[optionString];
	            	if(optionString == optionPrefixShort) {
	                    result.push([action, optionString, argExplicitShort]);
	            	} else if(optionString.substr(0, optionPrefix.length) == optionPrefix) {
	                    result.push([action, optionString, argExplicit]);
	            	}
	            });
	                

	        //shouldn't ever get here
	 		} else {
	            this.error(_('unexpected option string: ') + optionString);
	        }

	        //return the collected option tuples
	        return result;
		},
	    _getRegexpNargs: function(action) {
	        //in all examples below, we have to allow for '--' args
	        //which are represented as '-' in the pattern
	        var nargs = action.nargs;

	        //the default (None) is assumed to be a single argument
	        if(!$defined(nargs)) {
	            regexpNargs = '(-*A-*)';

	        //allow zero or one arguments
	        } else if(nargs == OPTIONAL) {
	            regexpNargs = '(-*A?-*)';

	        //allow zero or more arguments
	        } else if(nargs == ZERO_OR_MORE) {
	            regexpNargs = '(-*[A-]*)';

	        //allow one or more arguments
	        } else if(nargs == ONE_OR_MORE) {
	            regexpNargs = '(-*A[A-]*)';

	        //allow any number of options or arguments
	        } else if(nargs == REMAINDER) {
	            regexpNargs = '([-AO]*)';

	        //allow one argument followed by any number of options or arguments
	        } else if(nargs == PARSER) {
	            regexpNargs = '(-*A[-AO]*)';

	        //all others should be integers
	        } else {
	            regexpNargs = '(-*' + '-*'.join('A' * nargs) + '-*)';
	        }

	        //if this is an optional action, -- is not allowed
	        if(action.optionStrings) {
	            regexpNargs = regexpNargs.replace('-*', '');
	            regexpNargs = regexpNargs.replace('-', '');
	        }

	        //return the pattern
	        return regexpNargs;
	    },
	    /**
	     * Value conversion methods
	     */
	    _getValues: function(action, argStrings) {
	        //for everything but PARSER args, strip out '--'
	        if([PARSER, REMAINDER].indexOf(action.nargs) < 0) {
	        	argStrings = argStrings.filter(function(arrayElement) { return arrayElement != '--'; });
	        }

	        var value;
	        //optional argument produces a default when not present
	        if(!argStrings && action.nargs == OPTIONAL) {
	            value = (action.optionStrings) ? action.constant : action.defaultValue;
	           
	            if(typeof(value) == 'string') {
	                value = this._getValue(action, value);
	                this._checkValue(action, value);
	            }

	        //when nargs='*' on a positional, if there were no command-line
	        //args, use the default if it is anything other than None
	        } else if (!argStrings && action.nargs == ZERO_OR_MORE && !action.optionStrings) {
	            value = $value(action.defaultValue, argStrings);
	            this._checkValue(action, value);

	        //single argument or optional argument produces a single value
	        } else if(argStrings.length == 1 && (!$defined(action.nargs) || action.nargs == OPTIONAL)) {
	            argString = argStrings[0];
	            value = this._getValue(action, argString);
	            this._checkValue(action, value);

	        //REMAINDER arguments convert all values, checking none
	        } else if(action.nargs == REMAINDER) {
	        	value = argStrings.map(function(v) {return this._getValue(action, v);});

	        //PARSER arguments convert all values, but check only the first
	        } else if(action.nargs == PARSER) {
	        	value = argStrings.map(function(v) {return this._getValue(action, v);});
	            this._checkValue(action, value[0]);

	        //all other types of nargs produce a list
	        } else {
	        	value = argStrings.map(function(v) {return this._getValue(action, v);});
	        	value.forEach(function(v) {
	        		this._checkValue(action, v);
	        	});
	        }

	        //return the converted value
	        return value;
	  },
	  _getValue: function(action, argString) {
        var typeFunc = this._registryGet('type', action.type, action.type);
        if( $isCallable(typeFunc)) {
            throw new Error(action, typeFunc + _(' is not callable'));//ArgumentError
        }
        
        var result;
        //convert the value to the appropriate type
        try {
            result = typeFunc(argString);

        //ArgumentTypeErrors indicate errors
	  	} catch(e) {
	  		//catch ArgumentTypeError:
	            name = action.type;
	            message = e.message;//TODO change this
	            throw new Error(action, message);//ArgumentError

	        //TypeErrors or ValueErrors also indicate errors
	        //catch (TypeError, ValueError):
	            name = action.type;
	            throw new Error(action, _('invalid ' + name +' value: '+argString));//ArgumentError
	  	}
        //return the converted value
        return result;
	},
	_checkValue: function(action, value) {
        //converted value must be one of the choices (if specified)
        if($defined(action.choices) && action.choices.indexOf(value) < 0) {
            var message = _('invalid choice: ' + value + ' (choose from ' + action.choices.join(', ') + ')');
            throw new Error(action, message);//ArgumentError
        }
	},
	
	/*********************************
	 * Help formatting methods
	 *********************************/
	/**
	 * Format Usage
	 * 
	 * @return string
	 */
	formatUsage: function() {
        formatter = this._getFormatter();
        formatter.addUsage(this.usage, this._actions, this._mutuallyExclusiveGroups);
        return formatter.formatHelp();
	},
	/**
	 * Format Help
	 * 
	 * @return string
	 */
	formatHelp: function() {
        formatter = this._getFormatter();

        //usage
        formatter.addUsage(this.usage, this._actions, this._mutuallyExclusiveGroups);

        //description
        formatter.addText(this.description);

        //positionals, optionals and user-defined groups
        this._actionGroups.forEach(function(actionGroup, actionIndex) {
            formatter.startSection(actionGroup.title);
            formatter.addText(actionGroup.description);
            formatter.addArguments(actionGroup._groupActions);
            formatter.endSection();
        });

        //epilog
        formatter.addText(this.epilog);

        //determine help from format above
        return formatter.formatHelp();
	},        
	_getFormatter: function() {
	    return new this.formatterClass({program: this.program});
	},
	
	/*********************************
	 * Print functions
	 *********************************/
	/**
	 * Print usage
	 */
	printUsage : function(/*file*/ file) {
	    file = file || process.stdout;
	    this._printMessage(this.formatUsage(), file);
	    return this;
	},
	/**
	 * Print help
	 */
	printHelp : function(/*file*/ file) {
	    file = file || process.stdout;
	    this._printMessage(this.formatHelp(), file);
	    return this;
	},    
	_printMessage : function(/*string*/ message, /*file*/ file) {
	    if (message) {
	        file = file || process.stdout;//TODO : replace to stderr
	        file.write(String(message));
	    }
	},


	/*********************************
	 * Exit functions
	 *********************************/
	/**
	 * Exit method
	 * 
	 * @param status
	 * @param message
	 * @return undefined
	 */
	exit : function(/* int */ status, /* string */ message) {
		if(message) {
			this._printMessage(message, process.stderr);
		}
		status = $value(status, 0);
		process.exit(status);
		return status;
	},
	/**
	 * Error method
	 * 
	 * Prints a usage message incorporating the message to stderr and
	 * exits.
	 * 
	 * If you override this in a subclass, it should not return -- it
	 * should either exit or throw an exception.
	 * 
	 * @param message
	 * @return undefined
	 */
	error : function(/* string */ message) {
		this.printUsage(process.stderr);
		return this.exit(2, this.program + _(': error: ') + message + EOL);
	}
});



exports.ArgumentParser = ArgumentParser;
exports.Action = Action;
exports.Namespace = Namespace;
exports.HelpFormatter = HelpFormatter;

