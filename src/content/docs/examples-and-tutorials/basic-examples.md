---
title: Basic Examples
description: Examples related Cortex Data Framework
---

## Examples and Tutorials

## Overview

Welcome to the Cortex Examples and Tutorials page! This guide is designed to help you understand how to use Cortex by walking you through various examples, ranging from basic data transformations to advanced stream processing scenarios. We'll cover all types of operators, including **TumblingWindow**, **SlidingWindow**, and **SessionWindow**, ensuring that they are used appropriately within the stream processing pipeline.


### Example 1: Basic Data Transformation
**Objective**: Transform a stream of integers by doubling each number using the Map operator.

```csharp
using Cortex.Streams;

var streamBuilder = StreamBuilder<int, int>.CreateNewStream("DoubleNumbersStream");

streamBuilder
    .Stream()
    .Map(x => x * 2)
    .Sink(x => Console.WriteLine($"Doubled number: {x}"));

var stream = streamBuilder.Build();
stream.Start();

// Emitting numbers into the stream
stream.Emit(1); // Output: Doubled number: 2
stream.Emit(2); // Output: Doubled number: 4
stream.Emit(3); // Output: Doubled number: 6

stream.Stop();
```

**Explanation**:
- **Stream Operator**: Initiate the Stream to accept emits from the user.
- **Map Operator**: Transforms each input number by multiplying it by 2.
- **Sink Operator**: Outputs the transformed number to the console.

### Example 2: Filtering Data
**Objective**: Filter out negative numbers from a stream using the Filter operator.

```csharp
using Cortex.Streams;

var streamBuilder = StreamBuilder<int, int>.CreateNewStream("PositiveNumbersStream");

streamBuilder
    .Stream()
    .Filter(x => x >= 0)
    .Sink(x => Console.WriteLine($"Positive number: {x}"));

var stream = streamBuilder.Build();
stream.Start();

// Emitting numbers into the stream
stream.Emit(-1); // No output
stream.Emit(0);  // Output: Positive number: 0
stream.Emit(5);  // Output: Positive number: 5

stream.Stop();
```
**Explanation**:
- **Filter Operator**: Allows only numbers greater than or equal to zero to pass through.
- **Sink Operator**: Outputs the positive numbers to the console.
