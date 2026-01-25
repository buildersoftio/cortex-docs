---
title: Window Triggers
description: Window Triggers in Cortex.Streams
---

# Window Triggers

## Overview

**Window Triggers** control when windows emit their results. By default, windows emit once when the window time ends. However, triggers give you fine-grained control over result emission timing, enabling patterns like early partial results, count-based emissions, or custom business logic.

## Trigger Results

Every trigger evaluation returns one of three results:

| Result | Behavior |
|--------|----------|
| `Continue` | Do nothing, keep accumulating |
| `Fire` | Emit current window contents, keep window open |
| `FireAndPurge` | Emit contents and close the window |

## Built-in Triggers

### EventTimeTrigger (Default)

Fires when the window's end time is reached. This is the default behavior.

```csharp
using Cortex.Streams.Operators.Windows.Triggers;

var config = WindowConfiguration<Event>.Create()
    .WithTrigger(new EventTimeTrigger<Event>())
    .Build();
```

Behavior:
- Does nothing on element arrival
- Fires `FireAndPurge` when processing time >= window end time

### CountTrigger

Fires every N elements:

```csharp
var config = WindowConfiguration<Order>.Create()
    .TriggerOnCount(100)  // Fire every 100 elements
    .Build();

// Explicit usage
var config2 = WindowConfiguration<Order>.Create()
    .WithTrigger(CountTrigger<Order>.Of(100))
    .Build();
```

**Use Cases:**
- Batch processing with guaranteed batch sizes
- Rate limiting (fire at capacity)
- Micro-batching for efficiency

**Example: Order Processing in Batches**

```csharp
var stream = StreamBuilder<Order, Order>
    .CreateNewStream("Order Batch Processor")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: o => o.WarehouseId,
        timestampSelector: o => o.OrderTime,
        windowSize: TimeSpan.FromHours(1),
        config: WindowConfiguration<Order>.Create()
            .TriggerOnCount(50)  // Process in batches of 50
            .WithStateMode(WindowStateMode.Discarding)
            .Build())
    .Sink(batch => ProcessOrderBatch(batch.Items))
    .Build();
```

### ProcessingTimeTrigger

Fires at regular time intervals based on processing time (wall clock):

```csharp
var config = WindowConfiguration<Event>.Create()
    .TriggerOnProcessingTime(TimeSpan.FromSeconds(30))  // Fire every 30 seconds
    .Build();

// Explicit usage
var config2 = WindowConfiguration<Event>.Create()
    .WithTrigger(ProcessingTimeTrigger<Event>.Every(TimeSpan.FromSeconds(30)))
    .Build();
```

**Use Cases:**
- Regular dashboard updates
- Periodic aggregation snapshots
- Heartbeat-style emissions

**Example: Real-time Dashboard Updates**

```csharp
var stream = StreamBuilder<Metric, Metric>
    .CreateNewStream("Dashboard Metrics")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: m => m.Category,
        timestampSelector: m => m.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        config: WindowConfiguration<Metric>.Create()
            .TriggerOnProcessingTime(TimeSpan.FromSeconds(10))
            .WithStateMode(WindowStateMode.Accumulating)
            .Build())
    .Sink(window => UpdateDashboard(window))
    .Build();
```

### EarlyTrigger

Emits early partial results at specified intervals, with final emission at window close:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithEarlyTrigger(TimeSpan.FromMinutes(1))  // Partial results every minute
    .Build();
```

**Behavior:**
- `Fire` at each interval (partial result)
- `FireAndPurge` at window end (final result)

**Use Cases:**
- Long windows that need real-time updates
- Progressive aggregation display
- User experience optimization

**Example: Long-Running Analysis with Progress**

```csharp
var stream = StreamBuilder<Transaction, Transaction>
    .CreateNewStream("Hourly Transaction Analysis")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: t => t.AccountId,
        timestampSelector: t => t.Timestamp,
        windowSize: TimeSpan.FromHours(1),
        config: WindowConfiguration<Transaction>.Create()
            .WithEarlyTrigger(TimeSpan.FromMinutes(5))
            .WithStateMode(WindowStateMode.Accumulating)
            .Build())
    .Map(window =>
    {
        var label = window.IsFinal ? "FINAL" : $"UPDATE #{window.EmissionSequence}";
        var sum = window.Items.Sum(t => t.Amount);
        return $"[{label}] Account {window.Key}: ${sum:N2}";
    })
    .Sink(Console.WriteLine)
    .Build();
