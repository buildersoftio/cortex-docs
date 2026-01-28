---
title: Azure Blob Storage
description: How to integrate Azure Blob Storage in Cortex.Streams
---

The **Cortex.Streams.AzureBlobStorage** package lets you persist stream data to [Azure Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/) as JSON or JSON‑Lines files. It provides two sink operators—a simple per‑record sink and a bulk sink—for different throughput and file‑organization requirements. Both operators rely on the Azure Storage SDK and include retry logic via the [Polly](https://github.com/App-vNext/Polly) library.

## Installation

Add the NuGet package:

```bash
dotnet add package Cortex.Streams.AzureBlobStorage
```

## Azure Blob Storage Sink Operator

`AzureBlobStorageSinkOperator` writes each input object as a separate blob file. The constructor requires the storage connection string, container name and directory path within the container, and accepts an optional serializer. If no serializer is provided, JSON serialization is used. A `BlobContainerClient` is created internally and the container is created if it does not exist when Start is called. The operator defines an exponential back‑off retry policy using Polly.

Calling `Process` serializes the input object, generates a unique file name (`GUID.json`) and asynchronously uploads the content to the specified directory. Uploads are wrapped in the retry policy and errors are logged. Calling Stop disposes resources and stops further processing.

### Example: Writing records individually

```csharp
using Cortex.Streams;
using Cortex.Streams.AzureBlobStorage;

var sink = new AzureBlobStorageSinkOperator<MyEvent>(
    connectionString: Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNSTR"),
    containerName: "my-data",
    directoryPath: "events");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("BlobSingleSink")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();
stream.Emit(new MyEvent { Id = 1, Value = "hello" });
```

## Azure Blob Storage Bulk Sink Operator

`AzureBlobStorageBulkSinkOperator` buffers messages and writes them to Blob Storage in batches. The constructor accepts the same connection string, container and directory path as the simple sink, plus a mandatory serializer, optional `batchSize` (default `100`) and optional `flushInterval` (default `10 seconds`). A `Timer` flushes the buffer at the configured interval; starting the operator ensures the container exists.

Each call to `Process` adds the object to an in‑memory buffer. When the buffer size reaches the batch size, the objects are serialized, concatenated with new‑line separators and uploaded as a single `.jsonl` file. The flush timer ensures that partially filled buffers are uploaded at the flush interval. On stop, the buffer is flushed and the timer is disposed.

### Example: Writing in batches

```csharp
using Cortex.Streams;
using Cortex.Streams.AzureBlobStorage;

var sink = new AzureBlobStorageBulkSinkOperator<MyEvent>(
    connectionString: Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNSTR"),
    containerName: "my-data",
    directoryPath: "events",
    serializer: new DefaultJsonSerializer<MyEvent>(),
    batchSize: 50,
    flushInterval: TimeSpan.FromSeconds(15));

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("BlobBulkSink")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

for (int i = 0; i < 200; i++)
{
    stream.Emit(new MyEvent { Id = i, Value = $"event-{i}" });
}

// When finished call Stop() to flush any remaining records
sink.Stop();

```

## Serializers
Both blob sink operators default to JSON serialization. You can supply a custom `ISerializer<T>` if you need to write XML or other formats. For the bulk sink, the serializer must be provided explicitly.

## Error handling

The operators use Polly to retry uploads on transient errors. If retries fail, the error is logged and the record remains unpersisted. You can extend the operators to capture failed uploads and write them to a dead‑letter location.
