---
title: AWSSQS
description: How to integrate AWSSQS in Cortex.Streams
---

The **Cortex.Streams.AWSSQS** package provides source and sink operators for [Amazon Simple Queue Service (SQS)](https://aws.amazon.com/sqs/). These operators use the official AWS SDK to send and receive messages, and support JSON serialization by default.

## Installation

Add the NuGet package:

```powershell
dotnet add package Cortex.Streams.AWSSQS
```

## SQS Source Operator

`SQSSourceOperator` polls an SQS queue and emits deserialized objects into the stream. The constructor requires the queue URL and accepts an optional deserializer and AWS region. If no deserializer is provided, a default JSON deserializer is used. If no region is specified, the operator uses `RegionEndpoint.USEast1` by default.

When started, the operator creates an `AmazonSQSClient` and begins a loop that repeatedly calls `ReceiveMessageAsync` with long polling (up to 10 messages, 20‑second wait). Each message body is deserialized and emitted; upon successful processing the message is deleted from the queue. Errors during receive or processing are caught and logged and the operator waits before retrying.

### Example: Consuming from SQS

```csharp
using Cortex.Streams;
using Cortex.Streams.AWSSQS;
using Amazon;

var source = new SQSSourceOperator<MyEvent>(
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
    region: RegionEndpoint.USEast1);

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("SqsConsumer")
    .Source(source)
    .Sink(evt => Console.WriteLine($"Received: {evt.Id}"))
    .Build();

stream.Start();
```

### Customizing the consumer

To handle custom formats (e.g., compressed JSON or Avro), implement `IDeserializer<T>` and pass it to the constructor. You can also override the AWS region to match your queue’s location.

## SQS Sink Operator
`SQSSinkOperator` publishes messages to SQS. The constructor takes the queue URL and optional `RegionEndpoint` and serializer. A default JSON serializer is used if none is provided, and the AWS client defaults to RegionEndpoint.USEast1.

`Process` serializes the input and calls `SendMessageAsync` in a background task to avoid blocking. Errors are caught and printed to the console; you can extend the operator to implement retry logic or a dead‑letter queue.

### Example: Producing to SQS

```csharp
using Cortex.Streams;
using Cortex.Streams.AWSSQS;
using Amazon;

var sink = new SQSSinkOperator<MyEvent>(
    queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue");

var stream = StreamBuilder<MyEvent>
    .CreateNewStream("SqsProducer")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();

// Emit an event to SQS
stream.Emit(new MyEvent { Id = Guid.NewGuid() });

```

## Serializers and deserializers

Both operators default to JSON. You can supply custom `ISerializer<T>` and `IDeserializer<T>` implementations to handle other data formats.

## Error handling

The SQS operators catch exceptions when sending or receiving messages and log them to the console. Failed receive attempts trigger a short delay before retrying. You can implement your own retry policy or use AWS dead‑letter queues by extending the `Process` logic.