```

## Composite Triggers

### OrTrigger

Fires when **either** of two triggers fires:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithTrigger(new OrTrigger<Event>(
        new CountTrigger<Event>(1000),           // Fire at 1000 elements
        ProcessingTimeTrigger<Event>.Every(TimeSpan.FromMinutes(1))  // OR every minute
    ))
    .Build();
```

**Use Cases:**
- "First to fire" scenarios
- Guaranteed maximum latency with minimum batch size
- Flexible emission policies

**Example: Smart Batching**

```csharp
// Fire when we have 100 items OR after 30 seconds, whichever comes first
var stream = StreamBuilder<LogEntry, LogEntry>
    .CreateNewStream("Log Batcher")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: l => l.Source,
        timestampSelector: l => l.Timestamp,
        windowSize: TimeSpan.FromHours(1),
        config: WindowConfiguration<LogEntry>.Create()
            .WithTrigger(new OrTrigger<LogEntry>(
                CountTrigger<LogEntry>.Of(100),
                ProcessingTimeTrigger<LogEntry>.Every(TimeSpan.FromSeconds(30))))
            .WithStateMode(WindowStateMode.Discarding)
            .Build())
    .Sink(batch => SendToElasticsearch(batch.Items))
    .Build();
```

### AndTrigger

Fires only when **both** triggers have fired:

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithTrigger(new AndTrigger<Event>(
        new CountTrigger<Event>(50),              // Need at least 50 elements
        ProcessingTimeTrigger<Event>.Every(TimeSpan.FromMinutes(1))   // AND 1 minute passed
    ))
    .Build();
```

**Use Cases:**
- Minimum batch size with time guarantee
- Quorum-style conditions
- Complex business rules

**Example: Guaranteed Minimum Batch**

```csharp
// Only fire if we have at least 10 items AND 1 minute has passed
var stream = StreamBuilder<Order, Order>
    .CreateNewStream("Order Aggregator")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: o => o.Region,
        timestampSelector: o => o.OrderTime,
        windowSize: TimeSpan.FromMinutes(10),
        config: WindowConfiguration<Order>.Create()
            .WithTrigger(new AndTrigger<Order>(
                CountTrigger<Order>.Of(10),
                ProcessingTimeTrigger<Order>.Every(TimeSpan.FromMinutes(1))))
            .Build())
    .Sink(ProcessRegionalOrders)
    .Build();
```

## Custom Triggers

### Using CustomTrigger

For complete control over trigger logic:

```csharp
var customTrigger = new CustomTrigger<Transaction>(
    onElement: (element, timestamp, windowStart, windowEnd, context) =>
    {
        // Fire immediately for high-value transactions
        if (element.Amount > 10000)
            return TriggerResult.Fire;
        
        // Normal accumulation
        return TriggerResult.Continue;
    },
    onProcessingTime: (processingTime, windowStart, windowEnd, context) =>
    {
        // Fire at window end
        if (processingTime >= windowEnd)
            return TriggerResult.FireAndPurge;
        
        return TriggerResult.Continue;
    },
    description: "HighValueTrigger: Fires immediately for transactions > $10,000"
);

var config = WindowConfiguration<Transaction>.Create()
    .WithTrigger(customTrigger)
    .Build();
```

### Using CustomTriggerBuilder

Fluent API for building custom triggers:

```csharp
var trigger = CustomTrigger<Event>.Create()
    .OnElement((element, timestamp, windowStart, windowEnd, context) =>
    {
        // Custom element logic
        return TriggerResult.Continue;
    })
    .OnProcessingTime((time, windowStart, windowEnd, context) =>
    {
        // Custom time logic
        return time >= windowEnd ? TriggerResult.FireAndPurge : TriggerResult.Continue;
    })
    .WithDescription("My Custom Trigger")
    .Build();
```

### Real-World Example: Priority-Based Trigger

```csharp
public record Alert(string AlertId, int Priority, string Message, DateTime Timestamp);

