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
 *      - argumentDefault -- The default value for all arguments
 *      - conflictHandler -- String indicating how to handle conflicts
 *      - addHelp -- Add a -h/-help option
 */
var sys = require('sys');
var fs = require('fs');
var assert = require('assert');


/**
 * Utils methods
 */
/**
 * Class Helper
 */
var Class = function(){};
(function(){
	var isFn = function(fn) { return typeof fn == 'function'; };
	Class.create = function(className, proto) {
		var k = function(magic) { // call initialize only if there's no magic cookie
			if (magic != isFn && isFn(this.initialize)) {
				this.initialize.apply(this, arguments);
			}
		};
		k.prototype = new this(isFn); // use our private method as magic cookie
		k.prototype.toRepr = function(depth) { return this._toRepr(this, depth || 2, []);};
		k.prototype._toRepr = function(object, depth, references) {
			if(depth == 0) {
				return '';
			}
			//references = references || [];

			if(object == undefined) {
				return 'undefined';
			} else if(object === null) {
				return 'null';
			} else {
				switch(typeof(object)) {
				case 'object':
					if(references.indexOf(object) >= 0) {
						return '#Recursion#';
					}
					if(this instanceof Function) {
						return 'function()';
					}
					references.push(object);
					var referencesNew = references;
					if(object instanceof Array) {
						return '[' + object.map(function(value) {
							return k.prototype._toRepr(value, depth, referencesNew);
						}).join(', ')+ ']';
					} else {
						var className = $value(object.constructor.__class__, 'Object');
						
						var properties;
						if(depth > 1) {
							properties = [];
							for(var property in object) {
								if(property == 'prototype') {
									continue;
								}
								var value = object[property];
								var valueString = false;
								
								if((value != undefined) && !(value instanceof Function)) {
									valueString = k.prototype._toRepr(value, depth - 1, referencesNew);
								}
								
								if(valueString !== false) {
									properties.push(property + ':' + valueString);
								}
							}
							properties = properties.join(', ');
						} else {
							properties = '...';
						}
						
						return '<' + className + ':{' + properties + '}>';
					}
					break;
				case 'string':
					return '"' + object + '"';
				case 'number':
				case 'boolean':
					return '' + object;
				default:
					return 'unknown type:'+typeof(object);
				}
			}
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
 * Return true if obj is defined
 * 
 * @param obj
 * @return boolean
 */
var $defined = function(obj) {
	return (obj != undefined);
};

/** 
 * Return defaultValue if value is not set
 * 
 * @param value
 * @param defaultValue
 * @return
 */
var $value = function(value, defaultValue) {
	return (!$defined(value) ? defaultValue : value);
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
		return true;
	}
} ;

var $stringRepeat = function (string, count){
	return count < 1 ? '' : new Array(count + 1).join(string);
};

var $stringStrip = function(string, chars) {
    return $stringLStrip($stringRStrip(string, chars), chars);
};

var $stringLStrip = function(string, chars) {
	chars = chars || "\\s";
	return string.replace(new RegExp("^[" + chars + "]+", "g"), "");
};

var $stringRStrip = function(string, chars) {
	chars = chars || "\\s";
	return string.replace(new RegExp("[" + chars + "]+$", "g"), "");
};

var $stringPrint = function(string, obj) {
	var tag = '%';
	var result = string.substring();
	obj = obj || {};
	for(var property in obj) {
		result = result.replace(tag + property + tag, '' + obj[property]);
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
	
		this.sectionRoot = new this._HelpSection(this);
	    this.sectionCurrent = this.sectionRoot;
	
	    this._regexpWhitespace = new RegExp('\s+');
	    this._regexpLongBreak = new RegExp(EOL + EOL + EOL + '+');
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
	_addItem: function(callback) {
	    this.sectionCurrent.addItem(callback);
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
		addItem: function(callback) {
			this.items.push(callback);
			return this;
		},
	    formatHelp: function() {
	        //format the indented section
	        if(this.parent) {
	            this.formatter._indent();
	        }
	        
	        var itemHelp = this.items.map(function(item) {
	        	return item();
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
	        var heading = (this.heading && this.heading != SUPPRESS) ? 
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
		this.sectionCurrent = new this._HelpSection(this, this.sectionCurrent, heading);
	    this._addItem(function() { return this._sectionCurrent.formatHelp();}.bind(this));
	    return this;
	},
	endSection: function() {
		this.sectionCurrent = this.sectionCurrent.parent;
		this._dedent();
		return this;
	},
	addText: function(/*string*/ text) {
		if (text && text != SUPPRESS) {
	        this._addItem(function() { return this._formatText(text); }.bind(this));
		}
		return this;
	},
	addUsage: function(/*string*/ usage, actions, groups, /*string*/ prefix) {
		if(usage != SUPPRESS ) {
	        this._addItem(function() { return this._formatUsage(usage, actions, groups, prefix);}.bind(this));
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
	        this._addItem(function() {return this._formatAction(action);}.bind(this));
	    }
	    return this;
	},
	addArguments: function(/*array*/ actions) {
		actions.forEach(function(action) {
			this.addArgument(action);
		}.bind(this));
		return this;
	},
	
	/**
	 * Help-formatting methods
	 */
	formatHelp: function() {
        var help = this.sectionRoot.formatHelp();
        if(help) {
            help = help.replace(this._regexpLongBreak, EOL + EOL);
            help = $stringStrip(help, EOL) + EOL;
        }
        return help;
	},
	_joinParts: function(partStrings) {
		return partStrings.filter(function(part) {
			return (part && part != SUPPRESS);
		}).join('');
	},
	_formatUsage: function(/*string*/ usage, actions, groups, /*string*/ prefix) {
		prefix = $value(prefix, _('usage: '));
		actions = actions || [];
		groups = groups || [];

        //if usage is specified, use that
        if(usage) {
        	usage = $stringPrint(usage, {program : this.program});
        	
        //if no optionals or positionals are available, usage is just prog
		} else if(!usage && actions.length == 0) {
            usage = '' + $value(this.program, '');

        //if optionals and positionals are available, calculate usage
		} else if(!usage) {

            var program = '' + $value(this.program, '');
            
            //split optionals from positionals
            var optionals = [];
            var positionals = [];
            actions.forEach(function(action) {
            	if(action.isOptional()) {
                    optionals.push(action);
            	} else {
                    positionals.push(action);
            	}
            });

            //build full usage string
            var actionUsage = this._formatActionsUsage([].concat(optionals, positionals), groups);
            
            var usageString = '';
            if(program) usageString += program + ' ';
            if(actionUsage) usageString += actionUsage;
            usage = usageString;
            

            //wrap the usage parts if it's too long
            var textWidth = this.width - this.indentationCurrent;
            if ((prefix.length + usage.length) > textWidth) {

                //break usage into wrappable parts
            	var regexpPart = new Regexp('\(.*?\)+|\[.*?\]+|\S+');
                var optionalUsage = format(optionals, groups);
                var positionalUsage = format(positionals, groups);
                var optionalParts = optionalUsage.match(regexpPart);
                var positionalParts = positionalUsage.match(regexpPart);
                assert.equal(optionalParts.join(' '), optionalUsage);
                assert.equal(positionalParts.join(' '), positionalUsage);

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
        var inserts = [];
        
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
	                for(var i = start + 1; i < end; i++) {
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
            } else if(action.isPositional()) {
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
        }.bind(this));

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
        if(action.isPositional()) {
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
            	for(var i = 0; i < size; ++i) {
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
	            if(action.isOptional() || [OPTIONAL, ZERO_OR_MORE].indexOf(action.nargs) < 0) {
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
		this.type = $value(options['type'], null);
		this.choices = options['choices'];
		this.required = $value(options['required'], false);
		this.help = options['help'];
		this.metavar = options['metavar'];
		
		assert.ok(this.optionStrings instanceof Array, 'optionStrings should be an array');
		if($defined(this.required)) {
			assert.ok(typeof(this.required) == 'boolean', 'required should be a boolean');
		}
		if($defined(this.nargs)) {
			assert.ok(typeof(this.nargs) == 'number', 'nargs should be a number');
		}
	},
	getName: function() {
	    if(this.optionStrings.length > 0) {
	        return this.optionStrings.join('/');
	    } else if($defined(this.metavar) && this.metavar != SUPPRESS) {
	        return this.metavar;
	 	} else if($defined(this.destination) && this.destination != SUPPRESS) {
	        return this.destination;
		} 
	    return null;
	},
	isOptional: function() {
		return !this.isPositional();
	},
	isPositional: function() {
		return (this.optionStrings.length == 0);
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
            var message = $stringPrint(
            		_('Unknown parser "%name%" (choices: [%choices%]).', 
            		{
            			name: parserName, 
            			choices: this._nameParserMap.join(', ')
            		})
            );
            throw new ArgumentError(this, message);
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
		for (var key in options) {
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
        this._actionGroupsMutex = [];
        
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
		options = options || {};
		for(var property in options) {
			this._defaults[property] = options[property];
		}

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
            throw new Error($stringPrint('Unknown action "%action%".', {action: actionClass}));//ValueError
        }
        var action = new actionClass(kwargs);
        
        
        //throw an error if the action type is not callable
        typeFunc = this._registryGet('type', action.type, action.type);
        if(!$isCallable(typeFunc)) {
            throw new Error($stringPrint('"%function%" is not callable', {'function': typeFunc}));
        }

        return this._addAction(action);
	},
	addArgumentGroup: function(options, mutuallyExclusive) {
		mutuallyExclusive = $value(mutuallyExclusive, false);
		if(mutuallyExclusive) {
			var group = new _MutuallyExclusiveGroup(this, options);
	        this._actionGroupsMutex.push(group);
	        return group;
		} else {
	        var group = new _ArgumentGroup(this, options);
	        this._actionGroups.push(group);
	        return group;
		}
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
		if(actionIndex >= 0) {
			this._actions.splice(actionIndex);
		}
	},
	_addContainerActions: function(container) {
		
        // collect groups by titles
        var titleGroupMap = {};
        this._actionGroups.forEach(function(group) {
        	if(titleGroupMap.indexOf(group.title) >= 0) {
                throw new Error($stringPrint(_('Cannot merge actions - two groups are named "%title%".'), group));//ValueError
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
        container._actionGroupsMutex.forEach(function(group) {
        	var mutexGroup = this.addArgumentGroup({required: group.required}, true);

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
            throw new Error(_('"required" is an invalid argument for positionals.'));//TypeError
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
        var optionStrings = [];
        var optionStringsLong = [];
        args.forEach(function(optionString) {
        	// error on strings that don't start with an appropriate prefix
            if(prefixChars.indexOf(optionString[0]) < 0) {
            	throw Error($stringPrint(_('Invalid option string "%option%": must start with a "%prefix%".'), {
            		option: optionString,
            		prefix: prefixChars
            	}));//ValueError
            }

            // strings starting with two prefix characters are long options
            optionStrings.push(optionString);
            if(prefixChars.indexOf(optionString[0]) >= 0) {
                if(optionString.length > 1 && prefixChars.indexOf(optionString[1]) >= 0) {
                	optionStringsLong.push(optionString);
                }
            }
        });
            

        // infer destination, '--foo-bar' -> 'foo_bar' and '-x' -> 'x'
        var destination = kwargs['destination'];
        delete kwargs['destination'];
        
        if(!$defined(destination)) {
            var optionStringDestination = $value(optionStringsLong[0], optionStrings[0]);
            
            //destination = optionStringDestination.lstrip(this.prefixChars);
            destination = $stringLStrip(optionStringDestination, this.prefixChars);
            
            if(destination.length == 0) {
                throw Error($stringPrint(_('destination= is required for options like "%option%"'), {option: optionString}));
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
        return actionClass;
	},
	_getHandler: function() {
        // determine function from conflict handler string
		var handlerFuncName = '';
		handlerFuncName += '_handleConflict';
		handlerFuncName += this.conflictHandler.charAt(0).toUpperCase() + this.conflictHandler.substr(1);
		
        if(!$defined(this[handlerFuncName])) {
        	throw new Error($stringPrint(_('Invalid conflictResolution value: %value%'), {
        		value: $value(this.conflictHandler, 'undefined')
        	}));//ValueError
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
                
        throw new ArgumentError(action, $stringPrint(_('Conflicting option string(s) : %conflict%'), {conflict: optionStrings.join(', ')}));
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
            if(action.isOptional()) {
                action.container._removeAction(action);
            }
        });
	}
});


var _ArgumentGroup = _ActionContainer.extend('_ArgumentGroup', {
	initialize: function(container, options) {
		
		options = options || {};

		//add any missing keyword arguments by checking the container
		options.conflictHandler = $value(options.conflictHandler, container.conflictHandler);
		options.prefixChars = $value(options.prefixChars, container.prefixChars);
		options.argumentDefault = $value(options.argumentDefault, container.argumentDefault);
		
	    this._super(options);
	
	    //group attributes
	    this.title = options.title;
	    this._groupActions = [];
	
	    //share most attributes with the container
	    this._container = container;
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
	initialize: function(container, options) {
		options = options || {};
		
        this._super(container, options);
        this.required = $value(options.required, false);
	},
	_addAction: function(action) {
		if(action.required) {
            throw new Error(_('Mutually exclusive arguments must be optional.'));//ValueError
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
		options = options || {};
		options.prefixChars = $value(options.prefixChars, '-');
		options.help = $value(options.help, false);
		options.parents = $value(options.parents, []);
		
		this._super(options);
		this.program = $value(options.program, require('path').basename(process.execPath));
		this.usage = options.usage;
		this.epilog = options.epilog;
		this.version = options.version;
		
		this.formatterClass = $value(options.formatterClass, 'HelpFormatter');
		this.prefixCharsFile = options.prefixCharsFile;
		
	    this._positionals = this.addArgumentGroup({title : _('Positional arguments')});
	    this._optionals = this.addArgumentGroup({title: _('Optional arguments')});
	    this._subparsers = [];
	
	    //register types
	    this.register('type', 'auto', function(x) { return x; });
	    this.register('type', null, function(x) { return x; });
		
		// add help and version arguments if necessary
	    // (using explicit default to override global argument_default)
	    if (options['help']) {
	        this.addArgument(
	        	['-h', '--help'],
	        	{
		        	action : 'help', 
		        	help : _('Show this help message and exit.')
	        	}
	        );
	    }
	    if ($defined(this.version)) {
	        this.addArgument(
	            ['-v', '--version'],
	            {
		            action : 'version',
		            version: this.version,
		            help : _("Show program's version number and exit.")
	            }
	        );
	    }
	    
	    //add parent arguments and defaults
	    options.parents.forEach(function(parent) {
        	this._addContainerActions(parent);
        	if($defined(parent._defaults)) {
        		for(defaultKey in parent._defaults) {
        			this._defaults[defaultKey] = parent._defaults[defaultKey];
        		}
        	}
        });
	},
	/**
	 * Optional/Positional adding methods
	 */
	addSubparsers: function(kwargs) {
        if($defined(this._subparsers)) {
            this.error(_('Cannot have multiple subparser arguments.'));
        }

        //add the parser class to the arguments if it's not present
        kwargs.setdefault('parserClass', type(self));//TODO: change this

        if($defined(kwargs['title']) || $defined(kwargs['description'])) {
            this._subparsers = this.addArgumentGroup({
            	title: _(kwargs.pop('title', 'subcommands')), 
            	description: _(kwargs.pop('description', None))
            });
        } else {
            this._subparsers = this._positionals;
        }

        //prog defaults to the usage message of this parser, skipping
        //optional arguments and with no "usage:" prefix
        if($defined(kwargs['program'])) {
            formatter = this._getFormatter();
            positionals = this._getActionsPositional();
            groups = this._actionGroupsMutex;
            formatter.addUsage(this.usage, positionals, groups, '');
            kwargs['program'] = $stringStrip(formatter.formatHelp());//TODO: strip
        }
        //create the parsers action and add it to the positionals list
        parsersClass = this._popActionClass(kwargs, 'parsers');
        kwargs['optionStrings'] = [];
        var action = parsersClass(kwargs);
        this._subparsers._addAction(action);

        //return the created parsers action
        return action;
	},
	_addAction: function(action) {
	    if (action.isOptional()) {
	        this._optionals._addAction(action);
	    } else {
	        this._positionals._addAction(action);
	    }
	    return action;
	},

	_getActionsOptional : function() {
		return this._actions.filter(function(action, actionIndex) {  
			return action.isOptional();
		});
	},
	_getActionsPositional : function() {
		return this._actions.filter(function(action, actionIndex) {  
			return action.isPositional();
		});
	},
	
	
	/**
	 * Command line argument parsing methods
	 */
	parseArgs: function(args, namespace) {
		var result = this.parseArgsKnown(args, namespace);
	    var args = result[0];
	    var argv = result[1];
	    
	    if (argv && argv.length > 0) {
	        this.error($stringPrint(_('Unrecognized arguments: %arguments%.'), {arguments: argv.join(' ')}));
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
                namespace.set(action.destination, defaultValue);
            }
        }.bind(this));
        
        //add any parser defaults that aren't present
        for(var destination in this._defaults) {
        	if(!$defined(namespace[destination])) {
        		namespace.set(destination, this._defaults[destination]);
        	}
        }

        //parse the arguments and exit if there are any errors
        try {
            return this._parseArgsKnown(args, namespace);
        } catch (e) {
            this.error(e.message);//_sys.exc_info()[1];
        }
	},
	_parseArgsKnown: function(argStrings, namespace) {
		argStrings = this._readArgs(argStrings);

        //map all mutually exclusive arguments to the other arguments they can't occur with
        var actionConflicts = {};
        this._actionGroupsMutex.forEach(function(mutexGroup) {
            mutexGroup._groupActions.forEach(function(mutexAction, mutexIndex) {
            	actionConflicts[mutexAction] = $value(actionConflicts[mutexAction], []);
            	actionConflicts[mutexAction] = actionConflicts[mutexAction].concat(
            		mutexGroup._groupActions.slice(0, mutexIndex),
            		mutexGroup._groupActions.slice(mutexIndex + 1)
            	);
            });
        });
            

        //find all option indices, and determine the argStringPattern
        //which has an 'O' if there is an option at an index,
        //an 'A' if there is an argument, or a '-' if there is a '--'
        var optionStringIndices = [];
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
	                var pattern;
	                if($defined(optionTuple)) {
	                    optionStringIndices[argStringIndex] = optionTuple;
	                    pattern = 'O';
	                } else {
	                	pattern = 'A';
	                }
	                argStringPatternParts.push(pattern);
	            }
        	}
        }.bind(this));

        //join the pieces together to form the pattern
        var argStringsPattern = argStringPatternParts.join('');

        //converts arg strings to the appropriate and then takes the action
        var actionsSeen = [];
        var actionsSeenNonDefault = [];
        var extras = [];
        var startIndex = 0;
        var stopIndex = 0;

        function takeAction(action, argumentStrings, optionString) {
        	
            actionsSeen.push(action);
            var argValues = this._getValues(action, argumentStrings);
            
            //error if this argument is not allowed with other previously
            //seen arguments, assuming that actions that use the default
            //value don't really count as "present"
            if(argValues != action.defaultValue) {
                actionsSeenNonDefault.push(action);
                $value(actionConflicts[action], []).forEach(function(actionConflict) {
                    if(actionsSeenNonDefault.indexOf(actionConflict) >= 0) {
                        throw new ArgumentError(action, $stringPrint(_('Not allowed with argument "%argument%".'), {argument: actionConflict.getName()}));
                    }
                });
            }
            //take the action if we didn't receive a SUPPRESS value
            //(e.g. from a default)
            if(argValues != SUPPRESS) {
                action.call(this, namespace, argValues, optionString);
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
            var stop;
            
            while(true) {

                //if we found no optional action, skip it
                if(!$defined(action)) {
                    extras.push(argStrings[startIndex]);
                    return startIndex + 1;
                }

                //if there is an explicit argument, try to match the
                //optional's string arguments to only this
                if($defined(argExplicit)) {
                    var argCount = this._matchArgument(action, 'A');

                    //if the action is a single-dash option and takes no
                    //arguments, try to parse more single-dash options out
                    //of the tail of the option string
                    if(argCount == 0 && this.prefixChars.indexOf(optionString[1]) < 0) {
                        actionTuples.push([action, [], optionString]);
                        var breaked = false;
                        this.prefixChars.forEach(function(prefixChar) {
                        	var optionString = prefixChar + argExplicit.substr(0, 1);
                            var argExplicit = argExplicit.substr(1);
                            if($defined(this._optionStringActions[optionString])) {
                                action = this._optionStringActions[optionString];
                                breaked = true;
                                break;
                            }
                        }.bind(this));
                        if(breaked) {
                        	throw new ArgumentError(action, $stringPrint(_('Ignored explicit argument "%argument%".'), {argument: argExplicit}));
                        }

                    //if the action expect exactly one argument, we've
                    //successfully matched the option; exit the loop
                	} else if(argCount == 1) {
                        stop = startIndex + 1;
                        var args = [argExplicit];
                        actionTuples.push([action, args, optionString]);
                        break;

                    //error if a double-dash option did not use the
                    //explicit argument
                	} else {
                        throw new ArgumentError(action, $stringPrint(_('Ignored explicit argument "%argument%".'), {argument: argExplicit}));
                	}

                //if there is no explicit argument, try to match the
                //optional's string arguments with the following strings
                //if successful, exit the loop
                } else {
                    var start = startIndex + 1;
                    var argStringsPatternSelected = argStringsPattern.substr(start);
                    var argCount = this._matchArgument(action, argStringsPatternSelected);
                                  
                    stop = start + argCount;
                    var args = argStrings.slice(start, stop);

                    actionTuples.push([action, args, optionString]);
                    break;
                }
            }

            //add the Optional to the list and return the index at which
            //the Optional's string args stopped
            assert.ok(actionTuples.length > 0);
            actionTuples.forEach(function(actionTuple) {
                takeAction.bind(this).apply(this, actionTuple);
            }.bind(this));
            return stop;
        }

        //the list of Positionals left to be parsed; this is modified by consumePositionals()
        var positionals = this._getActionsPositional();

        //function to convert argStrings into positional actions
        function consumePositionals(startIndex) {
            //match as many Positionals as possible
        	var argStringsPatternSelected = argStringsPattern.substr(startIndex);
            var argCounts = this._matchArgumentsPartial(positionals, argStringsPatternSelected);

            //slice off the appropriate arg strings for each Positional
            //and add the Positional and its args to the list
            for(var i = 0; i < positionals.length; i++) {
            	var action = positionals[i];
            	var argCount = $value(argCounts[i], 0);
            	var args = argStrings.slice(startIndex, startIndex + argCount);

            	startIndex += argCount;
                takeAction.bind(this)(action, args);
            }
            
            //slice off the Positionals that we just parsed and return the
            //index at which the Positionals' string args stopped
            //positionals[:] = positionals.slice(argCounts.length);//TODO check this
            positionals = positionals.slice(argCounts.length);
            return startIndex;
        }

        //consume Positionals and Optionals alternately, until we have
        //passed the last option string
        var optionStringIndexMax = optionStringIndices ?  optionStringIndices.length - 1 : -1;

        while(startIndex <= optionStringIndexMax) {
            //consume any Positionals preceding the next option
        	var optionStringIndexNext;
        	for(var i = startIndex; i < optionStringIndices.length; i++) {
        		if($defined(optionStringIndices[i])) {
        			optionStringIndexNext = i;
        			break; 
        		}
        	}

            if(startIndex != optionStringIndexNext) {
                positionalsEndIndex = consumePositionals.bind(this)(startIndex);

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
                var strings = argStrings.slice(startIndex, optionStringIndexNext);
                extras = extras.concat(strings);
                startIndex = optionStringIndexNext;
            }
            //consume the next optional and any arguments for it
            startIndex = consumeOptional.bind(this)(startIndex);
        }

        //consume any positionals following the last Optional
        stopIndex = consumePositionals.bind(this)(startIndex);

        //if we didn't consume all the argument strings, there were extras
        extras = extras.concat(argStrings.slice(stopIndex));

        //if we didn't use all the Positional objects, there were too few
        //arg strings supplied.
        if(positionals.length > 0) {
            this.error(_('Too few arguments'));
        }

        //make sure all required actions were present
        this._actions.forEach(function(action) {
        	if(action.required && actionsSeen.indexOf(action) < 0) {
                this.error(_('Argument "%name%" is required'), {argument: action.getName()});
        	}
        }.bind(this));

        //make sure all required groups had one option present
        this._actionGroupsMutex.forEach(function(group) {
        	if(group.required) {
        		var found = false;
                for(var actionIndex in group._groupActions) {
                	var action = group._groupActions[actionIndex];
                    if(actionsSeenNonDefault.indexOf(action) >= 0) {
                    	found = true;
                        break;
                    }
                }
                //if no actions were used, report the error
                if(found) {
                	var names = [];
                	group._groupActions.forEach(function(action) {
                		if(action.help != SUPPRESS) {
                			names.push(action.getName());
                		}
                	});
                    this.error($stringPrint(_('One of the arguments %arguments% is required.'), {arguments: names.join(' ')}));
                }
        	}
        }.bind(this));
            

        //return the updated namespace and the extra arguments
        return [namespace, extras];
	},
	_readArgs: function(argStrings) {
		var result = argStrings.slice();
		//replace arg strings that are file references
        if($defined(this.prefixCharsFile)) {
        	result = this._readArgsFromFiles(result);
        }
        return result;
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
        var message;
        
        //throw an exception if we weren't able to find a match
        if(!$defined(matches)) {
        	if(!$defined(action.nargs)) {
        		message = _('Expected one argument.');
        	} else if(action.nargs == OPTIONAL) {
        		message = _('Expected at most one argument.');
        	} else if(action.nargs == ONE_OR_MORE) {
        		message = _('Expected at least one argument.');
        	} else {
        		message = _('Expected %count% argument(s)');
        	}
            throw new ArgumentError(action, $stringPrint(message, {count: action.nargs}));
        }
        //return the number of arguments matched
        return matches[1].length;
	},
	_matchArgumentsPartial: function(actions, regexpArgStrings) {
        //progressively shorten the actions list by slicing off the
        //final actions until we find a match
        var result = [];
        for(var i = actions.length;i > 0; i--) {
            var actionSlice = actions.slice(0, i);

        	var pattern = actionSlice.map(function(action) {	
        		return this._getRegexpNargs(action);
        	}.bind(this)).join('');

            var matches = regexpArgStrings.match(pattern);
            if(matches && matches.length > 0) {     
            	
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
        if($defined(this._optionStringActions[argString])) {
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
            this.error($stringPrint(_('Ambiguous option: "%argument%" could match %values%.'), {argument: argString, values: optionStrings.join(', ')}));

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
	            this.error($stringPrint(_('Unexpected option string: %argument%.'), {argument : optionString}));
	        }

	        //return the collected option tuples
	        return result;
		},
	    _getRegexpNargs: function(action) {
	        //in all examples below, we have to allow for '--' args
	        //which are represented as '-' in the pattern
	        var regexpNargs;
	       
	        switch(action.nargs) {
	        //the default (None) is assumed to be a single argument
	        case undefined:
	        	regexpNargs = '(-*A-*)';
	        	break;
	        //allow zero or more arguments
	        case OPTIONAL:
	        	regexpNargs = '(-*A?-*)';
	        	break;
	        //allow zero or more arguments
	        case ZERO_OR_MORE:
	        	regexpNargs = '(-*[A-]*)';
	        	break;
	        //allow one or more arguments
	        case ONE_OR_MORE:
	        	regexpNargs = '(-*A[A-]*)';
	        	break;
	        //allow any number of options or arguments
	        case REMAINDER:
	        	regexpNargs = '([-AO]*)';
	        	break;
	        //allow one argument followed by any number of options or arguments
	        case PARSER:
	        	regexpNargs = '(-*A[-AO]*)';
	        	break;
	        default:
	        	regexpNargs = '(-*' + 'A' + $stringRepeat('-*A', action.nargs - 1) + '-*)';
	        }

	        //if this is an optional action, -- is not allowed
	        if(action.isOptional()) {
	            regexpNargs = regexpNargs.replace('-*', '');
	            regexpNargs = regexpNargs.replace('-', '');
	        }

	        //return the pattern
	        return new RegExp(regexpNargs);
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
	            value = (action.isOptional()) ? action.constant : action.defaultValue;
	           
	            if(typeof(value) == 'string') {
	                value = this._getValue(action, value);
	                this._checkValue(action, value);
	            }

	        //when nargs='*' on a positional, if there were no command-line
	        //args, use the default if it is anything other than None
	        } else if (!argStrings && action.nargs == ZERO_OR_MORE && action.isPositional()) {
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
        if(!$isCallable(typeFunc)) {
            throw new ArgumentError(action, $stringPrint(_('%callback% is not callable'), {callback: typeFunc}));
        }
            	
        var result;
        //convert the value to the appropriate type
        try {

            return typeFunc(argString);

        //ArgumentTypeErrors indicate errors
	  	} catch(e) {
	  		//catch ArgumentTypeError:
	            /*name = action.type;
	            message = e.message;//TODO change this
	            throw new ArgumentError(action, message);*/

	        //TypeErrors or ValueErrors also indicate errors
	        //catch (TypeError, ValueError):
	            throw new ArgumentError(action, $stringPrint(_('Invalid %name% value: %value%'), {name: action.type, value: argString}));
	  	}
        //return the converted value
        return result;
	},
	_checkValue: function(action, value) {
        //converted value must be one of the choices (if specified)
        if($defined(action.choices) && action.choices.indexOf(value) < 0) {
            throw new ArgumentError(action, $stringPrint(_('Invalid choice: %value% (choose from [%choices%])', {value: value, choices: action.choices.join(', ')})));
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
        formatter.addUsage(this.usage, this._actions, this._actionGroupsMutex);
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
        formatter.addUsage(this.usage, this._actions, this._actionGroupsMutex);

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
		var formatterClass = eval(this.formatterClass);
	    var formatter =  new formatterClass({program: this.program});
	    return formatter;
	},
	
	/*********************************
	 * Print functions
	 *********************************/
	/**
	 * Print usage
	 */
	printUsage : function(/*file*/ file) {
	    this._printMessage(this.formatUsage(), file || process.stdout);
	    return this;
	},
	/**
	 * Print help
	 */
	printHelp : function(/*file*/ file) {
	    this._printMessage(this.formatHelp(), file || process.stdout);
	    return this;
	},    
	_printMessage : function(/*string*/ message, /*file*/ file) {
	    if (message) {
	        file = file || process.stdout;//TODO : replace to stderr
	        file.write('' + message);
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
		if($defined(message)) {
			this._printMessage(message, process.stderr);
		}
		var status = $value(status, 0);
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
		return this.exit(2, $stringPrint(_('%program%: error: %message%'), {program: this.program, message: message}) + EOL);
	}
});

/**
 * An error from creating or using an argument (optional or positional).
 * 
 * The string value of this exception is the message, augmented with
 * information about the argument that caused it.
 */
var ArgumentError =  function() {this.initialize.apply(this, arguments);};
ArgumentError.prototype = Error.prototype;
ArgumentError.prototype.initialize = function(argument, message) {
	if(argument.getName) {
		this.argumentName = argument.getName();
	} else {
		this.argumentName = '' + argument;
	}
    this.message = message;
};
ArgumentError.prototype.toString = function() {
    var format = !$defined(this.argumentName) ? '%message%' : 'argument %argumentName%: %message%';

    return $stringPrint(format, {
    	message:this.message, 
    	argumentName:this.argumentName
    });
};


exports.ArgumentParser = ArgumentParser;
exports.ArgumentError = ArgumentError;
exports.Action = Action;
exports.Namespace = Namespace;
exports.HelpFormatter = HelpFormatter;
exports.ArgumentDefaultsHelpFormatter = ArgumentDefaultsHelpFormatter;
exports.RawDescriptionHelpFormatter = RawDescriptionHelpFormatter;
exports.RawTextHelpFormatter = RawTextHelpFormatter;
