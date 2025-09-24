---
title: Intermediate  Examples
description: Examples related Cortex Data Framework
---

## Examples and Tutorials

## Overview

Welcome to the Cortex Examples and Tutorials page! This guide is designed to help you understand how to use Cortex by walking you through various examples, ranging from basic data transformations to advanced stream processing scenarios. We'll cover all types of operators, including **TumblingWindow**, **SlidingWindow**, and **SessionWindow**, ensuring that they are used appropriately within the stream processing pipeline.


### Example 1: Grouping and Aggregation
**Objective**: Count occurrences of words in a stream using the Aggregate operator.

```csharp
using Cortex.Streams;
using Cortex.States;

var streamBuilder = StreamBuilder<string, string>.CreateNewStream("WordCountStream");

streamBuilder
    .Stream()
    .AggregateSilently<string, int>(
        keySelector: word => word,
        aggregateFunction: (count, _) => count + 1
    )
    .Sink(word => Console.WriteLine($"Word: {word}"));

var stream = streamBuilder.Build();
stream.Start();

// Emitting words into the stream
stream.Emit("apple");
stream.Emit("banana");
stream.Emit("apple");
stream.Emit("orange");
stream.Emit("banana");
stream.Emit("apple");

// Expected Output: when you GetAll records from WordCountStream
// Word: apple, Count: 1
// Word: banana, Count: 1
// Word: apple, Count: 2
// Word: orange, Count: 1
// Word: banana, Count: 2
// Word: apple, Count: 3

stream.Stop();
```
**Explanation**:
- **Aggregate Operator**: Maintains a count of each unique word using an in-memory state store.


### Example 2: Tumbling Window Example
**Objective**: Compute the sum of numbers over a tumbling window of 5 seconds using the TumblingWindow operator.

```csharp
using Cortex.Streams;
using System.Timers;

var stream = StreamBuilder<int, int>.CreateNewStream("SumTumblingWindowStream")
   .Stream()
   .TumblingWindow<string, int>(
       keySelector: _ => "Sum", // Single window
       windowDuration: TimeSpan.FromSeconds(5),
       windowFunction: numbers => numbers.Sum()
   )
   .Sink(sum => Console.WriteLine($"Sum over window: {sum}"))
   .Build();

var stream = streamBuilder.Build();
stream.Start();

// Emitting numbers into the stream every second
var timer = new Timer(1000);
int counter = 1;
timer.Elapsed += (sender, args) =>
{
    if (counter <= 10)
    {
        stream.Emit(counter);
        counter++;
    }
    else
    {
        timer.Stop();
        stream.Stop();
    }
};
timer.Start();

// Expected Output (after every 5 seconds):
// Sum over window: 15  (1+2+3+4+5)
// Sum over window: 40  (6+7+8+9+10)
```

**Explanation**:
- **TumblingWindow Operator**: Groups numbers into fixed, non-overlapping windows of 5 seconds.
- **Window Function**: Calculates the sum of numbers in each window.
- **Sink Operator**: Outputs the sum after each window closes.

### Example 3: Sliding Window Example
**Objective**: Calculate the moving average of stock prices over a sliding window using the SlidingWindow operator.

```csharp
using Cortex.Streams;
using Cortex.States;

public class StockPrice
{
    public string Symbol { get; set; }
    public double Price { get; set; }
}

var stream = StreamBuilder<StockPrice, StockPrice>.CreateNewStream("StockPriceStream")
    .Stream()
    .SlidingWindow<string, double>(
        keySelector: stock => stock.Symbol,
        windowSize: TimeSpan.FromSeconds(10),
        advanceBy: TimeSpan.FromSeconds(5),
        windowFunction: prices => prices.Average(p => p.Price)
    )
    .Sink(avgPrice => Console.WriteLine($"Moving average price: {avgPrice}"))
    .Build();

stream.Start();

// Emitting stock prices every 2 seconds
var timer = new System.Timers.Timer(2000);
int tick = 0;
timer.Elapsed += (sender, args) =>
{
    if (tick < 10)
    {
        var price = new StockPrice { Symbol = "MSFT", Price = 150 + tick };
        stream.Emit(price);
        tick++;
    }
    else
    {
        timer.Stop();
        stream.Stop();
    }
};
timer.Start();

// Expected Output:
// Every 5 seconds, the moving average over the last 10 seconds is printed.
```

**Explanation**:
- **SlidingWindow Operator**: Creates overlapping windows of 10 seconds, advancing every 5 seconds.
- **Window Function**: Calculates the average stock price within each window.
- **Sink Operator**: Outputs the moving average price.


### Example 4: Session Window Example

**Objective**: Detect periods of user inactivity using the SessionWindow operator.

```csharp
using Cortex.Streams;
using Cortex.States;

public class UserAction
{
    public string UserId { get; set; }
    public DateTime Timestamp { get; set; }
}

var stream = StreamBuilder<UserAction, UserAction>.CreateNewStream("UserSessionStream")
    .Stream()
    .SessionWindow<string, TimeSpan>(
        keySelector: action => action.UserId,
        inactivityGap: TimeSpan.FromSeconds(5),
        windowFunction: actions =>
        {
            var sessionDuration = actions.Last().Timestamp - actions.First().Timestamp;
            return sessionDuration;
        }
    )
    .Sink(duration => Console.WriteLine($"Session duration: {duration.TotalSeconds} seconds"))
    .Build();

stream.Start();

// Simulating user actions with inactivity gaps
stream.Emit(new UserAction { UserId = "User1", Timestamp = DateTime.UtcNow });
System.Threading.Thread.Sleep(2000); // Active within 5 seconds
stream.Emit(new UserAction { UserId = "User1", Timestamp = DateTime.UtcNow });
System.Threading.Thread.Sleep(6000); // Inactivity gap greater than 5 seconds
stream.Emit(new UserAction { UserId = "User1", Timestamp = DateTime.UtcNow });

// Expected Output:
// Session duration: 2 seconds (First session)
// Session duration: 0 seconds (Second session)

```

**Explanation**:
- **SessionWindow Operator**: Groups events into sessions based on user activity, closing a session if there's inactivity for more than 5 seconds.
- **Window Function**: Calculates the duration of each session.
- **Sink Operator**: Outputs the session duration.