var priorityTrigger = new CustomTrigger<Alert>(
    onElement: (alert, timestamp, windowStart, windowEnd, context) =>
    {
        // Priority 1 (critical): Fire immediately
        if (alert.Priority == 1)
            return TriggerResult.Fire;
        
        // Priority 2 (high): Fire if we have 5 or more
        var highPriorityCount = context.GetState<int>("highPriorityCount");
        if (alert.Priority == 2)
        {
            highPriorityCount++;
            context.SetState("highPriorityCount", highPriorityCount);
            if (highPriorityCount >= 5)
            {
                context.SetState("highPriorityCount", 0);
                return TriggerResult.Fire;
            }
        }
        
        return TriggerResult.Continue;
    },
    onProcessingTime: (time, windowStart, windowEnd, context) =>
    {
        // Always fire at window end
        if (time >= windowEnd)
            return TriggerResult.FireAndPurge;
        
        // Fire every minute regardless of priority
        var lastFire = context.GetState<DateTime?>("lastPeriodicFire");
        if (!lastFire.HasValue || time - lastFire.Value >= TimeSpan.FromMinutes(1))
        {
            context.SetState("lastPeriodicFire", (DateTime?)time);
            return TriggerResult.Fire;
        }
        
        return TriggerResult.Continue;
    },
    description: "PriorityAlertTrigger"
);

var stream = StreamBuilder<Alert, Alert>
    .CreateNewStream("Alert Handler")
    .Stream()
    .AdvancedTumblingWindow<string>(
        keySelector: a => a.AlertId.Substring(0, 3),  // Group by alert category
        timestampSelector: a => a.Timestamp,
        windowSize: TimeSpan.FromMinutes(10),
        config: WindowConfiguration<Alert>.Create()
            .WithTrigger(priorityTrigger)
            .WithStateMode(WindowStateMode.Accumulating)
            .Build())
    .Sink(HandleAlertBatch)
    .Build();
```

## Trigger Context

Triggers have access to a `TriggerContext` that provides:

```csharp
public interface ITriggerContext<TInput>
{
    // Current count of elements in the window
    int ElementCount { get; }
    
    // Unique key for this window
    string WindowKey { get; }
    
    // Current processing time
    DateTime CurrentProcessingTime { get; }
    
    // Custom state storage
    TState GetState<TState>(string key);
    void SetState<TState>(string key, TState value);
    void ClearState();
}
```

**Using Trigger Context State:**

```csharp
var statefulTrigger = new CustomTrigger<Event>(
    onElement: (element, timestamp, windowStart, windowEnd, context) =>
    {
        // Track unique users
        var uniqueUsers = context.GetState<HashSet<string>>("uniqueUsers") 
            ?? new HashSet<string>();
        uniqueUsers.Add(element.UserId);
        context.SetState("uniqueUsers", uniqueUsers);
        
        // Fire when we have 100 unique users
        if (uniqueUsers.Count >= 100)
        {
            context.ClearState();  // Reset for next trigger
            return TriggerResult.Fire;
        }
        
        return TriggerResult.Continue;
    },
    onProcessingTime: (time, windowStart, windowEnd, context) =>
    {
        return time >= windowEnd ? TriggerResult.FireAndPurge : TriggerResult.Continue;
    },
    description: "UniqueUserTrigger: Fires at 100 unique users"
);
```

## Trigger Comparison Table

| Trigger | Fires On | Best For |
|---------|----------|----------|
| EventTimeTrigger | Window end | Simple windowing |
| CountTrigger | Every N elements | Batch processing |
| ProcessingTimeTrigger | Time intervals | Regular updates |
| EarlyTrigger | Intervals + window end | Long windows |
| OrTrigger | First condition met | Flexible latency |
| AndTrigger | Both conditions met | Guaranteed batches |
| CustomTrigger | Your logic | Complex requirements |

## Best Practices

1. **Match trigger to use case**: Count for batching, time for latency guarantees
2. **Consider state mode with triggers**: Early triggers usually need Accumulating mode
3. **Use composite triggers for complex needs**: Combine simple triggers
4. **Monitor trigger frequency**: Too many fires = overhead; too few = latency
5. **Test trigger behavior**: Ensure triggers fire when expected under various loads
6. **Clear custom state appropriately**: Prevent memory leaks in custom triggers
