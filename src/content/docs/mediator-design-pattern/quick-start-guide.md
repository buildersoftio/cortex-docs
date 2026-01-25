---
title: Quick Start Guide
description: Quick Start Guide with Cortex.Mediator
---


# Quick Start Guide

Get up and running with **Cortex.Mediator** in under 10 minutes! This guide walks you through creating a simple API with commands, queries, and notifications.

## Prerequisites

- .NET 6.0 or higher
- Your favorite IDE (Visual Studio, VS Code, Rider)

## Step 1: Create a New Project

```bash
dotnet new webapi -n MediatorDemo
cd MediatorDemo
```

## Step 2: Install Cortex.Mediator

```bash
dotnet add package Cortex.Mediator
```

## Step 3: Configure Services

Open `Program.cs` and add the mediator configuration:

```csharp
using Cortex.Mediator.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add Cortex.Mediator
builder.Services.AddCortexMediator(
    new[] { typeof(Program).Assembly },
    options => options.AddDefaultBehaviors() // Adds logging
);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

## Step 4: Create Your First Command

Create a folder structure:
```
MediatorDemo/
├── Features/
│   └── Todos/
│       ├── CreateTodo/
│       │   ├── CreateTodoCommand.cs
│       │   └── CreateTodoHandler.cs
│       ├── GetTodo/
│       │   ├── GetTodoQuery.cs
│       │   └── GetTodoHandler.cs
│       └── Events/
│           ├── TodoCreatedNotification.cs
│           └── LogTodoCreatedHandler.cs
├── Controllers/
│   └── TodosController.cs
└── Program.cs

```

### CreateTodoCommand.cs

```csharp
using Cortex.Mediator.Commands;

namespace MediatorDemo.Features.Todos.CreateTodo;

public class CreateTodoCommand : ICommand<TodoDto>
{
    public string Title { get; init; }
    public string Description { get; init; }
}

public class TodoDto
{
    public Guid Id { get; init; }
    public string Title { get; init; }
    public string Description { get; init; }
    public bool IsCompleted { get; init; }
    public DateTime CreatedAt { get; init; }
}
```

### CreateTodoHandler.cs

```csharp
using Cortex.Mediator.Commands;

namespace MediatorDemo.Features.Todos.CreateTodo;

public class CreateTodoHandler : ICommandHandler<CreateTodoCommand, TodoDto>
{
    // In-memory storage for demo
    public static List<TodoDto> Todos { get; } = new();

    public Task<TodoDto> Handle(
        CreateTodoCommand command,
        CancellationToken cancellationToken)
    {
        var todo = new TodoDto
        {
            Id = Guid.NewGuid(),
            Title = command.Title,
            Description = command.Description,
            IsCompleted = false,
            CreatedAt = DateTime.UtcNow
        };

        Todos.Add(todo);

        return Task.FromResult(todo);
    }
}
```

## Step 5: Create Your First Query

### GetTodoQuery.cs

```csharp
using Cortex.Mediator.Queries;

namespace MediatorDemo.Features.Todos.GetTodo;

public class GetTodoQuery : IQuery<TodoDto>
{
    public Guid Id { get; init; }
}
```

### GetTodoHandler.cs

```csharp
using Cortex.Mediator.Queries;
using MediatorDemo.Features.Todos.CreateTodo;

namespace MediatorDemo.Features.Todos.GetTodo;

public class GetTodoHandler : IQueryHandler<GetTodoQuery, TodoDto>
{
    public Task<TodoDto> Handle(
        GetTodoQuery query,
        CancellationToken cancellationToken)
    {
        var todo = CreateTodoHandler.Todos.FirstOrDefault(t => t.Id == query.Id);

        if (todo == null)
        {
            throw new KeyNotFoundException($"Todo with ID {query.Id} not found");
        }

        return Task.FromResult(todo);
    }
}
```

## Step 6: Create the Controller

### TodosController.cs

```csharp
using Cortex.Mediator;
using MediatorDemo.Features.Todos.CreateTodo;
using MediatorDemo.Features.Todos.GetTodo;
using Microsoft.AspNetCore.Mvc;

namespace MediatorDemo.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TodosController : ControllerBase
{
    private readonly IMediator _mediator;

    public TodosController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateTodoCommand command)
    {
        var result = await _mediator.SendAsync(command);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var query = new GetTodoQuery { Id = id };
        var result = await _mediator.QueryAsync(query);
        return Ok(result);
    }

    [HttpGet]
    public IActionResult GetAll()
    {
        return Ok(CreateTodoHandler.Todos);
    }
}
```

## Step 7: Run and Test

```bash
dotnet run
```

Open Swagger UI at `https://localhost:5001/swagger` and test the endpoints:

1. **POST /api/todos** - Create a new todo
   ```json
   {
     "title": "Learn Cortex.Mediator",
     "description": "Complete the quick start guide"
   }
   ```

2. **GET /api/todos/{id}** - Get a specific todo

3. **GET /api/todos** - Get all todos

