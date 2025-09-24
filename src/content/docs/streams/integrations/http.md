---
title: RESTful HTTP
description: How to integrate Http in Cortex.Streams
---

The **Cortex.Streams.Http** package lets you integrate with RESTful HTTP endpoints. It provides sink operators for pushing data to an API (both synchronous and asynchronous variants) and a source operator for polling an endpoint and emitting the responses. These operators use `HttpClient` under the hood and implement simple retry logic with exponential backoff.

## Installation

Add the NuGet package:

```bash
dotnet add package Cortex.Streams.Http
```

## HTTP Sink Operator (synchronous)

`HttpSinkOperator` posts each incoming record to a configured HTTP endpoint. The constructor takes the endpoint URL and optional parameters: maximum retries (default 3), initial back‑off delay (default 500 ms) and optional `HttpClient` and `JsonSerializerOptions`. When `Process` is called, the object is serialized to JSON and synchronously sent using `HttpClient.PostAsync`. If the request fails, it is retried with exponential backoff until the maximum retries are exhausted; failures are logged to the console.

### Example: Synchronous POST

```csharp
using Cortex.Streams;
using Cortex.Streams.Http;

var sink = new HttpSinkOperator<MyEvent>(
    endpoint: "https://example.com/api/events");

var stream = StreamBuilder<MyEvent, MyEvent>
    .CreateNewStream("HttpSync")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();
stream.Emit(new MyEvent { Id = 1, Message = "hello" });
```

This variant blocks inside `Process` until the request completes. It is suitable for low‑throughput scenarios where backpressure is acceptable.

## HTTP Sink Operator (asynchronous)

`HttpSinkOperatorAsync` queues records and sends them to the HTTP endpoint from a background worker. The constructor accepts the same arguments as the synchronous sink and uses a `BlockingCollection` to buffer messages. Calling `Start` prepares the queue and launches a worker task. `Process` enqueues records without blocking.

The worker loops over queued items, serializes them and posts them asynchronously with retries. Calling `Stop` cancels the worker and flushes the queue. This variant is appropriate for high‑throughput scenarios where you want to decouple event production from network latency.

### Example: Asynchronous POST

```csharp
using Cortex.Streams;
using Cortex.Streams.Http;

var sink = new HttpSinkOperatorAsync<MyEvent>(
    endpoint: "https://example.com/api/events",
    maxRetries: 5,
    flushInterval: TimeSpan.FromSeconds(1));

var stream = StreamBuilder<MyEvent, MyEvent>
    .CreateNewStream("HttpAsync")
    .Source()
    .Sink(sink)
    .Build();

sink.Start();

for (int i = 0; i < 1000; i++)
{
    stream.Emit(new MyEvent { Id = i, Message = $"msg-{i}" });
}

// Stop to flush any remaining items
sink.Stop();

```

## HTTP Source Operator
`HttpSourceOperator` periodically calls a REST endpoint, deserializes the response and emits it into the stream. The constructor takes the endpoint URL, poll interval and optional parameters: maximum retries (default 3), initial delay (default 500 ms) and optional `HttpClient` and `JsonSerializerOptions`. `Start` sets up a timer that fires at the given interval and invokes the internal polling method. The poll method performs a `GET` request, deserializes the JSON response and emits it. If the request fails, it retries with exponential backoff until the maximum retry count is reached. Calling `Stop` cancels the timer.

```csharp
using Cortex.Streams;
using Cortex.Streams.Http;

// Poll every minute
var source = new HttpSourceOperator<WeatherResponse>(
    endpoint: "https://api.example.com/weather",
    pollInterval: TimeSpan.FromMinutes(1));

var stream = StreamBuilder<WeatherResponse, WeatherResponse>
    .CreateNewStream("HttpSource")
    .Source(source)
    .Sink(data => Console.WriteLine($"Temp: {data.Temperature}"))
    .Build();

source.Start(stream.Emit);
```

## Serializers and deserializers
All HTTP operators use `System.Text.Json` to serialize and deserialize objects by default. You can pass custom `JsonSerializerOptions` to control property naming policies or use a custom `ISerializer<T>`/`IDeserializer<T>` if you need a completely different encoding.

## Error handling
Each operator implements basic retry logic with exponential backoff. After the configured number of retries, the error is logged and the record or request is dropped. Consider adding application‑level monitoring or alerting to detect persistent failures.