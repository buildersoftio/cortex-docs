---
title: PostgreSQL Store
description: An overview of Cortex PostgreSQL state stores
---

The **PostgresStateStore** modules provide durable state management using **PostgreSQL**, a popular open‑source relational database. PostgreSQL is engineered for reliability: the engine makes sure that all data recorded by a committed transaction is stored in non‑volatile storage. Even if the host system fails, committed transactions remain intact because the database writes modifications to disk using a write‑ahead log (WAL) and supports crash recovery. By mapping state keys and values into PostgreSQL tables, Cortex can take advantage of this durability while still exposing a simple key–value API.

## Description and Features

The **Cortex.States.PostgreSQL** package provides two PostgreSQL–backed state stores:

- `PostgresStateStore<TKey, TValue>` — a **typed, columnar** store that maps scalar properties of `TValue` to table columns and persists `List<>` properties in child tables.   
- `PostgresKeyValueStateStore<TKey, TValue>` — a **simple key–value** store that serializes keys/values as JSON strings into a single table.

Both stores support safe, one-time initialization with a static semaphore and can automatically create or evolve the required schema and tables. 

### Common features

- **Durable storage in PostgreSQL** under a configurable schema (default `public`).   
- **Auto schema management (opt-in)** — create schema/tables and add missing columns at startup; throw if disabled and objects are missing.
- **CRUD API**: `Get`, `Put`, `ContainsKey`, `Remove`, `GetAll`, `GetKeys`. 

### `PostgresStateStore<TKey, TValue>` (typed/columnar)
- **Automatic type → column mapping** for scalar properties of `TValue`:
  - `int/short/byte → INTEGER`, `long → BIGINT`, `bool → BOOLEAN`, `DateTime → TIMESTAMP`,  
    `decimal → NUMERIC(18,2)`, `double → DOUBLE PRECISION`, `float → REAL`, `Guid → UUID`,  
    `TimeSpan → INTERVAL`, `string → TEXT` (fallback also `TEXT`). :contentReference[oaicite:6]{index=6}
- **List support**:
  - `List<TChild>` properties on `TValue` become **child tables** named `{BaseTable}_{PropertyName}` with PK `("key","ItemIndex")`.   
  - If `TValue` **itself is `List<TChild>`**, a base table stores only `"key"`, and a single child table `{BaseTable}_Child` stores items. 
- **Upsert semantics** on the main row (`INSERT … ON CONFLICT (key) DO UPDATE`). Child rows are replaced per `Put`. 

### `PostgresKeyValueStateStore<TKey, TValue>` (JSON key–value)
- **Table layout**: `"key" TEXT PRIMARY KEY`, `"value" TEXT`.
- **Default JSON (de)serialization** using `System.Text.Json` for both key and value


Key features of the PostgreSQL state store:

| Feature                           | Details                                                                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent storage**            | State is stored in PostgreSQL tables.  PostgreSQL guarantees that data recorded by a committed transaction is stored in non‑volatile storage, ensuring that committed state persists even after crashes.                                                    |
| **Key–value semantics**           | Both stores expose `Put`, `Get`, `Remove`, `ContainsKey`, `GetAll` and `GetKeys` methods.  `PostgresKeyValueStateStore` serializes the entire value into a `text` column; `PostgresStateStore` maps object properties to columns.                           |
| **Unlimited key and value sizes** | Keys and values are stored using the `text` type, which stores strings of any length.  PostgreSQL automatically moves large `text` values off‑row using TOAST tables, so only an 18‑byte pointer remains in the row.                                        |
| **Automatic schema management**   | On initialization, the store creates the schema and tables if they do not exist.  `PostgresStateStore` can also add missing columns for new properties when `createOrUpdateTableSchema` is `true`.                                                          |
| **Support for complex types**     | The structured store inspects `TValue` via reflection to determine scalar properties and list properties, generating appropriate tables and columns.  List properties are stored in separate child tables with composite primary keys (`key`, `ItemIndex`). |
| **Durable & reliable**            | Data persists across application restarts and system failures thanks to PostgreSQL’s write‑ahead logging and crash recovery.                                                                                                                                |
| **Integration**                   | Since state is stored in a relational database, it can be queried, backed up and replicated using standard PostgreSQL tools.  The `text` type is the native string type in PostgreSQL, so built‑in string functions work seamlessly.                        |



## Configuration and Setup

### Prerequisites

- **PostgreSQL instance** – You need a running PostgreSQL server. Ensure the connection user has privileges to create schemas and tables if you enable automatic schema management.
- **Package dependency** – Add the NuGet package:

```shell
Install-Package Cortex.States.PostgreSQL
```

This package depends on `Npgsql`, the .NET data provider for PostgreSQL.

### Key–Value Store (PostgresKeyValueStateStore)

To create a simple key‑value store, supply a store name, connection string, table name, and optionally a schema name (defaults to `public`). By default the store will create the schema and table if they do not exist, with `key` and `value` columns of type `text`.

```csharp
using Cortex.States.PostgreSQL;
// Initialize a key‑value state store for counting words
var stateStore = new PostgresKeyValueStateStore<string, int>(
    name: "WordCountStore",
    connectionString: "Host=localhost;Database=cortex;Username=postgres;Password=secret",
    tableName: "word_counts",
    schemaName: "public");

// Put or update a count
stateStore.Put("apple", 3);

// Get a stored value
int count = stateStore.Get("apple");

// Check existence
bool exists = stateStore.ContainsKey("apple");

// Remove a key
stateStore.Remove("apple");

// Dispose when finished
stateStore.Dispose();
```

The store uses JSON serialization for keys and values by default. You can provide custom serialization and deserialization delegates if you want to use a different format.

### Structured State Store (PostgresStateStore)

