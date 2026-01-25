---
title: Sliding Window
description: Sliding Window in Cortex.Streams
---

# Sliding Window

## Overview

A **Sliding Window** groups events into overlapping, fixed-size windows that advance by a configurable slide interval. Unlike tumbling windows, an event can belong to multiple windows, making sliding windows ideal for computing moving averages and detecting trends.

```
Time:        |--------Window 1--------|
                   |--------Window 2--------|
                         |--------Window 3--------|
Events:      * *  *   *    *  * *   *    *  *   *  *   *

Window Size: 10 minutes
Slide:       3 minutes

Event at 12:05 belongs to windows:
- [12:00-12:10]
- [12:03-12:13]
- [12:06-12:16] (if slide=3min)
```

## When to Use Sliding Windows

? **Good for:**
- Moving averages (e.g., 5-minute moving average)
- Trend detection and anomaly detection
- Smooth real-time analytics
- Rate limiting (requests per sliding window)

? **Not ideal for:**
- Periodic batch reporting (use Tumbling Window)
- Activity-based grouping (use Session Window)
- When events should belong to only one window

## Key Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `windowSize` | Total duration of each window | `TimeSpan.FromMinutes(10)` |
| `slideInterval` | How often a new window starts | `TimeSpan.FromMinutes(1)` |
| `keySelector` | Partitions data into separate window sets | `e => e.SensorId` |
| `timestampSelector` | Event time for window assignment | `e => e.Timestamp` |

**Important**: `slideInterval` must be less than or equal to `windowSize`.

## Basic Usage

### Simple Sliding Window

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;

public record StockPrice(string Symbol, decimal Price, DateTime Timestamp);

var stream = StreamBuilder<StockPrice, StockPrice>
    .CreateNewStream("Stock Moving Average")
    .Stream()
    .SlidingWindow<string>(
        keySelector: sp => sp.Symbol,
        timestampSelector: sp => sp.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        slideInterval: TimeSpan.FromMinutes(1))  // New window every minute
    .Map(window => new
    {
        Symbol = window.Key,
        MovingAverage = window.Items.Average(p => p.Price),
        High = window.Items.Max(p => p.Price),
        Low = window.Items.Min(p => p.Price),
        DataPoints = window.Items.Count,
        WindowEnd = window.WindowEnd
    })
    .Sink(quote => Console.WriteLine(
        $"{quote.Symbol}: ${quote.MovingAverage:F2} " +
        $"(H: ${quote.High:F2}, L: ${quote.Low:F2}) @ {quote.WindowEnd:HH:mm:ss}"))
    .Build();

stream.Start();
```

### Real-World Example: API Rate Limiting

```csharp
public record ApiRequest(string ClientId, string Endpoint, DateTime Timestamp);

public record RateLimitStatus(
    string ClientId, 
    int RequestCount, 
    bool IsLimited,
    DateTime WindowStart,
    DateTime WindowEnd);

const int MaxRequestsPerMinute = 100;

var rateLimiter = StreamBuilder<ApiRequest, ApiRequest>
    .CreateNewStream("API Rate Limiter")
    .Stream()
    // 1-minute sliding window with 10-second slides
    // This gives smooth rate limiting instead of sharp edges
    .SlidingWindow<string>(
        keySelector: r => r.ClientId,
        timestampSelector: r => r.Timestamp,
        windowSize: TimeSpan.FromMinutes(1),
        slideInterval: TimeSpan.FromSeconds(10))
    .Map(window => new RateLimitStatus(
        ClientId: window.Key,
        RequestCount: window.Items.Count,
        IsLimited: window.Items.Count > MaxRequestsPerMinute,
        WindowStart: window.WindowStart,
        WindowEnd: window.WindowEnd))
    .AddBranch("Blocked", branch => branch
        .Filter(status => status.IsLimited)
        .Sink(status => 
        {
            Console.WriteLine($"? Rate limit exceeded for {status.ClientId}");
            NotifyRateLimitExceeded(status.ClientId);
        }))
    .Sink(UpdateRateLimitCache)
    .Build();
```

### Real-World Example: Network Traffic Anomaly Detection

```csharp
public record NetworkPacket(
    string SourceIp, 
    string DestinationIp, 
    int ByteCount, 
    DateTime Timestamp);

public record TrafficSummary(
    string SourceIp,
    double AvgBytesPerSecond,
    double StdDeviation,
    int PacketCount,
    bool IsAnomaly,
    DateTime WindowEnd);

// Keep historical baselines for anomaly detection
Dictionary<string, double> historicalAverages = new();

