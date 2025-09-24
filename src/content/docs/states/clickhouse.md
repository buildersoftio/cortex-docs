---
title: Clickhouse Store
description: An overview of Cortex Clickhouse state stores
---

The **Cortex.States.ClickHouse** package provides a **typed, columnar** state store for ClickHouse:

- `ClickHouseStateStore<TKey, TValue>` — maps scalar properties of `TValue` to table columns and persists `List<>` properties as **Array(...)** columns in the **same table** (no child tables). It auto-creates/evolves the table (opt-in) and supports MergeTree/Replac­ingMergeTree engines. 


## Description and Features

### Highlights
- **ClickHouse durability** using a configurable table engine (default **MergeTree**). **ReplacingMergeTree** is supported and uses a version column (`timestamp`) for de-duplication. Engine modifiers (e.g., `ORDER BY key`) are configurable. 
- **Auto schema management (opt-in)**: on startup it creates the table (if missing) and **adds new columns** discovered on the model; in strict mode it throws if objects/columns are missing.
- **Typed mapping** for common .NET types:
  - `int/short/byte → Int32`, `long → Int64`, `bool → UInt8`, `DateTime → DateTime64(3)`,  
    `decimal → Decimal(18,4)`, `double → Float64`, `float → Float32`, `Guid → String`,  
    `TimeSpan → Int64 (ticks)`, `string/unknown → String`. :contentReference[oaicite:3]{index=3}
- **Lists as arrays**: each `List<T>` property maps to `Array(<mapped T>)` in the same row. :contentReference[oaicite:4]{index=4}
- **Thread-safe one-time init** via `SemaphoreSlim`. :contentReference[oaicite:5]{index=5}
- **CRUD API**: `Get`, `Put`, `ContainsKey`, `Remove`, `GetAll`, `GetKeys`. :contentReference[oaicite:6]{index=6}

Key features include:

| Feature                         | Details                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent storage**          | Uses ClickHouse tables for durable state.  ClickHouse is a column‑oriented DBMS designed for real‑time analytics.                                                                                                                                                                                               |
| **Columnar performance**        | Column‑oriented storage makes filtering and aggregation over large datasets faster than row‑oriented storage.                                                                                                                                                                                                   |
| **Table engines**               | Choose between the default **MergeTree** or **ReplacingMergeTree** engine.  `ReplacingMergeTree` removes duplicate rows with the same sorting key during background merges; it keeps only the latest row based on the `timestamp` version when merging.                                                         |
| **Key–value semantics**         | Exposes `Put`, `Get`, `Remove`, `ContainsKey`, `GetAll` and `GetKeys` methods.  Each `Put` call removes any existing row for the key and inserts the new row.                                                                                                                                                   |
| **Automatic schema management** | Creates the table and missing columns at runtime when `CreateOrUpdateTableSchema` is `true`.  Columns map to scalar properties, and `List<T>` properties map to `Array(T)` types.                                                                                                                               |
| **Configurable**                | Accepts a ClickHouse connection string, table name and optional `ClickHouseConfiguration`.  The configuration selects the table engine (`MergeTree` or `ReplacingMergeTree`), allows extra engine modifiers (e.g., `PARTITION BY` or `ORDER BY` clauses) and controls whether the schema is created or updated. |
| **Support for complex types**   | Can persist classes with multiple scalar properties and list properties.  Lists are stored in array columns.                                                                                                                                                                                                    |
| **Concurrency & replication**   | ClickHouse handles writes without locking tables and replicates data asynchronously across nodes.  The store is thread‑safe via an initialization semaphore.                                                                                                                                                    |

> Ensure your **ClickHouse user** can create/alter tables if you enable auto-create.

## Configuration and Setup

### Prerequisites

- **ClickHouse instance** – You need access to an existing ClickHouse server (single node or cluster). Ensure the user in your connection string has rights to create tables and alter schemas if `CreateOrUpdateTableSchema` is enabled. ClickHouse works best for analytic workloads; it expects data to remain mostly immutable and does not fully support ACID transactions.
- **Package dependency**  – Add the NuGet package:
```powershell
Install-Package Cortex.States.ClickHouse
```

- **Engine selection** – Decide whether to use the default `MergeTree` engine or `ReplacingMergeTree`. `ReplacingMergeTree` deduplicates rows with the same `ORDER BY key` during background merges. However, deduplication is eventual; duplicate rows may remain until a merge runs.

### Step‑by‑Step Configuration

1. **Define key and value types** – Choose a key type (`TKey`) and define a value type (`TValue`). Scalar properties become table columns. List properties become array columns. For example:
```csharp
public class OrderState
{
    public string CustomerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal Total { get; set; }
    public List<string> Items { get; set; } = new();
}
```
2. Initialize the store – Create an instance of `ClickHouseStateStore<TKey, TValue>` by providing the store name, ClickHouse connection string, table name and an optional configuration:

```csharp
using Cortex.States.ClickHouse;
// Configuration: use ReplacingMergeTree with ORDER BY key and PARTITION BY month
var config = new ClickHouseConfiguration
{
    TableEngine = ClickHouseTableEngine.ReplacingMergeTree,
    EngineModifiers = "PARTITION BY toYYYYMM(timestamp) ORDER BY key",
    CreateOrUpdateTableSchema = true
};

var orderStore = new ClickHouseStateStore<Guid, OrderState>(
    name: "OrderStateStore",
    connectionString: "Host=localhost;Port=9000;User=default;Password=;Database=default;",
    tableName: "order_state",
    config: config);
```

