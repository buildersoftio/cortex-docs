---
title: Branches
description: How to use Branches in Cortex.Streams
---

In Cortex, branches allow you to split your data stream into multiple parallel processing paths. Each branch operates independently, enabling you to apply different transformations, filters, and sinks to the same incoming data. This is particularly useful when you need to perform different operations on the same data set concurrently.

## Creating and Using Branches
To use branches in your stream processing pipeline, you start by creating a `StreamBuilder` instance. You can then add branches using the `AddBranch` method, where each branch is configured using an `IBranchStreamBuilder`. Within each branch, you can chain multiple operators like `Filter`, `Map`, `Sink`, `Aggregate`, `AgreggateSilently`, `GroupBy`, `GroupBySilently` to define the processing logic.

### Syntax

```csharp
IStreamBuilder<TIn> AddBranch(
    string name, 
    Action<IBranchStreamBuilder<TIn>> config
);
```
- `name`: A unique identifier for the branch.
- `config`: A delegate that configures the branch using the IBranchStreamBuilder.

### Methods in `IBranchStreamBuilder`

- `Filter(Func<TCurrent, bool> predicate)`: Filters the data based on a condition.
- `Map<TNext>(Func<TCurrent, TNext> mapFunction)`: Transforms the data to a new type.
- `Sink(Action<TCurrent> sinkFunction)`: Consumes the data at the end of the branch.
- `Sink(ISinkOperator<TCurrent> sinkOperator)`: Uses a custom sink operator to consume data.
- `AggregateSilently<TKey, TAggregate>(Func<TCurrent, TKey> keySelector, Func<TAggregate, TCurrent, TAggregate> aggregateFunction, string stateStoreName = null, IStateStore<TKey, TAggregate> stateStore = null);`: Aggregates the stream data using a specified aggregation function silently in the background
- `Aggregate<TKey, TAggregate>(Func<TCurrent, TKey> keySelector, Func<TAggregate, TCurrent, TAggregate> aggregateFunction, string stateStoreName = null, IStateStore<TKey, TAggregate> stateStore = null);`: Aggregates the stream data using a specified aggregation function

and `GroupBy`, `GroupBySilently`

## Examples
Below are several examples demonstrating how to use branches effectively.


### Example 1: Even and Odd Number Processing
**Scenario**: You have a stream of integers and want to process even and odd numbers differently.

```csharp
        var stream = StreamBuilder<int>.CreateNewStream("NumberProcessingStream")
            .Stream()
              .AddBranch("EvenNumbers", branch =>
              {
                  branch
                      .Filter(x => x % 2 == 0)
                      .Map(x => x * 2)
                      .Sink(x => Console.WriteLine($"Even number processed: {x}"));
              })
             .AddBranch("OddNumbers", branch =>
             {
                 branch
                     .Filter(x => x % 2 != 0)
                     .Map(x => x * 3)
                     .Sink(x => Console.WriteLine($"Odd number processed: {x}"));
             })
            .Build();

        stream.Start();

        // Emitting numbers into the stream
        stream.Emit(1);
        stream.Emit(2);
        stream.Emit(3);
        stream.Emit(4);
        stream.Emit(5);

        stream.Stop();
```

**Output:**

```bash
Odd number processed: 3
Even number processed: 4
Odd number processed: 9
Even number processed: 8
Odd number processed: 15
```

**Explanation:**

- **EvenNumbers Branch**:
    - Filters even numbers.
    - Doubles the value.
    - Prints the result.

- **OddNumbers Branch**:
    - Filters odd numbers.
    - Triples the value.
    - Prints the result.


### Example 2: Even and Odd Number Processing
**Scenario**: Categorize temperature readings into `"Cold"`, `"Warm"`, and `"Hot"`.

