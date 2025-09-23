---
title: Cortex.Types - Union and Intersection Types
description: Cortex Types
---

The *Cortex.Types* library provides utility types to ease working with values that might be one of several types (union types) or that must simultaneously satisfy multiple type constraints (intersection types). This page covers three related constructs:

- AnyOf – a union type container that can hold a value from a set of types.
- OneOf – a union type container that conceptually guarantees that the stored value is exactly one of the given types.
- AllOf – an intersection type container used when a single value must conform to several type contracts (often via multiple interfaces).


## Comparison and Best Practices

- **AnyOf** vs. **OneOf**:

    - **AnyOf** is used when a value can be any one (or in some cases, more than one) of the declared types. Due to inheritance, a stored value might be assignable to multiple type parameters.
    - **OneOf** is intended for cases where exactly one type is valid for the stored value. It enforces a stricter one-type contract and makes the intended usage clearer.

- **Using AllOf**:\
When you need to work with an object that implements multiple interfaces (or satisfies several type contracts), use AllOf. This pattern is ideal for dependency injection scenarios or for handling objects with multiple facets without resorting to manual casts.

- **Pattern Matching**:\
Both union types (AnyOf/OneOf) and intersection types (AllOf) benefit from built-in pattern matching methods like `Match` and `Switch`. These methods reduce boilerplate and centralize type-dependent logic in a clear and type-safe manner.

- **Implicit Conversions**:\
The design leverages implicit conversion operators to minimize verbosity. A value of a declared type can be assigned directly to the container without explicit wrapping.