---
title: Elasticsearch
description: How to integrate Elasticsearch in Cortex.Streams
---

The **Cortex.Streams.Elasticsearch** package provides a sink operator that writes messages from a Cortex data stream into an [Elasticsearch](https://www.elastic.co/) index using the official `.NET` client. It supports **bulk batching**, **flush intervals** and **automatic retries** for failed documents. This module is typically used at the end of a stream pipeline to persist processed records in a search index.

## Installation

Add the package to your project via NuGet:

```csharp
dotnet add package Buildersoft.Cortex.Streams.Elasticsearch
```

This package depends on the [Elasticsearch.Net](https://www.nuget.org/packages/Elasticsearch.Net/) and `Elasticsearch.Client` packages. You must provide a configured `ElasticsearchClient` when constructing the sink operator.

## `ElasticsearchSinkOperator<T>`

### Purpose

`ElasticsearchSinkOperator<T>` implements `IOperator<T>` and `IStatefulOperator<T>`. It buffers records and sends them to Elasticsearch in bulk. The operator keeps a **state store** for failed documents and periodically retries them. This makes it suitable for high‑throughput ingestion with fault tolerance.

### Constructor

```csharp
new ElasticsearchSinkOperator<T>(
    ElasticsearchClient client,
    string indexName,
    int batchSize = 50,
    TimeSpan? flushInterval = null,
    TimeSpan? retryInterval = null,
    IStateStore? stateStore = null,
    ILogger<ElasticsearchSinkOperator<T>>? logger = null);
```

The constructor accepts:

- `client` – a configured `ElasticsearchClient` used to send bulk requests.
- `indexName` – the name of the Elasticsearch index where documents will be written.
- `batchSize` – maximum number of documents to buffer before performing a bulk write. The default is **50** records.
- `flushInterval` – optional time span to flush the buffer on a timer even if `batchSize` has not been reached. When not supplied, it defaults to five seconds.
- `retryInterval` – interval between retry attempts for failed documents stored in the state store. It defaults to 60 seconds.
- `stateStore` – optional implementation of `IStateStore` used to persist failed documents. If null, an in‑memory store (`InMemoryStateStore`) is used.
- `logger` – optional logger for diagnostic messages.

### Lifecycle

When the operator starts (`Start()` method), two timers are created: one triggers a **flush** when the `flushInterval` elapses; the other triggers a retry for failed documents at `retryInterval`. `Dispose()` stops these timers and writes any remaining records.

### Processing

The `Process()` method adds incoming records to an internal list. When the list size reaches `batchSize`, the operator calls `FlushBatch()`. `FlushBatch()` builds an Elasticsearch BulkRequest with index and document operations, then calls `client.BulkAsync()` to send the request. After a successful bulk operation, the buffer is cleared; if any failures occur (e.g., rejected documents), failed items are stored in the `stateStore` along with their content and metadata.

### Retry logic

The **retry timer** calls `RetryFailedDocuments()` periodically. This method retrieves failed documents from the state store and attempts to resend them as a bulk request. On success, the documents are removed from the store; on partial failure, only the remaining failed entries stay in the store. This ensures eventual consistency without losing records.

### State store

Since `ElasticsearchSinkOperator<T>` implements `IStatefulOperator`, it exposes its `IDataStore` via `GetState()` so that you can inspect or override the state store. By default, an `InMemoryStateStore` is used, which does not survive application restarts. For durability across restarts, provide your own implementation of `IStateStore` (e.g. using a database or file system).

### Example
The following example shows how to configure a stream pipeline that enriches records and sinks them to Elasticsearch. Assume you have a class `ClickEvent` that describes a click record.

```csharp
using Buildersoft.Cortex.Core;
using Buildersoft.Cortex.Models;
using Buildersoft.Cortex.Streams;
using Buildersoft.Cortex.Streams.Elasticsearch;
using Elasticsearch.Net;
using Elastic.Clients.Elasticsearch;

// Configure the Elasticsearch client
var settings = new ElasticsearchClientSettings(new Uri("http://localhost:9200"));
var client = new ElasticsearchClient(settings);

// Build a stream that processes ClickEvent objects and writes them to Elasticsearch
var stream = StreamBuilder.NewStream<ClickEvent>()
    .WithName("click-events")
    .Pipeline(p =>
    {
        // Enrich the record, e.g. compute additional fields
        p.Map(record => record with { Timestamp = DateTime.UtcNow });
        
        // Sink to Elasticsearch
        p.Sink<ElasticsearchSinkOperator<ClickEvent>>(
            "elasticsearch-sink",
            operatorOptions: () => new ElasticsearchSinkOperator<ClickEvent>(
                client,
                indexName: "click-events",
                batchSize: 100,
                flushInterval: TimeSpan.FromSeconds(10),
                retryInterval: TimeSpan.FromMinutes(1)
            ));
    })
    .Build();

// Start the stream asynchronously
await stream.StartAsync();

// Write events into the stream
await stream.EmitAsync(new ClickEvent { UserId = "u123", Url = "/", Timestamp = DateTime.UtcNow });
// ...
```

In this example:

- The operator writes to the `click-events` index in Elasticsearch.
- We increased the `batchSize` from the default 50 to 100 so that bulk requests are larger.
- The `flushInterval` is set to 10 seconds; records are flushed either when the batch reaches 100 items or when the interval elapses.
- The `retryInterval` is set to one minute, meaning the operator will attempt to resend failed documents every minute.

## Tips and considerations

- **Index management** – The operator does not automatically create the index. Ensure that the index exists or that your Elasticsearch cluster is configured to auto‑create indices.
- **Document IDs** – By default, documents are sent without IDs, allowing Elasticsearch to generate a random ID. If you need deterministic IDs, transform your record into a `IndexRequestItem` with an explicit ID before sending.
- **Mapping and data types** – Define appropriate field mappings in Elasticsearch to avoid dynamic mapping issues. You can configure custom serialization for complex data types using `JsonSerializerOptions` on the `ElasticsearchClient`.
- **Backpressure** – Batching reduces the number of requests to Elasticsearch but increases memory usage. Tune `batchSize` and `flushInterval` to balance throughput and resource usage.
- **Custom state store** – For critical data pipelines, implement your own `IStateStore` to persist failed documents across restarts. The operator exposes `GetState()` for inspection and injection.