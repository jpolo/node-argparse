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
 * Return defaultValue if value is not set
 * 
 * @param value
 * @param defaultValue
 * @return
 */
var $value = function(value, defaultValue) {
	return ((typeof value == 'undefined') ? defaultValue : value);
};
var $identity = function(x) { return x; };

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

EOL = EOL;

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

/*def __repr__(self):
        type_name = type(self).__name__
        arg_strings = []
        for arg in self._get_args():
            arg_strings.append(repr(arg))
        for name, value in self._get_kwargs():
            arg_strings.append('%s=%r' % (name, value))
        return '%s(%s)' % (type_name, ', '.join(arg_strings))

    def _get_kwargs(self):
        return _sorted(self.__dict__.items())*/

/**
 * Formatting Help
 */
/**
 * Formatter for generating usage messages and argument help strings.
 * 
 * Only the name of this class is considered a public API. All the methods
 * provided by the class are considered an implementation detail.
 */
var HelpFormatter = function(options) {
	this.initialize.apply(this, arguments);
};

HelpFormatter.prototype = {
	initialize: function(options) {
		options = options || {};
	
		this.program = $value(options['program']);
	
		this.indentation = $value(options['indentation'], 2);
		this.indentationCurrent = 0;
		this.indentationLevel = 0;
		
		this.helpPositionMax = $value(options['helpPositionMax'], 24);
		this.width = $value(options['width'], $(process.env['COLUMNS'], 80) - 2);
	
		this.actionLengthMax = 0;
	
		this.sectionRoot = this._Section(this, null);
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
	addUsage: function(usage, actions, groups, prefix) {
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
	_formatUsage: function(usage, actions, groups, prefix) {
        var prefix = $value(prefix, _('usage: '));

        //if usage is specified, use that
        if(usage) {
        	usage = usage % dict(program=this.program);//TODO change this pythonic syntax
        	
        //if no optionals or positionals are available, usage is just prog
		} else if(!usage && !actions) {
            usage = '' + this.program;//TODO check equivalent to '%(program)s' % dict(program=this.program)

        //if optionals and positionals are available, calculate usage
		} else if(!usage) {
            var program = '' + this.program;//TODO check equivalent to '%(program)s' % dict(program=this.program)

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
	_formatText: function(text) {
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
            tup = actionWidth, actionHeader;
            actionHeader = $stringRepeat(' ', this.indentationCurrent) + '%-*s  ' % tup; //TODO remove this syntax
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
        } else if(!actionHeader.endswith(EOL)) {//TODO: implement endswith()
            parts.push(EOL);
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
	_metavarFormatter: function(action, metavarDefault) {
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
    _formatArgs: function(action, metavarDefault) {
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
    /*_expandHelp: function(action) {
        params = dict(vars(action), program=this.program)
        for name in list(params):
            if params[name] is SUPPRESS:
                del params[name]
        for name in list(params):
            if hasattr(params[name], '__name__'):
                params[name] = params[name].__name__
        if params.get('choices') is not None:
            choices_str = ', '.join([str(c) for c in params['choices']])
            params['choices'] = choices_str
        return this._get_help_string(action) % params
	},*/
    _iterIndentedSubactions: function(action) {
		if(action._getSubactions) {
			this._indent();
			action._getSubactions().forEach(function(subaction) {
				yield subaction;//TODO python syntax
			});
            this._dedent();
		}
	},
    _splitLines: function(text, width) {
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
    _fillText: function (text, width, indent) {
		var lines = this._splitLines(text, width);
		lines.forEach(function(line) {
			line = indent + line;
		});
		return lines.join(EOL);
	}
    /*_getHelpString: function(action) {
        return action.help;
	}*/
};
	/*

    class _Section(object):

        def __init__(self, formatter, parent, heading=None):
            this.formatter = formatter
            this.parent = parent
            this.heading = heading
            this.items = []

        def format_help(self):
            # format the indented section
            if this.parent is not None:
                this.formatter._indent()
            join = this.formatter._join_parts
            for func, args in this.items:
                func(*args)
            item_help = join([func(*args) for func, args in this.items])
            if this.parent is not None:
                this.formatter._dedent()

            # return nothing if the section was empty
            if not item_help:
                return ''

            # add the heading if the section was non-empty
            if this.heading is not SUPPRESS and this.heading is not None:
                current_indent = this.formatter.indentationCurrent
                heading = '%*s%s:\n' % (current_indent, '', this.heading)
            else:
                heading = ''

            # join the section-initial newline, the heading and the help
            return join([EOL, heading, item_help, EOL])

class RawDescriptionHelpFormatter(HelpFormatter):
    """Help message formatter which retains any formatting in descriptions.

    Only the name of this class is considered a public API. All the methods
    provided by the class are considered an implementation detail.
    """

    def _fill_text(self, text, width, indent):
        return ''.join([indent + line for line in text.splitlines(True)])


class RawTextHelpFormatter(RawDescriptionHelpFormatter):
    """Help message formatter which retains formatting of all help text.

    Only the name of this class is considered a public API. All the methods
    provided by the class are considered an implementation detail.
    """

    def _split_lines(self, text, width):
        return text.splitlines()


class ArgumentDefaultsHelpFormatter(HelpFormatter):
    """Help message formatter which adds default values to argument help.

    Only the name of this class is considered a public API. All the methods
    provided by the class are considered an implementation detail.
    """

    def _get_help_string(self, action):
        help = action.help
        if '%(default)' not in action.help:
            if action.default is not SUPPRESS:
                defaulting_nargs = [OPTIONAL, ZERO_OR_MORE]
                if action.option_strings or action.nargs in defaulting_nargs:
                    help += ' (default: %(default)s)'
        return help


*/


/**
 * ArgumentParser declaration
 */
var ArgumentParser = function(options) {
	this.initialize.apply(this, arguments);
};
ArgumentParser.prototype = {
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
	    if (action.option_strings) {
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
		var formatterClass = this.formatterClass;
		var options = {/*program: this.program */};
	    return formatterClass(options);
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
};



exports.ArgumentParser = ArgumentParser;
exports.HelpFormatter = HelpFormatter;