```csharp
        var stream = StreamBuilder<int>.CreateNewStream("TemperatureStream")
            .Stream()
            .AddBranch("Cold", branch =>
            {
                branch
                    .Filter(temp => temp < 15)
                    .Sink(temp => Console.WriteLine($"Cold temperature: {temp}°C"));
            })
                .AddBranch("Warm", branch =>
                {
                    branch
                    .Filter(temp => temp >= 15 && temp < 25)
                    .Sink(temp => Console.WriteLine($"Warm temperature: {temp}°C"));
                })
            .AddBranch("Hot", branch =>
            {
                branch
                    .Filter(temp => temp >= 25)
                    .Sink(temp => Console.WriteLine($"Hot temperature: {temp}°C"));
            })
           .Build();

        stream.Start();

        // Emitting temperature readings
        stream.Emit(10);  // Cold
        stream.Emit(20);  // Warm
        stream.Emit(30);  // Hot

        stream.Stop();
```

**Output:**

```bash
Cold temperature: 10°C
Warm temperature: 20°C
Hot temperature: 30°C
```

**Explanation**:\
Each branch filters temperatures based on defined ranges and prints a message accordingly.

### Example 3: Log Message Processing
**Scenario**: Process different types of log messages: `Info`, `Warning`, and `Error`.

```csharp
        var stream = StreamBuilder<string>.CreateNewStream("LogProcessingStream")
            .Stream()
            .AddBranch("InfoLogs", branch =>
            {
                branch
                    .Filter(log => log.Contains("INFO"))
                    .Map(log => $"[Info]: {log}")
                    .Sink(log => Console.WriteLine(log));
            })
            .AddBranch("WarningLogs", branch =>
            {
                branch
                    .Filter(log => log.Contains("WARNING"))
                    .Map(log => $"[Warning]: {log}")
                    .Sink(log => Console.WriteLine(log));
            })
            .AddBranch("ErrorLogs", branch =>
            {
                branch
                    .Filter(log => log.Contains("ERROR"))
                    .Map(log => $"[Error]: {log}")
                    .Sink(log => Console.WriteLine(log));
            })
            .Build();

        stream.Start();

        // Emitting log messages
        stream.Emit("INFO: System started.");
        stream.Emit("WARNING: Low disk space.");
        stream.Emit("ERROR: Failed to connect to database.");

        stream.Stop();
```

**Output:**

```bash
[Info]: INFO: System started.
[Warning]: WARNING: Low disk space.
[Error]: ERROR: Failed to connect to database.
```

**Explanation**:
- **InfoLogs Branch**:
    - Filters messages containing "INFO".
    - Adds a prefix.
    - Prints the message.

- **WarningLogs Branch**:
    - Filters messages containing "WARNING".
    - Adds a prefix.
    - Prints the message.

- **ErrorLogs Branch**:
    - Filters messages containing "ERROR".
    - Adds a prefix.
    - Prints the message.

### Example 4: Complex Data Transformation
**Scenario**: Process transaction data to detect fraud and calculate statistics concurrently.

```csharp
    public class Transaction
    {
        public string Id { get; set; }
        public double Amount { get; set; }
        public bool IsFraudulent { get; set; }
    }

    private static void Main(string[] args)
    {
        var stream = StreamBuilder<Transaction>.CreateNewStream("TransactionStream")
            .Stream()
            .AddBranch("FraudDetection", branch =>
            {
                branch
                    .Filter(tx => tx.IsFraudulent)
                    .Sink(tx => Console.WriteLine($"Fraudulent transaction detected: {tx.Id}"));
            })
            // Branch for calculating total amount
            .AddBranch("TotalAmount", branch =>
            {
                double totalAmount = 0;
                branch
                    .Map(tx => tx.Amount)
                    .Sink(amount =>
                    {
                        totalAmount += amount;
                        Console.WriteLine($"Total amount processed: {totalAmount}");
                    });
            })
            .Build();

        stream.Start();

        // Emitting transactions
        stream.Emit(new Transaction { Id = "TX1001", Amount = 150.00, IsFraudulent = false });
        stream.Emit(new Transaction { Id = "TX1002", Amount = 2000.00, IsFraudulent = true });
        stream.Emit(new Transaction { Id = "TX1003", Amount = 75.50, IsFraudulent = false });

        stream.Stop();
    }
```

**Output:**

```bash
Total amount processed: 150
Fraudulent transaction detected: TX1002
Total amount processed: 2150
Total amount processed: 2225.5
```

**Explanation**:
- **FraudDetection Branch**:
    - Filters fraudulent transactions.
    - Prints a warning message.

