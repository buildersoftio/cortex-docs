---
title: Session Window
description: Session Window in Cortex.Streams
---

# Session Window

## Overview

A **Session Window** dynamically groups events based on periods of activity, separated by gaps of inactivity. Unlike time-based windows, session windows have variable lengths�they start when activity begins and close after a configurable period of silence.

```
Time:    |------Session 1------|     |---Session 2---|        |--Session 3--|
Events:  * * * * *   *    *              *  *  * *               *   *
         ??????????????????????          ????????????            ???????????
                    ?                          ?                      ?
              Activity ends            New activity            Another session
         (gap > inactivity threshold)
```

## When to Use Session Windows

? **Good for:**
- User session analysis (web, mobile apps)
- Activity tracking and engagement metrics
- Game play sessions
- Shopping cart analysis
- Call center interactions
- Machine operation cycles

? **Not ideal for:**
- Fixed-time reporting (use Tumbling Window)
- Moving averages (use Sliding Window)
- When consistent window sizes are required

## Key Concepts

### Inactivity Gap
The duration of silence after which a session is considered complete:

```csharp
// Session closes after 5 minutes of no activity
inactivityGap: TimeSpan.FromMinutes(5)
```

### Session Lifecycle
1. **Session Start**: First event arrives for a key
2. **Session Extension**: Each new event resets the inactivity timer
3. **Session Close**: No new events within the inactivity gap
4. **Result Emission**: Window result is emitted with all session events

## Basic Usage

### Simple Session Window

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;

public record UserAction(string UserId, string Action, DateTime Timestamp);

var stream = StreamBuilder<UserAction>
    .CreateNewStream("User Session Tracker")
    .Stream()
    .SessionWindow<string>(
        keySelector: a => a.UserId,
        timestampSelector: a => a.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(30))  // 30-minute session timeout
    .Map(session => new
    {
        UserId = session.Key,
        SessionStart = session.WindowStart,
        SessionEnd = session.WindowEnd,
        Duration = session.WindowEnd - session.WindowStart,
        ActionCount = session.Items.Count,
        Actions = session.Items.Select(a => a.Action).ToList()
    })
    .Sink(s => Console.WriteLine(
        $"Session ended for {s.UserId}: {s.ActionCount} actions over {s.Duration.TotalMinutes:F1} minutes"))
    .Build();

stream.Start();
```

### Real-World Example: E-Commerce Session Analysis

```csharp
public record ShoppingEvent(
    string CustomerId,
    string EventType,  // "view", "add_to_cart", "remove", "checkout"
    string ProductId,
    decimal? Price,
    DateTime Timestamp);

public record ShoppingSession(
    string CustomerId,
    DateTime SessionStart,
    DateTime SessionEnd,
    TimeSpan Duration,
    int ProductsViewed,
    int ItemsAddedToCart,
    bool CompletedPurchase,
    decimal CartValue,
    List<string> ViewedProducts);

var shoppingStream = StreamBuilder<ShoppingEvent>
    .CreateNewStream("Shopping Session Analyzer")
    .Stream()
    .SessionWindow<string>(
        keySelector: e => e.CustomerId,
        timestampSelector: e => e.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(20))  // 20-min shopping timeout
    .Map(session =>
    {
        var events = session.Items;
        
        return new ShoppingSession(
            CustomerId: session.Key,
            SessionStart: session.WindowStart,
            SessionEnd: session.WindowEnd,
            Duration: session.WindowEnd - session.WindowStart,
            ProductsViewed: events.Count(e => e.EventType == "view"),
            ItemsAddedToCart: events.Count(e => e.EventType == "add_to_cart"),
            CompletedPurchase: events.Any(e => e.EventType == "checkout"),
            CartValue: events
                .Where(e => e.EventType == "add_to_cart" && e.Price.HasValue)
                .Sum(e => e.Price!.Value),
            ViewedProducts: events
                .Where(e => e.EventType == "view")
                .Select(e => e.ProductId)
                .Distinct()
                .ToList());
    })
    .AddBranch("AbandonedCarts", branch => branch
        .Filter(s => !s.CompletedPurchase && s.ItemsAddedToCart > 0)
        .Sink(s => SendAbandonedCartEmail(s)))
    .AddBranch("HighValue", branch => branch
        .Filter(s => s.CartValue > 500)
        .Sink(s => NotifySalesTeam(s)))
    .Sink(SaveSessionAnalytics)
    .Build();
```

### Real-World Example: Customer Support Interactions

```csharp
public record SupportEvent(
    string TicketId,
    string AgentId,
    string EventType,  // "message", "hold", "transfer", "resolve"
    string Content,
    DateTime Timestamp);

