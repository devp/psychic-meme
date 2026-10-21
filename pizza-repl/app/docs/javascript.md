# JavaScript, briefly

## Values

```
1 + 2                // 3
"pizza".length       // 5
[1, 2, 3].map(x => x * x)
({ slice: 1, rat: true })   // parens, or { } reads as a block
```

The last result is `_`:

```
6 * 7
_ + 1                // 43
```

## What persists between entries

Each entry is evaluated on its own, at global scope:

```
var a = 1            // persists
function sq(n) { return n * n }   // persists
let b = 2            // gone after this entry
globalThis.c = 3     // persists
```

## Printing

`console.log(...)` output appears before the entry's value.

```
console.log("hi"); 5
```

## Functions

```
const add = (x, y) => x + y   // this entry only; use var to keep it
function fact(n) { return n <= 1 ? 1 : n * fact(n - 1) }
fact(10)
```

## Arrays and objects

```
var xs = [3, 1, 2]
xs.toSorted()
xs.filter(x => x > 1)
xs.reduce((a, b) => a + b, 0)
Object.entries({ a: 1, b: 2 })
```

## Strings

```
`template ${1 + 1}`
"a,b,c".split(",")
"Pizza".toUpperCase()
```

## Errors

A thrown error shows in red and leaves earlier definitions alone:

```
nope()               // ReferenceError: nope is not defined
```