- **TotalAmount Branch**:
    - Maps transactions to their amounts.
    - Accumulates and prints the total amount.


### Example 5: Checking Customers

Suppose we have a stream of Customer objects. Each `Customer` has an `IsPremium` flag and a `Country` property. We want to create two branches:

* **PremiumCustomers**: For customers who are premium and from the USA.
* **RegularCustomers**: For all other customers.

```csharp
// Assume Customer class: 
// public class Customer { public string Name; public bool IsPremium; public string Country; }

// Creating a new stream (in this case we assume in-memory streaming, no external source)
var stream = StreamBuilder<Customer>
    .CreateNewStream("CustomerStream")
    .Stream() // In-app streaming (no external source)
    
    // Add a Branch for Premium US Customers
    .AddBranch("PremiumCustomers", branch => 
    {
        branch
            .Filter(c => c.IsPremium && c.Country == "USA")
            .Map(c => new { c.Name, c.IsPremium, c.Country }) // Transform to an anonymous type
            .Sink(result => Console.WriteLine($"Premium US Customer: {result.Name}"));
    })

    // Add another Branch for Regular Customers
    .AddBranch("RegularCustomers", branch =>
    {
        branch
            .Filter(c => !c.IsPremium || c.Country != "USA")
            .Sink(c => Console.WriteLine($"Regular Customer: {c.Name}, Country: {c.Country}"));
    })

    // Finish building
    .Build();

// Start the stream
stream.Start();

// Emit some test data
stream.Emit(new Customer { Name = "Alice", IsPremium = true, Country = "USA" });
stream.Emit(new Customer { Name = "Eren", IsPremium = false, Country = "Germany" });
stream.Emit(new Customer { Name = "Drita", IsPremium = true, Country = "Kosovo" });

// Output:
// Premium US Customer: Alice
// Regular Customer: Eren, Country: Germany
// Regular Customer: Drita, Country: Kosovo

stream.Stop();

```

## Best Practices

- **Unique Branch Names**: Ensure that each branch has a unique name to avoid conflicts.
- **Efficient Filtering**: Place filters early in the branch to reduce the amount of data processed downstream.
- **Error Handling**: Implement try-catch blocks in your sink functions to handle exceptions gracefully.
- **Resource Management**: Be mindful of resource consumption, especially when processing large streams or using external resources in sinks.

## Conclusion

Branches in **Cortex** provide a flexible way to process the same data stream in multiple ways simultaneously. By leveraging branches, you can design complex data processing pipelines that are both efficient and maintainable.
- **Parallel Processing**: Multiple branches can process data concurrently without interfering with each other.
- **Modularity**: Each branch can be developed and tested independently.
- **Scalability**: Branches can be added or removed as processing needs evolve.

## Additional Notes

- **Integration with External Systems**: You can use custom sink operators to integrate branches with external systems like databases, message queues, or APIs.
- **Telemetry and Monitoring**: Utilize telemetry features to monitor the performance and health of each branch.
- **State Management**: If your branches require stateful operations, consider using state stores provided by Cortex.States.


## Sample Code Snippet
Here's a complete example combining several concepts:

```csharp
        var stream = StreamBuilder<string>.CreateNewStream("MultiBranchStream")
            .Stream()
            .AddBranch("UpperCaseBranch", branch =>
            {
                branch
                    .Map(str => str.ToUpper())
                    .Sink(str => Console.WriteLine($"UpperCase: {str}"));
            })
            .AddBranch("LowerCaseBranch", branch =>
            {
                branch
                    .Map(str => str.ToLower())
                    .Sink(str => Console.WriteLine($"LowerCase: {str}"));
            })
            .AddBranch("LengthBranch", branch =>
            {
                branch
                    .Map(str => str.Length)
                    .Sink(length => Console.WriteLine($"Length: {length}"));
            })
            .Build();

        stream.Start();

        // Emitting transactions
        stream.Emit("Hello World");

        stream.Stop();
```

**Output**:

```bash
UpperCase: HELLO WORLD
LowerCase: hello world
Length: 11
```

**Explanation**:
- The same input string is processed in three different ways:
    - Converted to uppercase.
    - Converted to lowercase.
    - Calculated for length.