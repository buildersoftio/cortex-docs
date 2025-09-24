---
title: Files I/O
description: How to integrate Files in Cortex.Streams
---

The **Cortex.Streams.Files** package enables stream ingestion from and persistence to local files. It supports CSV, JSON Lines and XML formats for sources, and can write outputs either to a single file or to many individual files. You can plug in custom serializers and deserializers for additional formats.

## Installation

Add the NuGet package:

```csharp
dotnet add package Cortex.Streams.Files
```

## File Source Operator

`FileSourceOperator` reads data from a file and emits each record into the stream. The constructor accepts the file path, a `FileFormat` indicating whether the file is CSV, JSON Lines (`Jsonl`), or `XML`, and an optional deserializer. If no deserializer is provided and the format is CSV, a `DefaultCsvDeserializer` is used; for JSON Lines, a default JSON deserializer is used; and for `XML`, a default `XML` deserializer is used.

Calling `Start` launches a background task that reads the file line‑by‑line and emits records. For CSV files, the first line is treated as a header and used to map column names to object properties. `Stop` cancels the task and waits for it to finish.

### Example: Reading a CSV file

```csharp
using Cortex.Streams;
using Cortex.Streams.Files;

var source = new FileSourceOperator<Order>(
    filePath: "/path/to/orders.csv",
    fileFormat: FileFormat.CSV);

var stream = StreamBuilder<Order, Order>
    .CreateNewStream("FileSourceExample")
    .Source(source)
    .Sink(order => Console.WriteLine($"Order: {order.Id} – {order.Product}"))
    .Build();

stream.Start();
```

You can override the default deserializer for custom parsing logic by implementing `IDeserializer<T>` and passing it to the constructor.

## File Sink Operator

`FileSinkOperator` writes objects to files. The constructor takes an output directory, a `FileSinkMode` (either `SingleFile` or `MultiFile`), an optional serializer and an optional file name for the single‑file mode. When no serializer is provided, the operator falls back to a default serializer that simply calls `ToString()` on the object. For `SingleFile` mode the specified file is created (or truncated) and each record is appended; for `MultiFile` mode each record is written to its own file with a GUID in the name.

The sink must be started before processing. Calls to `Process` serialize the input and write it to the appropriate file. `Stop` flushes and closes any open file handles.

### Example: Writing JSON lines

```csharp
using Cortex.Streams;
using Cortex.Streams.Files;

// Write each record to its own file in JSON format
var sink = new FileSinkOperator<Order>(
    outputDirectory: "/tmp/orders",
    sinkMode: FileSinkMode.MultiFile,
    serializer: new DefaultJsonSerializer<Order>());

var stream = StreamBuilder<Order, Order>
    .CreateNewStream("FileSinkExample")
    .Source()
    .Sink(sink)
    .Build();

stream.Start();
stream.Emit(new Order { Id = 1, Product = "chair" });
```

## Enumerations

### FileFormat
`FileFormat` enumerates the supported file formats: `CSV`, `Jsonl` (JSON Lines) and `XML`.

### FileSinkMode
`FileSinkMode` defines how the sink writes files. In `SingleFile` mode all data goes into one file; in `MultiFile` mode each record is written to a separate file.

### Serializers and deserializers
Built‑in serializers and deserializers are provided for CSV (`DefaultCsvSerializer` / `DefaultCsvDeserializer`), JSON (`DefaultJsonSerializer` / `DefaultJsonDeserializer`) and XML (`DefaultXmlSerializer` / `DefaultXmlDeserializer`). You can implement `ISerializer<T>` and `IDeserializer<T>` to customize how objects are written to or read from files.

## Error handling

The file operators throw exceptions if the file or directory cannot be accessed. During processing, errors writing or parsing individual records are caught and logged. Ensure that your application has permission to read or write the specified paths.