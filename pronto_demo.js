// pronto_demo.js
// 2025-10-30

// This is used by pronto_demo.html to demonstrate pronto.js. It includes a widget
// function that represents a service factory, a show callback that displays the
// final result, and a demonstration program.

// This interacts with the browser using Plain Old DOM.

/*jslint
    browser
*/

/*property
    addEventListener, alfa, append, bravo, charlie, children, className,
    cloneNode, create, createElement, delta, echo, fallback, firstChild,
    forEach, getElementById, length, message, name, objectify, outerHTML,
    parallel, prepend, race, removeChild, replaceChildren, requestorize,
    sequence, stringify, tagName, target, time_limit, toLowerCase, toString,
    type, value
*/

import pronto from "./pronto.js";

const choice = document.getElementById("choice");
const demo = document.getElementById("demo");
const source = document.getElementById("source");
const proto = demo.removeChild(demo.firstChild);

function widget(name) {
    return function widget_requestor(callback, value) {
        let span = proto.cloneNode(true);
        let success = span.firstChild;
        let failure = span.children[1];
        span.prepend(name);
        success.addEventListener(
            "click",
            function success_handler() {
                span.className = "success";
                return callback(
                    value !== undefined
                    ? value + "." + name
                    : name
                );
            },
            false
        );
        failure.addEventListener(
            "click",
            function failure_handler() {
                span.className = "failure";
                return callback(undefined, name);
            },
            false
        );
        demo.append(span, " ");
        return function widget_cancel() {
            span.className = "cancelled";
        };
    };
}

function show(value, reason) {
    let span = proto.cloneNode(true);
    let result;
    let status;
    if (value !== undefined) {
        result = JSON.stringify(value);
        status = "success";
    } else {
        if (reason instanceof Error) {
            result = reason.message;
        } else {
            result = (
                typeof result === "string"
                ? result
                : JSON.stringify(reason)
            );
        }
        status = "failure";
    }
    span.prepend(status + " " + result);
    span.className = status;
    demo.append(span);
}

// The program array contains the cases that can be demonstrated.

const program = [
    function a_widget() {
        return widget("A");
    },
    function fallback() {

// Try each widget until one succeeds.

        return pronto.fallback(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ]
        );
    },
    function parallel() {

// Run all of the widgets at once. All must succeed.

        return pronto.parallel(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ]
        );
    },
    function parallel_3() {

// Run five widgets in parallel.
// At least three successes are needed.

        return pronto.parallel(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ],
            undefined,
            3
        );
    },
    function race() {

// Run five widgets in parallel.
// The first success wins, cancelling any unfinished.

        return pronto.race(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ]
        );
    },
    function race_3() {

// Run five widgets in parallel.
// Three successes are needed.

    return pronto.race(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ],
            undefined,
            3
        );
    },
    function sequence() {

// Run the widgets one at a time, giving the previous result to the next.

        return pronto.sequence(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ]
        );
    },
    "hr",
    function throttle() {

// Run all five widgets in parallel, but no more than two can be running
// at a time.

        return pronto.parallel(
            [
                widget("A"),
                widget("B"),
                widget("C"),
                widget("D"),
                widget("E")
            ],
            2
        );
    },
    function time_limit() {

// Run five widgets in parallel.
// Three successes are needed.
// It takes no more than 10 seconds.

        return pronto.time_limit(
            pronto.parallel(
                [
                    widget("A"),
                    widget("B"),
                    widget("C"),
                    widget("D"),
                    widget("E")
                ],
                undefined,
                3
            ),
            10000
        );
    },
    function complex() {

// A sequence containing a parallel containing a fallback and a race with
// another parallel. The final stage of the sequence passes the result of
// the outer parallel to an ordinary function that has been requestorized.

        return pronto.sequence([
            widget("A"),
            pronto.parallel([
                pronto.fallback([
                    widget("F1"),
                    widget("F2"),
                    widget("F3")
                ]),
                pronto.race([
                    widget("R1"),
                    widget("R2"),
                    widget("R3"),
                    pronto.parallel([
                        widget("P1"),
                        widget("P2"),
                        widget("P3")
                    ])
                ])
            ]),
            pronto.requestorize(function ordinary(value) {
                return value.length + ": " + JSON.stringify(value) + "!";
            })
        ]);
    },
    function objectified() {

// Process an object in parallel.

        return pronto.objectify(pronto.parallel)(
            {
                alfa: widget("A"),
                bravo: widget("B"),
                charlie: widget("C"),
                delta: widget("D"),
                echo: widget("E")
            }
        );
    }
];

const index = Object.create(null);

program.forEach(function buttonize(element, subscript) {
    let node;
    if (typeof element === "function") {
        node = document.createElement("input");
        node.type = "button";
        node.value = element.name;
        index[element.name] = subscript;
    } else if (typeof element === "string") {
        node = document.createElement(element);
    }
    choice.append(node, " ");
});

choice.addEventListener("click", function (event) {
    demo.replaceChildren();
    source.replaceChildren();
    if (event.target.tagName.toLowerCase() === "input") {
        const the_program = program[index[event.target.value]];
        source.append(the_program.toString());
        the_program()(show);
    }
});
document.getElementById("widget_source").addEventListener(
    "click",
    function (ignore) {
        demo.replaceChildren();
        source.replaceChildren(widget.toString());
    }
);
document.getElementById("proto_widget").addEventListener(
    "click",
    function (ignore) {
        demo.replaceChildren();
        source.replaceChildren(proto.outerHTML);
    }
);
