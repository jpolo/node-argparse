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
var assert = require('assert');



/**
 * Utils methods
 */
/**
 * Class Helper
 */
var Class;
(function(){
	  var isFn = function(fn) { return typeof fn == 'function'; };
	  Class = function(){};
	  Class.create = function(proto) {
	    var k = function(magic) { // call initialize only if there's no magic cookie
	      if (magic != isFn && isFn(this.initialize)) 
	    	  this.initialize.apply(this, arguments);
	    };
	    k.prototype = new this(isFn); // use our private method as magic cookie
	    for (key in proto) (function(fn, sfn){ // create a closure
	      k.prototype[key] = !isFn(fn) || !isFn(sfn) ? fn : // add _super method
	        function() { 
	    	  this._super = sfn; 
	    	  return fn.apply(this, arguments);
	    	};
	    })(proto[key], k.prototype[key]);
	    
	    k.prototype.constructor = k;
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

function $defined(obj){
	return (obj != undefined);
};

var $identity = function(x) { return x; };

var $value = function(value, defaultValue) {
	return (!$defined(value) ? defaultValue : value);
};

function $extend(original, extended){
	for (var key in (extended || {})) original[key] = extended[key];
	return original;
};

var $arrayCollect = function (array, iterator, context) {
    iterator = iterator || $identity;
    var results = [];
    array.forEach(function(value, index) {
    	results.push(iterator.call(context, value, index));
    });
    return results;
};

var $stringRepeat = function (string, count){
	return count < 1 ? '' : new Array(count + 1).join(string);
};

var $stringStrip = function(string) {
    return string.replace(/^\s+/, '').replace(/\s+$/, '');
};

EOL = '\n';

SUPPRESS = '==SUPPRESS==';

OPTIONAL = '?';
ZERO_OR_MORE = '*';
ONE_OR_MORE = '+';
PARSER = 'A...';
REMAINDER = '...';

//var _AttributeHolder = function() {
	/**
     * Abstract base class that provides __repr__.
     * The __repr__ method returns a string in the format::
     * 		ClassName(attr=name, attr=name, ...)
     * The attributes are determined either by a class-level attribute,
     *  '_kwarg_names', or by inspecting the instance __dict__.
     */
//};

/*
_AttributeHolder.prototype._getArgs = function() {
	return [];
};

_AttributeHolder.prototype.toString = function() {
	type_name = Function.toString(this);
    arg_strings = [];
};

/*def __repr__(this):
        type_name = type(this).__name__
        arg_strings = []
        for arg in this._get_args():
            arg_strings.append(repr(arg))
        for name, value in this._get_kwargs():
            arg_strings.append('%s=%r' % (name, value))
        return '%s(%s)' % (type_name, ', '.join(arg_strings))

    def _get_kwargs(this):
        return _sorted(this.__dict__.items())*/

/**
 * Formatting Help
 */
/**
 * Formatter for generating usage messages and argument help strings.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var _Section = function() {};
_Section.prototype = {
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
            join = this.formatter._joinParts;
            
            this.items.forEach(function(item, itemIndex) {
            	
            }); 
            /*for func, args in :
                func(*args)
            itemHelp = join([func(*args) for func, args in this.items])*/ //TODO translate to javascript
            
            if(this.parent) {
                this.formatter._dedent();
            }

            //return nothing if the section was empty
            if(!itemHelp) {
                return '';
            }

            //add the heading if the section was non-empty
            if(this.heading && this.heading != SUPPRESS) {
                heading = $stringRepeat(' ', this.formatter.indentationCurrent)+ this.heading + ':\n';
            } else {
                heading = '';
            }

            //join the section-initializeial newline, the heading and the help
            return join([EOL, heading, item_help, EOL]);
		}
};

var HelpFormatter = Class.create({
	initialize: function(options) {
		options = options || {};
	
		this.program = $value(options['program']);
	
		this.indentation = $value(options['indentation'], 2);
		this.indentationCurrent = 0;
		this.indentationLevel = 0;
		
		this.helpPositionMax = $value(options['helpPositionMax'], 24);
		this.width = $value(options['width'], $value(process.env['COLUMNS'], 80) - 2);
	
		this.actionLengthMax = 0;
	
		this.sectionRoot = new _Section(this, null);
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
	 * Message building methods
	 */
	startSection: function(/*string*/ heading) {
		this._indent();
	    var section = this._Section(this, this.sectionCurrent, heading);
	    this._addItem(section.formatHelp, []);
	    this._sectionCurrent = section;
	},
	endSection: function() {
		this.sectionCurrent = this.sectionCurrent.parent;
		this._dedent();
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
	        this._iterIndentedSubactions(action).forEach(function(subaction) {
	        	invocationNew = this._formatActionInvocation(subaction);
	        	invocations.append(invocationNew);
	        	invocationLength = max(invocationLength, invocationNew.length);
	        });

	        //update the maximum item length
	        var actionLength = invocationLength + this.indentationCurrent;
	        this.actionLengthMax = max(this.actionLengthMax, actionLength);

	        //add the item to the list
	        this._addItem(this._formatAction, [action]);
	    }
	},
	addArguments: function(/*array*/ actions) {
		actions.forEach(function(action) {
			this.addArgument(action);
		});  
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
		return $arrayCollect(partStrings, function(part) {
			return (part && part != SUPPRESS);
		}).join('');
	},
	_formatUsage: function(/*string*/ usage, actions, groups, /*string*/ prefix) {
        var prefix = $value(prefix, _('usage: '));

        //if usage is specified, use that
        if(usage) {
        	usage = usage % dict(program=this.program);//TODO change this pythonic syntax
        	
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
        	var start = actions.indexOf(group._groupActions[0]);//TODO: check for non existent value
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
        var text = $arrayCollect(
        		parts, 
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
        if(text.indexOf('%(program)') >= 0) {
            text = text % dict(prog = this.program); //TODO: change python syntax
        }
        var textWidth = this.width - this.indentationCurrent;
        var indentation = $stringRepeat(' ', this.indentationCurrent);
        return this._fillText(text, textWidth, indentation) + EOL + EOL;
	},
	_formatAction: function(action) {
        //determine the required width and the entry label
        var helpPosition = min(this.actionLengthMax + 2, this.helpPositionMax);
        var helpWidth = this.width - helpPosition;
        var actionWidth = helpPosition - this.indentationCurrent - 2;
        var actionHeader = this._formatActionInvocation(action);

        //no help; start on same line and add a final newline
        if(!action.help) {
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + actionHeader + EOL;

        //short action name; start on the same line and pad two spaces
        } else if(actionHeader.length <= actionWidth) {
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + '-' + actionHeader + '  ' % tup; //TODO actionWidth parameter on actionHeader?
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
            	parts.push($stringRepeat(' ', helpPosition) + line + EOL); //TODO remove this syntax
            });

        //or add a newline if the description doesn't end with one
        } else {
        	var diff = this.length - EOL.length;            
        	if(!(diff >= 0 && this.indexOf(EOL, diff) === diff)) {
        		parts.push(EOL);
        	}
        }
        //if there are any sub-actions, add their help as well
        this._iterIndentedSubactions(action).forEach(function(subaction) {
        	parts.push(this._formatAction(subaction));
        });

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
    _iterIndentedSubactions: function(action) {
		if(action._getSubactions) {
			this._indent();
			action._getSubactions().forEach(function(subaction) {
				//yield subaction;//TODO python syntax
			});
            this._dedent();
		}
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
var RawDescriptionHelpFormatter = HelpFormatter.extend({
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
var RawTextHelpFormatter = RawDescriptionHelpFormatter.extend({
	_splitLines: function(text, width) {
	    return text.split(EOL);
	}
});
RawTextHelpFormatter.prototype = new RawDescriptionHelpFormatter;


/**
 * Help message formatter which adds default values to argument help.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var ArgumentDefaultsHelpFormatter = HelpFormatter.extend({
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
var Action = Class.create({
	initialize: function(options) {
		this.optionStrings = options['optionStrings'];
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
	/*def _get_kwargs(this):
	    names = [
	        'optionStrings',
	        'destination',
	        'nargs',
	        'constant',
	        'default',
	        'type',
	        'choices',
	        'help',
	        'metavar',
	    ]
	    return [(name, getattr(this, name)) for name in names]*/
	
	__call__: function(parser, namespace, values, optionString) {
	    //throw NotImplementedError(_('.__call__() not defined'))
	}
});

var _StoreAction = Action.extend({
    initialize: function(options) {
        this._super(options);
        if(this.nargs <= 0) {
            throw ValueError('nargs for store actions must be > 0; if you '+
                             'have nothing to store, actions such as store '+
                             'true or store const may be more appropriate');
            
        }
        if($defined(this.constant) && this.nargs != OPTIONAL) {
            throw ValueError('nargs must be OPTIONAL to supply const');
        }
	},
    __call__: function (parser, namespace, values, optionString) {
        namespace[this.destination] = values;//TODO : check this
	}
});

var _StoreConstantAction = Actions.extend({
	
	initialize : function(options) {
		options = options || {};
		options.nargs = 0;
		this._super(options);
	},
	__call__: function(parser, namespace, values, optionString) {
		namespace[this.destination] = this.constant;//TODO change this
	}
});

var _StoreTrueAction = _StoreConstAction.extend({
	initialize : function(options) {
		options = options || {};
		options.constant = true;
		options.defaultValue = $value(options.defaultValue, false);
		this._super(options);
	}
});

var _StoreFalseAction = _StoreConstAction.extend({
	initialize : function(options) {
		options = options || {};
		options.constant = false;
		options.defaultValue = $value(options.defaultValue, true);
		this._super(options);
	}
});

var _AppendAction = Action.extend({
	initialize : function(options) {
		this._super(options);
		if(nargs <= 0){
            throw ValueError('nargs for append actions must be > 0; if arg '+
                             'strings are not supplying the value to append, '+
                             'the append const action may be more appropriate');
		}
		if($defined(this.constant) && this.nargs != OPTIONAL) {
	        throw ValueError('nargs must be OPTIONAL to supply const');
	    }
	},
	 __call__: function(parser, namespace, values, optionString) {
        items = _copy.copy($value(namespace[this.destination], []));
        items.push(values);
        namespace[this.destination] = items;//TODO : check this;
	}
});

var _AppendConstAction = Action.extend({
	initialize : function(options) {
		this._super(options);
		this.nargs = 0;
	},
	__call__: function(parser, namespace, values, optionString) {
        items = _copy.copy($(namespace[this.destination], []));
        items.push(this.constant);
        namespace[this.destination] = items;//TODO : Check this
	}
});

var _CountAction = Action.extend({
	initialize : function(options) {
		this._super(options);
	},
	__call__: function(parser, namespace, values, optionString) {
        namespace[this.destination] = $value(namespace[this.destination], 0) + 1;//TODO : Check this
	}
});

var _HelpAction = Action.extend({
	initialize : function(options) {
		options = options || {};
		options.defaulValue = $value(options.defaultValue, SUPPRESS);
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = 0;
		this._super(options);
	},
	__call__: function(parser, namespace, values, optionString) {
        parser.printHelp();
        parser.exit();
	}
});

var _VersionAction = Action.extend({
	initialize : function(options) {
		options = options || {};
		options.defaulValue = $value(options.defaultValue, SUPPRESS);
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = 0;
		this._super(options);
		this.version = options.version;
	},
	__call__: function(parser, namespace, values, optionString) {
        version = $value(this.version, parser.version);
        formatter = parser._getFormatter();
        formatter.addText(version);
        parser.exit(0, formatter.formatHelp());
	}
});

var _SubParsersAction = Action.extend({
	initialize: function(options) {
		options = options || {};
		options.destination = $value(options.destination, SUPPRESS);
		options.nargs = PARSER;
		
		this._programPrefix = $value(options['program']);
	    this._parserClass = $value(options['parserClass']);
	    this._nameParserMap = {};
	    this._choicesActions = [];
	    
	    choices = this._nameParserMap;
	    this._super(options);
	},
	addParser: function(name, options) {
        //set prog from the existing prefix
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
	__call__: function(parser, namespace, values, optionString) {
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
            var message = _('unknown parser ' + parserName + ' (choices: ' + this._nameParserMap.join(', ') + ')');//TODO translation not working
            throw ArgumentError(this, message);//TODO change this
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
var Namespace = Class.create({
	initialize: function(options) {
		$extends(this, options);
	}
});

var _ActionsContainer = Class.create({
	initialize: function() {
		this.description = description;
	    this.argumentDefault = argumentDefault;
	    this.prefixChars = prefixChars;
	    this.conflictHandler = conflictHandler;
	  
	    //set up registries
        this._registries = {};
        
        //register actions
        this.register('action', None, _StoreAction);
        this.register('action', 'store', _StoreAction);
        this.register('action', 'store_const', _StoreConstantAction);
        this.register('action', 'store_true', _StoreTrueAction);
        this.register('action', 'store_false', _StoreFalseAction);
        this.register('action', 'append', _AppendAction);
        this.register('action', 'append_const', _AppendConstAction);
        this.register('action', 'count', _CountAction);
        this.register('action', 'help', _HelpAction);
        this.register('action', 'version', _VersionAction);
        this.register('action', 'parsers', _SubParsersAction);
        
        //raise an exception if the conflict handler is invalid
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
        registry = this._registries.setdefault(registryName, {});
        registry[value] = object;
        return this;
	},
	_registryGet: function(registryName, value, defaultValue) {
		var registry = this._registries[registryName];
		return $value(registry[value], defaultValue);
	},
	
	/**
	 * Namespace default accessor methods
	 */
	setDefaults: function(options) {
        $extend(this._defaults, options);

        //if these defaults match any existing arguments, replace
        //the previous default on the object with the new one
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
	 * addArgument(option_string, option_string, ..., name=value, ...)
	 */
	addArgument: function(args, kwargs) {//TODO change python syntax
		
	    //if no positional args are supplied or only one is supplied and
	    //it doesn't look like an option string, parse a positional argument
	    var chars = this.prefixChars;
	        
	    if !args || args.length == 1 && args[0][0] not in chars:
            if args and 'dest' in kwargs:
                raise ValueError('dest supplied twice for positional argument')
            kwargs = this._get_positional_kwargs(args, kwargs)

        //otherwise, we're adding an optional argument
        else:
            kwargs = this._get_optional_kwargs(args, kwargs)

        //if no default was supplied, use the parser-level default
        if(! $defined(kwargs['default'])) {
            destination = kwargs['destination'];
            if(this._defaults.indexOf(destination) >= 0) {
                kwargs['default'] = this._defaults[destination];
            } else if($defined(this.argumentDefault)) {
                kwargs['default'] = this.argumentDefault;
            }
        }
        
        //create the action object, and add it to the parser
        var actionClass = new this._popActionClass(kwargs);
        if not _callable(actionClass):
            raise ValueError('unknown action "%s"' % action_class)
        action = action_class(**kwargs)

        //raise an error if the action type is not callable
        type_func = this._registry_get('type', action.type, action.type)
        if not _callable(type_func):
            raise ValueError('%r is not callable' % type_func)

        return this._addAction(action);
	},
	addArgumentGroup: function(args, kwargs) {//TODO change python syntax
        var group = new _ArgumentGroup(this, args, kwargs);
        this._actionGroups.push(group);
        return group;
	},
	addMutuallyExclusiveGroup: function(kwargs) {//TODO change python syntax
        var group = new _MutuallyExclusiveGroup(this, kwargs);
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
        });

        //set the flag if any option strings look like negative numbers
        action.optionStrings.forEach(function(optionString) {
        	if(optionString.match(this._regexpNegativeNumber)) {
                if(!this._hasNegativeNumberOptionals) {
                    this._hasNegativeNumberOptionals.push(true);
                }
        	}
        });

        //return the created action
        return action;
	},
    _removeAction: function(action) {
        this._actions.remove(action);
	}
});


   

    

    

    

    def _add_container_actions(this, container):
        // collect groups by titles
        title_group_map = {}
        for group in this._action_groups:
            if group.title in title_group_map:
                msg = _('cannot merge actions - two groups are named %r')
                raise ValueError(msg % (group.title))
            title_group_map[group.title] = group

        // map each action to its group
        group_map = {}
        for group in container._action_groups:

            // if a group with the title exists, use that, otherwise
            // create a new group matching the container's group
            if group.title not in title_group_map:
                title_group_map[group.title] = this.add_argument_group(
                    title=group.title,
                    description=group.description,
                    conflict_handler=group.conflict_handler)

            // map the actions to their new group
            for action in group._group_actions:
                group_map[action] = title_group_map[group.title]

        // add container's mutually exclusive groups
        // NOTE: if add_mutually_exclusive_group ever gains title= and
        // description= then this code will need to be expanded as above
        for group in container._mutually_exclusive_groups:
            mutex_group = this.add_mutually_exclusive_group(
                required=group.required)

            // map the actions to their new mutex group
            for action in group._group_actions:
                group_map[action] = mutex_group

        // add all actions to this container or their group
        for action in container._actions:
            group_map.get(action, this)._add_action(action)

    def _get_positional_kwargs(this, dest, **kwargs):
        // make sure required is not specified
        if 'required' in kwargs:
            msg = _("'required' is an invalid argument for positionals")
            raise TypeError(msg)

        // mark positional arguments as required if at least one is
        // always required
        if kwargs.get('nargs') not in [OPTIONAL, ZERO_OR_MORE]:
            kwargs['required'] = True
        if kwargs.get('nargs') == ZERO_OR_MORE and 'default' not in kwargs:
            kwargs['required'] = True

        // return the keyword arguments with no option strings
        return dict(kwargs, dest=dest, option_strings=[])

    def _get_optional_kwargs(this, *args, **kwargs):
        // determine short and long option strings
        option_strings = []
        long_option_strings = []
        for option_string in args:
            // error on strings that don't start with an appropriate prefix
            if not option_string[0] in this.prefix_chars:
                msg = _('invalid option string %r: '
                        'must start with a character %r')
                tup = option_string, this.prefix_chars
                raise ValueError(msg % tup)

            // strings starting with two prefix characters are long options
            option_strings.append(option_string)
            if option_string[0] in this.prefix_chars:
                if len(option_string) > 1:
                    if option_string[1] in this.prefix_chars:
                        long_option_strings.append(option_string)

        // infer destination, '--foo-bar' -> 'foo_bar' and '-x' -> 'x'
        dest = kwargs.pop('dest', None)
        if dest is None:
            if long_option_strings:
                dest_option_string = long_option_strings[0]
            else:
                dest_option_string = option_strings[0]
            dest = dest_option_string.lstrip(this.prefix_chars)
            if not dest:
                msg = _('dest= is required for options like %r')
                raise ValueError(msg % option_string)
            dest = dest.replace('-', '_')

        // return the updated keyword arguments
        return dict(kwargs, dest=dest, option_strings=option_strings)

    def _popActionClass(this, kwargs, default=None):
        action = kwargs.pop('action', default)
        return this._registry_get('action', action, action)

    def _get_handler(this):
        // determine function from conflict handler string
        handler_func_name = '_handle_conflict_%s' % this.conflict_handler
        try:
            return getattr(this, handler_func_name)
        except AttributeError:
            msg = _('invalid conflict_resolution value: %r')
            raise ValueError(msg % this.conflict_handler)

    def _check_conflict(this, action):

        // find all options that conflict with this option
        confl_optionals = []
        for option_string in action.option_strings:
            if option_string in this._option_string_actions:
                confl_optional = this._option_string_actions[option_string]
                confl_optionals.append((option_string, confl_optional))

        // resolve any conflicts
        if confl_optionals:
            conflict_handler = this._get_handler()
            conflict_handler(action, confl_optionals)

    def _handle_conflict_error(this, action, conflicting_actions):
        message = _('conflicting option string(s): %s')
        conflict_string = ', '.join([option_string
                                     for option_string, action
                                     in conflicting_actions])
        raise ArgumentError(action, message % conflict_string)

    def _handle_conflict_resolve(this, action, conflicting_actions):

        // remove all conflicting options
        for option_string, action in conflicting_actions:

            // remove the conflicting option
            action.option_strings.remove(option_string)
            this._option_string_actions.pop(option_string, None)

            // if the option now has no option string, remove it from the
            // container holding it
            if not action.option_strings:
                action.container._remove_action(action)

/**
 * ArgumentParser declaration
 */
var ArgumentParser = Class.create({
	/**
	 * Constructor
	 */
	initialize: function(options) {
		//argument_default=None,
	    //conflict_handler='error';
		options = options || {};

		this.program = $value(options['program'], path.basename(process.execPath));
		this.usage = $value(options['usage'], '');
		this.description = $value(options['description'], '');
		this.epilog = $value(options['epilog'], '');
		this.version = $value(options['version']);
		
		//this.parents = $value(options['parents'], []);
		this.formatterClass = $value(options['formatterClass'], 'HelpFormatter');
		this.prefixChars = $value(options['prefixChars'], '-');
		//this.prefixCharsFile = $value(options['prefixCharsFile']);
		
		
	    //this._positionals = this.addArgumentGroup(_('positional arguments'));
	    //this._optionals = this.addArgumentGroup(_('optional arguments'));
	    this._subparsers = [];
	
	    //register types
	    var identityFunction = function(string) {
	        return string;
	    };
	    //this.register('type', null, identityFunction);
		
		// add help and version arguments if necessary
	    // (using explicit default to override global argument_default)
	    /*if ($value(options['addHelp'], true)) {
	        this.addArgument(
	        	'-h', '--help',
	        	{
		        	'action' : 'help', 
		        	'default' : 'SUPPRESS', 
		        	'help' : _('show this help message and exit')
	        	}
	        );
	    }
	    if (this.version) {
	        this.addArgument(
	            '-v', '--version',
	            {
		            'action' : 'version', 
		            'default' : 'SUPPRESS',
		            'version': this.version,
		            'help' : _("show program's version number and exit")
	            }
	        );
	    }*/
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
	        message = _('unrecognized arguments: %s');
	        this.error(message % ' '.join(argv));
	    }
	    return args;
	},
	parseArgsKnown: function(args, namespace) {
		
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
        formatter.addUsage(this.usage, this._actions, this._mutually_exclusive_groups);
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
        formatter.addUsage(this.usage, this._actions, this._mutually_exclusive_groups);

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
	 * should either exit or raise an exception.
	 * 
	 * @param message
	 * @return undefined
	 */
	error : function(/* string */ message) {
		this.printUsage(process.stderr);
		return this.exit(2, _('%s: error: %s\n'));
	}
});



exports.ArgumentParser = ArgumentParser;
exports.HelpFormatter = HelpFormatter;