var anomalyDetector = StreamBuilder<NetworkPacket, NetworkPacket>
    .CreateNewStream("Network Anomaly Detector")
    .Stream()
    // 30-second sliding window, sliding every 5 seconds
    .SlidingWindow<string>(
        keySelector: p => p.SourceIp,
        timestampSelector: p => p.Timestamp,
        windowSize: TimeSpan.FromSeconds(30),
        slideInterval: TimeSpan.FromSeconds(5))
    .Map(window =>
    {
        var totalBytes = window.Items.Sum(p => p.ByteCount);
        var duration = (window.WindowEnd - window.WindowStart).TotalSeconds;
        var avgBytesPerSec = totalBytes / duration;
        
        // Calculate standard deviation
        var mean = window.Items.Average(p => (double)p.ByteCount);
        var variance = window.Items.Average(p => Math.Pow(p.ByteCount - mean, 2));
        var stdDev = Math.Sqrt(variance);
        
        // Check against historical baseline
        var historicalAvg = historicalAverages.GetValueOrDefault(window.Key, avgBytesPerSec);
        var isAnomaly = avgBytesPerSec > historicalAvg * 3; // 3x normal is anomaly
        
        return new TrafficSummary(
            SourceIp: window.Key,
            AvgBytesPerSecond: avgBytesPerSec,
            StdDeviation: stdDev,
            PacketCount: window.Items.Count,
            IsAnomaly: isAnomaly,
            WindowEnd: window.WindowEnd);
    })
    .AddBranch("Alerts", branch => branch
        .Filter(t => t.IsAnomaly)
        .Sink(alert => SendSecurityAlert(
            $"Anomalous traffic from {alert.SourceIp}: " +
            $"{alert.AvgBytesPerSecond:N0} bytes/sec")))
    .Sink(UpdateDashboard)
    .Build();
```

### Real-World Example: Real-Time Gaming Leaderboard

```csharp
public record GameScore(string PlayerId, string GameId, int Score, DateTime Timestamp);

public record LeaderboardEntry(
    string PlayerId,
    int TotalScore,
    int GamesPlayed,
    double AverageScore,
    int Rank,
    DateTime SnapshotTime);

var leaderboard = StreamBuilder<GameScore, GameScore>
    .CreateNewStream("Live Leaderboard")
    .Stream()
    // 1-hour sliding window, updated every minute
    .SlidingWindow<string>(
        keySelector: s => s.PlayerId,
        timestampSelector: s => s.Timestamp,
        windowSize: TimeSpan.FromHours(1),
        slideInterval: TimeSpan.FromMinutes(1))
    .Map(window => new
    {
        PlayerId = window.Key,
        TotalScore = window.Items.Sum(s => s.Score),
        GamesPlayed = window.Items.Count,
        AverageScore = window.Items.Average(s => s.Score),
        WindowEnd = window.WindowEnd
    })
    // Aggregate all players to compute rankings
    .GroupBy(entry => "global")
    .Map(group =>
    {
        var ranked = group.Value
            .OrderByDescending(e => e.TotalScore)
            .Select((e, index) => new LeaderboardEntry(
                PlayerId: e.PlayerId,
                TotalScore: e.TotalScore,
                GamesPlayed: e.GamesPlayed,
                AverageScore: e.AverageScore,
                Rank: index + 1,
                SnapshotTime: e.WindowEnd))
            .ToList();
        return ranked;
    })
    .Sink(UpdateLeaderboardDisplay)
    .Build();
```

## Advanced Sliding Window

For more control, use `AdvancedSlidingWindow`:

### With Early Triggers

```csharp
var config = WindowConfiguration<StockPrice>.Create()
    .WithEarlyTrigger(TimeSpan.FromSeconds(5))
    .WithStateMode(WindowStateMode.Accumulating)
    .Build();

var stream = StreamBuilder<StockPrice, StockPrice>
    .CreateNewStream("Real-time Stock Tracker")
    .Stream()
    .AdvancedSlidingWindow<string>(
        keySelector: sp => sp.Symbol,
        timestampSelector: sp => sp.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        slideInterval: TimeSpan.FromMinutes(1),
        config: config)
    .Map(window =>
    {
        var status = window.IsFinal ? "FINAL" : "PARTIAL";
        var avg = window.Items.Average(p => p.Price);
        return $"[{status}] {window.Key}: ${avg:F2} ({window.Items.Count} ticks)";
    })
    .Sink(Console.WriteLine)
    .Build();
```

### With Count-Based Trigger

```csharp
var config = WindowConfiguration<NetworkPacket>.Create()
    .TriggerOnCount(1000)  // Fire every 1000 packets
    .WithStateMode(WindowStateMode.Discarding)
    .Build();

var stream = StreamBuilder<NetworkPacket, NetworkPacket>
    .CreateNewStream("Packet Analyzer")
    .Stream()
    .AdvancedSlidingWindow<string>(
        keySelector: p => p.SourceIp,
        timestampSelector: p => p.Timestamp,
        windowSize: TimeSpan.FromMinutes(5),
        slideInterval: TimeSpan.FromMinutes(1),
        config: config)
    .Build();
```

### Handling Late Data

```csharp
var config = WindowConfiguration<Event>.Create()
    .WithAllowedLateness(TimeSpan.FromMinutes(2))
    .OnLateEvent((evt, ts) => 
    {
        Console.WriteLine($"Late event: {evt} at {ts}");
        // Optionally store for batch reprocessing
        lateEventStore.Add(evt);
    })
    .Build();

