// @ts-check
import { defineConfig } from 'astro/config';
import mermaid from "astro-mermaid";
import starlight from '@astrojs/starlight';
import starlightThemeNova from 'starlight-theme-nova'

// https://astro.build/config
export default defineConfig({
	integrations: [
		mermaid(),
		starlight({
			plugins: [
        		starlightThemeNova(/* options */), 
      		],
			title: 'Cortex Data Framework', 
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/buildersoftio/cortex' }, 
				{ icon: 'discord', label: 'Discord', href: 'https://discord.com/invite/JnMJV33QHu' }
			],
			sidebar: [
				{
					label: 'Get started',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Home', slug: 'get-started/home'  },
						{ label: 'Getting Started', slug: 'get-started/getting-started' },

					],
					
				},
				{
					label: 'Streams',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'streams/overview' },
						{ label: 'Operators', collapsed: true, items: [
							
							{ label: 'Overview', slug: 'streams/operators/operators' },
							{ label: 'Source Operators', slug: 'streams/operators/source' },
							{ label: 'Map Operators', slug: 'streams/operators/map' },
							{ label: 'Filter Operators', slug: 'streams/operators/filter' },
							{ label: 'Aggregate Operators', slug: 'streams/operators/aggregate' },
							{ label: 'Sink Operators', slug: 'streams/operators/sink' },
							{ label: 'Custom Operators', slug: 'streams/operators/custom' },
						
							{ label: 'Window Operators', collapsed: true, items: [
								{ label: 'Window Operators Overview', slug: 'streams/operators/windows/windows-operators-overview' },
								{ label: 'Tumbling Window', slug: 'streams/operators/windows/tumbling-window' },
								{ label: 'Sliding Window', slug: 'streams/operators/windows/sliding-window' },
								{ label: 'Session Window', slug: 'streams/operators/windows/session-window' },
								{ label: 'Window Triggers', slug: 'streams/operators/windows/window-triggers' },
								{ label: 'Window Types Quick Reference', slug: 'streams/operators/windows/window-types-quick-reference' },
								{ label: 'Advanced Window Configuration', slug: 'streams/operators/windows/advanced-window-configuration' },]
						}]
						},
						{ label: 'Integrations', collapsed: true, items: [
							
							{ label: 'Apache Kafka', slug: 'streams/integrations/kafka' },
							{ label: 'Apache Pulsar', slug: 'streams/integrations/apache-pulsar' },
							{ label: 'RabbitMQ', slug: 'streams/integrations/rabbit-mq' },
							{ label: 'Amazon SQS', slug: 'streams/integrations/awssqs' },
							{ label: 'Azure Service Bus', slug: 'streams/integrations/azure-service-bus' },
							{ label: 'Azure Blob Storage', slug: 'streams/integrations/azure-blob-storage' },
							{ label: 'Amazon S3', slug: 'streams/integrations/s3' },
							{ label: 'Files I/O', slug: 'streams/integrations/files' },
							{ label: 'HTTP', slug: 'streams/integrations/http' },
						    { label: 'Elasticsearch', slug: 'streams/integrations/elasticsearch' },]
						},
						{ label: 'Joins', collapsed: true, items: [
							
							{ label: 'Stream-Table Joins', slug: 'streams/joins/stream-table-join' },
							{ label: 'Stream-Stream Joins', slug: 'streams/joins/stream-stream-join' },]
						},
						{ label: 'Branches', slug: 'streams/branches' },
						{ label: 'Stream Performance & Async Processing', slug: 'streams/stream-performance' },
					],
					
				},
				{
					label: 'States',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'states/overview' },
						{ label: 'In-Memory Store', slug: 'states/in-memory' },
						{ label: 'RocksDb Store', slug: 'states/rocksdb' },
						{ label: 'Microsoft SQL Server Store', slug: 'states/ms-sql' },
						{ label: 'PostgreSQL Store', slug: 'states/postgresql' },
						{ label: 'SQLite Store', slug: 'states/sqlite' },
						{ label: 'Clickhouse Store', slug: 'states/clickhouse' },
						{ label: 'MongoDb Store', slug: 'states/mongodb' },
						{ label: 'Cassandra Store', slug: 'states/cassandradb' },
					],
					
				},
				{
					label: 'Aggregations',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'aggregations/overview' },
						{ label: 'Examples', slug: 'aggregations/examples' },

					],
					
				},
				{
					label: 'Change Data Capture (CDC)',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'cdc/overview' },
						{ label: 'Microsoft SQL Server', slug: 'cdc/mssql' },
						{ label: 'PostgreSQL', slug: 'cdc/postgresql' },
						{ label: 'MongoDB', slug: 'cdc/mongodb' },

					],
					
				},
				{
					label: 'Data Types',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'types/overview' },
						{ label: 'AnyOf', slug: 'types/anyof' },
						{ label: 'OneOf', slug: 'types/oneof' },
						{ label: 'AllOf', slug: 'types/allof' },
					],
					
				},
								{
					label: 'Serialization',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'YAML', slug: 'serialization/yaml' },
					],
					
				},
				{
					label: 'Mediator Design Pattern',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'mediator-design-pattern/overview' },
						{ label: 'Architecture', collapsed: true, items: [
							
							{ label: 'Overview', slug: 'mediator-design-pattern/architecture/architecture-overview' },
							{ label: 'Pipelines', slug: 'mediator-design-pattern/architecture/pipeline-behaviors' },
							{ label: 'Exception Handling', slug: 'mediator-design-pattern/architecture/exception-handling' },
							{ label: 'Caching', slug: 'mediator-design-pattern/architecture/caching' },
							{ label: 'Request Processors', slug: 'mediator-design-pattern/architecture/request-processors' },
						]},
						{ label: 'Getting Started', slug: 'mediator-design-pattern/getting-started' },
						{ label: 'Quick Start Guide', slug: 'mediator-design-pattern/quick-start-guide' },
						{ label: 'Commands', slug: 'mediator-design-pattern/commands' },
						{ label: 'Queries', slug: 'mediator-design-pattern/queries' },
						{ label: 'Notifications', slug: 'mediator-design-pattern/notifications' },
						{ label: 'Streaming Queries', slug: 'mediator-design-pattern/streaming-queries' },
						
						{ label: 'Integrations', collapsed: true, items: [
							
							{ label: 'FluentValidation', slug: 'mediator-design-pattern/integrations/fluent-validation' },
						]},
						{ label: 'CQRS', slug: 'mediator-design-pattern/cqrs' },
						{ label: 'Vertical Slice Architecture', slug: 'mediator-design-pattern/vertical-slice-architecture' },
						{ label: 'E-Commerce Application Example', slug: 'mediator-design-pattern/e-commerce' },
					],
					
				},
				{
					label: 'Examples and Tutorials',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Basic Examples', slug: 'examples-and-tutorials/basic-examples' },
						{ label: 'Intermediate Examples', slug: 'examples-and-tutorials/intermediate-examples' },
						{ label: 'Advanced Examples', slug: 'examples-and-tutorials/advanced-examples' },
					],
					
				}
			],
		}),
	],
});
