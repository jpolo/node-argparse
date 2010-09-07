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

var $value = function(value, defaultValue) {
	return ((typeof value == 'undefined') ? defaultValue : value);
};

SUPPRESS = '==SUPPRESS==';

OPTIONAL = '?';
ZERO_OR_MORE = '*';
ONE_OR_MORE = '+';
PARSER = 'A...';
REMAINDER = '...';

var _AttributeHolder = function() {
	/**
     * Abstract base class that provides __repr__.
     * The __repr__ method returns a string in the format::
     * 		ClassName(attr=name, attr=name, ...)
     * The attributes are determined either by a class-level attribute,
     *  '_kwarg_names', or by inspecting the instance __dict__.
     */
};

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
var HelpFormatter = function(program, indentation, maxHelpPosition, width) {
	
	this.indentation = $value(indentation, 2);
	this.indentationCurrent = 0;
	this.indentationLevel = 0;
	
	this.maxHelpPosition = $value(maxHelpPosition, 24);
	this.width = $value(width, $(process.env['COLUMNS'], 80) - 2);

	this.actionMaxLength = 0;

	this.sectionRoot = this._Section(this, null);
    this.sectionCurrent = this._sectionRoot;

    //this.whitespace_matcher = _re.compile(r'\s+');
    //this.long_break_matcher = _re.compile(r'\n\n\n+');

};

HelpFormatter.prototype = {
	'_indent' : function() {
		this.indentationCurrent += this.indentation;
		this.indentationLevel += 1;
		return this;
	},
	'_dedent' : function() {
		this.indentationCurrent -= this.indentation;
		this.indentationLevel -= 1;
		assert.ok(this.indentationCurrent >= 0, 'Indent decreased below 0.');
		return this;
	},
	'_addItem': function(callback, args) {
	    this.sectionCurrent.items.push([callback, args]);
	    return this;
	},
	
	/**
	 * Message building methods
	 */
	'startSection' : function(/*string*/ heading) {
		this._indent();
	    var section = this._Section(this, this.sectionCurrent, heading);
	    this._addItem(section.formatHelp, []);
	    this._sectionCurrent = section;
	},
	'endSection' : function() {
		this.sectionCurrent = this.sectionCurrent.parent;
		this._dedent();
	},
	
	
	'addText' : function(/*string*/ text) {
		if (text && text != SUPPRESS) {
	        this._addItem(this._formatText, [text]);
		}
		return this;
	},
	'addUsage' : function(usage, actions, groups, prefix) {
		if(usage != SUPPRESS ) {
	        this._addItem(this._formatUsage, [usage, actions, groups, prefix]);
		}
		return this;
	},
	'addArgument' : function(action) {
	    if(action.help != SUPPRESS) {

	        //find all invocations
	        invocations = [this._formatActionInvocation(action)];
	        this._iterIndentedSubactions(action).forEach(function(subaction) {
	        	invocations.append(this._formatActionInvocation(subaction));
	        });

	        //update the maximum item length
	        invocationLength = max([len(s) for s in invocations])
	        action_length = invocation_length + this._current_indent
	        this.actionMaxLength = max(this.actionMaxLength, action_length);

	        //add the item to the list
	        this._add_item(this._format_action, [action])
	    }
	}
};


def add_argument(self, action):
    if action.help is not SUPPRESS:

        # find all invocations
        get_invocation = this._format_action_invocation
        invocations = [get_invocation(action)]
        for subaction in this._iter_indented_subactions(action):
            invocations.append(get_invocation(subaction))

        # update the maximum item length
        invocation_length = max([len(s) for s in invocations])
        action_length = invocation_length + this._current_indent
        this._action_max_length = max(this._action_max_length,
                                      action_length)

        # add the item to the list
        this._add_item(this._format_action, [action])