public record SupportInteraction(
    string TicketId,
    string PrimaryAgent,
    DateTime InteractionStart,
    DateTime InteractionEnd,
    TimeSpan TotalDuration,
    TimeSpan HoldTime,
    int MessageCount,
    int TransferCount,
    bool WasResolved,
    double CustomerSatisfactionEstimate);

var supportStream = StreamBuilder<SupportEvent>
    .CreateNewStream("Support Interaction Analyzer")
    .Stream()
    .SessionWindow<string>(
        keySelector: e => e.TicketId,
        timestampSelector: e => e.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(15))  // 15-min timeout
    .Map(session =>
    {
        var events = session.Items;
        var holdEvents = events.Where(e => e.EventType == "hold").ToList();
        
        // Calculate hold time based on hold events
        var totalHold = TimeSpan.Zero;
        foreach (var hold in holdEvents)
        {
            // Assume hold lasts until next non-hold event
            var nextEvent = events
                .Where(e => e.Timestamp > hold.Timestamp && e.EventType != "hold")
                .OrderBy(e => e.Timestamp)
                .FirstOrDefault();
            
            if (nextEvent != null)
                totalHold += nextEvent.Timestamp - hold.Timestamp;
        }

        return new SupportInteraction(
            TicketId: session.Key,
            PrimaryAgent: events.First().AgentId,
            InteractionStart: session.WindowStart,
            InteractionEnd: session.WindowEnd,
            TotalDuration: session.WindowEnd - session.WindowStart,
            HoldTime: totalHold,
            MessageCount: events.Count(e => e.EventType == "message"),
            TransferCount: events.Count(e => e.EventType == "transfer"),
            WasResolved: events.Any(e => e.EventType == "resolve"),
            CustomerSatisfactionEstimate: EstimateSatisfaction(events));
    })
    .AddBranch("LongInteractions", branch => branch
        .Filter(i => i.TotalDuration > TimeSpan.FromMinutes(30))
        .Sink(i => LogLongInteraction(i)))
    .AddBranch("MultipleTransfers", branch => branch
        .Filter(i => i.TransferCount >= 2)
        .Sink(i => FlagForReview(i)))
    .Sink(UpdateSupportMetrics)
    .Build();

double EstimateSatisfaction(IReadOnlyList<SupportEvent> events)
{
    double score = 0.5;
    if (events.Any(e => e.EventType == "resolve")) score += 0.3;
    if (events.Count(e => e.EventType == "transfer") > 1) score -= 0.2;
    return Math.Clamp(score, 0, 1);
}
```

### Real-World Example: Gaming Session Analysis

```csharp
public record GameEvent(
    string PlayerId,
    string EventType,  // "start", "score", "death", "level_up", "purchase", "quit"
    string Details,
    int? Points,
    DateTime Timestamp);

public record GamingSession(
    string PlayerId,
    DateTime SessionStart,
    DateTime SessionEnd,
    TimeSpan PlayTime,
    int TotalScore,
    int Deaths,
    int LevelsGained,
    decimal MoneySpent,
    bool RageQuit);  // Died and quit immediately

var gamingStream = StreamBuilder<GameEvent>
    .CreateNewStream("Gaming Session Tracker")
    .Stream()
    .SessionWindow<string>(
        keySelector: e => e.PlayerId,
        timestampSelector: e => e.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(10))  // 10-min AFK timeout
    .Map(session =>
    {
        var events = session.Items.OrderBy(e => e.Timestamp).ToList();
        
        // Detect rage quit: death followed by quit within 30 seconds
        var lastDeath = events.LastOrDefault(e => e.EventType == "death");
        var quit = events.LastOrDefault(e => e.EventType == "quit");
        var rageQuit = lastDeath != null && quit != null &&
            (quit.Timestamp - lastDeath.Timestamp).TotalSeconds < 30;

        return new GamingSession(
            PlayerId: session.Key,
            SessionStart: session.WindowStart,
            SessionEnd: session.WindowEnd,
            PlayTime: session.WindowEnd - session.WindowStart,
            TotalScore: events.Where(e => e.Points.HasValue).Sum(e => e.Points!.Value),
            Deaths: events.Count(e => e.EventType == "death"),
            LevelsGained: events.Count(e => e.EventType == "level_up"),
            MoneySpent: events
                .Where(e => e.EventType == "purchase")
                .Sum(e => ParseMoney(e.Details)),
            RageQuit: rageQuit);
    })
    .AddBranch("Whales", branch => branch
        .Filter(s => s.MoneySpent > 50)
        .Sink(s => TagAsHighValuePlayer(s.PlayerId)))
    .AddBranch("FrustratedPlayers", branch => branch
        .Filter(s => s.RageQuit || s.Deaths > 10)
        .Sink(s => ConsiderSendingHelp(s)))
    .Sink(UpdatePlayerAnalytics)
    .Build();
