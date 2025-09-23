---
title: Getting Started
description: Getting started with Cortex Data Framework
---

### Prerequisites

- **.NET 6.0 SDK** or later
- **NuGet Package Manager** (integrated with Visual Studio or available via CLI)
- **Apache Kafka** (if using Cortex.Streams.Kafka)
- **Apache Pulsar** (if using Cortex.Streams.Pulsar)

### Installation

Cortex Data Framework is available through the NuGet Package Manager. You can easily add the necessary packages to your .NET project using the following methods:

#### Using the .NET CLI

Open your terminal or command prompt and navigate to your project directory, then run the following commands to install the desired packages:


```bash
# Install Cortex.Streams
dotnet add package Cortex.Streams

# Install Cortex.States
dotnet add package Cortex.States
```

#### 2.1.2. Using the Package Manager Console in Visual Studio
1. Open your project in Visual Studio.
2. Navigate to **Tools > NuGet Package Manager > Package Manager Console**.
3. Run the following commands:

```powershell
# Install Cortex.Streams
Install-Package Cortex.Streams

# Install Cortex.States
Install-Package Cortex.States
```

## Usage

Cortex Data Framework makes it easy to set up and run real-time data processing pipelines. Below are some simple examples to get you started.

### 1. Creating a Stream

```csharp
var stream = StreamBuilder<int, int>.CreateNewStream("ExampleStream")
    .Stream()
    .Map(x => x * 2)
    .Filter(x => x > 10)
    .Sink(Console.WriteLine)
    .Build();
stream.Start();

// emitting data to the stream
stream.Emit(2);
```
### 2. Using State Stores

```csharp
var stateStore = new RocksDbStateStore<string, int>("ExampleStateStore", "./data");
stateStore.Put("key1", 42);
Console.WriteLine(stateStore.Get("key1"));
```

### 3. Telemetry Integration

```csharp
var telemetryProvider = new OpenTelemetryProvider();
var stream = StreamBuilder<int, int>
    .CreateNewStream("TelemetryStream")
    .WithTelemetry(telemetryProvider)
    .Stream()
    .Map(x => x * 2)
    .Sink(Console.WriteLine)
    .Build();
```

### 4. Real-Time Click Tracking

**Scenario**: Track the number of clicks on different web pages in real-time and display the aggregated counts.

Steps:

**1. Define the Event Class**

```csharp
public class ClickEvent
{
    public string PageUrl { get; set; }
    public DateTime Timestamp { get; set; }
}
```

**2. Build the Stream Pipeline**

- **Stream**: Starts with the source operator.
- **Filter**: Filters events based on certain criteria.
- **GroupBy**: Groups events by PageUrl.
- **Aggregate**: Counts the number of clicks per page.
- **Sink**: Prints the total clicks per page.

```csharp
        static void Main(string[] args)
        {
            // Build the stream
            var stream = StreamBuilder<ClickEvent, ClickEvent>.CreateNewStream("ClickStream")
                .Stream()
                .Filter(e => !string.IsNullOrEmpty(e.PageUrl))
                .GroupBySilently(
                    e => e.PageUrl,                   // Key selector: group by PageUrl
                    stateStoreName: "ClickGroupStore")
                .AggregateSilently<string, int>(
                    e => e.PageUrl,             // Key selector for aggregation
                    (count, e) => count + 1,          // Aggregation function: increment count
                    stateStoreName: "ClickAggregateStore")
                .Sink(e =>
                {
                    Console.WriteLine($"Page: {e.PageUrl}");
                })
                .Build();

            // start the stream
            stream.Start();
```

Emitting some random events into the stream

```csharp
// emit some events

var random = new Random();
var pages = new[] { "/home", "/about", "/contact", "/products" };

while (true)
{
    var page = pages[random.Next(pages.Length)];
    var click = new ClickEvent
    {
        PageUrl = page,
        Timestamp = DateTime.UtcNow
    };

    stream.Emit(click);
    Thread.Sleep(100); // Simulate click rate
}
```

**3. Access Aggregated Data**

Retrieve and display the click counts from the state store

```csharp
// Access the aggregate state store data
var aggregateStore = stream.GetStateStoreByName<InMemoryStateStore<string, int>>("ClickAggregateStore");

// Access the groupby state store data
var groupByStore = stream.GetStateStoreByName<InMemoryStateStore<string, List<ClickEvent>>>("ClickGroupStore")


if (aggregateStore != null)
{
    Console.WriteLine("\nAggregated Click Counts:");
    foreach (var kvp in aggregateStore.GetAll())
    {
        Console.WriteLine($"Page: {kvp.Key}, Clicks: {kvp.Value}");
    }
}
else
{
    Console.WriteLine("Aggregate state store not found.");
}
```
