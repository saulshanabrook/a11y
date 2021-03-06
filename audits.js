/**
 * Conducts audits using the Chrome Accessibility Tools and PhantomJS.
 */
var system = require('system');
var webpage = require('webpage').create();
var opts = JSON.parse(system.args[1]);
var PAGE_TIMEOUT = 9000;
var TOOLS_PATH = 'node_modules/accessibility-developer-tools/dist/js/axs_testing.js';

function formatTrace(trace) {
    var src = trace.file || trace.sourceURL;
    var fn = (trace.function ? ' in function ' + trace.function : '');
    return '→ ' + src + ' on line ' + trace.line + fn;
}

// console.error is broken in PhantomJS
console.error = function () {
    system.stderr.writeLine([].slice.call(arguments).join(' '));
};

webpage.settings.resourceTimeout = PAGE_TIMEOUT;

webpage.onResourceTimeout = function (err) {
    console.log('Error code:' +  err.errorCode + ' ' + err.errorString + ' for ' + err.url);
    phantom.exit(1);
};

webpage.onError = opts.verbose ? function (err, trace) {
    console.error(err + '\n' + formatTrace(trace[0]) + '\n');
} : function () {};

webpage.open(opts.url, function (status) {
    if (status === 'fail') {
        console.error('Couldn\'t load url: ' + url);
        phantom.exit(1);
    }

    // Inject axs_testing
    webpage.injectJs(TOOLS_PATH);

    var ret = webpage.evaluate(function () {
        var results = axs.Audit.run();

        var audit = results.map(function (result) {
            var DOMElements = result.elements;
            var message = '';

            if (DOMElements !== undefined) {
                var maxElements = Math.min(DOMElements.length, 5);

                for (var i = 0; i < maxElements; i++) {
                    var el = DOMElements[i];
                    message += '\n';
                    // Get query selector not browser independent. catch any errors and
                    // default to simple tagName.
                    try {
                        message += axs.utils.getQuerySelectorText(el);
                    } catch (err) {
                        message += ' tagName:' + el.tagName;
                        message += ' id:' + el.id;
                    }
                }
            }

            return {
                heading: result.rule.heading,
                result: result.result,
                severity: result.rule.severity,
                elements: message
            };
        });

        return {
            audit: audit,
            report: axs.Audit.createReport(results)
        };
    });

    if (!ret) {
        system.stderr.writeLine('Audit failed');
        phantom.exit(1);
        return;
    }

    console.log(JSON.stringify(ret));
    phantom.exit();
});