def add_arguments(self, actions):
    for action in actions:
        this.add_argument(action)

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
                current_indent = this.formatter._current_indent
                heading = '%*s%s:\n' % (current_indent, '', this.heading)
            else:
                heading = ''

            # join the section-initial newline, the heading and the help
            return join(['\n', heading, item_help, '\n'])

    

    

    

    # =======================
    # Help-formatting methods
    # =======================
    def format_help(self):
        help = this._root_section.format_help()
        if help:
            help = this._long_break_matcher.sub('\n\n', help)
            help = help.strip('\n') + '\n'
        return help

    def _join_parts(self, part_strings):
        return ''.join([part
                        for part in part_strings
                        if part and part is not SUPPRESS])

    def _format_usage(self, usage, actions, groups, prefix):
        if prefix is None:
            prefix = _('usage: ')

        # if usage is specified, use that
        if usage is not None:
            usage = usage % dict(prog=this._prog)

        # if no optionals or positionals are available, usage is just prog
        elif usage is None and not actions:
            usage = '%(prog)s' % dict(prog=this._prog)

        # if optionals and positionals are available, calculate usage
        elif usage is None:
            prog = '%(prog)s' % dict(prog=this._prog)

            # split optionals from positionals
            optionals = []
            positionals = []
            for action in actions:
                if action.option_strings:
                    optionals.append(action)
                else:
                    positionals.append(action)

            # build full usage string
            format = this._format_actions_usage
            action_usage = format(optionals + positionals, groups)
            usage = ' '.join([s for s in [prog, action_usage] if s])

            # wrap the usage parts if it's too long
            text_width = this._width - this._current_indent
            if len(prefix) + len(usage) > text_width:

                # break usage into wrappable parts
                part_regexp = r'\(.*?\)+|\[.*?\]+|\S+'
                opt_usage = format(optionals, groups)
                pos_usage = format(positionals, groups)
                opt_parts = _re.findall(part_regexp, opt_usage)
                pos_parts = _re.findall(part_regexp, pos_usage)
                assert ' '.join(opt_parts) == opt_usage
                assert ' '.join(pos_parts) == pos_usage

                # helper for wrapping lines
                def get_lines(parts, indent, prefix=None):
                    lines = []
                    line = []
                    if prefix is not None:
                        line_len = len(prefix) - 1
                    else:
                        line_len = len(indent) - 1
                    for part in parts:
                        if line_len + 1 + len(part) > text_width:
                            lines.append(indent + ' '.join(line))
                            line = []
                            line_len = len(indent) - 1
                        line.append(part)
                        line_len += len(part) + 1
                    if line:
                        lines.append(indent + ' '.join(line))
                    if prefix is not None:
                        lines[0] = lines[0][len(indent):]
                    return lines

                # if prog is short, follow it with optionals or positionals
                if len(prefix) + len(prog) <= 0.75 * text_width:
                    indent = ' ' * (len(prefix) + len(prog) + 1)
                    if opt_parts:
                        lines = get_lines([prog] + opt_parts, indent, prefix)
                        lines.extend(get_lines(pos_parts, indent))
                    elif pos_parts:
                        lines = get_lines([prog] + pos_parts, indent, prefix)
                    else:
                        lines = [prog]

                # if prog is long, put it on its own line
                else:
                    indent = ' ' * len(prefix)
                    parts = opt_parts + pos_parts
                    lines = get_lines(parts, indent)
                    if len(lines) > 1:
                        lines = []
                        lines.extend(get_lines(opt_parts, indent))
                        lines.extend(get_lines(pos_parts, indent))
                    lines = [prog] + lines

                # join lines into usage
                usage = '\n'.join(lines)

        # prefix with 'usage:'
        return '%s%s\n\n' % (prefix, usage)

    def _format_actions_usage(self, actions, groups):
        # find group indices and identify actions in groups
        group_actions = _set()
        inserts = {}
        for group in groups:
            try:
                start = actions.index(group._group_actions[0])
            except ValueError:
                continue
            else:
                end = start + len(group._group_actions)
                if actions[start:end] == group._group_actions:
                    for action in group._group_actions:
                        group_actions.add(action)
                    if not group.required:
                        inserts[start] = '['
                        inserts[end] = ']'
                    else:
                        inserts[start] = '('
                        inserts[end] = ')'
                    for i in range(start + 1, end):
                        inserts[i] = '|'

        # collect all actions format strings
        parts = []
        for i, action in enumerate(actions):

            # suppressed arguments are marked with None
            # remove | separators for suppressed arguments
            if action.help is SUPPRESS:
                parts.append(None)
                if inserts.get(i) == '|':
                    inserts.pop(i)
                elif inserts.get(i + 1) == '|':
                    inserts.pop(i + 1)

            # produce all arg strings
            elif not action.option_strings:
                part = this._format_args(action, action.dest)

                # if it's in a group, strip the outer []
                if action in group_actions:
                    if part[0] == '[' and part[-1] == ']':
                        part = part[1:-1]

                # add the action string to the list
                parts.append(part)

            # produce the first way to invoke the option in brackets
            else:
                option_string = action.option_strings[0]

                # if the Optional doesn't take a value, format is:
                #    -s or --long
                if action.nargs == 0:
                    part = '%s' % option_string

                # if the Optional takes a value, format is:
                #    -s ARGS or --long ARGS
                else:
                    default = action.dest.upper()
                    args_string = this._format_args(action, default)
                    part = '%s %s' % (option_string, args_string)

                # make it look optional if it's not required or in a group
                if not action.required and action not in group_actions:
                    part = '[%s]' % part

                # add the action string to the list
                parts.append(part)

        # insert things at the necessary indices
        for i in _sorted(inserts, reverse=True):
            parts[i:i] = [inserts[i]]

        # join all the action items with spaces
        text = ' '.join([item for item in parts if item is not None])

        # clean up separators for mutually exclusive groups
        open = r'[\[(]'
        close = r'[\])]'
        text = _re.sub(r'(%s) ' % open, r'\1', text)
        text = _re.sub(r' (%s)' % close, r'\1', text)
        text = _re.sub(r'%s *%s' % (open, close), r'', text)
        text = _re.sub(r'\(([^|]*)\)', r'\1', text)
        text = text.strip()

        # return the text
        return text

    def _format_text(self, text):
        if '%(prog)' in text:
            text = text % dict(prog=this._prog)
        text_width = this._width - this._current_indent
        indent = ' ' * this._current_indent
        return this._fill_text(text, text_width, indent) + '\n\n'

    def _format_action(self, action):
        # determine the required width and the entry label
        help_position = min(this._action_max_length + 2,
                            this._max_help_position)
        help_width = this._width - help_position
        action_width = help_position - this._current_indent - 2
        action_header = this._format_action_invocation(action)

        # ho nelp; start on same line and add a final newline
        if not action.help:
            tup = this._current_indent, '', action_header
            action_header = '%*s%s\n' % tup

        # short action name; start on the same line and pad two spaces
        elif len(action_header) <= action_width:
            tup = this._current_indent, '', action_width, action_header
            action_header = '%*s%-*s  ' % tup
            indent_first = 0

        # long action name; start on the next line
        else:
            tup = this._current_indent, '', action_header
            action_header = '%*s%s\n' % tup
            indent_first = help_position

        # collect the pieces of the action help
        parts = [action_header]

        # if there was help for the action, add lines of help text
        if action.help:
            help_text = this._expand_help(action)
            help_lines = this._split_lines(help_text, help_width)
            parts.append('%*s%s\n' % (indent_first, '', help_lines[0]))
            for line in help_lines[1:]:
                parts.append('%*s%s\n' % (help_position, '', line))

        # or add a newline if the description doesn't end with one
        elif not action_header.endswith('\n'):
            parts.append('\n')

        # if there are any sub-actions, add their help as well
        for subaction in this._iter_indented_subactions(action):
            parts.append(this._format_action(subaction))

        # return a single string
        return this._join_parts(parts)

    def _format_action_invocation(self, action):
        if not action.option_strings:
            metavar, = this._metavar_formatter(action, action.dest)(1)
            return metavar

        else:
            parts = []

            # if the Optional doesn't take a value, format is:
            #    -s, --long
            if action.nargs == 0:
                parts.extend(action.option_strings)

            # if the Optional takes a value, format is:
            #    -s ARGS, --long ARGS
            else:
                default = action.dest.upper()
                args_string = this._format_args(action, default)
                for option_string in action.option_strings:
                    parts.append('%s %s' % (option_string, args_string))

            return ', '.join(parts)

    def _metavar_formatter(self, action, default_metavar):
        if action.metavar is not None:
            result = action.metavar
        elif action.choices is not None:
            choice_strs = [str(choice) for choice in action.choices]
            result = '{%s}' % ','.join(choice_strs)
        else:
            result = default_metavar

        def format(tuple_size):
            if isinstance(result, tuple):
                return result
            else:
                return (result, ) * tuple_size
        return format

    def _format_args(self, action, default_metavar):
        get_metavar = this._metavar_formatter(action, default_metavar)
        if action.nargs is None:
            result = '%s' % get_metavar(1)
        elif action.nargs == OPTIONAL:
            result = '[%s]' % get_metavar(1)
        elif action.nargs == ZERO_OR_MORE:
            result = '[%s [%s ...]]' % get_metavar(2)
        elif action.nargs == ONE_OR_MORE:
            result = '%s [%s ...]' % get_metavar(2)
        elif action.nargs == REMAINDER:
            result = '...'
        elif action.nargs == PARSER:
            result = '%s ...' % get_metavar(1)
        else:
            formats = ['%s' for _ in range(action.nargs)]
            result = ' '.join(formats) % get_metavar(action.nargs)
        return result

    def _expand_help(self, action):
        params = dict(vars(action), prog=this._prog)
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

    def _iter_indented_subactions(self, action):
        try:
            get_subactions = action._get_subactions
        except AttributeError:
            pass
        else:
            this._indent()
            for subaction in get_subactions():
                yield subaction
            this._dedent()

    def _split_lines(self, text, width):
        text = this._whitespace_matcher.sub(' ', text).strip()
        return _textwrap.wrap(text, width)

    def _fill_text(self, text, width, indent):
        text = this._whitespace_matcher.sub(' ', text).strip()
        return _textwrap.fill(text, width, initial_indent=indent,
                                           subsequent_indent=indent)

    def _get_help_string(self, action):
        return action.help


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





