---
title: AnyOf
description: Cortex Types | AnyOf
---

**AnyOf** is implemented as a `readonly struct` that wraps an object value along with a set of indices identifying which of the declared type parameters the value matches. In the provided implementation, there are overloads for two, three, and four possible types. Key methods include:

- **Implicit Conversions**:\
Implicit operators allow a value of type T1, T2, etc., to be assigned directly to an AnyOf container.
    ```csharp
    AnyOf<int, string> value = 42;
    AnyOf<int, string> value2 = "Hello";
    ```
- **Type Checking and Retrieval**:

    - `Is<T>()` returns `true` if the stored value is (or derives from) type `T`.
    - `As<T>()` casts the value to type `T` (or throws an exception if the cast is invalid).
    - `TryGet<T>(out T result)` attempts a safe cast.

- Pattern Matching:

    - `Match(...)` returns a value by executing one of several provided functions based on the stored type.
    - `Switch(...)` executes a type-specific action without returning a value.

## AnyOf Examples

**Example 1: AnyOf with Two Types**
```csharp
using Cortex.Types;

AnyOf<int, string> anyValue = 42;

// Pattern matching returns a string based on the stored type.
string result = anyValue.Match(
    i => $"Integer: {i}",
    s => $"String: {s}"
);
Console.WriteLine(result);

// Now assign a string value.
anyValue = "Hello, World!";
Console.WriteLine(anyValue.Match(
    i => $"Integer: {i}",
    s => $"String: {s}"
));

```

**Example 2: AnyOf with Three Types**

```csharp
using Cortex.Types;

AnyOf<int, string, double> value = "Test";

// Using Match for type-specific handling:
Console.WriteLine(value.Match(
    i => $"Integer: {i}",
    s => $"String: {s}",
    d => $"Double: {d}"
));

// Or use TryGet for safe retrieval:
if (value.TryGet<string>(out var str))
{
    Console.WriteLine("Value is a string: " + str);
}

```

**Example 3: AnyOf with Four Types**

```csharp
using Cortex.Types;

AnyOf<int, string, double, bool> multiValue = true;

// Using Switch to perform actions without returning a result:
multiValue.Switch(
    i  => Console.WriteLine($"Integer: {i}"),
    s  => Console.WriteLine($"String: {s}"),
    d  => Console.WriteLine($"Double: {d}"),
    b  => Console.WriteLine($"Boolean: {b}")
);

```

## Real-World Scenario Examples

### API Response Handling

**Scenario:**\
Imagine an HTTP API that returns either a successful result (for example, a User object) or an error message (an ApiError object). Using AnyOf allows you to wrap the response in a single container and then pattern-match based on whether the response represents a success or failure.

**Example:**

```csharp
// Domain models
public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
}

public class ApiError
{
    public int ErrorCode { get; set; }
    public string Message { get; set; }
}

// Using the AnyOf union type for API responses.
using Cortex.Types;

public class ApiService
{
    // Simulate an API call that returns either a User or an ApiError.
    public AnyOf<User, ApiError> GetUserResponse(int userId)
    {
        if (userId == 0)
        {
            // Return an error result implicitly converted to AnyOf<User, ApiError>.
            return new ApiError { ErrorCode = 404, Message = "User not found" };
        }
        else
        {
            // Return a successful User object.
            return new User { Id = userId, Name = "Jane Doe" };
        }
    }
}

public class Program
{
    public static void Main()
    {
        var service = new ApiService();
        AnyOf<User, ApiError> response = service.GetUserResponse(0);

        // Pattern match the response.
        string result = response.Match(
            user => $"User Found: {user.Name}",
            error => $"Error {error.ErrorCode}: {error.Message}"
        );
        Console.WriteLine(result);
    }
}
```

**Explanation:**\
This example uses `AnyOf<User, ApiError>` to encapsulate two possible types for the API response. The `Match` method is then used to process the result appropriately based on the actual type returned.

### Flexible API Response Handling

**Scenario**: Handling different response types from a weather API that can return data, cached results, or errors.

```csharp
public class WeatherData { /* ... */ }
public class CachedResult { /* ... */ }
public class ApiError { /* ... */ }

AnyOf<WeatherData, CachedResult, ApiError> GetWeatherData()
{
    // Simulated API call
    return new WeatherData();
}

// Usage
var response = GetWeatherData();
response.Switch(
    data => RenderWeather(data),
    cached => ShowCachedWarning(cached),
    error => DisplayError(error.Message)
);

// Pattern matching
var summary = response.Match(
    data => $"Temp: {data.Temperature}°C",
    cached => $"Cached: {cached.Timestamp}",
    error => $"Error: {error.Code}"
);
```

### Configuration Flexibility

**Scenario**: Supporting multiple configuration source types for a system.

```csharp
public class DatabaseConfig { /* ... */ }
public class FileConfig { /* ... */ }
public class CloudConfig { /* ... */ }

AnyOf<DatabaseConfig, FileConfig, CloudConfig> LoadConfiguration()
{
    // Configuration loading logic
    return new FileConfig();
}

// Usage
var config = LoadConfiguration();
config.Match(
    db => ConnectDatabase(db.ConnectionString),
    file => ReadFileConfig(file.Path),
    cloud => AuthenticateWithCloud(cloud.Token)
);

// Safe type access
if (config.TryGet<CloudConfig>(out var cloudConfig))
{
    EnableCloudFeatures(cloudConfig);
}
```
