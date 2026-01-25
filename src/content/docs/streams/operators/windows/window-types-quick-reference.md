---
title: Window Types Quick Reference
description: Window Types Quick Reference
---

# Window Types Quick Reference

## At a Glance

| Feature | Tumbling Window | Sliding Window | Session Window |
|---------|-----------------|----------------|----------------|
| **Size** | Fixed | Fixed | Variable |
| **Overlap** | No | Yes | No |
| **Boundaries** | Time-based | Time-based | Activity-based |
| **Events per window** | One | Multiple | One |
| **Best for** | Periodic reports | Moving averages | User sessions |

## Visual Comparison

### Tumbling Window
```
Time:     |----Window 1----|----Window 2----|----Window 3----|
Events:   * * *  *    *     * *   *     *    *  *  *   * *
          ?????????????????????????????????????????????????????????
          Each event belongs to exactly ONE window
```

### Sliding Window
```
Time:     |--------Window 1--------|
                |--------Window 2--------|
                      |--------Window 3--------|
Events:   * *  *   *    *  * *   *    *  *   *  *   *
          Each event belongs to MULTIPLE windows
```

### Session Window
```
Time:     |---Session 1---|     |--Session 2--|        |--Session 3--|
Events:   * * * *   *              *  *  * *               *   *
          ?????????????????          ?????????????            ?????????????
          Dynamic boundaries based on ACTIVITY GAPS
```

## API Quick Reference

### Basic Windows

```csharp
// Tumbling Window
.TumblingWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    stateStoreName: "optional-name",      // optional
    stateStore: customStore)              // optional

// Sliding Window
.SlidingWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    slideInterval: TimeSpan.FromMinutes(1),
    stateStoreName: "optional-name",      // optional
    stateStore: customStore)              // optional

// Session Window
.SessionWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    inactivityGap: TimeSpan.FromMinutes(30),
    stateStoreName: "optional-name",      // optional
    stateStore: customStore)              // optional
```

### Advanced Windows

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithTrigger(new CountTrigger<Event>(100))
    .WithStateMode(WindowStateMode.Accumulating)
    .WithAllowedLateness(TimeSpan.FromMinutes(5))
    .OnLateEvent((evt, ts) => HandleLate(evt, ts))
    .Build();

// Advanced Tumbling Window
.AdvancedTumblingWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    config: config,
    stateStoreName: "optional-name",
    stateStore: customStore)

// Advanced Sliding Window
.AdvancedSlidingWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    slideInterval: TimeSpan.FromMinutes(1),
    config: config,
    stateStoreName: "optional-name",
    stateStore: customStore)

// Advanced Session Window
.AdvancedSessionWindow<TKey>(
    keySelector: item => item.Key,
    timestampSelector: item => item.Timestamp,
    inactivityGap: TimeSpan.FromMinutes(30),
    config: config,
    stateStoreName: "optional-name",
    stateStore: customStore)
```

## Configuration Options

### Triggers

```csharp
// Default - fires at window end
new EventTimeTrigger<T>()

// Fire every N elements
CountTrigger<T>.Of(100)
.TriggerOnCount(100)

// Fire at time intervals
ProcessingTimeTrigger<T>.Every(TimeSpan.FromSeconds(30))
.TriggerOnProcessingTime(TimeSpan.FromSeconds(30))

// Early results during window + final at end
.WithEarlyTrigger(TimeSpan.FromMinutes(1))

// Composite triggers
new OrTrigger<T>(trigger1, trigger2)   // Fire when either fires
new AndTrigger<T>(trigger1, trigger2)  // Fire when both fire

// Custom logic
new CustomTrigger<T>(onElement: ..., onProcessingTime: ...)
```

### State Modes

```csharp
// Each emission has only NEW elements since last fire
.WithStateMode(WindowStateMode.Discarding)

// Each emission has ALL elements since window start
.WithStateMode(WindowStateMode.Accumulating)

// Like Accumulating but emits RETRACT before each update
.WithStateMode(WindowStateMode.AccumulatingAndRetracting)
```

### Late Data

```csharp
// Accept late data up to 5 minutes after window close
.WithAllowedLateness(TimeSpan.FromMinutes(5))

