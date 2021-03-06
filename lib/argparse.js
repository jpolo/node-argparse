/*jslint nodejs:true, indent:4 */
/**
 * Object for parsing command line strings into Javascript objects.
 *
 * Keyword Arguments:
 * <ul>
 * <li>program -- The name of the program (default:process.argv[0])</li>
 * <li>usage -- A usage message (default: auto-generated from arguments)</li>
 * <li>description -- A description of what the program does</li>
 * <li>epilog -- Text following the argument descriptions</li>
 * <li>parents -- Parsers whose arguments should be copied into this one</li>
 * <li>formatterClass -- HelpFormatter class for printing help messages</li>
 * <li>prefixChars -- Characters that prefix optional arguments</li>
 * <li>prefixCharsFile -- Characters that prefix files containing additional arguments</li>
 * <li>argumentDefault -- The default value for all arguments</li>
 * <li>conflictHandler -- String indicating how to handle conflicts</li>
 * <li>addHelp -- Add a -h/-help option</li>
 * </ul>
 */

/**
 * Imports
 */
var util = require(process.binding('natives').util ? 'util': 'sys');
var fs = require('fs');

/**
 * Utils methods
 */
var $isCallable = function (c) {
    if (!c) {
        return false;
    }
    if (c instanceof Function || c.call !== undefined) {
        return true;
    }

    try {
        c.__call = c.__call;
        return false;
    } catch (e) {
        return true;
    }
};

var $stringRepeat = function (string, count) {
    return count < 1 ? '': new Array(count + 1).join(string);
};

var $stringLStrip = function (string, chars) {
    chars = chars || "\\s";
    return string.replace(new RegExp("^[" + chars + "]+", "g"), "");
};

var $stringRStrip = function (string, chars) {
    chars = chars || "\\s";
    return string.replace(new RegExp("[" + chars + "]+$", "g"), "");
};

var $stringStrip = function (string, chars) {
    return $stringLStrip($stringRStrip(string, chars), chars);
};

var $stringPrint = function (string, obj) {
    var tag = '%',
        result = string.substring(),
        property;
    obj = obj || {};
    for (property in obj) {
        if (obj.hasOwnProperty(property)) {
            result = result.replace(tag + property + tag, '' + obj[property]);
        }
    }
    return result;
};

var _ = function (string) {
    return string;
};

var FUNCTION_IDENTITY = function (o) {
    return o;
};

/**
 * Constants
 */
/** @const */
var EOL = '\n';
/** @const */
var SUPPRESS = '==SUPPRESS==';
/** @const */
var OPTIONAL = '?';
/** @const */
var ZERO_OR_MORE = '*';
/** @const */
var ONE_OR_MORE = '+';
/** @const */
var PARSER = 'A...';
/** @const */
var REMAINDER = '...';


/**
 * An error from creating or using an argument (optional or positional). The
 * string value of this exception is the message, augmented with information
 * about the argument that caused it.
 */
function ArgumentError(argument, message) {
    Error.call(this, message);
    if (argument.getName) {
        this.argumentName = argument.getName();
    } else {
        this.argumentName = '' + argument;
    }
}
util.inherits(ArgumentError, Error);

ArgumentError.prototype.toString = function () {
    var format = this.argumentName === undefined ? '%message%': 'argument "%argumentName%": %message%';

    return $stringPrint(format, {
        message: this.message,
        argumentName: this.argumentName
    });
};

function SystemExit(code, message) {
    Error.call(this, message);
    this.code = code;
}
util.inherits(SystemExit, Error);

/**
 * Formatting Help
 */

/**
 * Internal Section class
 *
 * @constructor
 */
function HelpSection(formatter, parent, heading) {
    this.formatter = formatter;
    this.parent = parent;
    this.heading = heading;
    this.items = [];
}

HelpSection.prototype.addItem = function (callback) {
    this.items.push(callback);
    return this;
};

HelpSection.prototype.formatHelp = function () {
    var itemHelp, heading;

    // format the indented section
    if (this.parent) {
        this.formatter._indent();
    }

    itemHelp = this.items.map(function (item) {
        return item();
    });
    itemHelp = this.formatter._joinParts(itemHelp);

    if (this.parent) {
        this.formatter._dedent();
    }

    // return nothing if the section was empty
    if (!itemHelp) {
        return '';
    }

    // add the heading if the section was non-empty
    heading = (this.heading && this.heading !== SUPPRESS) ?
        $stringRepeat(' ', this.formatter.indentationCurrent) + this.heading + ':' + EOL :
        '';

    // join the section-initialize newline, the heading and the help
    return this.formatter._joinParts([EOL, heading, itemHelp, EOL]);
};

/**
 * Formatter for generating usage messages and argument help strings. Only the
 * name of this class is considered a public API. All the methods provided by
 * the class are considered an implementation detail.
 *
 * @constructor
 */
function HelpFormatter(options) {
    options = options || {};

    this.program = options.program;

    this.indentation = options.indentation || 2;
    this.indentationCurrent = 0;
    this.indentationLevel = 0;

    this.helpPositionMax = options.helpPositionMax || 24;
    this.width = (options.width || ((process.env.COLUMNS || 80) - 2));

    this.actionLengthMax = 0;

    this.sectionRoot = new HelpSection(this);
    this.sectionCurrent = this.sectionRoot;

    this._regexpWhitespace = new RegExp('\\s+');
    this._regexpLongBreak = new RegExp(EOL + EOL + EOL + '+');
}

HelpFormatter.prototype._indent = function () {
    this.indentationCurrent += this.indentation;
    this.indentationLevel += 1;
    return this;
};

HelpFormatter.prototype._dedent = function () {
    this.indentationCurrent -= this.indentation;
    this.indentationLevel -= 1;
    if (this.indentationCurrent < 0) {
        throw new Error('Indent decreased below 0.');
    }
    return this;
};

HelpFormatter.prototype._addItem = function (callback) {
    this.sectionCurrent.addItem(callback);
    return this;
};

/**
 * Message building methods
 */
HelpFormatter.prototype.startSection = function (/* string */ heading) {
    var self = this;
    this._indent();
    this.sectionCurrent = new HelpSection(this, this.sectionCurrent, heading);
    this._addItem(function () {
        return self._sectionCurrent.formatHelp();
    });
    return this;
};

HelpFormatter.prototype.endSection = function () {
    this.sectionCurrent = this.sectionCurrent.parent;
    this._dedent();
    return this;
};

HelpFormatter.prototype.addText = function (/* string */ text) {
    var self = this;
    if (text && text !== SUPPRESS) {
        this._addItem(function () {
            return self._formatText(text);
        });
    }
    return this;
};

HelpFormatter.prototype.addUsage = function (/* string */ usage, actions, groups, /* string */ prefix) {
    if (usage !== SUPPRESS) {
        var self = this;
        this._addItem(function () {
            return self._formatUsage(usage, actions, groups, prefix);
        });
    }
    return this;
};

HelpFormatter.prototype.addArgument = function (action) {
    if (action.help !== SUPPRESS) {

        // find all invocations
        var self = this,
            invocations = [this._formatActionInvocation(action)],
            invocationLength = invocations[0].length,
            actionLength;

        if (action._getSubactions !== undefined) {
            this._indent();
            action._getSubactions().forEach(function (subaction) {

                var invocationNew = this._formatActionInvocation(subaction);
                invocations.push(invocationNew);
                invocationLength = Math.max(invocationLength, invocationNew.length);

            });
            this._dedent();
        }

        // update the maximum item length
        actionLength = invocationLength + this.indentationCurrent;
        this.actionLengthMax = Math.max(this.actionLengthMax, actionLength);

        // add the item to the list
        this._addItem(function () {
            return self._formatAction(action);
        });
    }
    return this;
};

HelpFormatter.prototype.addArguments = function (/* array */ actions) {
    actions.forEach(function (action) {
        this.addArgument(action);
    }.bind(this));
    return this;
};

/**
 * Help-formatting methods
 */
HelpFormatter.prototype.formatHelp = function () {
    var help = this.sectionRoot.formatHelp();
    if (help) {
        help = help.replace(this._regexpLongBreak, EOL + EOL);
        help = $stringStrip(help, EOL) + EOL;
    }
    return help;
};

HelpFormatter.prototype._joinParts = function (partStrings) {
    return partStrings.filter(function (part) {
        return (part && part !== SUPPRESS);
    }).join('');
};

