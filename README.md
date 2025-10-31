# Pronto

> *Extremism in the pursuit of parallelism is no vice.*

Pronto provides a straightforward functional approach to the management of eventuality, concurrency, and parallelism. Pronto embraces the paradigm of distributed message passing. In the Pronto Method, you break all of the programmatic parts into black box functions called _requestors_. This sort of composition is a good design practice. Pronto then provides a way of temporally linking the black boxes together. This produces programs that are easier to test, maintain, and reason about than practices that muddle the work and flow together.

Structure your application as a set of requestor functions that each performs or manages a unit of work. That work might be done in other processes or other machines or by a human. This is a good design pattern in general. The workflow is specified by assembling the requestors into arays that are passed to the Pronto factories. The units of work are kept distinct from the mechanics of control flow, leading to better programs.

Pronto packages its own work into requestors, which means that requestor arrays can be nested in useful ways.

Pronto is in the Public Domain.

## Function Types

Pronto uses four types of functions.

### Factory

A factory function is any function that returns a requestor function. Pronto provides these factory functions:

    pronto.fallback(requestor_array)
    returns requestor

    pronto.parallel(requestor_array, throttle, need)
    returns requestor

    pronto.race(requestor_array, throttle, need)
    returns requestor

    pronto.sequence(requestor_array)
    returns requestor

    pronto.time_limit(requestor, milliseconds)
    returns requestor

    pronto.requestorize(unary)
    returns requestor

Each of these factory functions returns a requestor function. A factory function may throw an exception if it finds problems in its arguments. You can write your own factory functions too. A factory function is a useful tool in developing the black boxes. A factory throw an exception if it can determine that any of its arguments are wrong.

Pronto also provides a factory factory.

    pronto.objectify(factory)
    returns factory

### Requestor

A requestor function is any function that takes a `callback` and a `value`.

    my_little_requestor(callback, value)

A requestor can do some work or send a message to another process or system. When the work is done, the requestor signals the result by passing a result to its `callback`. The `callback` can be called in a future turn, so the requestor does not need to block, nor should it ever block.

The `value` may be of any type, including objects, arrays, and `undefined`.

A requestor can pass its `value` parameter to any requestors that it starts. A `sequence` passes the `value` parameter to its first requestor. It then passes the result of the previous requestor to the next requestor.

A requestor should not throw an exception. It should communicate all failures through its `callback`.

### Callback

A callback function takes two arguments: `value` and `reason`.

    my_little_callback(value, reason)

If `value` is `undefined`, then failure is signalled. `reason` may contain information explaining the failure. If `value` is not `undefined`, then success is  signalled and `value` contains the result. Generally, programs should not branch on the `reason`, instead acting in a consistent way after a failure.

### Cancel

A requestor function may return a `cancel` function. A `cancel` function takes a `reason` argument that might be propagated and logged as the `reason` a requestor failed.

    my_little_cancel(reason)

A `cancel` function attempts to stop the operation of the requestor. If a program decides that it no longer needs the result of a requestor, it can call the `cancel` function that the requestor returned. This is not an undo operation. It is just a way of stopping unneeded work. There is no guarantee that the work actually stops. The cancel mechanism is totally optional and advisory. It is provided to give you the opportunity to prevent the wasting of resources.

For example, in a race, one requestor wins, and the results of all of the other requestors are redundant. The race requestor can call the cancel functions of the requestors in the requestor_array to attempt to stop the waste..

## The Pronto Object

[pronto.js](https://github.com/douglascrockford/Pronto/blob/master/pronto.js) is a module that exports the `pronto` object.

    import pronto from "./pronto.js";

It contains these functions:

### Fallback

    pronto.fallback(
        requestor_array
    )

`pronto.fallback` returns a requestor function. When the requestor is called, it calls the first requestor in `requestor_array`. If that is ultimately successful, its value is passed to the callback. But if that requestor fails, the next requestor is called, and so on. If none of the requestors is successful, then the fallback fails. If any succeeds, then the fallback succeeds.

The fallback requestor returns a `cancel` function that can be called when the result is no longer needed.

### Parallel

    pronto.parallel(
        requestor_array,
        throttle,
        need
    )

`pronto.parallel` returns a requestor that processes the `requestor_array` requestors in parallel, producing an array of all of results. The value produced by the first element of the `requestor_array` provides the first element of the result. If any requestor fails, the pending requestors are cancelled and this operation fails.

By default, it starts all of the requestors in the `requestor_array` at once, each in its own turn so that they do not interfere with each other. This can shock some systems by unleashing a lot of demand at once. To mitigate the shock, the optional `throttle` argument sets the maximum number of requestors running at a time. As requestors succeed or fail, waiting requestors can be started.

By default, all of the requestors in the `requestor_array` must succeed. Optionally, a smaller number of needed results can be specified. If the number of successes is greater than or equal to `need`, then the whole operation succeeds. The `need` argument must be between `0` and `requestor_array.length`.

### Race

    pronto.race(
        requestor_array,
        throttle,
        need
    )

`pronto.race` returns a requestor that starts all of the requestors in `requestor_array`, like `pronto.parallel` does. Its result is the result of the first of those requestors to successfully finish. All of the other requestors are cancelled. If all of those requestors fail, then the race fails.

By default, it starts all of the requestors in the `requestor_array` at once, each in its own turn so that they do not interfere with each other. This can shock some systems by unleashing a lot of demand at once. To mitigate the shock, the optional `throttle` argument sets the maximum number of requestors running at a time. As requestors succeed or fail, waiting requestors can be started.

By default, a single result is produced. If an array of results is need, specify the needed number of results in the `need` parameter. When the needed number of successful results is obtained, the operation ends. The results go into a sparce array, and unfinished requestors are cancelled. The `need` argument must be between `1` and `requestor_array.length`.

### Sequence

    pronto.sequence(
        requestor_array
    )

`pronto.sequence` returns a requestor that processes each requestor in `requestor_array` one at a time. Each of those requestors is passed the result of the previous requestor as its `value` argument. If all succeed, then the sequence succeeds, giving the result of the last of the requestors. If any fail, then the sequence fails.

### Time Limit

    pronto.time_limit(
        requestor,
        milliseconds
    )

`pronto.time_limit` returns a requestor that acts just like the `requestor` argument except that it will cancel itself after the `milliseconds` elapse. Note that if `pronto.parallel` has satisfied its `need` but has not completed yet, the time expiring will cancel the unfinished requestors resulting in success.

The `cancel` returned by the time limited requestor does not cancel the time limit. It cancels the `requestor`.

### Requestorize

    pronto.requestorize(
        unary
    )

`pronto.requestorize` takes a unary function (a function that takes one argument) and returns a requestor. This makes it possible to insert ordinary local functions into a sequence. The requestor does not return a cancel function because the requestor finishes in the same turn.

### Objectify

    pronto.objectify(
        requestor
    )

`pronto.objectify` takes a factory that takes a `requestor_array` and returns a factory that takes an `object_of_requestors`. If possible, the objectified requestor will deliver an object using the same keys to its `callback`.

## Demo

A demonstration of Pronto is provided in two files that use `pronto.js`:

- [demo.html](https://github.com/douglascrockford/Pronto/blob/master/pronto_demo.html)
- [demo.js](https://github.com/douglascrockford/Pronto/blob/master/pronto_demo.js)

It is live at [The Pronto Demonstration](https://www.crockford.com/pronto_demo.html).

---

Pronto supersedes Parseq and RQ.
