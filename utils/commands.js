/**
 *  @overview this library defines functions which implement the various
 *            commands that are given to the chapi command-line tool
 *  @author Ben Watson <ben.watson@coxautoinc.com>
 */

var tty = require('tty');
var CloudHealth = require('..');
var utils = CloudHealth.utils;

/**
 *  @namespace module:cloud-health-api.commands
 */
var commands = {
  make_api_call,
  resolve_component,
  resolve_inputs,
  resolve_func,
  run_script,
  set_api_key,
  show_help,
  show_version,
  use_api,
}

/**
 *  makes an api call by calling <component_name>#<func_name> with params
 *  @memberof module:cloud-health-api.commands
 *  @param {string} component_name - the name of the component to call func_name on
 *  @param {string} func_name - the name of the function to call
 *  @param {string[]} params - an array of parameters to give to func_name
 *  @param {mixedCallback} cb - yields the result of the api call
 */
function make_api_call(component_name, func_name, params, cb) {
  utils.find_api_key((err, api_key) => {
    if (err) return cb(err, api_key);

    var component = this.resolve_component(component_name, api_key);
    var func = this.resolve_func(component, func_name);

    utils.execute(component, func, params, cb);
  });
}

/**
 *  resolves a name of a component and retrieves the actual component
 *  @memberof module:cloud-health-api.commands
 *  @param {string} name - the name of the component
 *  @param {string} [api_key] - the api_key to use when creating the component
 *  @return {object} the component object
 */
function resolve_component(name, api_key) {
  var class_name = name.slice(0, 1).toUpperCase() + name.slice(1).toLowerCase();
  switch(class_name) {
    case 'Account':
    case 'Accounts':
    case 'Acct':
      return new CloudHealth.Account(api_key);
    case 'Asset':
    case 'Assets':
    case 'Asst':
      return new CloudHealth.Asset(api_key);
    case 'Perspective':
    case 'Perspectives':
    case 'Pers':
      return new CloudHealth.Perspective(api_key);
    case 'Tag':
    case 'Tags':
    case 'Tagging':
      return new CloudHealth.Tag(api_key);
    case 'Report':
    case 'Reports':
    case 'Reporting':
      return new CloudHealth.Report(api_key);
    default:
      return new Error(class_name + ' is an invalid component name');
  }
}

/**
 *  calls the appropriate command based on the given arguments
 *  @memberof module:cloud-health-api.commands
 *  @param {string[]} args - and array of arguments
 */
function resolve_inputs(args) {
  if (!args.length) args = [ 'help' ];

  switch (args[0]) {
    case 'help':
    case '--help':
    case 'usage':
    case '--usage':
      this.show_help();
      break;
    case 'set_api_key':
    case 'set-api-key':
    case 'set_key':
    case 'set-key':
    case '-A':
      this.set_api_key(args[1]);
      break;
    case 'run':
    case 'script':
    case 'exec':
    case 'execute':
    case '-R':
      this.run_script(...args.slice(1));
      break;
    case 'version':
    case '--version':
    case '-V':
      this.show_version();
      break;
    default:
      this.use_api(args);
  }
}

/**
 *  retrieves the function with the given name for the given component
 *  @memberof module:cloud-health-api.commands
 *  @param {object} component - the component object containing the desired function
 *  @param {string} func_name - the name of the function to retrieve
 *  @return {function} the function
 */
function resolve_func(component, func_name) {
  if (func_name.charAt(0) === '_') {
    return new Error('private functions cannot be called from the command-line');
  }
  func_name = func_name.replace(/-/g, '_');
  var func = component[func_name.toLowerCase()];
  if (!func) {
    return new Error(`function ${func_name} does not exist on component ${JSON.stringify(component)}`);
  }
  return func;
}

/**
 *  executes a script in the scripts folder with the given arguments
 *  @memberof module:cloud-health-api.commands
 *  @param {string} name - the name of the script
 */
function run_script(name, ...args) {
  utils.run(name, ...args);
}

/**
 *  sets the api key and prints a message on success
 *  @memberof module:cloud-health-api.commands
 *  @param {string} api_key - the api key to set
 */
function set_api_key(api_key) {
  utils.set_api_key(api_key, (err, api_key) => {
    if (err) return utils.print_response(err, api_key);
    utils.print_response(null, 'api key has been set');
  });
}

/**
 *  prints a message explaining the usage of the tool
 *  @memberof module:cloud-health-api.commands
 */
function show_help() {
  console.error(
`usage:
chapi <component> <function> [<flags>] [<other-arguments>]

<component> - the name of the component to use (ie. perspective, account, etc.)
<function> - the name of the function to call (ie. get, find_by, list, etc.)
<flags> - any flags taken by the function (in the form --key=value)
<other-arguments> - parameters to pass to the function`
  );
}

/**
 *  prints the name and version number of this tool
 *  @memberof module:cloud-health-api.commands
 */
function show_version() {
  utils.get_package_json((err, json) => {
    if (err) return utils.print_response(err, json);
    utils.print_response(null, `${json.name} version ${json.version}`);
  });
}

/**
 *  reads parameters from stdin (if any), adds them to the list of params, and
 *  makes an api call based on the given args
 *  @memberof module:cloud-health-api.commands
 *  @param {string[]} args - an array in the form [component, function, parameters]
 */
function use_api(args) {
  // if data is piped in, read from stdin, otherwise execute with given params
  var cb = utils.print_response;
  if (tty.isatty(0)) {
    this.make_api_call(args[0], args[1], args.slice(2), cb);
  }
  else {
    utils.read_stdin((err, data) => {
      if (err) return utils.print_response(err, data);

      var parsed_data = utils._parse_stdin_data(data);
      params = args.slice(2).concat(parsed_data);

      this.make_api_call(args[0], args[1], params, cb);
    });
  }
}

module.exports = commands;