HelpFormatter.prototype._formatUsage = function (/* string */ usage, actions, groups, /* string */ prefix) {
    prefix = prefix || _('usage: ');
    actions = actions || [];
    groups = groups || [];



    // if usage is specified, use that
    if (usage) {
        usage = $stringPrint(usage, {program: this.program});

        // if no optionals or positionals are available, usage is just prog
    } else if (!usage && actions.length === 0) {
        usage = '' + (this.program || '');

        // if optionals and positionals are available, calculate usage
    } else if (!usage) {
        var program = '' + (this.program || ''),
            optionals = [],
            positionals = [],
            actionUsage,
            usageString = '',
            textWidth;

        // split optionals from positionals
        actions.forEach(function (action) {
            if (action.isOptional()) {
                optionals.push(action);
            } else {
                positionals.push(action);
            }
        });

        // build full usage string
        actionUsage = this._formatActionsUsage([].concat(optionals, positionals), groups);
        usageString = '';
        if (program) {
            usageString += program + ' ';
        }
        if (actionUsage) {
            usageString += actionUsage;
        }
        usage = usageString;

        // wrap the usage parts if it's too long
        textWidth = this.width - this.indentationCurrent;
        if ((prefix.length + usage.length) > textWidth) {

            // break usage into wrappable parts
            var regexpPart = new RegExp('\\(.*?\\)+|\\[.*?\\]+|\\S+'),
                optionalUsage = this._formatActionsUsage(optionals, groups),
                positionalUsage = this._formatActionsUsage(positionals, groups),
                optionalParts = optionalUsage.match(regexpPart),
                positionalParts = positionalUsage.match(regexpPart);
            // assert.equal(optionalParts.join(' '), optionalUsage);
            // assert.equal(positionalParts.join(' '), positionalUsage);

            // helper for wrapping lines
            var __getLines = function (parts, indent, prefix) {
                var lines = [],
                    line = [],
                    lineLength = prefix ? prefix.length - 1: indent.length - 1;

                parts.forEach(function (part) {
                    if (lineLength + 1 + part.length > textWidth) {
                        lines.push(indent + line.join(' '));
                        line = [];
                        lineLength = indent.length - 1;
                    }
                    line.push(part);
                    lineLength += part.length + 1;
                });

                if (line) {
                    lines.push(indent + line.join(' '));
                }
                if (prefix) {
                    lines[0] = lines[0].substr(indent.length);
                }
                return lines;
            };

            var lines, indent, parts;
            // if prog is short, follow it with optionals or positionals
            if (prefix.length + program.length <= 0.75 * textWidth) {
                indent = $stringRepeat(' ', (prefix.length + program.length + 1));
                if (optionalParts) {
                    lines = [].concat(
                            __getLines([program].concat(optionalParts), indent, prefix),
                            __getLines(positionalParts, indent)
                    );
                } else if (positionalParts) {
                    lines = __getLines([program].concat(positionalParts), indent, prefix);
                } else {
                    lines = [program];
                }

            // if prog is long, put it on its own line
            } else {
                indent = $stringRepeat(' ', prefix.length);
                parts = optionalParts + positionalParts;
                lines = __getLines(parts, indent);
                if (lines.length > 1) {
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
};

HelpFormatter.prototype._formatActionsUsage = function (actions, groups) {
    // find group indices and identify actions in groups
    var groupActions = [];
    var inserts = [];

    groups.forEach(function (group) {
        var start = actions.indexOf(group._groupActions[0]),
            end, i;
        if (start >= 0) {
            end = start + group._groupActions.length;

            if (actions.slice(start, end) === group._groupActions) {
                group._groupActions.forEach(function (action) {
                    groupActions.add(action);
                });

                if (!group.required) {
                    inserts[start] = '[';
                    inserts[end] = ']';
                } else {
                    inserts[start] = '(';
                    inserts[end] = ')';
                }
                for (i = start + 1; i < end; i += 1) {
                    inserts[i] = '|';
                }
            }
        }
    });

    // collect all actions format strings
    var parts = [];
    actions.forEach(function (action, actionIndex) {
        var part,
            optionString,
            argsDefault,
            argsString;

        // suppressed arguments are marked with None
        // remove | separators for suppressed arguments
        if (action.help === SUPPRESS) {
            parts.push(null);
            if (inserts[actionIndex] === '|') {
                inserts.splice(actionIndex);
            } else if (inserts[actionIndex + 1] === '|') {
                inserts.splice(actionIndex + 1);
            }

            // produce all arg strings
        } else if (action.isPositional()) {
            part = this._formatArgs(action, action.destination);

            // if it's in a group, strip the outer []
            if (groupActions.indexOf(action) >= 0) {
                if (part[0] === '[' && part[part.length - 1] === ']') {
                    part = part.slice(1, -1);
                }
            }
            // add the action string to the list
            parts.push(part);

            // produce the first way to invoke the option in brackets
        } else {
            optionString = action.optionStrings[0];

            // if the Optional doesn't take a value, format is: -s or --long
            if (action.nargs === 0) {
                part = '' + optionString;

            // if the Optional takes a value, format is: -s ARGS or --long ARGS
            } else {
                argsDefault = action.destination.toUpperCase();
                argsString = this._formatArgs(action, argsDefault);
                part = optionString + ' ' + argsString;
            }
            // make it look optional if it's not required or in a group
            if (!action.required && groupActions.indexOf(action) < 0) {
                part = '[' + part + ']';
            }
            // add the action string to the list
            parts.push(part);
        }
    }.bind(this));

    // insert things at the necessary indices
    inserts.reverse().forEach(function (insert, insertIndex) {
        parts = parts.slice(0, insertIndex).concat([insert], parts.slice(insertIndex + 1, parts.length - 1));
    });

    // join all the action items with spaces
    var text = parts.filter(
        function (part) {
            if (part) {
                return true;
            }
            return false;
        }
    ).join(' ');

    // clean up separators for mutually exclusive groups
    var regexpOpen = '[\\[(]';
    var regexpClose = '[\\])]';
    text = text.replace('(' + regexpOpen + ') ', '\\1');
    text = text.replace(' (' + regexpClose + ')', '\\1');
    text = text.replace(regexpOpen + ' *' + regexpClose, '');
    text = text.replace('\\(([^|]*)\\)', '\\1');
    text = $stringStrip(text);

    // return the text
    return text;
};

HelpFormatter.prototype._formatText = function (/* string */ text) {
    text = $stringPrint(text, {program:  this.program});
    var textWidth = this.width - this.indentationCurrent;
    var indentation = $stringRepeat(' ', this.indentationCurrent);
    return this._fillText(text, textWidth, indentation) + EOL + EOL;
};

HelpFormatter.prototype._formatAction = function (action) {
    // determine the required width and the entry label
    var helpPosition = Math.min(this.actionLengthMax + 2, this.helpPositionMax),
        helpWidth = this.width - helpPosition,
        helpText,
        helpLines,
        actionWidth = helpPosition - this.indentationCurrent - 2,
        actionHeader = this._formatActionInvocation(action),
        parts,
        indentFirst;

    // no help; start on same line and add a final newline
    if (!action.help) {
        actionHeader = $stringRepeat(' ', this.indentationCurrent) + actionHeader + EOL;

    // short action name; start on the same line and pad two spaces
    } else if (actionHeader.length <= actionWidth) {
        actionHeader = $stringRepeat(' ', this.indentationCurrent) + '-' + actionHeader + '  ';
        indentFirst = 0;

    // long action name; start on the next line
    } else {
        actionHeader = $stringRepeat(' ', this.indentationCurrent) + actionHeader + EOL;
        indentFirst = helpPosition;
    }
    // collect the pieces of the action help
    parts = [actionHeader];

    // if there was help for the action, add lines of help text
    if (action.help) {
        helpText = this._expandHelp(action);
        helpLines = this._splitLines(helpText, helpWidth);
        parts.push($stringRepeat(' ', indentFirst) + helpLines[0] + EOL);
        helpLines.slice(1).forEach(function (line) {
            parts.push($stringRepeat(' ', helpPosition) + line + EOL);
        });

        // or add a newline if the description doesn't end with one
    } else {
        var diff = this.length - EOL.length;
        if (!(diff >= 0 && this.indexOf(EOL, diff) === diff)) {
            parts.push(EOL);
        }
    }
    // if there are any sub-actions, add their help as well
    if (action._getSubactions !== undefined) {
        this._indent();
        action._getSubactions().forEach(function (subaction) {
            parts.push(this._formatAction(subaction));
        });
        this._dedent();
    }

    // return a single string
    return this._joinParts(parts);
};

HelpFormatter.prototype._formatActionInvocation = function (action) {
    if (action.isPositional()) {
        return this._metavarFormatter(action, action.destination)(1);
    } else {
        var parts = [],
            argsDefault,
            argsString;

        // if the Optional doesn't take a value, format is: -s, --long
        if (action.nargs === 0) {
            parts = parts.concat(action.optionStrings);

            // if the Optional takes a value, format is: -s ARGS, --long ARGS
        } else {
            argsDefault = action.destination.toUpperCase();
            argsString = this._formatArgs(action, argsDefault);
            action.optionStrings.forEach(function (optionString) {
                parts.push(optionString + ' ' + argsString);
            });
        }
        return parts.join(', ');
    }
};

HelpFormatter.prototype._metavarFormatter = function (action, /* string */ metavarDefault) {
    var result,
        format;

    if (action.metavar) {
        result = action.metavar;
    } else if (action.choices) {
        result = '{' + action.choices.join(',') + '}';
    } else {
        result = metavarDefault;
    }
    return function (size) {
        if (Array.isArray(result)) {
            return result;
        } else {
            var metavars = [];
            for (var i = 0; i < size; i += 1) {
                metavars.push(result);
            }
            return metavars;
        }
    };
};

HelpFormatter.prototype._formatArgs = function (action, /* string */ metavarDefault) {
    var buildMetavar = this._metavarFormatter(action, metavarDefault),
        result,
        metavars;

    if (!action.nargs) {
        metavars = buildMetavar(1);
        result = '' + metavars[0];
    } else if (action.nargs === OPTIONAL) {
        metavars = buildMetavar(1);
        result = '[' + metavars[0] + ']';
    } else if (action.nargs === ZERO_OR_MORE) {
        metavars = buildMetavar(2);
        result = '[' + metavars[0] + '[' + metavars[1] + ' ...]]';
    } else if (action.nargs === ONE_OR_MORE) {
        metavars = buildMetavar(2);
        result = '' + metavars[0] + '[' + metavars[1] + ' ...]';
    } else if (action.nargs === REMAINDER) {
        result = '...';
    } else if (action.nargs === PARSER) {
        metavars = buildMetavar(1);
        result = metavars[0] + ' ...';
    } else {
        metavars = buildMetavar(action.nargs);
        result = metavars.join(' ');
    }
    return result;
};

HelpFormatter.prototype._expandHelp = function (action) {
    var params = {},
        actionProperty,
        actionValue;
    params.program = this.program;

    for (actionProperty in action) {
        if (action.hasOwnProperty(actionProperty)) {
            actionValue = params[actionProperty];

            if (actionValue !== SUPPRESS) {
                params[actionProperty] = actionValue;
            }
        }
    }

    if (params.choices) {
        params.choices = params.choices.join(', ');
    }

    /*
     * for name in list(params): if hasattr(params[name], '__name__'):
     * params[name] = params[name].__name__
     */

    return $stringPrint(this._getHelpString(action), params);
};

HelpFormatter.prototype._splitLines = function (/* string */ text, /* int */ width) {
    var lines = [],
        wrapped;

    text = text.replace(this._regexpWhitespace, ' ');
    text = $stringStrip(text);
    text.split(EOL).forEach(function (line) {
        var wrapStart = 0;
        var wrapEnd = width;
        while (wrapStart < line.length) {
            wrapped = line.split(wrapStart, wrapEnd);
            lines.push(wrapped);
            wrapStart += width;
            wrapEnd += width;
        }
    });

    return lines;
};

HelpFormatter.prototype._fillText = function (/* string */ text, /* int */ width, /* string */ indent) {
    var lines = this._splitLines(text, width);
    lines.forEach(function (line) {
        line = indent + line;
    });
    return lines.join(EOL);
};

HelpFormatter.prototype._getHelpString = function (action) {
    return action.help;
};

/**
 * Help message formatter which retains any formatting in descriptions. Only the
 * name of this class is considered a public API. All the methods provided by
 * the class are considered an implementation detail.
 *
 * @constructor
 * @extends HelpFormatter
 */
function HelpFormatterRawDescription(options) {
    HelpFormatter.call(this, options);
}
util.inherits(HelpFormatterRawDescription, HelpFormatter);

HelpFormatterRawDescription.prototype._fillText = function (text, width, indent) {
    var lines = text.split(EOL);
    lines.forEach(function (line) {
        line = indent + line;
    });
    return lines.join(EOL);
};

/**
 * Help message formatter which retains formatting of all help text. Only the
 * name of this class is considered a public API. All the methods provided by
 * the class are considered an implementation detail.
 *
 * @constructor
 * @extends HelpFormatterRawDescription
 */
function HelpFormatterRawText(options) {
    HelpFormatterRawDescription.call(this, options);
}
util.inherits(HelpFormatterRawText, HelpFormatterRawDescription);

HelpFormatterRawText.prototype._splitLines = function (text, width) {
    return text.split(EOL);
};

/**
 * Help message formatter which adds default values to argument help. Only the
 * name of this class is considered a public API. All the methods provided by
 * the class are considered an implementation detail.
 *
 * @constructor
 * @extends HelpFormatter
 */
function HelpFormatterArgumentDefaults(options) {
    HelpFormatter.call(this, options);
}
util.inherits(HelpFormatterArgumentDefaults, HelpFormatter);

HelpFormatterArgumentDefaults.prototype._getHelpString = function (action) {
    var help = action.help;
    if (action.help.indexOf('%(default)') < 0) {
        if (action.defaultValue !== SUPPRESS) {
            if (action.isOptional() || [OPTIONAL, ZERO_OR_MORE].indexOf(action.nargs) < 0) {
                help += ' (default: %(default)s)';
            }
        }
    }
    return help;
};


/*******************************************************************************
 * Actions classes
 ******************************************************************************/
/**
 * Information about how to convert command line strings to Javascript objects.
 * Action objects are used by an ArgumentParser to represent the information
 * needed to parse a single argument from one or more strings from the command
 * line. The keyword arguments to the Action constructor are also all attributes
 * of Action instances.
 *
 * Keyword Arguments:
 * <ul>
 * <li>optionStrings -- A list of command-line option strings for the action.</li>
 * <li>destination -- Attribute to hold the created object(s)</li>
 * <li>nargs -- The number of command-line arguments that should be consumed.
 * By default, one argument will be consumed and a single value will be
 * produced. Other values include:
 * <ul>- N (an integer) consumes N arguments (and produces a list) - '?'
 * consumes zero or one arguments - '*' consumes zero or more arguments (and
 * produces a list) - '+' consumes one or more arguments (and produces a list)
 * Note that the difference between the default and nargs=1 is that with the
 * default, a single value will be produced, while with nargs=1, a list
 * containing a single value will be produced.</li>
 * </ul>
 * <li>constant -- Default value for an action with no value.</li>
 * <li>defaultValue -- The value to be produced if the option is not specified.</li>
 * <li>type -- Cast to 'string'|'int'|'float'|'complex'|function (string). If
 * None, 'string'.</li>
 * <li>choices -- The choices available.</li>
 * <li>required -- True if the action must always be specified at the command
 * line.</li>
 * <li>help -- The help describing the argument.</li>
 * <li>metavar -- The name to be used for the option's argument with the help
 * string. If None, the 'destination' value will be used as the name.</li>
 * </ul>
 *
 * @constructor
 * @param {object} options
 */
function Action(options) {
    options = options || {};
    this.optionStrings = options.optionStrings || [];
    this.destination = options.destination;
    this.nargs = options.nargs;
    this.constant = options.constant;
    this.defaultValue = options.defaultValue;
    this.type = options.type ||  null;
    this.choices = options.choices;
    this.required = options.required !== undefined ? options.required: false;
    this.help = options.help;
    this.metavar = options.metavar;

    if (!(this.optionStrings instanceof Array)) {
        throw new Error('optionStrings should be an array');
    }
    if (this.required !== undefined && typeof(this.required) !== 'boolean') {
        throw new Error('required should be a boolean');
    }
    if (this.nargs !== undefined && typeof(this.nargs) !== 'number') {
        throw new Error('nargs should be a number');
    }
}

/**
 * Return the name
 *
 * @return {string}
 */
Action.prototype.getName = function () {
    if (this.optionStrings.length > 0) {
        return this.optionStrings.join('/');
    } else if (this.metavar !== undefined && this.metavar !== SUPPRESS) {
        return this.metavar;
    } else if (this.destination !== undefined && this.destination !== SUPPRESS) {
        return this.destination;
    }
    return null;
};

/**
 * Return true if optional
 *
 * @return {boolean}
 */
Action.prototype.isOptional = function () {
    return !this.isPositional();
};

/**
 * Return true if positional
 *
 * @return {boolean}
 */
Action.prototype.isPositional = function () {
    return (this.optionStrings.length === 0);
};

/**
 * Call the action
 *
 * @param {ArgumentParser} parser
 * @param {Namespace} namespace
 * @param {Array} values
 * @param {Array} optionString
 * @return
 */
Action.prototype.call = function (parser, namespace, values, optionString) {
    throw new Error(_('.call() not defined'));// Not Implemented error
};

/**
 * ActionStore constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionStore(options) {
    options = options || {};
    Action.call(this, options);
    if (this.nargs <= 0) {
        throw new Error('nargs for store actions must be > 0; if you ' +
                'have nothing to store, actions such as store ' +
                'true or store const may be more appropriate');// ValueError

    }
    if (this.constant !== undefined && this.nargs !== OPTIONAL) {
        throw new Error('nargs must be OPTIONAL to supply const');// ValueError
    }
}
util.inherits(ActionStore, Action);

ActionStore.prototype.call = function (parser, namespace, values, optionString) {
    namespace.set(this.destination, values);
};


/**
 * ActionStoreConstant constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionStoreConstant(options) {
    options = options || {};
    options.nargs = 0;
    Action.call(this, options);
}
util.inherits(ActionStoreConstant, Action);

ActionStoreConstant.prototype.call = function (parser, namespace, values, optionString) {
    namespace.set(this.destination, this.constant);
};


/**
 * ActionStoreTrue constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionStoreTrue(options) {
    options = options || {};
    options.constant = true;
    options.defaultValue = options.defaultValue !== undefined ?  options.defaultValue: false;
    ActionStoreConstant.call(this, options);
}
util.inherits(ActionStoreTrue, ActionStoreConstant);

/**
 * ActionStoreFalse constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionStoreFalse(options) {
    options = options || {};
    options.constant = false;
    options.defaultValue = options.defaultValue !== undefined ?  options.defaultValue: true;
    ActionStoreConstant.call(this, options);
}
util.inherits(ActionStoreFalse, ActionStoreConstant);


/**
 * ActionAppend constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionAppend(options) {
    options = options || {};
    Action.call(this, options);
    if (this.nargs <= 0) {
        throw new Error('nargs for append actions must be > 0; if arg ' +
                'strings are not supplying the value to append, ' +
                'the append const action may be more appropriate');// ValueError
    }
    if (this.constant !== undefined && this.nargs !== OPTIONAL) {
        throw new Error('nargs must be OPTIONAL to supply const');// ValueError
    }
}
util.inherits(ActionAppend, Action);

ActionAppend.prototype.call = function (parser, namespace, values, optionString) {
    var items = [].concat(namespace[this.destination] || [], values);
    namespace.set(this.destination, items);
};


/**
 * ActionAppendConstant constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionAppendConstant(options) {
    options = options || {};
    options.nargs = 0;
    Action.call(this, options);
}
util.inherits(ActionAppendConstant, Action);

ActionAppendConstant.prototype.call = function (parser, namespace, values, optionString) {
    var items = [].concat(namespace[this.destination] || []);
    items.push(this.constant);
    namespace.set(this.destination, items);
};


/**
 * ActionCount constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionCount(options) {
    Action.call(this, options);
}
util.inherits(ActionCount, Action);

ActionCount.prototype.call = function (parser, namespace, values, optionString) {
    namespace.set(this.destination, (namespace[this.destination] || 0) + 1);
};


/**
 * ActionHelp constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionHelp(options) {
    options = options || {};
    options.defaulValue = (options.defaultValue !== undefined ? options.defaultValue: SUPPRESS);
    options.destination = (options.destination !== undefined ? options.destination: SUPPRESS);
    options.nargs = 0;
    Action.call(this, options);
}
util.inherits(ActionHelp, Action);

ActionHelp.prototype.call = function (parser, namespace, values, optionString) {
    parser.printHelp();
    parser.exit();
};


/**
 * ActionVersion constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionVersion(options) {
    options = options || {};
    options.defaultValue = (options.defaultValue !== undefined ? options.defaultValue: SUPPRESS);
    options.destination = (options.destination || SUPPRESS);
    options.nargs = 0;
    Action.call(this, options);
    this.version = options.version;
}
util.inherits(ActionVersion, Action);

ActionVersion.prototype.call = function (parser, namespace, values, optionString) {
    var version = this.version || parser.version;
    var formatter = parser._getFormatter();
    formatter.addText(version);
    parser.exit(0, formatter.formatHelp());
};


/**
 * SubparserAction constructor
 *
 * @constructor
 * @extends Action
 * @param {object} options
 */
function ActionSubparser(options) {
    options = options || {};
    options.destination = options.destination || SUPPRESS;
    options.nargs = PARSER;

    this._programPrefix = options.program;
    this._parserClass = options.parserClass;
    this._nameParserMap = {};
    this._choicesActions = [];

    options.choices = this._nameParserMap;
    Action.call(this, options);
}
util.inherits(ActionSubparser, Action);

ActionSubparser.prototype.addParser = function (name, options) {
    var parser, help, choiceAction;

    // set program from the existing prefix
    if (options.program === undefined) {
        options.program = this._programPrefix + ' ' + name;
    }

    // create a pseudo-action to hold the choice help
    if (options.help !== undefined) {
        help = options.help;
        delete options.help;

        choiceAction = this._ChoicesPseudoAction(name, help);
        this._choicesActions.push(choiceAction);
    }

    // create the parser and add it to the map
    parser = new this._parserClass(options);
    this._nameParserMap[name] = parser;
    return parser;
};

ActionSubparser.prototype._getSubactions = function () {
    return this._choicesActions;
};

ActionSubparser.prototype.call = function (parser, namespace, values, optionString) {
    var parserName = values[0];
    var argStrings = values.slice(1);

    // set the parser name if requested
    if (this.destination !== SUPPRESS) {
        namespace[this.destination] = parserName;
    }

    // select the parser
    if (this._nameParserMap[parserName] !== undefined) {
        parser = this._nameParserMap[parserName];
    } else {
        var message = $stringPrint(
            _('Unknown parser "%name%" (choices: [%choices%]).', {
                name: parserName,
                choices: this._nameParserMap.join(', ')
            })
        );
        throw new ArgumentError(this, message);
    }

    // parse all the remaining options into the namespace
    parser.parseArgs(argStrings, namespace);
};


/*
 * class _ChoicesPseudoAction(Action):
 *
 * def __init__(this, name, help): sup =
 * super(ActionSubparser._ChoicesPseudoAction, this)
 * sup.__init__(optionStrings=[], dest=name, help=help)
 */

/**
 * Simple object for storing attributes. Implements equality by attribute names
 * and values, and provides a simple string representation.
 *
 * @constructor
 * @param {object} options
 */
function Namespace(options) {
    options = options || {};
    for (var key in options) {
        if (options.hasOwnProperty(key)) {
            this[key] = options[key];
        }
    }
}

/**
 * Return true if this[key] is set
 *
 * @param {string|number} key
 * @return {boolean}
 */
Namespace.prototype.isset = function (key) {
    return this[key] !== undefined;
};

/**
 * Set the property named key with value
 *
 * @param {string|number|object} key
 * @param value
 * @return this
 */
Namespace.prototype.set = function (key, value) {
    if (typeof (key) === 'object') {
        for (var property in key) {
            if (key.hasOwnProperty(property)) {
                this[property] = key[property];
            }
        }
    } else {
        if (value !== undefined) {
            this[key] = value;
        } else {
            delete this[key];
        }
    }
    return this;
};

/**
 * Return the property key or defaulValue if not set
 *
 * @param {string|number|object} key
 * @param defaultValue
 * @return
 */
Namespace.prototype.get = function (key, defaultValue) {
    var value = this[key];
    return value === undefined ? defaultValue: value;
};

/**
 * Return data[key] or defaultValue (and delete it)
 *
 * @param key
 * @param defaultValue
 * @return
 */
Namespace.prototype.unset = function (key, defaultValue) {
    var value = this[key];
    if (value !== undefined) {
        delete this[key];
        return value;
    } else {
        return defaultValue;
    }
};

/**
 * Return Array containing all keys
 *
 * @return Array
 */
Namespace.prototype.keys = function () {
    var keys = [];
    for (var key in this) {
        if (this.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys;
};

/**
 * Return Array containing all values
 *
 * @return Array
 */
Namespace.prototype.values = function () {
    var values = [];
    for (var key in this) {
        if (this.hasOwnProperty(key)) {
            values.push(this[key]);
        }
    }
    return values;
};

/**
 * ActionContainer class
 *
 * @constructor
 * @param {object} options
 * @return
 */
function ActionContainer(options) {
    options = options || {};

    this.description = options.description;
    this.argumentDefault = options.argumentDefault;
    this.prefixChars = options.prefixChars || '';
    this.conflictHandler = options.conflictHandler || 'error';

    // set up registries
    this._registries = {};

    // register actions
    this.register('action', null, ActionStore);
    this.register('action', 'store', ActionStore);
    this.register('action', 'storeConstant', ActionStoreConstant);
    this.register('action', 'storeTrue', ActionStoreTrue);
    this.register('action', 'storeFalse', ActionStoreFalse);
    this.register('action', 'append', ActionAppend);
    this.register('action', 'appendConstant', ActionAppendConstant);
    this.register('action', 'count', ActionCount);
    this.register('action', 'help', ActionHelp);
    this.register('action', 'version', ActionVersion);
    this.register('action', 'parsers', ActionSubparser);

    // throw an exception if the conflict handler is invalid
    this._getHandler();

    // action storage
    this._actions = [];
    this._optionStringActions = {};

    // groups
    this._actionGroups = [];
    this._actionGroupsMutex = [];

    // defaults storage
    this._defaults = {};

    // determines whether an "option" looks like a negative number
    this._regexpNegativeNumber = new RegExp('^-\\d+$|^-\\d*\\.\\d+$');

    // whether or not there are any optionals that look like negative
    // numbers -- uses a list so it can be shared and edited
    this._hasNegativeNumberOptionals = [];
}

/**
 * Registration methods
 */
ActionContainer.prototype.register = function (registryName, value, object) {
    this._registries[registryName] = this._registries[registryName] || {};
    this._registries[registryName][value] = object;
    return this;
};
ActionContainer.prototype._registryGet = function (registryName, value, defaultValue) {
    return this._registries[registryName][value] || defaultValue;
};

/**
 * Namespace default accessor methods
 */
ActionContainer.prototype.setDefaults = function (options) {
    options = options || {};
    for (var property in options) {
        if (options.hasOwnProperty(property)) {
            this._defaults[property] = options[property];
        }
    }

    // if these defaults match any existing arguments, replace the previous
    // default on the object with the new one
    this._actions.forEach(function (action) {
        if (options.indexOf(action.destination) >= 0) {
            action.defaultValue = options[action.destination];
        }
    });
};

ActionContainer.prototype.getDefault = function (destination) {
    this._actions.forEach(function (action) {
        if (action.destination === destination && action.defaultValue !== undefined) {
            return action.defaultValue;
        }
    });
    return this._defaults[destination];
};

/**
 * Adding argument actions
 */
/**
 * addArgument([dest, ...], {name:value, ...}) addArgument(optionString,
 * optionString, ..., name=value, ...)
 */
ActionContainer.prototype.addArgument = function (args, kwargs) {
    args = args || [];
    kwargs = kwargs || {};

    // if no positional args are supplied or only one is supplied and
    // it doesn't look like an option string, parse a positional argument
    if (!args || args.length === 1 && this.prefixChars.indexOf(args[0][0]) < 0) {
        if (args && kwargs.destination !== undefined) {
            throw new Error('destination supplied twice for positional argument');// ValueError
        }
        kwargs = this._getPositionalKwargs(args, kwargs);

        // otherwise, we're adding an optional argument
    } else {
        kwargs = this._getOptionalKwargs(args, kwargs);
    }

    // if no default was supplied, use the parser-level default
    if (kwargs.defaultValue === undefined) {
        var destination = kwargs.destination;
        if (this._defaults[destination] !== undefined) {
            kwargs.defaultValue = this._defaults[destination];
        } else if (this.argumentDefault !== undefined) {
            kwargs.defaultValue = this.argumentDefault;
        }
    }

    // create the action object, and add it to the parser
    var actionClass = this._popActionClass(kwargs);
    if (! $isCallable(actionClass)) {
        throw new Error($stringPrint('Unknown action "%action%".', {action: actionClass}));// ValueError
    }
    var action = new actionClass(kwargs);


    // throw an error if the action type is not callable
    var typeFunction = this._registryGet('type', action.type, action.type);
    if (!$isCallable(typeFunction)) {
        throw new Error($stringPrint('"%function%" is not callable', {'function': typeFunction}));
    }

    return this._addAction(action);
};

ActionContainer.prototype.addArgumentGroup = function (options, mutuallyExclusive) {
    var group;
    mutuallyExclusive = (mutuallyExclusive || false);
    if (mutuallyExclusive) {
        group = new ArgumentGroupMutex(this, options);
        this._actionGroupsMutex.push(group);
    } else {
        group = new ArgumentGroup(this, options);
        this._actionGroups.push(group);
    }
    return group;
};

ActionContainer.prototype._addAction = function (action) {

    // resolve any conflicts
    this._checkConflict(action);

    // add to actions list
    this._actions.push(action);
    action.container = this;

    // index the action by any option strings it has
    action.optionStrings.forEach(function (optionString) {
        this._optionStringActions[optionString] = action;
    }.bind(this));

    // set the flag if any option strings look like negative numbers
    action.optionStrings.forEach(function (optionString) {
        if (optionString.match(this._regexpNegativeNumber)) {
            if (!this._hasNegativeNumberOptionals) {
                this._hasNegativeNumberOptionals.push(true);
            }
        }
    }.bind(this));

    // return the created action
    return action;
};

ActionContainer.prototype._removeAction = function (action) {
    var actionIndex = this._actions.indexOf(action);
    if (actionIndex >= 0) {
        this._actions.splice(actionIndex);
    }
};

ActionContainer.prototype._addContainerActions = function (container) {

    // collect groups by titles
    var titleGroupMap = {};
    this._actionGroups.forEach(function (group) {
        if (titleGroupMap.indexOf(group.title) >= 0) {
            throw new Error($stringPrint(_('Cannot merge actions - two groups are named "%title%".'), group));// ValueError
        }
        titleGroupMap[group.title] = group;
    });

    // map each action to its group
    var groupMap = {};
    container._actionGroups.forEach(function (group) {

        // if a group with the title exists, use that, otherwise
        // create a new group matching the container's group
        if (titleGroupMap.indexOf(group.title) < 0) {
            titleGroupMap[group.title] = this.addArgumentGroup([], {
                title: group.title,
                description: group.description,
                conflictHandler: group.conflictHandler
            });
        }

        // map the actions to their new group
        group._groupActions.forEach(function (action) {
            groupMap[action] = titleGroupMap[group.title];
        });
    });

    // add container's mutually exclusive groups
    // NOTE: if add_mutually_exclusive_group ever gains title= and
    // description= then this code will need to be expanded as above
    container._actionGroupsMutex.forEach(function (group) {
        var mutexGroup = this.addArgumentGroup({required: group.required}, true);

        // map the actions to their new mutex group
        group._groupActions.forEach(function (action) {
            groupMap[action] = mutexGroup;
        });
    });

    // add all actions to this container or their group
    container._actions.forEach(function (action) {
        groupMap.get(action, this)._addAction(action);
    });
};

ActionContainer.prototype._getPositionalKwargs = function (destination, kwargs) {
    // make sure required is not specified
    if (kwargs.required) {
        throw new Error(_('"required" is an invalid argument for positionals.'));// TypeError
    }

    // mark positional arguments as required if at least one is
    // always required
    if (kwargs.nargs !== OPTIONAL && kwargs.nargs !== ZERO_OR_MORE) {
        kwargs.required = true;
    }
    if (kwargs.nargs === ZERO_OR_MORE && kwargs.defaultValue === undefined) {
        kwargs.required = true;
    }

    // return the keyword arguments with no option strings
    kwargs.destination = destination;
    kwargs.optionStrings = [];
    return kwargs;
};

ActionContainer.prototype._getOptionalKwargs = function (args, kwargs) {
    var prefixChars = this.prefixChars,
        optionStrings = [],
        optionStringsLong = [];

    // determine short and long option strings
    args.forEach(function (optionString) {
        // error on strings that don't start with an appropriate prefix
        if (prefixChars.indexOf(optionString[0]) < 0) {
            throw Error($stringPrint(_('Invalid option string "%option%": must start with a "%prefix%".'), {
                option: optionString,
                prefix: prefixChars
            }));// ValueError
        }

        // strings starting with two prefix characters are long options
        optionStrings.push(optionString);
        if (prefixChars.indexOf(optionString[0]) >= 0) {
            if (optionString.length > 1 && prefixChars.indexOf(optionString[1]) >= 0) {
                optionStringsLong.push(optionString);
            }
        }
    });


    // infer destination, '--foo-bar' -> 'foo_bar' and '-x' -> 'x'
    var destination = kwargs.destination;
    delete kwargs.destination;

    if (destination === undefined) {
        var optionStringDestination = optionStringsLong[0] || optionStrings[0];

        // destination = optionStringDestination.lstrip(this.prefixChars);
        destination = $stringLStrip(optionStringDestination, this.prefixChars);

        if (destination.length === 0) {
            throw Error($stringPrint(_('destination= is required for options like "%option%"'), {
                option: optionStrings.join(', ')
            }));
        }
        destination = destination.replace('-', '_');
    }

    // return the updated keyword arguments
    kwargs.destination = destination;
    kwargs.optionStrings = optionStrings;

    return kwargs;
};

ActionContainer.prototype._popActionClass = function (kwargs, defaultValue) {
    var action = (kwargs.action || defaultValue);
    delete kwargs.action;
    var actionClass = this._registryGet('action', action, action);
    return actionClass;
};

ActionContainer.prototype._getHandler = function () {
    // determine function from conflict handler string
    var handlerFuncName = '';
    handlerFuncName += '_handleConflict';
    handlerFuncName += this.conflictHandler.charAt(0).toUpperCase() + this.conflictHandler.substr(1);

    if (this[handlerFuncName] === undefined) {
        throw new Error($stringPrint(_('Invalid conflictResolution value: %value%'), {
            value: (this.conflictHandler || 'undefined')
        }));// ValueError
    }
    return this[handlerFuncName];
};

ActionContainer.prototype._checkConflict = function (action) {
    var optionStringActions = this._optionStringActions,
        conflictOptionals = [];

    // find all options that conflict with this option
    action.optionStrings.forEach(function (optionString) {
        if (optionStringActions[optionString] !== undefined) {
            conflictOptionals.push([
                optionString, // #1,
                optionStringActions[optionString]// #2
            ]);
        }
    });

    // resolve any conflicts
    if (conflictOptionals.length > 0) {
        this._getHandler()(action, conflictOptionals);
    }
};

ActionContainer.prototype._handleConflictError = function (action, conflictingActions) {
    var optionStrings = [], message;
    conflictingActions.forEach(function (tuple) {
        var optionString = tuple[0],
            action = tuple[1];
        optionStrings.push(optionString);
    });

    throw new ArgumentError(
        action,
        $stringPrint(_('Conflicting option string(s): %conflict%'), {
            conflict: optionStrings.join(', ')
        })
    );
};

ActionContainer.prototype._handleConflictResolve = function (action, conflictingActions) {

    // remove all conflicting options
    conflictingActions.forEach(function (tuple) {
        var optionString = tuple[0];
        var action = tuple[1];

        // remove the conflicting option
        action.optionStrings.splice(action.optionStrings.indexOf(optionString));
        delete this._optionStringActions[optionString];

        // if the option now has no option string, remove it from the
        // container holding it
        if (action.isOptional()) {
            action.container._removeAction(action);
        }
    });
};

/**
 * ArgumentGroup constructor
 *
 * @constructor
 * @param container
 * @param {object} options
 * @return
 */
function ArgumentGroup(container, options) {

    options = options || {};

    // add any missing keyword arguments by checking the container
    options.conflictHandler = (options.conflictHandler || container.conflictHandler);
    options.prefixChars = (options.prefixChars || container.prefixChars);
    options.argumentDefault = (options.argumentDefault || container.argumentDefault);

    ActionContainer.call(this, options);

    // group attributes
    this.title = options.title;
    this._groupActions = [];

    // share most attributes with the container
    this._container = container;
    this._registries = container._registries;
    this._actions = container._actions;
    this._optionStringActions = container._optionStringActions;
    this._defaults = container._defaults;
    this._hasNegativeNumberOptionals = container._hasNegativeNumberOptionals;
}
util.inherits(ArgumentGroup, ActionContainer);

/**
 * Add action and returns this new action
 *
 * @param {Action} action
 * @return
 */
ArgumentGroup.prototype._addAction = function (action) {
    // Parent add action
    action = ActionContainer.prototype._addAction.call(this, action);
    this._groupActions.push(action);
    return action;
};

/**
 * Return action
 *
 * @param {Action} action
 * @return
 */
ArgumentGroup.prototype._removeAction = function (action) {
    // Parent remove action
    ActionContainer.prototype._removeAction.call(this, action);
    this._groupActions.remove(action);
};

/**
 * ArgumentGroupMutex constructor
 *
 * @constructor
 * @param container
 * @param {object} options
 * @return
 */
function ArgumentGroupMutex(container, options) {
    options = options || {};

    ArgumentGroup.call(this, container, options);
    this.required = (options.required || false);
}
util.inherits(ArgumentGroupMutex, ArgumentGroup);

ArgumentGroupMutex.prototype._addAction = function (action) {
    if (action.required) {
        throw new Error(_('Mutually exclusive arguments must be optional.'));// ValueError
    }
    action = this._container._addAction(action);
    this._groupActions.push(action);
    return action;
};
ArgumentGroupMutex.prototype._removeAction = function (action) {
    this._container._removeAction(action);
    var actionIndex = this._groupActions.indexOf(action);
    this._groupActions.splice(actionIndex);
};


/**
 * ArgumentParser declaration
 *
 * @constructor
 * @param {object} options
 */
function ArgumentParser(options) {
    options = options || {};
    options.prefixChars = (options.prefixChars || '-');
    options.help = (options.help || false);
    options.parents = (options.parents || []);

    // environment
    options.debug = (options.debug || false);
    options.stdout = (options.stdout || process.stdout);
    options.stderr = (options.stderr || process.stderr);

    // default program name
    options.program = (options.program || require('path').basename(process.execPath));

    ActionContainer.call(this, options);

    this.debug = true;
    this.stdout = options.stdout;
    this.stderr = options.stderr;

    this.program = options.program;
    this.usage = options.usage;
    this.epilog = options.epilog;
    this.version = options.version;

    this.formatterClass = (options.formatterClass || 'HelpFormatter');
    // TODO: more generic way module.Class?

    this.prefixCharsFile = options.prefixCharsFile;

    this._positionals = this.addArgumentGroup({title: _('Positional arguments')});
    this._optionals = this.addArgumentGroup({title: _('Optional arguments')});
    this._subparsers = [];

    // register types
    this.register('type', 'auto', FUNCTION_IDENTITY);
    this.register('type', null, FUNCTION_IDENTITY);
    this.register('type', 'int', function (x) {
        var result = parseInt(x, 10);
        if (isNaN(result)) {
            throw new Error(x + ' is not a valid integer.');
        }
        return result;
    });
    this.register('type', 'float', function (x) {
        var result = parseFloat(x);
        if (isNaN(result)) {
            throw new Error(x + ' is not a valid float.');
        }
        return result;
    });
    this.register('type', 'string', function (x) {
        return '' + x;
    });

    // add help and version arguments if necessary
    // (using explicit default to override global argument_default)
    if (options.help) {
        this.addArgument(
            ['-h', '--help'],
            {
                action: 'help',
                help: _('Show this help message and exit.')
            }
        );
    }
    if (this.version !== undefined) {
        this.addArgument(
            ['-v', '--version'],
            {
                action: 'version',
                version: this.version,
                help: _("Show program's version number and exit.")
            }
        );
    }

    // add parent arguments and defaults
    options.parents.forEach(function (parent) {
        this._addContainerActions(parent);
        if (parent._defaults !== undefined) {
            for (var defaultKey in parent._defaults) {
                if (parent._defaults.hasOwnProperty(defaultKey)) {
                    this._defaults[defaultKey] = parent._defaults[defaultKey];
                }
            }
        }
    });

}
util.inherits(ArgumentParser, ActionContainer);

/**
 * Optional/Positional adding methods
 */
ArgumentParser.prototype.addSubparsers =  function (options) {
    if (this._subparsers !== undefined) {
        this.error(1, _('Cannot have multiple subparser arguments.'));
    }

    options = options || {};
    options.optionStrings = [];
    options.parserClass =  (options.parserClass || 'ArgumentParser');


    if (options.title !== undefined || options.description !== undefined) {

        this._subparsers = this.addArgumentGroup({
            title: _((options.title || 'subcommands')),
            description: _(options.description)
        });
        delete options.title;
        delete options.description;

    } else {
        this._subparsers = this._positionals;
    }

    // prog defaults to the usage message of this parser, skipping
    // optional arguments and with no "usage:" prefix
    if (options.program !== undefined) {
        var formatter = this._getFormatter();
        var positionals = this._getActionsPositional();
        var groups = this._actionGroupsMutex;
        formatter.addUsage(this.usage, positionals, groups, '');
        options.program = $stringStrip(formatter.formatHelp());
    }
    // create the parsers action and add it to the positionals list
    var parsersClass = this._popActionClass(options, 'parsers');
    var action = new parsersClass(options);
    this._subparsers._addAction(action);

    // return the created parsers action
    return action;
};

ArgumentParser.prototype._addAction = function (action) {
    if (action.isOptional()) {
        this._optionals._addAction(action);
    } else {
        this._positionals._addAction(action);
    }
    return action;
};

ArgumentParser.prototype._getActionsOptional = function () {
    return this._actions.filter(function (action, actionIndex) {
        return action.isOptional();
    });
};

ArgumentParser.prototype._getActionsPositional = function () {
    return this._actions.filter(function (action, actionIndex) {
        return action.isPositional();
    });
};


/**
 * Return the parsed args and throws error if some arguments are not recognized
 *
 * @param {Array} args
 * @param {Namespace} namespace
 * @return args
 */
ArgumentParser.prototype.parseArgs = function (/* array */ args, /* object */ namespace) {
    var result = this.parseArgsKnown(args, namespace), argv;
    args = result[0];
    argv = result[1];

    if (argv && argv.length > 0) {
        this.error(1,
            $stringPrint(_('Unrecognized arguments: %arguments%.'), {
                arguments: argv.join(' ')
            })
        );
    }
    return args;
};

/**
 * Return the parsed args (only known)
 *
 * @param {Array} args
 * @param {Namespace} namespace (optional)
 * @return [args, argv]
 */
ArgumentParser.prototype.parseArgsKnown = function (/* array */ args, /* object */ namespace) {
    // args default to the system args
    args = args || process.argv.slice(1);

    // default Namespace built from parser defaults
    namespace = namespace || new Namespace();


    // add any action defaults that aren't present
    this._actions.forEach(function (action) {
        if (action.destination !== SUPPRESS &&
            namespace[action.destination] === undefined &&
            action.defaultValue !== SUPPRESS
        ) {
            var defaultValue = action.defaultValue;
            if (typeof(action.defaultValue) === 'string') {
                defaultValue = this._getValue(action, defaultValue);
            }
            namespace.set(action.destination, defaultValue);
        }
    }.bind(this));

    // add any parser defaults that aren't present
    for (var destination in this._defaults) {
        if (namespace.get(destination) === undefined) {
            namespace.set(destination, this._defaults[destination]);
        }
    }

    // parse the arguments and exit if there are any errors
    try {
        return this._parseArgsKnown(args, namespace);
    } catch (e) {
        if (this.debug) {
            throw e;
        } else {
            this.error(1, e.message);// _sys.exc_info()[1];
        }
    }
};

ArgumentParser.prototype._parseArgsKnown = function (argStrings, namespace) {
    argStrings = this._readArgs(argStrings);

    // map all mutually exclusive arguments to the other arguments they can't
    // occur with
    var actionConflicts = {};
    this._actionGroupsMutex.forEach(function (mutexGroup) {
        mutexGroup._groupActions.forEach(function (mutexAction, mutexIndex) {
            actionConflicts[mutexAction] = (actionConflicts[mutexAction] || []);
            actionConflicts[mutexAction] = actionConflicts[mutexAction].concat(
                    mutexGroup._groupActions.slice(0, mutexIndex),
                    mutexGroup._groupActions.slice(mutexIndex + 1)
            );
        });
    });


    // find all option indices, and determine the argStringPattern
    // which has an 'O' if there is an option at an index,
    // an 'A' if there is an argument, or a '-' if there is a '--'
    var optionStringIndices = [];
    var argStringPatternParts = [];
    var found = false;// -- if is found

    argStrings.forEach(function (argString, argStringIndex) {

        if (found) {
            argStringPatternParts.push('A');
        } else {
            // all args after -- are non-options
            if (argString === '--') {
                argStringPatternParts.push('-');
                found = true;

                // otherwise, add the arg to the arg strings
                // and note the index if it was an option
            } else {
                var optionTuple = this._parseOptional(argString);
                var pattern;
                if (optionTuple !== undefined) {
                    optionStringIndices[argStringIndex] = optionTuple;
                    pattern = 'O';
                } else {
                    pattern = 'A';
                }
                argStringPatternParts.push(pattern);
            }
        }
    }.bind(this));

    // join the pieces together to form the pattern
    var argStringsPattern = argStringPatternParts.join('');

    // converts arg strings to the appropriate and then takes the action
    var actionsSeen = [];
    var actionsSeenNonDefault = [];
    var extras = [];
    var startIndex = 0;
    var stopIndex = 0;

    function takeAction(action, argumentStrings, optionString) {

        actionsSeen.push(action);
        var argValues = this._getValues(action, argumentStrings);

        // error if this argument is not allowed with other previously
        // seen arguments, assuming that actions that use the default
        // value don't really count as "present"
        if (argValues !== action.defaultValue) {
            actionsSeenNonDefault.push(action);
            if (actionConflicts[action]) {
                actionConflicts[action].forEach(function (actionConflict) {
                    if (actionsSeenNonDefault.indexOf(actionConflict) >= 0) {
                        var message = $stringPrint(_('Not allowed with argument "%argument%".'), {argument: actionConflict.getName()});
                        throw new ArgumentError(action, message);
                    }
                });
            }
        }
        // take the action if we didn't receive a SUPPRESS value (e.g. from a
        // default)
        if (argValues !== SUPPRESS) {
            action.call(this, namespace, argValues, optionString);
        }
    }

    // function to convert argStrings into an optional action
    function consumeOptional(startIndex) {

        // get the optional identified at this index
        var self = this,
            optionTuple = optionStringIndices[startIndex],
            action = optionTuple[0],
            optionString = optionTuple[1],
            argExplicit = optionTuple[2],
            args,
            argCount;

        // identify additional optionals in the same arg string
        // (e.g. -xyz is the same as -x -y -z if no args are required)
        var actionTuples = [];
        var stop;

        while (true) {

            // if we found no optional action, skip it
            if (action === undefined) {
                extras.push(argStrings[startIndex]);
                return startIndex + 1;
            }

            // if there is an explicit argument, try to match the
            // optional's string arguments to only this
            if (argExplicit !== undefined) {
                argCount = this._matchArgument(action, 'A');

                // if the action is a single-dash option and takes no
                // arguments, try to parse more single-dash options out
                // of the tail of the option string
                if (argCount === 0 && this.prefixChars.indexOf(optionString[1]) < 0) {
                    actionTuples.push([action, [], optionString]);
                    var breaked = false, prefixChar, i;

                    for (i = 0 ; i < this.prefixChars.length; i += 1) {
                        prefixChar = this.prefixChars[i];
                        optionString = prefixChar + argExplicit.substr(0, 1);
                        argExplicit = argExplicit.substr(1);
                        if (self._optionStringActions[optionString] !== undefined) {
                            action = self._optionStringActions[optionString];
                            breaked = true;
                            break;
                        }
                    }
                    if (breaked) {
                        var message = $stringPrint(_('Ignored explicit argument "%argument%".'), {argument: argExplicit});
                        throw new ArgumentError(action, message);
                    }

                    // if the action expect exactly one argument, we've
                    // successfully matched the option; exit the loop
                } else if (argCount === 1) {
                    stop = startIndex + 1;
                    args = [argExplicit];
                    actionTuples.push([action, args, optionString]);
                    break;

                    // error if a double-dash option did not use the
                    // explicit argument
                } else {
                    throw new ArgumentError(
                        action,
                        $stringPrint(_('Ignored explicit argument "%argument%".'), {
                            argument: argExplicit
                        })
                    );
                }

                // if there is no explicit argument, try to match the
                // optional's string arguments with the following strings
                // if successful, exit the loop
            } else {
                var start = startIndex + 1;
                var argStringsPatternSelected = argStringsPattern.substr(start);
                argCount = this._matchArgument(action, argStringsPatternSelected);

                stop = start + argCount;
                args = argStrings.slice(start, stop);

                actionTuples.push([action, args, optionString]);
                break;
            }
        }

        // add the Optional to the list and return the index at which
        // the Optional's string args stopped
        if (actionTuples.length <= 0) {
            throw new Error('length should be > 0');
        }
        actionTuples.forEach(function (actionTuple) {
            takeAction.bind(this).apply(this, actionTuple);
        }.bind(this));
        return stop;
    }

    // the list of Positionals left to be parsed; this is modified by
    // consumePositionals()
    var positionals = this._getActionsPositional();

    // function to convert argStrings into positional actions
    function consumePositionals(startIndex) {
        // match as many Positionals as possible
        var argStringsPatternSelected = argStringsPattern.substr(startIndex);
        var argCounts = this._matchArgumentsPartial(positionals, argStringsPatternSelected);

        // slice off the appropriate arg strings for each Positional
        // and add the Positional and its args to the list
        for (var i = 0; i < positionals.length; i += 1) {
            var action = positionals[i];
            var argCount = (argCounts[i] || 0);
            var args = argStrings.slice(startIndex, startIndex + argCount);

            startIndex += argCount;
            takeAction.bind(this)(action, args);
        }

        // slice off the Positionals that we just parsed and return the index at
        // which the Positionals' string args stopped
        positionals = positionals.slice(argCounts.length);
        return startIndex;
    }

    // consume Positionals and Optionals alternately, until we have passed the
    // last option string
    var optionStringIndexMax = optionStringIndices ?  optionStringIndices.length - 1: -1;

    while (startIndex <= optionStringIndexMax) {
        // consume any Positionals preceding the next option
        var optionStringIndexNext, positionalsEndIndex;
        for (var i = startIndex; i < optionStringIndices.length; i += 1) {
            if (optionStringIndices[i] !== undefined) {
                optionStringIndexNext = i;
                break;
            }
        }

        if (startIndex !== optionStringIndexNext) {
            positionalsEndIndex = consumePositionals.bind(this)(startIndex);

            // only try to parse the next optional if we didn't consume the
            // option string during the positionals parsing
            if (positionalsEndIndex > startIndex) {
                startIndex = positionalsEndIndex;
                continue;
            } else {
                startIndex = positionalsEndIndex;
            }
        }

        // if we consumed all the positionals we could and we're not at the
        // index of an option string, there were extra arguments
        if (optionStringIndices[startIndex] === undefined) {
            var strings = argStrings.slice(startIndex, optionStringIndexNext);
            extras = extras.concat(strings);
            startIndex = optionStringIndexNext;
        }
        // consume the next optional and any arguments for it
        startIndex = consumeOptional.bind(this)(startIndex);
    }

    // consume any positionals following the last Optional
    stopIndex = consumePositionals.bind(this)(startIndex);

    // if we didn't consume all the argument strings, there were extras
    extras = extras.concat(argStrings.slice(stopIndex));

    // if we didn't use all the Positional objects, there were too few arg
    // strings supplied.
    if (positionals.length > 0) {
        this.error(1, _('Too few arguments'));
    }

    // make sure all required actions were present
    this._actions.forEach(function (action) {
        if (action.required && actionsSeen.indexOf(action) < 0) {
            this.error(1, $stringPrint(_('Argument "%argument%" is required'), {argument: action.getName()}));
        }
    }.bind(this));

    // make sure all required groups had one option present
    this._actionGroupsMutex.forEach(function (group) {
        if (group.required) {
            var found = false,
                actionIndex,
                action,
                names = [];
            for (actionIndex in group._groupActions) {
                if (group._groupActions.hasOwnProperty(actionIndex)) {
                    action = group._groupActions[actionIndex];
                    if (actionsSeenNonDefault.indexOf(action) >= 0) {
                        found = true;
                        break;
                    }
                }
            }
            // if no actions were used, report the error
            if (found) {
                group._groupActions.forEach(function (action) {
                    if (action.help !== SUPPRESS) {
                        names.push(action.getName());
                    }
                });
                this.error(1, $stringPrint(_('One of the arguments %arguments% is required.'), {arguments: names.join(' ')}));
            }
        }
    }.bind(this));


    // return the updated namespace and the extra arguments
    return [namespace, extras];
};

ArgumentParser.prototype._readArgs = function (argStrings) {
    var result = argStrings.slice();
    // replace arg strings that are file references
    if (this.prefixCharsFile !== undefined) {
        result = this._readArgsFromFiles(result);
    }
    return result;
};

ArgumentParser.prototype._readArgsFromFiles = function (argStrings) {
    // expand arguments referencing files
    var argStringsNew = [];
    argStrings.forEach(function (argString) {

        // for regular arguments, just add them back into the list
        if (this.prefixCharsFile.indexOf(argString[0]) < 0) {
            argStringsNew.push(argString);

            // replace arguments referencing files with the file content
        } else {
            try {
                // TODO: optimize IO reading?
                var argsFileContent = fs.readFileSync(argString.substr(1), 'r');
                var argLines = argsFileContent.split(EOL);

                var argStrings = [];
                argLines.forEach(function (argLine) {
                    argLine = [argLine];// convert arg line to args
                    argLine.forEach(function (arg) {
                        argStrings.push(arg);
                    });
                });
                argStrings = this._readArgsFromFiles(argStrings);
                argStringsNew = argStringsNew.concat(argStrings);

            } catch (e) {// IOError
                this.error(1, e.getMessage());
            }
        }
    });
    // return the modified argument list
    return argStringsNew;
};

ArgumentParser.prototype._matchArgument = function (action, regexpArgStrings) {
    // match the pattern for this action to the arg strings
    var regexpNargs = this._getRegexpNargs(action);
    var matches = regexpArgStrings.match(regexpNargs);
    var message;

    // throw an exception if we weren't able to find a match
    if (!matches) {
        if (action.nargs === undefined) {
            message = _('Expected one argument.');
        } else if (action.nargs === OPTIONAL) {
            message = _('Expected at most one argument.');
        } else if (action.nargs === ONE_OR_MORE) {
            message = _('Expected at least one argument.');
        } else {
            message = _('Expected %count% argument(s)');
        }
        throw new ArgumentError(action, $stringPrint(message, {count: action.nargs}));
    }
    // return the number of arguments matched
    return matches[1].length;
};

ArgumentParser.prototype._matchArgumentsPartial =  function (actions, regexpArgStrings) {
    // progressively shorten the actions list by slicing off the
    // final actions until we find a match
    var self = this,
        result = [],
        actionSlice,
        pattern,
        matches,
        i,
        getRegexpNargs = function (action) {
            return self._getRegexpNargs(action);
        },
        getLength = function (string) {
            return string.length;
        };
    for (i = actions.length; i > 0; i -= 1) {
        actionSlice = actions.slice(0, i);
        pattern = actionSlice.map(getRegexpNargs).join('');

        matches = regexpArgStrings.match(pattern);
        if (matches && matches.length > 0) {
            result = result.concat(matches.map(getLength));
            break;
        }
    }

    // return the list of arg string counts
    return result;
};

ArgumentParser.prototype._parseOptional = function (argString) {
    var action, optionString, argExplicit, optionTuples;

    // if it's an empty string, it was meant to be a positional
    if (argString === undefined) {
        return undefined;
    }

    // if it doesn't start with a prefix, it was meant to be positional
    if (this.prefixChars.indexOf(argString[0]) < 0) {
        return undefined;
    }

    // if the option string is present in the parser, return the action
    if (this._optionStringActions[argString] !== undefined) {
        return [this._optionStringActions[argString], argString, undefined];
    }

    // if it's just a single character, it was meant to be positional
    if (argString.length === 1) {
        return undefined;
    }

    // if the option string before the "=" is present, return the action
    if (argString.indexOf('=') >= 0) {
        var argStringSplit = argString.split('=', 2);
        optionString =  argStringSplit[0];
        argExplicit = argStringSplit[1];
        if (this._optionStringActions[optionString] !== undefined) {
            action = this._optionStringActions[optionString];
            return [action, optionString, argExplicit];
        }
    }

    // search through all possible prefixes of the option string
    // and all actions in the parser for possible interpretations
    optionTuples = this._getOptionTuples(argString);

    // if multiple actions match, the option string was ambiguous
    if (optionTuples.length > 1) {
        var optionStrings = optionTuples.map(function (optionTuple) {
            return optionTuple[1];// optionTuple(action, optionString,
            // argExplicit)
        });
        this.error(1, $stringPrint(_('Ambiguous option: "%argument%" could match %values%.'), {argument: argString, values: optionStrings.join(', ')}));
        // if exactly one action matched, this segmentation is good,
        // so return the parsed action
    } else if (optionTuples.length === 1) {
        return optionTuples[0];
    }

    // if it was not found as an option, but it looks like a negative
    // number, it was meant to be positional
    // unless there are negative-number-like options
    if (argString.match(this._regexpNegativeNumber) && !this._hasNegativeNumberOptionals) {
        return undefined;
    }
    // if it contains a space, it was meant to be a positional
    if (argString.search(' ') >= 0) {
        return undefined;
    }

    // it was meant to be an optional but there is no such option
    // in this parser (though it might be a valid option in a subparser)
    return [undefined, argString, undefined];
};

ArgumentParser.prototype._getOptionTuples = function (optionString) {
    var result = [];
    var chars = this.prefixChars;
    var optionPrefix;
    var argExplicit;
    var action;

    // option strings starting with two prefix characters are only split at
    // the '='
    if (chars.indexOf(optionString[0]) >= 0 && chars.indexOf(optionString[1]) >= 0) {
        if (optionString.indexOf('=') >= 0) {
            var optionStringSplit = optionString.split('=', 1);

            optionPrefix = optionStringSplit[0];
            argExplicit = optionStringSplit[1];
        } else {
            optionPrefix = optionString;
            argExplicit = undefined;
        }

        for (var optionStringAction in this._optionStringActions) {
            if (optionStringAction.substr(0, optionPrefix.length) === optionPrefix) {
                action = this._optionStringActions[optionString];
                result.push([action, optionString, argExplicit]);
            }
        }

        // single character options can be concatenated with their arguments
        // but multiple character options always have to have their argument
        // separate
    } else if (chars.indexOf(optionString[0]) >= 0 && chars.indexOf(optionString[1]) < 0) {
        optionPrefix = optionString;
        argExplicit = undefined;
        var optionPrefixShort = optionString.substr(0, 2);
        var argExplicitShort = optionString.substr(2);

        this._optionStringActions.forEach(function (optionString) {
            action = this._optionStringActions[optionString];
            if (optionString === optionPrefixShort) {
                result.push([action, optionString, argExplicitShort]);
            } else if (optionString.substr(0, optionPrefix.length) === optionPrefix) {
                result.push([action, optionString, argExplicit]);
            }
        });


        // shouldn't ever get here
    } else {
        throw new Error($stringPrint(_('Unexpected option string: %argument%.'), {argument: optionString}));
    }

    // return the collected option tuples
    return result;
};

ArgumentParser.prototype._getRegexpNargs = function (action) {
    // in all examples below, we have to allow for '--' args
    // which are represented as '-' in the pattern
    var regexpNargs;

    switch (action.nargs) {
    // the default (None) is assumed to be a single argument
    case undefined:
        regexpNargs = '(-*A-*)';
        break;
        // allow zero or more arguments
    case OPTIONAL:
        regexpNargs = '(-*A?-*)';
        break;
        // allow zero or more arguments
    case ZERO_OR_MORE:
        regexpNargs = '(-*[A-]*)';
        break;
        // allow one or more arguments
    case ONE_OR_MORE:
        regexpNargs = '(-*A[A-]*)';
        break;
        // allow any number of options or arguments
    case REMAINDER:
        regexpNargs = '([-AO]*)';
        break;
        // allow one argument followed by any number of options or arguments
    case PARSER:
        regexpNargs = '(-*A[-AO]*)';
        break;
    default:
        regexpNargs = '(-*' + 'A' + $stringRepeat('-*A', action.nargs - 1) + '-*)';
    }

    // if this is an optional action, -- is not allowed
    if (action.isOptional()) {
        regexpNargs = regexpNargs.replace('-*', '');
        regexpNargs = regexpNargs.replace('-', '');
    }

    // return the pattern
    return new RegExp(regexpNargs);
};

/**
 * Value conversion methods
 */
ArgumentParser.prototype._getValues = function (action, argStrings) {
    // for everything but PARSER args, strip out '--'
    if (action.nargs !== PARSER && action.nargs !== REMAINDER) {
        argStrings = argStrings.filter(function (arrayElement) {
            return arrayElement !== '--';
        });
    }

    var value, argString;
    // optional argument produces a default when not present
    if (argStrings.length === 0 && action.nargs === OPTIONAL) {
        value = (action.isOptional()) ? action.constant: action.defaultValue;

        if (typeof(value) === 'string') {
            value = this._getValue(action, value);
            this._checkValue(action, value);
        }

    // when nargs='*' on a positional, if there were no command-line
    // args, use the default if it is anything other than None
    } else if (argStrings.length === 0 && action.nargs === ZERO_OR_MORE && action.isPositional()) {
        value = (action.defaultValue || argStrings);
        this._checkValue(action, value);

        // single argument or optional argument produces a single value
    } else if (argStrings.length <= 1 && (action.nargs === undefined || action.nargs === OPTIONAL)) {
        argString = argStrings[0] || action.defaultValue;
        value = this._getValue(action, argString);
        this._checkValue(action, value);

    // REMAINDER arguments convert all values, checking none
    } else if (action.nargs === REMAINDER) {
        value = argStrings.map(function (v) {
            return this._getValue(action, v);
        });
    // PARSER arguments convert all values, but check only the first
    } else if (action.nargs === PARSER) {
        value = argStrings.map(function (v) {
            return this._getValue(action, v);
        });
        this._checkValue(action, value[0]);

    // all other types of nargs produce a list
    } else {
        value = argStrings.map(function (v) {
            return this._getValue(action, v);
        }.bind(this));
        value.forEach(function (v) {
            this._checkValue(action, v);
        }.bind(this));
    }

    // return the converted value
    return value;
};

ArgumentParser.prototype._getValue = function (action, argString) {
    var typeFunction = this._registryGet('type', action.type, action.type);
    if (!$isCallable(typeFunction)) {
        var message = $stringPrint(_('%callback% is not callable'), {callback: typeFunction});
        throw new ArgumentError(action, message);
    }
    var result;
    // convert the value to the appropriate type
    try {
        result = typeFunction(argString);

        // ArgumentTypeErrors indicate errors
    } catch (e) {

        // catch ArgumentTypeError:
        /*
         * name = action.type; message = e.message;//TODO change this throw
         * new ArgumentError(action, message);
         */

        // TypeErrors or ValueErrors also indicate errors
        // catch (TypeError, ValueError):
        throw new ArgumentError(
            action,
            $stringPrint(_('Invalid %type% value: %value%'), {
                type: action.type,
                value: argString
            })
        );
    }
    // return the converted value
    return result;
};

ArgumentParser.prototype._checkValue = function (action, value) {
    // converted value must be one of the choices (if specified)
    if (action.choices !== undefined && action.choices.indexOf(value) < 0) {
        var message = $stringPrint(_('Invalid choice: %value% (choose from [%choices%])', {value: value, choices: action.choices.join(', ')}));
        throw new ArgumentError(action, message);
    }
};

/*******************************************************************************
 * Help formatting methods
 ******************************************************************************/
/**
 * Format Usage
 *
 * @return string
 */
ArgumentParser.prototype.formatUsage = function () {
    var formatter = this._getFormatter();
    formatter.addUsage(this.usage, this._actions, this._actionGroupsMutex);
    return formatter.formatHelp();
};

/**
 * Format Help
 *
 * @return string
 */
ArgumentParser.prototype.formatHelp = function () {
    var formatter = this._getFormatter();

    // usage
    formatter.addUsage(this.usage, this._actions, this._actionGroupsMutex);

    // description
    formatter.addText(this.description);

    // positionals, optionals and user-defined groups
    this._actionGroups.forEach(function (actionGroup, actionIndex) {
        formatter.startSection(actionGroup.title);
        formatter.addText(actionGroup.description);
        formatter.addArguments(actionGroup._groupActions);
        formatter.endSection();
    });

    // epilog
    formatter.addText(this.epilog);

    // determine help from format above
    return formatter.formatHelp();
};

ArgumentParser.prototype._getFormatter = function () {
    var formatterClass = eval(this.formatterClass);
    var formatter =  new formatterClass({program: this.program});
    return formatter;
};

/*******************************************************************************
 * Print functions
 ******************************************************************************/
/**
 * Print usage
 */
ArgumentParser.prototype.printUsage = function (/* file */ file) {
    this._printMessage(this.formatUsage(), file || this.stdout);
    return this;
};

/**
 * Print help
 */
ArgumentParser.prototype.printHelp = function (/* file */ file) {
    this._printMessage(this.formatHelp(), file || this.stdout);
    return this;
};

ArgumentParser.prototype._printMessage = function (/* string */ message, /* file */ file) {
    if (message && file) {
        // file = file || this.stdout;
        file.write('' + message);
    }
};

/*******************************************************************************
 * Exit functions
 ******************************************************************************/
/**
 * Exit method
 *
 * @param status
 * @param message
 * @return undefined
 */
ArgumentParser.prototype.exit = function (/* int */ status, /* string */ message) {
    if (message !== undefined) {
        this._printMessage(message, this.stderr);
    }
    status = status || 0;
    if (!this.debug) {
        process.exit(status);
    } else {
        throw new SystemExit(status, message);
    }
    return status;
};
/**
 * Error method Prints a usage message incorporating the message to stderr and
 * exits. If you override this in a subclass, it should not return -- it should
 * either exit or throw an exception.
 *
 * @param message
 * @return undefined
 */
ArgumentParser.prototype.error = function (/* int */ status, /* string */ message) {
    status = status || 1;
    this.printUsage(this.stderr);
    return this.exit(status, $stringPrint(_('%program%: error: %message%'), {program: this.program, message: message}) + EOL);
};



/**
 * Exports
 */
//misc.
exports.Namespace = Namespace;
exports.ArgumentParser = ArgumentParser;

//Exceptions & Errors
exports.ArgumentError = ArgumentError;
exports.SystemExit = SystemExit;

//Actions
exports.Action = Action;
exports.ActionAppend = ActionAppend;
exports.ActionAppendConstant = ActionAppendConstant;
exports.ActionCount = ActionCount;
exports.ActionStore = ActionStore;
exports.ActionStoreConstant = ActionStoreConstant;
exports.ActionStoreTrue = ActionStoreTrue;
exports.ActionStoreFalse = ActionStoreFalse;

//Formatters
exports.HelpFormatter = HelpFormatter;
exports.HelpFormatterArgumentDefaults = HelpFormatterArgumentDefaults;
exports.HelpFormatterRawDescription = HelpFormatterRawDescription;
exports.HelpFormatterRawText = HelpFormatterRawText;

//Constants
exports.SUPPRESS = SUPPRESS;
exports.OPTIONAL = OPTIONAL;
exports.ZERO_OR_MORE = ZERO_OR_MORE;
exports.ONE_OR_MORE = ONE_OR_MORE;
exports.PARSER = PARSER;
exports.REMAINDER = REMAINDER;