The constructor ensures that the table exists. It creates a key column of type `String`, a `timestamp` column of type `DateTime64(3)`, scalar columns mapped from the properties and array columns mapped from list properties. For `ReplacingMergeTree` the engine clause becomes `ReplacingMergeTree(timestamp)` followed by the specified engine modifiers.

3. **Handle the lifecycle** – Dispose the store when finished to release the initialization semaphore. Each method opens a new ClickHouse connection; connection pooling is handled by the underlying driver.

## Usage Guide

1. **Integration with Stream** – Use the state store when configuring stateful stream operators. For example, a tumbling window aggregation can persist per‑key state in ClickHouse. Pass the store instance and name to the operator.

2. **Stateful operations** – The store provides familiar key–value operations:

    - **Put** – Deletes any existing row with the same key via an `ALTER TABLE ... DELETE` statement and inserts a new row. Because ClickHouse expects data to be immutable and does not fully support in‑place updates, the delete–insert approach avoids primary‑key updates.
    - **Get** – Selects the most recent row by ordering by `timestamp` descending. If multiple versions exist (e.g., when using ReplacingMergeTree and merges have not yet run), the latest version is returned.
    - **Remove** – Issues `ALTER TABLE ... DELETE WHERE key = @key` to mark rows for deletion. Deletion is asynchronous; for `MergeTree` and `ReplacingMergeTree` the actual removal occurs during background merges or via a `DELETE`/`OPTIMIZE` operation
    - **ContainsKey, GetAll, GetKeys** – Provide efficient existence checks and enumeration of keys/values.

3. **Handling lists** – List properties are stored in ClickHouse `Array(T)` columns. An array’s elements must be of the same type, and ClickHouse automatically infers the narrowest type when creating arrays. Nested arrays are supported.

4. **Concurrency and replication** – ClickHouse can insert data without table locks. In cluster configurations, data is replicated asynchronously across nodes. However, ClickHouse does not fully support ACID transactions; it expects data to be mostly immutable and is not optimized for frequent single‑row updates. When using ReplacingMergeTree, duplicate rows may persist until background merges deduplicate them

5. **Performance considerations**:
    - **Primary key and sorting key** – For `MergeTree`/`ReplacingMergeTree`, choose an `ORDER BY` clause that matches your access pattern (e.g., `ORDER BY key`) and optionally partition data by time or another dimension. Do not update columns that participate in the sorting key; ClickHouse cannot update sorting key columns.
    - **Deduplication** – With ReplacingMergeTree, deduplication occurs during merges. To force cleanup, run `OPTIMIZE TABLE ... FINAL` or set engine settings such as `allow_experimental_replacing_merge_with_cleanup`
    - **String and GUID handling** – Keys are stored as `String` columns. ClickHouse stores string values contiguously and compresses them effectively. GUIDs are stored as strings in the default mapping.
    - **Replication and durability** – Although ClickHouse replicates data across nodes, it does not provide full ACID transaction semantics. Consider your consistency requirements when choosing this store.

## Code Example – Word Count with ClickHouse

The following example demonstrates a simple word‑count stream that uses a `ClickHouseStateStore` to persist counts. Each word serves as the key, and the count is stored in an integer column. The store is configured to use `ReplacingMergeTree` so that duplicate inserts are deduplicated during merges.

```csharp
using Cortex.States.ClickHouse;
using Cortex.Streams;
using Cortex.Streams.Operators;
using System;

class Program
{
    static void Main()
    {
        // Configure ClickHouse store
        var config = new ClickHouseConfiguration
        {
            TableEngine = ClickHouseTableEngine.ReplacingMergeTree,
            EngineModifiers = "ORDER BY key",
            CreateOrUpdateTableSchema = true
        };
        var connectionString = "Host=localhost;Port=9000;User=default;Password=;Database=default;";
        var wordCountStore = new ClickHouseStateStore<string, int>(
            name: "WordCountStore",
            connectionString: connectionString,
            tableName: "word_counts",
            config: config);

        // Build a stream that aggregates word counts
        var stream = StreamBuilder<string, string>
            .CreateNewStream("WordCountStream")
            .Stream()
            .Aggregate(
                keySelector: word => word,
                aggregateFunction: (currentCount, word) => currentCount + 1,
                stateStoreName: "WordCountStore",
                stateStore: wordCountStore)
            .Sink(msg => Console.WriteLine($"Processed: {msg}"))
            .Build();

        // Start the stream and emit some data
        stream.Start();
        var words = new[] { "apple", "banana", "apple", "orange", "banana", "apple" };
        foreach (var word in words)
        {
            stream.Emit(word);
        }

        // Stop processing and dispose the store
        stream.Stop();
        wordCountStore.Dispose();
    }
}
```

**Explanation**:

1. **Store Initialization** – The `ClickHouseStateStore` is created with a connection string, table name and configuration. It creates a table with columns `key` (`String`), `timestamp` (`DateTime64(3)`) and `value` (`Int32` for the count). The `ReplacingMergeTree` engine deduplicates rows with the same key when merges occur.

2. **Stream Configuration** – The stream uses the `Aggregate` operator to group words and increment their count. The state store persists the current count for each word. Because ClickHouse does not update rows in place, each update performs a delete followed by an insert.

3. **Processing and Persistence** – As the stream emits words, the aggregate function reads the current count from ClickHouse, increments it, and writes it back. If the process restarts, the counts persist because ClickHouse replicates data across nodes. However, duplicate rows may remain until a background merge runs when using `ReplacingMergeTree`