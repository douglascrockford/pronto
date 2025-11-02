// pronto.js
// Douglas Crockford
// 2025-11-01

// You can access the pronto object by importing it.
//      import pronto from "./pronto.js";

// See https://www.crockford.com/pronto.html

/*property
    create, fallback, forEach, freeze, isArray, isSafeInteger, keys, length,
    map, min, name, objectify, parallel, race, requestorize, sequence,
    time_limit
*/

function make_reason(factory_name, message, cause) {

// Make a reason object. These are used for exceptions and cancellations.
// They are made from Error objects.

    return new Error("pronto." + factory_name + " " + message, cause);
}

function run(
    factory_name,   // The name of the factory for error reporting
    requestor_array,
    throttle,       // max in flight
    callback,
    initial_value,
    needed,         // min successes for total success
    singleton,      // true if returning a single value
    advance,        // if the value is replaced with previous results
    early           // if true, stop when needed is met
) {

// The 'run' function does the work of the fallback, parallel, race, and
// sequence factories. It takes the name of the factory, an array of
// requestors, the callback, an initial value, and some specifiers.

    if (typeof callback !== "function" || callback.length !== 2) {
        throw make_reason(factory_name, "Not a callback function.", callback);
    }
    if (!Array.isArray(requestor_array)) {
        throw make_reason(
            factory_name,
            "Bad requestor array.",
            requestor_array
        );
    }

// If the requestor_array is empty, fire the callback immediately.

    if (requestor_array.length === 0) {
        callback(initial_value);
        return;
    }

// Check that every requestor is a function with 2 arguments: 'callback' and
// 'initial_value'. Checking now makes debugging easier because the throw will
// happen in this turn.

    requestor_array.forEach(
        function check_requestor(requestor) {
            if (typeof requestor !== "function" || requestor.length !== 2) {
                throw make_reason(
                    factory_name,
                    "Bad requestor function.",
                    requestor
                );
            }
        }
    );

    let pending = requestor_array.length;
    let the_value = initial_value;
    let results;
    let the_result;
    if (!singleton) {
        results = new Array(pending);
    }
    let cancel_array = new Array(pending);
    let next_number = 0;
    let strikes = pending - needed;
    let successes = 0;

// We need 'cancel' and 'next' functions.

    function cancel(
        reason = make_reason(factory_name, "Cancel."),
        convey = false
    ) {

// Stop all unfinished business. This can be called when a requestor fails.
// It can also be called when a requestor succeeds, such as 'race'. It can be
// called if the program that started the requestor no longer needs the work.
// It is also called by 'time_limit' if the time has been exceeded.

// It creates an opportunity to send a message to stop useless work. It is not
// and undo. It is completely optional and advisory.

// If anything is still going, cancel it.

        if (cancel_array !== undefined) {
            cancel_array.forEach(function (cancel) {
                try {
                    if (typeof cancel === "function") {
                        return cancel(reason);
                    }
                } catch (ignore) {}
            });
            cancel_array = undefined;
        }

    // If it is still necessary to convey a result, do so now.

        if (convey) {
            if (successes >= needed) {
                callback(
                    singleton
                    ? the_result
                    : results
                );
            } else {
                callback(undefined, reason);
            }
        }
    }

    function next(value) {

// Start the execution of a requestor, if there are any still waiting.

        if (
            cancel_array !== undefined
            && next_number < requestor_array.length
        ) {

// Each requestor has a number.

            let number = next_number;
            next_number = next_number + 1;

// Call the next requestor, passing in a callback function,
// saving the cancel function that the requestor might return.

            const requestor = requestor_array[number];
            try {
                cancel_array[number] = requestor(
                    function next_callback(value, reason) {

// This 'next_callback' function is called by a 'requestor' when it is done.
// This 'next_callback' function should only be called once. If we are no
// longer running, then this call is ignored.

                        if (
                            cancel_array !== undefined
                            && number !== undefined
                        ) {

// We no longer need the cancel associated with this request.

                            cancel_array[number] = undefined;
                            pending -= 1;

// The requestor succeeded.

                            if (value !== undefined) {
                                successes += 1;
                                if (singleton) {
                                    the_result = value;
                                } else {
                                    results[number] = value;
                                }
                                if (advance) {
                                    the_value = value;
                                }
                                if (
                                    pending <= 0
                                    || (early && successes >= needed)
                                ) {
                                    cancel("", true);
                                    number = undefined;
                                    return;
                                }

// The requestor failed.

                            } else {
                                if (strikes <= 0 || pending <= 0) {
                                    cancel(reason, true);
                                    number = undefined;
                                    return;
                                }
                                strikes -= 1;
                            }

// Clear 'number' so this callback can not be used again.

                            number = undefined;

// Start the next requestor.

                            return next(the_value);
                        }
                    },
                    value
                );

// Requestors are required to report their failure thru the callback.
// They are not allowed to throw exceptions. If we happen to catch one,
// it is treated as a failure.

            } catch (exception) {
                number = undefined;
                if (strikes <= 0 || pending <= 0) {
                    cancel(exception, true);
                } else {
                    strikes -= 1;
                    next(the_value);
                }
            }
        }
    }

// With the 'cancel' and the 'next' functions in hand,
// we can now get to work.

// Call all of the requestor functions in the array. Each of them might return
// a cancel function that is kept in the 'cancel_array'. Initially, we only
// start as many as the throttle allows. Each is started in a separate turn.

    if (!Number.isSafeInteger(throttle) || throttle <= 0) {
        throw make_reason(factory_name, "Bad throttle.", throttle);
    }
    let repeat = Math.min(throttle, requestor_array.length);
    while (repeat > 0) {
        setTimeout(next, 0, initial_value);
        repeat -= 1;
    }

// We return 'cancel', which allows the requestor to try to cancel this work.

    return cancel;
}