## Step 8: Add a Notification

Create a notification that fires when a todo is created:

### TodoCreatedNotification.cs

```csharp
using Cortex.Mediator.Notifications;

namespace MediatorDemo.Features.Todos.Events;

public class TodoCreatedNotification : INotification
{
    public Guid TodoId { get; init; }
    public string Title { get; init; }
}
```

### LogTodoCreatedHandler.cs

```csharp
using Cortex.Mediator.Notifications;

namespace MediatorDemo.Features.Todos.Events;

public class LogTodoCreatedHandler : INotificationHandler<TodoCreatedNotification>
{
    private readonly ILogger<LogTodoCreatedHandler> _logger;

    public LogTodoCreatedHandler(ILogger<LogTodoCreatedHandler> logger)
    {
        _logger = logger;
    }

    public Task Handle(
        TodoCreatedNotification notification,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "?? New todo created: {Title} (ID: {TodoId})",
            notification.Title,
            notification.TodoId);

        return Task.CompletedTask;
    }
}
```

### Update CreateTodoHandler.cs

```csharp
using Cortex.Mediator;
using Cortex.Mediator.Commands;
using MediatorDemo.Features.Todos.Events;

namespace MediatorDemo.Features.Todos.CreateTodo;

public class CreateTodoHandler : ICommandHandler<CreateTodoCommand, TodoDto>
{
    private readonly IMediator _mediator;
    public static List<TodoDto> Todos { get; } = new();

    public CreateTodoHandler(IMediator mediator)
    {
        _mediator = mediator;
    }

    public async Task<TodoDto> Handle(
        CreateTodoCommand command,
        CancellationToken cancellationToken)
    {
        var todo = new TodoDto
        {
            Id = Guid.NewGuid(),
            Title = command.Title,
            Description = command.Description,
            IsCompleted = false,
            CreatedAt = DateTime.UtcNow
        };

        Todos.Add(todo);

        // Publish notification
        await _mediator.PublishAsync(new TodoCreatedNotification
        {
            TodoId = todo.Id,
            Title = todo.Title
        }, cancellationToken);

        return todo;
    }
}
```

Now when you create a todo, you'll see a log message in the console!

## Step 9: Add Validation (Optional)

Install FluentValidation:

```bash
dotnet add package FluentValidation
dotnet add package FluentValidation.DependencyInjectionExtensions
dotnet add package Cortex.Mediator.Behaviors.FluentValidation
```

### CreateTodoValidator.cs

```csharp
using FluentValidation;

namespace MediatorDemo.Features.Todos.CreateTodo;

public class CreateTodoValidator : AbstractValidator<CreateTodoCommand>
{
    public CreateTodoValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(100).WithMessage("Title cannot exceed 100 characters");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description cannot exceed 500 characters");
    }
}
```

### Update Program.cs

```csharp
using Cortex.Mediator.DependencyInjection;
using FluentValidation;

var builder = WebApplication.CreateBuilder(args);

// Add validators
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// Add Cortex.Mediator with validation
builder.Services.AddCortexMediator(
    new[] { typeof(Program).Assembly },
    options => options
        .AddDefaultBehaviors()
        .AddOpenCommandPipelineBehavior(typeof(ValidationCommandBehavior<,>))
);

// ... rest of configuration
```

## Complete Project Structure

```
MediatorDemo/
├── Features/
│   └── Todos/
│       ├── CreateTodo/
│       │   ├── CreateTodoCommand.cs
│       │   ├── CreateTodoHandler.cs
│       │   └── CreateTodoValidator.cs
│       ├── GetTodo/
│       │   ├── GetTodoQuery.cs
│       │   └── GetTodoHandler.cs
│       └── Events/
│           ├── TodoCreatedNotification.cs
│           └── LogTodoCreatedHandler.cs
├── Controllers/
│   └── TodosController.cs
└── Program.cs
```

## Summary

You've learned how to:

- Install and configure Cortex.Mediator
- Create and send Commands
- Create and execute Queries
- Publish and handle Notifications
- Add validation with FluentValidation


## Common Patterns

### Using Minimal APIs

```csharp
app.MapPost("/api/todos", async (CreateTodoCommand command, IMediator mediator) =>
{
    var result = await mediator.SendAsync(command);
    return Results.Created($"/api/todos/{result.Id}", result);
});

app.MapGet("/api/todos/{id}", async (Guid id, IMediator mediator) =>
{
    var result = await mediator.QueryAsync(new GetTodoQuery { Id = id });
    return Results.Ok(result);
});
```

### Handling Errors

```csharp
app.MapGet("/api/todos/{id}", async (Guid id, IMediator mediator) =>
{
    try
    {
        var result = await mediator.QueryAsync(new GetTodoQuery { Id = id });
        return Results.Ok(result);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
});
```

## Need Help?

- ?? [Discord Community](https://discord.gg/JnMJV33QHu)
- ?? [GitHub Issues](https://github.com/buildersoftio/cortex/issues)
- ?? Email: cortex@buildersoft.io