```

## Advanced Session Window

For more control, use `AdvancedSessionWindow`:

### With Early Triggers for Long Sessions

Emit partial results during long sessions:

```csharp
var config = WindowConfiguration<UserAction>.Create()
    .WithEarlyTrigger(TimeSpan.FromMinutes(5))  // Emit every 5 minutes during session
    .WithStateMode(WindowStateMode.Accumulating)
    .Build();

var stream = StreamBuilder<UserAction>
    .CreateNewStream("Long Session Monitor")
    .Stream()
    .AdvancedSessionWindow<string>(
        keySelector: a => a.UserId,
        timestampSelector: a => a.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(30),
        config: config)
    .Map(session =>
    {
        var status = session.IsFinal ? "COMPLETED" : "IN PROGRESS";
        return $"[{status}] User {session.Key}: {session.Items.Count} actions";
    })
    .Sink(Console.WriteLine)
    .Build();
```

### With Activity-Based Triggers

Emit results every N actions:

```csharp
var config = WindowConfiguration<GameEvent>.Create()
    .TriggerOnCount(100)  // Emit every 100 game events
    .WithStateMode(WindowStateMode.Discarding)  // Only new events since last emit
    .Build();

var stream = StreamBuilder<GameEvent>
    .CreateNewStream("Game Event Batcher")
    .Stream()
    .AdvancedSessionWindow<string>(
        keySelector: e => e.PlayerId,
        timestampSelector: e => e.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(10),
        config: config)
    .Sink(batch => ProcessEventBatch(batch))
    .Build();
```

### With Accumulating and Retracting

For systems that need to update previous results:

```csharp
var config = WindowConfiguration<ShoppingEvent>.Create()
    .WithEarlyTrigger(TimeSpan.FromMinutes(2))
    .WithStateMode(WindowStateMode.AccumulatingAndRetracting)
    .Build();

var stream = StreamBuilder<ShoppingEvent>
    .CreateNewStream("Real-time Cart Tracker")
    .Stream()
    .AdvancedSessionWindow<string>(
        keySelector: e => e.CustomerId,
        timestampSelector: e => e.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(20),
        config: config)
    .Map(session =>
    {
        if (session.EmissionType == WindowEmissionType.Retraction)
        {
            return ("RETRACT", session);
        }
        return ("UPDATE", session);
    })
    .Sink(result =>
    {
        var (action, session) = result;
        if (action == "RETRACT")
            RemovePreviousSessionData(session.Key, session.EmissionSequence - 1);
        else
            UpdateSessionData(session);
    })
    .Build();
```

## State Store Configuration

### Default In-Memory Store

```csharp
// Automatically created
var stream = StreamBuilder<UserAction>
    .CreateNewStream("Demo")
    .Stream()
    .SessionWindow<string>(
        keySelector: a => a.UserId,
        timestampSelector: a => a.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(30))
    .Build();
```

### Persistent State Store

For fault tolerance and recovery:

```csharp
// Using RocksDB for persistent sessions
var sessionStore = new RocksDbStateStore<string, SessionState<UserAction>>(
    path: "./session-state",
    name: "user-sessions");

var stream = StreamBuilder<UserAction>
    .CreateNewStream("Persistent Sessions")
    .Stream()
    .SessionWindow<string>(
        keySelector: a => a.UserId,
        timestampSelector: a => a.Timestamp,
        inactivityGap: TimeSpan.FromMinutes(30),
        stateStore: sessionStore)
    .Build();
