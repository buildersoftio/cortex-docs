---
title: Getting Started with Cortex Mediator
description: Getting Started with Cortex.Mediator
---


## Installation & Setup

1. **Add Reference**: Include the **Cortex.Mediator** NuGet package or add the source to your project.

2. **Register in DI**: Invoke `AddCortexMediator(...)` in `Startup.cs` or `Program.cs` (for .NET 6 minimal APIs) to scan your assemblies for handlers.

```csharp
// Example in Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 1. Standard .NET setup
    services.AddControllers();

    // 2. Register your DB connection or IDbConnection
    //    services.AddScoped<IDbConnection>(...);

    // 3. Add Cortex.Mediator
    services.AddCortexMediator(
        handlerAssemblyMarkerTypes: new[] { typeof(Startup) },  // assemblies to scan
        configure: options =>
        {
            // Optionally add default behaviors such as Logging
            options.AddDefaultBehaviors();
        }
    );

    // ...
}

// Example in Program.cs

builder.Services.AddControllers();

builder.Services.AddCortexMediator(
      handlerAssemblyMarkerTypes: new[] { typeof(Program) }, // assemblies to scan
      configure: options =>
      {
          // Optionally add default behaviors such as Logging
          options
            .AddDefaultBehaviors();
      }
);
```

In the above example:
- We scan the assembly containing `Startup` for any command/query/notification handlers.
- `AddDefaultBehaviors()` registers standard pipeline behaviors (validation, logging, transaction) out of the box.

## Defining a Command & Handler
**Commands** typically change system state.

```csharp
// 1. Define a simple command
public class CreateUserCommand : ICommand<Guid>
{
    public string UserName { get; set; }
    public string Email { get; set; }
}

// 2. Implement the handler
public class CreateUserCommandHandler : ICommandHandler<CreateUserCommand, Guid>
{
    public async Task<Guid> Handle(CreateUserCommand command, CancellationToken cancellationToken)
    {
        // Example: Persist user to the database
        // using EF Core, raw SQL, etc.
        // e.g. _dbContext.Users.Add(new User { ... });
        // await _dbContext.SaveChangesAsync();

    
        Console.WriteLine($"User '{command.UserName}' created successfully!");
        return Guid.NewGuid();
    }
}
```
Usage:

```csharp
// Suppose we inject IMediator in a controller or service:
public class UserController : ControllerBase
{
    private readonly IMediator _mediator;

    public UserController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserCommand command)
    {
        await _mediator.SendCommandAsync<CreateUserCommand, Guid>(command);
        return Ok("User created");
    }
}
```

## Defining a Query & Handler
**Queries** read data without side effects.

```csharp
// 1. A query that returns a DTO
public class GetUserDetailsQuery : IQuery<UserDto>
{
    public int UserId { get; set; }
}

// 2. Query handler with a result type
public class GetUserDetailsQueryHandler : IQueryHandler<GetUserDetailsQuery, UserDto>
{
    public async Task<UserDto> Handle(GetUserDetailsQuery query, CancellationToken cancellationToken)
    {
        // Fetch user by query.UserId
        // return new UserDto { ... };

        return new UserDto { UserId = query.UserId, UserName = "Sample", Email = "sample@domain.com" };
    }
}

// Sample result model
public class UserDto
{
    public int UserId { get; set; }
    public string UserName { get; set; }
    public string Email { get; set; }
}
```
Usage:

```csharp
public class UserQueriesController : ControllerBase
{
    private readonly IMediator _mediator;

    public UserQueriesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("user/{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        var userDetails = await _mediator.SendQueryAsync<GetUserDetailsQuery, UserDto>(
            new GetUserDetailsQuery { UserId = id });
        return Ok(userDetails);
    }
}
```

## Defining a Notification & Handlers
**Notifications** allow broadcasting events to multiple handlers.

```csharp
// 1. A notification representing an event
public class UserCreatedNotification : INotification
{
    public string UserName { get; set; }
    public string Email { get; set; }
}

// 2. Handler(s) that listen for this notification
public class SendWelcomeEmailHandler : INotificationHandler<UserCreatedNotification>
{
    public async Task Handle(UserCreatedNotification notification, CancellationToken cancellationToken)
    {
        // e.g. send an email
        Console.WriteLine($"Welcome email sent to {notification.Email}");
    }
}

public class AnalyticsUpdateHandler : INotificationHandler<UserCreatedNotification>
{
    public async Task Handle(UserCreatedNotification notification, CancellationToken cancellationToken)
    {
        // e.g. log an analytics event
        Console.WriteLine($"Analytics updated for new user {notification.UserName}");
    }
}
```
Usage:

```csharp
public class UserRegistrationService
{
    private readonly IMediator _mediator;
    public UserRegistrationService(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task RegisterUserAsync(string userName, string email)
    {
        // 1. Create user in DB ...
        // 2. Publish notification
        await _mediator.PublishAsync(new UserCreatedNotification
        {
            UserName = userName,
            Email = email
        });
    }
}
```

## Using Pipeline Behaviors

**Pipeline behaviors** are optional modules that run before and after your command/query/notification handlers. They can:
- Validate input (`ValidationCommandBehavior`)
- Log operations (`LoggingCommandBehavior`)

By default, when you call `.AddDefaultBehaviors()` in your `AddCortexMediator(...)` registration:

- **Validation** uses FluentValidation to validate each command/query.
- **Logging** logs the command name and any exceptions to an `ILogger`.

```csharp
services.AddCortexMediator(
    Configuration,
    new[] { typeof(Program) },
    options =>
    {
        // Register default behaviors: Logging, Validation, Transaction
        options.AddDefaultBehaviors();
    }
);
```
**Custom pipeline behaviors** can also be added:

```csharp
// A custom pipeline behavior that measures execution time
public class TimingBehavior<TCommand, TResult> : ICommandPipelineBehavior<TCommand, TResult>
    where TCommand : ICommand<TResult>
{
    public async Task<TResult> Handle(TCommand command, CommandHandlerDelegate next, CancellationToken cancellationToken)
    {
        var start = DateTime.UtcNow;
        var result = await next();
        var duration = DateTime.UtcNow - start;
        Console.WriteLine($"Command {typeof(TCommand).Name} took {duration.TotalMilliseconds}ms");

        return result;
    }
}

// Register custom open generic pipeline
services.AddCortexMediator(Configuration, new[] { typeof(Program) }, options =>
{
    options.AddOpenCommandPipelineBehavior(typeof(TimingBehavior<,>));
});
```

