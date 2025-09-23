---
title: AllOf
description: Cortex Types | AllOf
---

**AllOf** represents an intersection type—a value that must conform to all of the specified type constraints. This is particularly useful when a value implements multiple interfaces or contracts. Rather than choosing one type among many, **AllOf** ensures that the contained value can be used as each of the declared types.

For example, if you have two interfaces:

```csharp
public interface IFoo { void Foo(); }
public interface IBar { void Bar(); }
```

A class that implements both can be wrapped in an `AllOf<IFoo, IBar>` container. Its API is similar to that of the union types (`Match`, `Switch`, etc.) but with the expectation that every declared type is supported by the stored value.

## AllOf Examples

**Example 1: AllOf with Two Interfaces**

```csharp
using Cortex.Types;

// Define two interfaces.
public interface IFoo { void Foo(); }
public interface IBar { void Bar(); }

// A class implementing both.
public class FooBar : IFoo, IBar
{
    public void Foo() => Console.WriteLine("Foo");
    public void Bar() => Console.WriteLine("Bar");
}

// Assume an AllOf<T1, T2> type exists that enforces the intersection constraint.
AllOf<IFoo, IBar> combined = AllOf<IFoo, IBar>.Create(new FooBar());

// Retrieve each interface aspect from the stored value.
if (combined.TryGet<IFoo>(out var foo) && combined.TryGet<IBar>(out var bar))
{
    foo.Foo();
    bar.Bar();
}

```

**Example 2: AllOf with Three Interfaces**

```csharp
using Cortex.Types;

// Define multiple interfaces.
public interface IAlpha { void Alpha(); }
public interface IBeta { void Beta(); }
public interface IGamma { void Gamma(); }

public class MultiImplementation : IAlpha, IBeta, IGamma
{
    public void Alpha() => Console.WriteLine("Alpha");
    public void Beta()  => Console.WriteLine("Beta");
    public void Gamma() => Console.WriteLine("Gamma");
}

// Wrap the instance in an AllOf container requiring all three interfaces.
AllOf<IAlpha, IBeta, IGamma> multi = AllOf<IAlpha, IBeta, IGamma>.Create(new MultiImplementation());

// Use a composite Switch method (if provided) to execute all actions at once.
multi.Switch(
    (IAlpha alpha, IBeta beta, IGamma gamma) =>
    {
        alpha.Alpha();
        beta.Beta();
        gamma.Gamma();
    }
);

```

> **Note**: The exact API for AllOf may vary. The example above demonstrates a common usage pattern where a single object is expected to meet multiple interface contracts.


## Real-World Scenario Examples

### Multi-Interface Component

**Scenario**: A plugin system requiring components to implement both plugin functionality and disposability.

```csharp
public interface IPlugin { void Execute(); }
public interface IDisposablePlugin { void Cleanup(); }

public class DataProcessor : IPlugin, IDisposablePlugin
{
    public void Execute() => Console.WriteLine("Processing data...");
    public void Cleanup() => Console.WriteLine("Cleaning resources...");
}

// Usage
var processor = AllOf<IPlugin, IDisposablePlugin>.Create(new DataProcessor());
processor.As<IPlugin>().Execute();    // Access as IPlugin
processor.As<IDisposablePlugin>().Cleanup();  // Access as IDisposable

if (processor.TryGet<IPlugin>(out var plugin))
{
    plugin.Execute();
}
```



### Game Entity System

**Scenario**: Game entities that must satisfy multiple capability interfaces.

```csharp
public interface IMovable { void Move(); }
public interface IDamageable { void TakeDamage(int amount); }
public interface ICollectible { void Collect(); }

public class PowerUp : IMovable, IDamageable, ICollectible
{
    public void Move() => Console.WriteLine("Floating...");
    public void TakeDamage(int amt) => Console.WriteLine($"Shield damaged by {amt}");
    public void Collect() => Console.WriteLine("Power-up collected!");
}

// Usage
AllOf<IMovable, IDamageable, ICollectible> entity = 
    AllOf<IMovable, IDamageable, ICollectible>.Create(new PowerUp());

entity.As<IMovable>().Move();
entity.As<ICollectible>().Collect();
```