For more complex state, use the `PostgresStateStore`. This store examines your value type and generates tables accordingly. Here’s an example for persisting an order state that has scalar properties and a collection of items:

```csharp
using Cortex.States.PostgreSQL;

public class OrderState
{
    public string CustomerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}

public class OrderItem
{
    public string ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
}

// Create the state store
var orderStore = new PostgresStateStore<Guid, OrderState>(
    name: "OrderStateStore",
    connectionString: "Host=localhost;Database=cortex;Username=postgres;Password=secret",
    tableName: "order_state",
    schemaName: "cortex",
    createOrUpdateTableSchema: true);

// Save an order
var orderId = Guid.NewGuid();
var state = new OrderState
{
    CustomerId = "C123",
    CreatedAt = DateTime.UtcNow,
    Total = 42.50m,
    Items = new List<OrderItem>
    {
        new OrderItem { ProductId = "P1", Quantity = 2, Price = 10.00m },
        new OrderItem { ProductId = "P2", Quantity = 1, Price = 22.50m }
    }
};
orderStore.Put(orderId, state);

// Retrieve state later
OrderState loaded = orderStore.Get(orderId);

// Remove state
orderStore.Remove(orderId);

orderStore.Dispose();

```

When the store initializes, it creates the schema if it doesn’t exist, generates a main table with a `key` column of type `text` and columns for each scalar property, and creates a child table (`order_state_Items`) to store list items. The child table uses a composite primary key (`key`, `ItemIndex`). The `createOrUpdateTableSchema` flag controls whether missing columns will be added automatically when the value type evolves.

## Usage Guide

1. **Integration with Stream** – The PostgreSQL stores can be passed to Cortex streaming operators to persist aggregation state. For example, a word‑count stream can use `PostgresKeyValueStateStore` for counts, while a sessionization operator can store complex session objects in `PostgresStateStore`.

2. **Stateful Operators** – Operators such as `AggregateOperator`, `TumblingWindowOperator` and `JoinOperator` rely on a state store. Use the PostgreSQL store when you need state durability across restarts, or when you want to inspect state with SQL queries.

3. **State Management**:

    - **Put** – Inserts a new row or updates an existing row. In the key‑value store, this uses `INSERT ... ON CONFLICT (key) DO UPDATE` to upsert the value. In the structured store, it also deletes and reinserts child rows for list properties to keep the database consistent.
    - **Get** – Reads a row by `key`. The structured store reconstructs the value object and any associated list items.
    - **Remove** – Deletes the main row and any child rows associated with the `key`.
    - **ContainsKey** – Executes a simple `SELECT` to check if a key exists.
    - **GetKeys / GetAll** – Enumerates keys or `key–value` pairs. For large tables, consider paginating these operations to avoid loading too much data at once.

4. **Handling Failures** – Because PostgreSQL ensures that all data recorded by committed transactions is stored on nonvolatile media, state remains intact after crashes. After a restart, your operators can call `Get` to restore their state from the database.

5. Performance Considerations:

    - **Key and value sizes** – `text` columns can store very large strings. **PostgreSQL** automatically moves large `text` values out of the main table to TOAST storage, leaving only a small pointer in the row. However, extremely long keys can slow down indexes; consider hashing long composite keys.
    - **Schema evolution** – Automatic schema updates (controlled by `createOrUpdateTableSchema`) simplify development but may not be desirable in production. Set the flag to `false` to prevent schema changes and manage tables manually.
    - **Transactions** – Each operation opens a new connection and executes its statements outside a transaction. If you need atomicity across multiple state store operations, wrap calls in an external transaction using `NpgsqlTransaction`.
    - **Connection pooling** – The Npgsql driver supports connection pooling by default. Ensure your connection string allows pooling and tune the pool size if necessary.

## Code Example – Word Count Stream with PostgreSQL

The following example illustrates a word‑count stream using `PostgresKeyValueStateStore`. Each unique word serves as the key and the value is an integer count. Counts persist across restarts because they are stored in PostgreSQL.

```csharp
using Cortex.States.PostgreSQL;
using Cortex.Streams;
using Cortex.Streams.Operators;
using System;

class Program
{
    static void Main()
    {
        // Create the PostgreSQL key‑value store
        var stateStore = new PostgresKeyValueStateStore<string, int>(
            name: "WordCountStore",
            connectionString: "Host=localhost;Database=cortex;Username=postgres;Password=secret",
            tableName: "word_count");

        // Build the stream with an Aggregate operator
        var stream = StreamBuilder<string, string>
            .CreateNewStream("WordCountStream")
            .Stream()
            .Aggregate(
                keySelector: word => word,
                aggregateFunction: (currentCount, word) => currentCount + 1,
                stateStoreName: "WordCountStore",
                stateStore: stateStore)
            .Sink(msg => Console.WriteLine($"Processed: {msg}"))
            .Build();

        // Start the stream
        stream.Start();
        var words = new[] { "apple", "banana", "apple", "orange", "banana", "apple" };
        foreach (var word in words)
        {
            stream.Emit(word);
        }

        // Stop the stream and dispose the store
        stream.Stop();
        stateStore.Dispose();
    }
}
```

**Explanation**:

1. **Store Initialization** – `PostgresKeyValueStateStore` is initialized with a connection string and table name. It creates a table with `key` and `value` columns of type `text` if it doesn’t already exist. The `text` type can store very long strings, and PostgreSQL stores large values out‑of‑line in TOAST tables
2. **Stream Configuration** – The stream uses the `Aggregate` operator to group words and increment their count. The state store persists counts using PostgreSQL.
3. **Durability** – Because PostgreSQL ensures that committed data is stored on nonvolatile storage, the counts persist even if the application or server crashes. Restarting the application and re‑initializing the store will allow the stream to pick up from the previous counts.