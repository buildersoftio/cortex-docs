---
title: Microsoft Sql Server Store
description: An overview of Cortex MS SQL Server state stores
---

The **SqlServerStateStore** family of data stores provides persistent state management on top of Microsoft SQL Server. Unlike an embedded key‑value database such as RocksDB, the SQL Server store relies on a relational database engine that is widely deployed in enterprise environments. SQL Server offers **ACID** transactions; its durability property means that once a transaction commits, the database engine uses specialized logging to ensure that updates persist even if the system crashes. By mapping state keys and values into SQL tables and columns, Cortex can leverage the reliability and scalability of SQL Server while still presenting a simple state‑store API.

The **Cortex.States.MSSqlServer** package provides two SQL Server–backed state stores:

- `SqlServerStateStore<TKey, TValue>` — a **typed, columnar** store that maps properties of `TValue` to SQL columns and supports `List<>` properties via child tables.
- `SqlServerKeyValueStateStore<TKey, TValue>` — a **simple key–value** store that persists values as JSON strings in a single table.

| Feature                         | Details                                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent storage**          | Values are written to SQL Server tables.  SQL Server’s ACID properties ensure that committed state is durable.                                                                                                                |
| **Key–value semantics**         | Both stores expose `Put`, `Get`, `Remove`, `ContainsKey`, `GetAll` and `GetKeys` methods.  `SqlServerKeyValueStateStore` uses custom serialization, whereas `SqlServerStateStore` maps properties to table columns.           |
| **Automatic schema management** | The stores create schemas and tables on first use.  `SqlServerStateStore` can also update existing tables by adding missing columns when `createOrUpdateTableSchema` is `true`.                                               |
| **Configurable**                | Accepts a connection string, schema name (`dbo` by default), table name, and an optional flag to control schema updates.  Custom key/value serializers are supported in the key‑value store.                                  |
| **Support for complex types**   | Through reflection, `SqlServerStateStore` can persist classes with multiple properties and `List<T>` collections; list items are stored in separate child tables.                                                             |
| **Durability & reliability**    | State survives process restarts and hardware failures because SQL Server logs committed transactions and recovers them after a crash.                                                                                         |
| **Integration**                 | Because state is stored in a relational database, it can be inspected and backed up using standard SQL tooling.  The schema uses standard `nvarchar` columns – the recommended data type for variable‑length Unicode strings. |


Both stores perform safe, one-time initialization using an internal semaphore and can automatically create or evolve the underlying schema (when enabled). 

---

## Description and Features

### Common features
- **Durability in SQL Server** under a configurable schema (default `dbo`).
- **Auto schema management (opt-in)** — create schema/tables and add missing columns at startup; strict validation when disabled.
- **CRUD API**: `Get`, `Put`, `Remove`, `ContainsKey`, `GetAll`, `GetKeys`. 

### `SqlServerStateStore<TKey, TValue>` (typed/columnar)
- **Automatic type→column mapping** for scalar properties of `TValue`:
  - `int/short/byte → INT`, `long → BIGINT`, `bool → BIT`, `DateTime → DATETIME2`,  
    `decimal → DECIMAL(18,2)`, `double → FLOAT`, `float → REAL`, `Guid → UNIQUEIDENTIFIER`,  
    `TimeSpan → BIGINT (ticks)`, `string/unknown → NVARCHAR(MAX)`.
- **List support**:
  - For `List<TChild>` properties on `TValue`, each becomes a **child table** `{BaseTable}_{PropertyName}` with PK `([key], [ItemIndex])`.   
  - If `TValue` **itself is `List<TChild>`**, the store creates a base table holding only `[key]` plus a single child table `{BaseTable}_Child`.
- **Upsert semantics** for the main row; child rows are re-written per `Put`.

### `SqlServerKeyValueStateStore<TKey, TValue>` (JSON key–value)
- **Table layout**: `[key] NVARCHAR(450) PK`, `[value] NVARCHAR(MAX)` (JSON).
- **Built-in JSON serialization** using `System.Text.Json` for keys and values by default.

---

## Installation

```powershell
Install-Package Cortex.States.MSSqlServer
```

Ensure your SQL principal can create schemas/tables if you enable auto-create.

## Configuration and Setup

### Typed store

```csharp
using Cortex.States.MSSqlServer;

var store = new SqlServerStateStore<string, OrderState>(
    name: "Orders",
    connectionString: "<sql-connection-string>",
    tableName: "OrderState",
    schemaName: "dbo",
    createOrUpdateTableSchema: true // strict mode = false
);
```

On first use, the store ensures [dbo].[OrderState] exists (with scalar columns) and creates a child table per List<> property; or {table}_Child when TValue is a List<>.

### Key–value store

```csharp
using Cortex.States.MSSqlServer;

var kv = new SqlServerKeyValueStateStore<string, CartSnapshot>(
    name: "Carts",
    connectionString: "<sql-connection-string>",
    tableName: "CartKV",
    schemaName: "state" // auto-creates non-dbo schema
);
```
The store ensures the schema (if not dbo) and a single table with [key] and [value].

## Usage Guide

### 1) Basic CRUD (typed store)

```csharp
store.Put("order-001", new OrderState { Id = "order-001", Status = "Placed", Total = 100m });
var loaded  = store.Get("order-001");
bool exists = store.ContainsKey("order-001");
store.Remove("order-001");
```

Put upserts the main row and rewrites the child rows for each list property; TimeSpan is stored as ticks (BIGINT).


### 2) Model with lists (child table per list)

