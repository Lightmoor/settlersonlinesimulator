define(function() {
    var console = window.console;

    function noop() {}

    function getApplyableLog(console, method) {
        method = method || "log";

        // http://stackoverflow.com/a/5539378/319878
        // IE patch
        return Function.prototype.bind.call(console[method], console);
    }

    function wrap(name, console, method) {
        return function() {
            var args = Array.prototype.slice.call(arguments);
            args = [name].concat(args);
            var log = getApplyableLog(console);
            log.apply(console, args);
        }
    }

    function createLog(name, on) {
        on = (false !== on);

        var log = !on ? noop : wrap(name, console, "log");
        var error = wrap(name, console, "error");

        var f = log;
        f.error = error;

        // Return a log function that prepends the logger name to the arguments.
        return f;
    }

    return {
        createLog: createLog
    };
});