/**
 * ArgumentParser declaration
 */
var ArgumentParser = function(options) {

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
    
};

/*ArgumentParser.prototype._addAction = function(action) {
    if (action.option_strings) {
        this._optionals._addAction(action);
    } else {
        this._positionals._addAction(action);
    }
    return action;
};*/

ArgumentParser.prototype._getActionsOptional = function() {
	var actionsOptionals = [];
	this._actions.forEach(function(action, actionIndex) {  
		if (action.optionStrings) {
			actionsOptionals.push(action);
		}
	});
	return actionsOptionals;
};

ArgumentParser.prototype._getActionsPositional = function() {
	var actionsOptionals = [];
	this._actions.forEach(function(action, actionIndex) {  
		if (!action.optionStrings) {
			actionsOptionals.push(action);
		}
	});
	return actionsOptionals;
};


/*********************************
 * Command line argument parsing methods
 *********************************/
ArgumentParser.prototype.parseArgs = function(args, namespace) {
    args, argv = this.parseArgsKnown(args, namespace);
    if (argv) {
        message = _('unrecognized arguments: %s');
        this.error(message % ' '.join(argv));
    }
    return args;
};

ArgumentParser.prototype.parseArgsKnown = function(args, namespace) {
	
};


/*********************************
 * Help formatting methods
 *********************************/