```csharp
public class OrderState
{
    public string Id { get; set; }
    public string Status { get; set; }
    public decimal Total { get; set; }
    public List<OrderLine> Lines { get; set; } = new();
}

public class OrderLine
{
    public string Sku { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}
```

This creates [dbo].[OrderState] for scalars and [dbo].[OrderState_Lines] with columns
[key], [ItemIndex], Sku, Quantity, LineTotal.

### 3) TValue as a list

```csharp
var tagsStore = new SqlServerStateStore<string, List<Tag>>(
    "Tags", "<cs>", "UserTags");

tagsStore.Put("user-42", new List<Tag> {
    new Tag { Name = "vip",  Score = 10 },
    new Tag { Name = "beta", Score =  5 }
});
```

### 4) Key–value JSON store

```csharp
kv.Put("cart-123", new CartSnapshot { Items = 3, Amount = 79.90m });
var snap = kv.Get("cart-123");
foreach (var k in kv.GetKeys()) { /* ... */ }
foreach (var pair in kv.GetAll()) { /* pair.Key, pair.Value */ }
```

Backed by [state].[CartKV] with JSON serialization for both key & value.

## Integration with Streams

Use either store wherever an IDataStore<TKey,TValue> is required (aggregations, windows, etc.). Type discovery for column mapping and list handling is performed by the internal TypeAnalyzer at runtime.

```csharp
var orders = new SqlServerStateStore<string, OrderState>("Orders", cs, "OrderState");
var stream = StreamBuilder<string, OrderEvent>.CreateNewStream("OrderStream")
    .Stream()
    .Aggregate(
        keySelector: e => e.OrderId,
        aggregateFunction: (state, e) => Apply(state, e),
        stateStoreName: "Orders",
        stateStore: orders)
    .Sink(x=> {
        // sink it
    })
    .Build();
```

## Usage Guide

1. **Integration with StreamBuilder** – The state stores integrate seamlessly with Cortex streaming operators. For example, a tumbling‐window aggregation can use a `SqlServerKeyValueStateStore` to persist counts, or a `SqlServerStateStore` to maintain complex per‑key state. Pass the store instance and state store name when configuring the operator.

2. **Stateful Operators** – Operators such as `AggregateOperator`, `TumblingWindowOperator` and `JoinOperator` rely on a state store to keep per‑key state across records. Use the SQL Server store when you need durability across application restarts or wish to inspect state using SQL.

3. **State Management**:

    - **Put** – Inserts or updates a key’s value. In the structured store, this also deletes and reinserts child records for lists to ensure the database accurately reflects the current value.
    - **Get** – Returns the deserialized value for a given key. If the key does not exist, it returns the default value `(default(TValue))`.
    - **Remove** – Deletes the row from the main table and any associated child records.
    - **ContainsKey** – Executes a `SELECT COUNT(*)` query to check if the key exists.
    - **GetAll / GetKeys** – Enumerates keys and values. For complex types, GetAll reads keys and individually loads each value.

4. **Handling Failures** – Because state is persisted in SQL Server, the application can recover its state after failures or redeployments. Upon restart, operators can call Get to rebuild their state from the durable tables.

5. **Performance Considerations**:
    - **Key size** – Keep serialized keys small; the primary key column is defined as `nvarchar(450)` to stay within SQL Server’s 900‑byte index limit. If your serialized key might exceed this length, consider hashing the key or using a shorter surrogate key.

    - **Value size** – The store uses `nvarchar(max)` for values so that large serialized objects are supported. Each non‑null `nvarchar(max)` column adds 24 bytes of fixed overhead and counts toward the 8,060‑byte row size limit, although SQL Server can push large values off‑row. For very large objects or high throughput scenarios, monitor I/O and tune the database accordingly.
    - **Schema updates** – Automatic table creation simplifies development but may not be desirable in locked‐down production environments. Disable schema updates by passing `createOrUpdateTableSchema: false` and manage the schema manually.
    - **Connections** – Each store operation opens and closes a new SqlConnection. Ensure your connection pool is appropriately sized and the connection string enables pooling.

## Code Example – Word Count with SQL Server

The following example demonstrates a simple word‑count stream that uses a `SqlServerKeyValueStateStore` to persist counts. Each unique word is used as the key, and the count is stored as an integer value. The state survives process restarts because it is stored in SQL Server.

```csharp
using Cortex.States.MSSqlServer;
using Cortex.Streams;
using Cortex.Streams.Operators;
using System;

class Program
{
    static void Main()
    {
        // Initialize the SQL Server key‑value store
        var connectionString = "Server=.;Database=CortexDb;Trusted_Connection=True;";
        var wordCountStore = new SqlServerKeyValueStateStore<string, int>(
            name: "WordCountStore",
            connectionString: connectionString,
            tableName: "WordCounts");

        // Build a simple stream that aggregates word counts
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

        // Stop processing and dispose the state store
        stream.Stop();
        wordCountStore.Dispose();
    }
}
```

**Explanation**:

1. **Store Initialization** – The SqlServerKeyValueStateStore is created with a connection string and table name. It automatically creates the underlying table with a `key` column of type `nvarchar(450)` and a `value` column of type `nvarchar(max)`.

2. **Stream Configuration** – The stream uses the `Aggregate` operator to group words by themselves and increment their count. The state store persists the current count for each word.

3. **Processing and Persistence** – As the stream emits words, the aggregate function reads the current count from SQL Server, increments it, and writes it back. If the application restarts, the counts persist because SQL Server’s durability ensures committed transactions survive crashes.


By providing durable, relational persistence for Cortex stateful operators, the SQL Server state store enables developers to build streaming applications that benefit from the reliability and manageability of SQL Server while still enjoying the simple key‑value semantics of the Cortex framework.