// The factories //////////////////////////////////////////////////////////////

function fallback(requestor_array) {
    return function fallback_requestor(callback, initial_value) {
        return run(
            "fallback",
            requestor_array,
            1,
            callback,
            initial_value,
            1,
            true,
            false,
            true
        );
    };
}

function parallel(requestor_array, throttle, need = requestor_array.length) {
    if (
        !Number.isSafeInteger(need)
        || need < 0
        || need > requestor_array.length
    ) {
        throw make_reason("parallel", "Bad need.", need);
    }
    return function parallel_requestor(callback, initial_value) {
        return run(
            "parallel",
            requestor_array,
            (
                (
                    !Number.isSafeInteger(throttle)
                    || throttle < 0
                    || throttle > requestor_array.length
                )
                ? requestor_array.length
                : throttle
            ),
            callback,
            initial_value,
            need,
            false,
            false,
            false
        );
    };
}

function race(requestor_array, throttle, need) {
    let needed = 1;
    let singleton = true;
    if (need !== undefined) {
        if (
            !Number.isSafeInteger(need)
            || need < 0
            || (need === 0 && requestor_array.length > 0)
            || (
                requestor_array.length > 0
                && (need > requestor_array.length || need === 0)
            )
        ) {
            throw make_reason("race", "Bad need.", need);
        }
        needed = need;
        singleton = false;
    }
    return function race_requestor(callback, initial_value) {
        return run(
            "race",
            requestor_array,
            (
                (
                    !Number.isSafeInteger(throttle)
                    || throttle < 1
                    || throttle > requestor_array.length
                )
                ? requestor_array.length
                : throttle
            ),
            callback,
            initial_value,
            needed,
            singleton,
            false,
            true
        );
    };
}

function sequence(requestor_array) {
    return function sequence_requestor(callback, initial_value) {
        return run(
            "sequence",
            requestor_array,
            1,
            callback,
            initial_value,
            requestor_array.length,
            true,
            true,
            false
        );
    };
}

function time_limit(requestor, milliseconds) {
    if (typeof requestor !== "function") {
        throw make_reason("time_limit", "requestor", requestor);
    }
    if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
        throw make_reason("time_limit", "milliseconds", milliseconds);
    }
    return function time_limit_requestor(callback, input) {
        if (typeof callback !== "function") {
            throw make_reason("time_limit", "callback", callback);
        }
        let working = true;
        let time_limit_cancel;
        let clear = setTimeout(
            function () {
                if (working) {
                    let reason = make_reason(
                        "time_limit",
                        "time expired",
                        milliseconds
                    );
                    if (typeof time_limit_cancel === "function") {
                        time_limit_cancel(reason, true);
                    }
                    if (working) {
                        callback(undefined, reason);
                    }
                    working = false;
                }
            },
            milliseconds
        );
        time_limit_cancel = requestor(
            function time_limit_callback(value, reason) {
                if (working) {
                    callback(value, reason);
                    working = false;
                }
                if (clear) {
                    clearTimeout(clear);
                }
            },
            input
        );
        return function cancel(reason) {
            if (working) {
                if (typeof time_limit_cancel === "function") {
                    time_limit_cancel(reason);
                }
                callback(undefined, reason);
                working = false;
                if (clear) {
                    clearTimeout(clear);
                }
            }
        };
    };
}

function requestorize(unary) {
    return function requestor(callback, value) {
        try {
            return callback(unary(value));
        } catch (exception) {
            return callback(undefined, exception ?? unary.name);
        }
    };
}


function objectify(factory) {

// THe objectify factory takes a factory that takes an array of requestors,
// and returns a factory that takes an object of requestors, and will
// reconstruct the resulting array into an object. Factories that operate
// on arrays include parallel and race.

    return function objectified_factory(object_of_requestors, ...rest) {

// Check the object.

        if (
            typeof object_of_requestors !== "object"
            || object_of_requestors === null
            || Array.isArray(object_of_requestors)
        ) {
            throw make_reason(
                "objectified_factory",
                "Bad object of requestors",
                object_of_requestors
            );
        }

// Deconstruct the object_of_requestors into an array of keys and a
// corresponding array of values.

        const keys = Object.keys(object_of_requestors);
        const requestor_array = keys.map(function (key) {
            return object_of_requestors[key];
        });

// Use the factory to make a private requestor.

        const private_requestor = factory(requestor_array, ...rest);

// Return the objectified requestor.

        return function objectified_requestor(callback, initial_value) {

// When objectified_requestor is called, we return the result of the
// private_requestor with a callback that converts the result array
// into an object if possible.

            return private_requestor(
                function objectified__callback(value, reason) {
                    if (
                        !Array.isArray(value)
                        || value.length !== keys.length
                    ) {
                        return callback(value, reason);
                    }
                    const object = Object.create(null);
                    keys.forEach(function (name, index) {
                        object[name] = value[index];
                    });
                    return callback(object);
                },
                initial_value
            );
        };
    };
}

export default Object.freeze({
    fallback,
    objectify,
    parallel,
    race,
    requestorize,
    sequence,
    time_limit
});
