---
title: SQLite Store
description: An overview of Cortex SQLite state stores
---

The **Cortex.States.SQLite** package provides a lightweight, durable **key–value** state store backed by SQLite:

- `SqliteKeyValueStateStore<TKey, TValue>` — persists keys and values as JSON strings in a single table and offers a simple CRUD API for stateful stream processing.


## Description and Features

- **Zero-config durability** on a local file DB or in-memory DB (`Data Source=:memory:`). The store auto-creates the table on first use. :contentReference[oaicite:1]{index=1}  
- **JSON (de)serialization by default** for keys and values, with optional custom serializer delegates. :contentReference[oaicite:2]{index=2}  
- **Thread-safe one-time initialization** via an internal `SemaphoreSlim`. :contentReference[oaicite:3]{index=3}  
- **CRUD API**: `Get`, `Put`, `ContainsKey`, `Remove`, `GetAll`, `GetKeys`. :contentReference[oaicite:4]{index=4}  
- **UPSERT** implemented with `INSERT OR REPLACE`. :contentReference[oaicite:5]{index=5}

Table layout:
```sql
CREATE TABLE IF NOT EXISTS [<table>] (
  [key]   TEXT NOT NULL PRIMARY KEY,
  [value] TEXT
);
```

## Installation

```powershell
Install-Package Cortex.States.SQLite
```

> Uses `Microsoft.Data.Sqlite` under the hood. Your connection string can point to a file (e.g., `Data Source=state.db`) or memory (`Data Source=:memory:`)

## Configuration and Setup

```csharp
using Cortex.States.Sqlite;

// Optional custom serializers; defaults use System.Text.Json
Func<string, string> keySer   = k => k;                   // example: identity for string keys
Func<MyState, string> valSer  = v => JsonSerializer.Serialize(v);
Func<string, string> keyDes   = s => s;
Func<string, MyState> valDes  = s => JsonSerializer.Deserialize<MyState>(s)!;

var store = new SqliteKeyValueStateStore<string, MyState>(
    name: "MySqliteStore",
    connectionString: "Data Source=state.db",  // or "Data Source=:memory:"
    tableName: "States",
    keySerializer: keySer,                      // optional
    valueSerializer: valSer,                    // optional
    keyDeserializer: keyDes,                    // optional
    valueDeserializer: valDes                   // optional
);
```

On construction, the store ensures the table exists once per process (semaphore-guarded).

## Usage Guide

### Basic CRUD

```csharp
// Create/Update
store.Put("user-1", new MyState { Id = "user-1", Score = 42 });

// Read
var state = store.Get("user-1");          // deserialized from JSON

// Check existence
bool exists = store.ContainsKey("user-1");

// Delete
store.Remove("user-1");
```

`Put` uses **`INSERT` OR `REPLACE`** for idempotent upserts.

### Enumerate

```csharp
foreach (var key in store.GetKeys()) {
    // ...
}
foreach (var pair in store.GetAll()) {
    // pair.Key, pair.Value
}
```

Both methods stream results using a data reader; values are deserialized per row.

## End-to-End Example

```csharp
public record SessionState(string UserId, DateTime LastSeen, int Count);

var sessions = new SqliteKeyValueStateStore<string, SessionState>(
    "Sessions", "Data Source=state.db", "SessionKV");

// Write
sessions.Put("sess-42", new SessionState("u-1", DateTime.UtcNow, 1));

// Read back
var s = sessions.Get("sess-42");
Console.WriteLine($"{s.UserId} - {s.LastSeen:o} - {s.Count}");
```

All key/value serialization defaults to System.Text.Json unless you pass custom delegates.

## Performance & Operational Notes

- **Connection model**: short-lived connections per operation; SQLite handles locking internally. 
- **Initialization**: `InitializeAsync()` runs once; subsequent calls are no-ops (guarded by `_isInitialized`). 
- **Error handling**: operations validate initialization (`EnsureInitialized`) and throw if the store wasn’t constructed correctly. 
- **Dispose**: no long-lived DB resources; the internal semaphore is disposed when the store is disposed.

## API Reference (quick)

```csharp
new SqliteKeyValueStateStore<TKey, TValue>(
    string name,
    string connectionString,
    string tableName,
    Func<TKey, string> keySerializer        = null,
    Func<TValue, string> valueSerializer    = null,
    Func<string, TKey> keyDeserializer      = null,
    Func<string, TValue> valueDeserializer  = null)

```

- `Name` — friendly identifier for logging/metrics.
- `connectionString` — e.g., `Data Source=state.db` or `Data Source=:memory:`.
- `tableName` — table to use/create.
- Serializer/deserializer delegates override the JSON defaults. 


**Methods**:
`Get`, `Put`, `ContainsKey`, `Remove`, `GetAll`, `GetKeys`; plus `Dispose()`.