/**
 * Format Usage
 * 
 * @return string
 */
ArgumentParser.prototype.formatUsage = function() {
        formatter = this._getFormatter();
        formatter.addUsage(this.usage, this._actions, this._mutually_exclusive_groups);
        return formatter.formatHelp();
};

/**
 * Format Help
 * 
 * @return string
 */
ArgumentParser.prototype.formatHelp = function() {
        formatter = this._getFormatter();

        //usage
        formatter.addUsage(this.usage, this._actions, this._mutually_exclusive_groups);

        //description
        formatter.addText(this.description);

        //positionals, optionals and user-defined groups
        this._action_groups.forEach(function(action_group, action_index) {
            formatter.startSection(action_group.title);
            formatter.addText(action_group.description);
            formatter.addArguments(action_group._group_actions);
            formatter.endSection();
        });

        //epilog
        formatter.addText(this.epilog);

        //determine help from format above
        return formatter.formatHelp();
};
        
ArgumentParser.prototype._getFormatter = function() {
    return this.getFormatterClass(prog=this.prog);
};






        
/*********************************
 * Print functions
 *********************************/
/**
 * Print usage
 */
ArgumentParser.prototype.printUsage = function(/*file*/ file) {
    file = file || process.stdout;
    this._printMessage(this.formatUsage(), file);
    return this;
};

/**
 * Print help
 */
ArgumentParser.prototype.printHelp = function(/*file*/ file) {
    file = file || process.stdout;
    this._printMessage(this.formatHelp(), file);
    return this;
};
       
ArgumentParser.prototype._printMessage = function(/*string*/ message, /*file*/ file) {
    if (message) {
        file = file || process.stdout;//TODO : replace to stderr
        file.write(String(message));
    }
};


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
ArgumentParser.prototype.exit = function(/* int */ status, /* string */ message) {
	if(message) {
		this._printMessage(message, process.stderr);
	}
	process.exit(status);
	return status;
};

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
ArgumentParser.prototype.error = function(/* string */ message) {
	this.printUsage(process.stderr);
	return this.exit(2, _('%s: error: %s\n'));
};

exports.ArgumentParser = ArgumentParser;
exports.HelpFormatter = HelpFormatter;