// Handle data that arrives too late
.OnLateEvent((event, timestamp) => {
    // Log, store, or alert
})
```

## Window Result Properties

```csharp
WindowResult<TKey, TValue> window = ...;

window.Key              // Partition key
window.WindowStart      // Start time
window.WindowEnd        // End time
window.Items            // IReadOnlyList<TValue>
window.EmissionType     // Early, OnTime, Late, Retraction
window.IsFinal          // True if window is closed
window.EmissionTime     // When result was emitted
window.EmissionSequence // Counter for multiple emissions
```

## Common Patterns

### Periodic Aggregation (Tumbling)

```csharp
// Hourly sales report
.TumblingWindow<string>(
    keySelector: sale => sale.ProductId,
    timestampSelector: sale => sale.Timestamp,
    windowSize: TimeSpan.FromHours(1))
.Map(w => new { Product = w.Key, TotalSales = w.Items.Sum(s => s.Amount) })
```

### Moving Average (Sliding)

```csharp
// 5-minute moving average updated every minute
.SlidingWindow<string>(
    keySelector: m => m.SensorId,
    timestampSelector: m => m.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    slideInterval: TimeSpan.FromMinutes(1))
.Map(w => new { Sensor = w.Key, Avg = w.Items.Average(m => m.Value) })
```

### User Session Analysis (Session)

```csharp
// Web session with 30-minute timeout
.SessionWindow<string>(
    keySelector: e => e.UserId,
    timestampSelector: e => e.Timestamp,
    inactivityGap: TimeSpan.FromMinutes(30))
.Map(w => new { 
    User = w.Key, 
    Duration = w.WindowEnd - w.WindowStart,
    PageViews = w.Items.Count 
})
```

### Real-time Dashboard (Advanced Tumbling)

```csharp
var config = WindowConfiguration<Metric>.Create()
    .WithEarlyTrigger(TimeSpan.FromSeconds(10))
    .WithStateMode(WindowStateMode.Accumulating)
    .Build();

.AdvancedTumblingWindow<string>(
    keySelector: m => m.Category,
    timestampSelector: m => m.Timestamp,
    windowSize: TimeSpan.FromMinutes(5),
    config: config)
.Map(w => {
    var status = w.IsFinal ? "FINAL" : "LIVE";
    return $"[{status}] {w.Key}: {w.Items.Average(m => m.Value):F2}";
})
```

### Rate Limiting (Sliding + Count)

```csharp
var config = WindowConfiguration<Request>.Create()
    .TriggerOnCount(100)  // Check at every 100 requests
    .Build();

.AdvancedSlidingWindow<string>(
    keySelector: r => r.ClientId,
    timestampSelector: r => r.Timestamp,
    windowSize: TimeSpan.FromMinutes(1),
    slideInterval: TimeSpan.FromSeconds(10),
    config: config)
.Filter(w => w.Items.Count > MaxRequestsPerMinute)
.Sink(w => BlockClient(w.Key))
```

## Decision Guide

### Choose Tumbling Window When:
- ? You need periodic reports (hourly, daily)
- ? Events should belong to exactly one window
- ? You want simple, predictable window boundaries
- ? Memory efficiency is important

### Choose Sliding Window When:
- ? You need moving averages or rolling aggregates
- ? You want smooth, continuous metrics
- ? Trend detection is important
- ? Events naturally belong to overlapping time periods

### Choose Session Window When:
- ? You're analyzing user sessions or activity periods
- ? Activity bursts with gaps between them
- ? Window boundaries depend on actual activity
- ? Session timeout behavior is needed

## Memory Considerations

| Window Type | Memory per Key | Notes |
|-------------|---------------|-------|
| Tumbling | `O(window_size)` | One window at a time |
| Sliding | `O(window_size � overlap_factor)` | Multiple overlapping windows |
| Session | `O(session_duration)` | Varies with activity patterns |

**Overlap factor** = `windowSize / slideInterval`

Example: 10-min window with 1-min slide = 10 overlapping windows per key