var stream = StreamBuilder<Event, Event>
    .CreateNewStream("Late-tolerant Stream")
    .Stream()
    .AdvancedSlidingWindow<string>(
        keySelector: e => e.Key,
        timestampSelector: e => e.Timestamp,
        windowSize: TimeSpan.FromMinutes(10),
        slideInterval: TimeSpan.FromMinutes(2),
        config: config)
    .Build();
```

## Choosing Window Size and Slide Interval

### Common Patterns

| Use Case | Window Size | Slide Interval | Overlap |
|----------|-------------|----------------|---------|
| 5-min moving average | 5 minutes | 1 minute | 80% |
| Real-time rate limiting | 1 minute | 10 seconds | 83% |
| Hourly trend analysis | 1 hour | 5 minutes | 92% |
| Daily aggregates | 24 hours | 1 hour | 96% |

### Trade-offs

**Smaller slide interval:**
- ? More frequent updates
- ? Smoother trends
- ? Higher CPU and memory usage
- ? More overlapping windows

**Larger slide interval:**
- ? Lower resource usage
- ? Less data duplication
- ? Less frequent updates
- ? Potential for missing short-term patterns

### Memory Considerations

Each event belongs to `?windowSize / slideInterval?` windows. For example:
- Window: 10 min, Slide: 1 min ? Each event in ~10 windows
- Window: 1 hour, Slide: 5 min ? Each event in ~12 windows

Plan state store capacity accordingly.

## Complete Example: Real-Time Sentiment Analysis

```csharp
using Cortex.Streams;
using Cortex.Streams.Operators.Windows;

public record SocialPost(
    string Topic,
    string Text,
    double SentimentScore,  // -1.0 to 1.0
    DateTime Timestamp);

public record SentimentTrend(
    string Topic,
    double MovingAverage,
    double Trend,  // Positive = improving, Negative = declining
    int PostCount,
    string TrendDirection,
    DateTime WindowEnd);

public class SentimentAnalyzer
{
    private readonly Dictionary<string, double> _previousAverages = new();

    public void Start()
    {
        var config = WindowConfiguration<SocialPost>.Create()
            .WithEarlyTrigger(TimeSpan.FromMinutes(1))
            .WithStateMode(WindowStateMode.Accumulating)
            .WithAllowedLateness(TimeSpan.FromMinutes(5))
            .Build();

        var stream = StreamBuilder<SocialPost, SocialPost>
            .CreateNewStream("Sentiment Tracker")
            .Stream()
            // Filter out neutral posts for clearer signal
            .Filter(post => Math.Abs(post.SentimentScore) > 0.1)
            // 15-minute sliding window, sliding every minute
            .AdvancedSlidingWindow<string>(
                keySelector: p => p.Topic,
                timestampSelector: p => p.Timestamp,
                windowSize: TimeSpan.FromMinutes(15),
                slideInterval: TimeSpan.FromMinutes(1),
                config: config)
            .Map(CalculateTrend)
            .AddBranch("PositiveTrends", branch => branch
                .Filter(t => t.TrendDirection == "Rising" && t.Trend > 0.1)
                .Sink(t => NotifyPositiveTrend(t)))
            .AddBranch("NegativeTrends", branch => branch
                .Filter(t => t.TrendDirection == "Falling" && t.Trend < -0.1)
                .Sink(t => NotifyNegativeTrend(t)))
            .Sink(UpdateDashboard)
            .Build();

        stream.Start();
    }

    private SentimentTrend CalculateTrend(WindowResult<string, SocialPost> window)
    {
        var currentAvg = window.Items.Average(p => p.SentimentScore);
        
        // Calculate trend compared to previous window
        var prevAvg = _previousAverages.GetValueOrDefault(window.Key, currentAvg);
        var trend = currentAvg - prevAvg;
        
        // Update for next comparison
        _previousAverages[window.Key] = currentAvg;
        
        var direction = trend switch
        {
            > 0.05 => "Rising",
            < -0.05 => "Falling",
            _ => "Stable"
        };

        return new SentimentTrend(
            Topic: window.Key,
            MovingAverage: currentAvg,
            Trend: trend,
            PostCount: window.Items.Count,
            TrendDirection: direction,
            WindowEnd: window.WindowEnd);
    }

    private void NotifyPositiveTrend(SentimentTrend trend)
    {
        Console.WriteLine($"?? Positive trend for '{trend.Topic}': " +
            $"Sentiment {trend.MovingAverage:F2} (?{trend.Trend:F2})");
    }

    private void NotifyNegativeTrend(SentimentTrend trend)
    {
        Console.WriteLine($"?? Negative trend for '{trend.Topic}': " +
            $"Sentiment {trend.MovingAverage:F2} (?{Math.Abs(trend.Trend):F2})");
    }

    private void UpdateDashboard(SentimentTrend trend)
    {
        // Update real-time dashboard
    }
}
```

## Best Practices

1. **Choose slide interval based on update frequency needs**: Smaller slides = more updates but higher cost
2. **Monitor memory with large windows**: Each event is stored in multiple windows
3. **Use early triggers for responsiveness**: Don't wait for full window for real-time apps
4. **Consider state store persistence**: Important for long windows or recovery
5. **Set appropriate allowed lateness**: Based on your data's out-of-order characteristics
