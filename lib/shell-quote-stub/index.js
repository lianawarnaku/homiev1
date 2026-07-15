// Minimal stub — react-devtools-core uses shell-quote for dev tooling only
exports.quote = function(args) { return args.map(String).join(' '); };
exports.parse = function(str) { return str.split(/\s+/).filter(Boolean); };
