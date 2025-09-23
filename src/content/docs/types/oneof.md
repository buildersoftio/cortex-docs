---
title: OneOf
description: Cortex Types | OneOf
---

**OneOf** is conceptually similar to **AnyOf**. It is used when you want to indicate that a value is exactly one of the provided types—eliminating ambiguity that might arise from inheritance hierarchies. Although its API (implicit conversions, `Match`, `Switch`, `As<T>()`, etc.) mirrors that of AnyOf, using OneOf signals to the reader (and enforces at runtime) that the value should match one and only one type among those specified.

> **Note**: Depending on the library’s design, the implementation details may differ from AnyOf (e.g., stricter type checking), but usage is nearly identical.

## OneOf Examples

**Example 1: OneOf with Two Types**

```csharp
using Cortex.Types;

OneOf<int, string> oneValue = 100;

// Use Match for type-safe pattern matching.
string output = oneValue.Match(
    i => $"Value is an integer: {i}",
    s => $"Value is a string: {s}"
);
Console.WriteLine(output);

// Change the stored value.
oneValue = "Cortex";
if (oneValue.TryGet<string>(out var strResult))
{
    Console.WriteLine("Successfully retrieved string: " + strResult);
}
```

**Example 2: OneOf with Three Types**

```csharp
using Cortex.Types;

OneOf<int, string, bool> option = false;

// Use Switch to execute type-specific actions.
option.Switch(
    i => Console.WriteLine($"Integer: {i}"),
    s => Console.WriteLine($"String: {s}"),
    b => Console.WriteLine($"Boolean: {b}")
);
```

## Real-World Scenario Examples

### Flexible Configuration Values

**Scenario:**\
In configuration management, a setting might be specified as an integer, boolean, or string. Enforcing that the configuration value is exactly one type can be achieved with OneOf. This helps avoid ambiguous situations (for example, where an integer might also be considered a valid string).

**Example:**
```csharp
// Define possible configuration value types.
public class Configuration
{
    // Using OneOf to ensure the configuration value is exactly one of the defined types.
    public OneOf<int, bool, string> Setting { get; set; }
}

public class ConfigProcessor
{
    public void Process(Configuration config)
    {
        // Use pattern matching to handle the setting based on its underlying type.
        config.Setting.Switch(
            intValue => Console.WriteLine($"Integer value: {intValue}"),
            boolValue => Console.WriteLine($"Boolean value: {boolValue}"),
            stringValue => Console.WriteLine($"String value: {stringValue}")
        );
    }
}

public class Program
{
    public static void Main()
    {
        // Example: a configuration that was read as a boolean.
        var config = new Configuration { Setting = true };
        var processor = new ConfigProcessor();
        processor.Process(config);
    }
}
```

**Explanation:**\
This example demonstrates how a configuration property might be typed as a `OneOf<int, bool, string>`. The `Switch` method is used to execute type-specific logic, ensuring the setting is handled exactly as its declared type.

### Payment Processing Results

**Scenario**: Handling distinct payment processing outcomes with type safety.

```csharp
public class PaymentReceipt { /* ... */ }
public class FraudCheckRequired { /* ... */ }
public class PaymentDeclined { /* ... */ }

OneOf<PaymentReceipt, FraudCheckRequired, PaymentDeclined> ProcessPayment()
{
    // Payment processing logic
    return new PaymentReceipt();
}

// Usage
var result = ProcessPayment();
result.Switch(
    receipt => SendConfirmationEmail(receipt),
    fraudCheck => TriggerVerification(fraudCheck),
    decline => NotifyDecline(decline.Reason)
);

// Type checking
if (result.Is<PaymentReceipt>())
{
    var receipt = result.As<PaymentReceipt>();
    UpdateAccounting(receipt);
}
```