```

## Choosing the Right Inactivity Gap

| Use Case | Typical Gap | Reasoning |
|----------|-------------|-----------|
| Web browsing | 30 min | Standard web session timeout |
| Mobile app | 5-15 min | Users switch apps frequently |
| Gaming | 5-10 min | AFK detection |
| Shopping cart | 20-30 min | Time to compare products |
| Support chat | 10-15 min | Waiting for responses |
| Machine operation | varies | Based on operational cycles |

### Considerations

**Too Short:**
- Many small sessions
- Actions split across sessions
- Lost context

**Too Long:**
- Sessions stay open unnecessarily
- Delayed insights
- Higher memory usage

## Complete Example: Multi-Channel Customer Journey

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;

public record CustomerTouchpoint(
    string CustomerId,
    string Channel,      // "web", "mobile", "store", "call_center"
    string Action,
    string ProductId,
    decimal? Value,
    DateTime Timestamp);

public record CustomerJourney(
    string CustomerId,
    DateTime JourneyStart,
    DateTime JourneyEnd,
    TimeSpan Duration,
    List<string> ChannelsUsed,
    int TotalTouchpoints,
    List<string> ProductsConsidered,
    bool ConvertedToSale,
    decimal TotalValue,
    string JourneyType);

public class CustomerJourneyAnalyzer
{
    public void Start()
    {
        var config = WindowConfiguration<CustomerTouchpoint>.Create()
            .WithEarlyTrigger(TimeSpan.FromMinutes(10))
            .WithStateMode(WindowStateMode.Accumulating)
            .Build();

        var stream = StreamBuilder<CustomerTouchpoint>
            .CreateNewStream("Customer Journey Tracker")
            .Stream()
            // Sessions based on customer activity with 1-hour gap
            // This captures multi-channel journeys that may span hours
            .AdvancedSessionWindow<string>(
                keySelector: t => t.CustomerId,
                timestampSelector: t => t.Timestamp,
                inactivityGap: TimeSpan.FromHours(1),
                config: config)
            .Map(AnalyzeJourney)
            .AddBranch("MultiChannel", branch => branch
                .Filter(j => j.ChannelsUsed.Distinct().Count() >= 2)
                .Sink(j => AnalyzeOmniChannel(j)))
            .AddBranch("Converted", branch => branch
                .Filter(j => j.ConvertedToSale)
                .Sink(j => TrackConversion(j)))
            .AddBranch("HighIntent", branch => branch
                .Filter(j => !j.ConvertedToSale && j.ProductsConsidered.Count > 5)
                .Sink(j => TriggerRetargeting(j)))
            .Sink(SaveJourneyData)
            .Build();

        stream.Start();
    }

    private CustomerJourney AnalyzeJourney(WindowResult<string, CustomerTouchpoint> session)
    {
        var touchpoints = session.Items.OrderBy(t => t.Timestamp).ToList();
        var channels = touchpoints.Select(t => t.Channel).ToList();
        var products = touchpoints
            .Where(t => !string.IsNullOrEmpty(t.ProductId))
            .Select(t => t.ProductId)
            .Distinct()
            .ToList();

        var converted = touchpoints.Any(t => t.Action == "purchase");
        var totalValue = touchpoints
            .Where(t => t.Action == "purchase" && t.Value.HasValue)
            .Sum(t => t.Value!.Value);

        // Classify journey type
        var journeyType = ClassifyJourney(channels, converted, products.Count);

        return new CustomerJourney(
            CustomerId: session.Key,
            JourneyStart: session.WindowStart,
            JourneyEnd: session.WindowEnd,
            Duration: session.WindowEnd - session.WindowStart,
            ChannelsUsed: channels.Distinct().ToList(),
            TotalTouchpoints: touchpoints.Count,
            ProductsConsidered: products,
            ConvertedToSale: converted,
            TotalValue: totalValue,
            JourneyType: journeyType);
    }

    private string ClassifyJourney(List<string> channels, bool converted, int productsCount)
    {
        var uniqueChannels = channels.Distinct().Count();
        
        if (converted && uniqueChannels >= 2)
            return "OmniChannelConversion";
        if (converted)
            return "SingleChannelConversion";
        if (uniqueChannels >= 2 && productsCount > 3)
            return "ResearchMultiChannel";
        if (productsCount > 5)
            return "HeavyResearch";
        if (productsCount == 0)
            return "Browsing";
        return "LightResearch";
    }

    private void AnalyzeOmniChannel(CustomerJourney journey)
    {
        Console.WriteLine($"?? Omni-channel journey for {journey.CustomerId}:");
        Console.WriteLine($"   Channels: {string.Join(" ? ", journey.ChannelsUsed)}");
        Console.WriteLine($"   Duration: {journey.Duration.TotalHours:F1} hours");
    }

    private void TrackConversion(CustomerJourney journey)
    {
        Console.WriteLine($"? Conversion: {journey.CustomerId} - ${journey.TotalValue:F2}");
    }

    private void TriggerRetargeting(CustomerJourney journey)
    {
        Console.WriteLine($"?? Retarget {journey.CustomerId}: " +
            $"Viewed {journey.ProductsConsidered.Count} products");
    }

    private void SaveJourneyData(CustomerJourney journey)
    {
        // Save to analytics database
    }
}
```

## Best Practices

1. **Choose inactivity gap based on domain**: Understand your users' typical activity patterns
2. **Use early triggers for long sessions**: Don't wait hours for insights
3. **Persist state for important sessions**: Recovery is crucial for business-critical analytics
4. **Monitor session count**: Many open sessions = high memory usage
5. **Consider time zones**: User activity patterns vary by region
6. **Handle session merging carefully**: Late events may belong to already-closed sessions
