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
							{ label: 'Map Operators', slug: 'streams/operators/map' },
							{ label: 'Filter Operators', slug: 'streams/operators/filter' },
							{ label: 'Aggregate Operators', slug: 'streams/operators/aggregate' },
							{ label: 'Window Operators', slug: 'streams/operators/window' },
							{ label: 'Sink Operators', slug: 'streams/operators/sink' },
							{ label: 'Custom Operators', slug: 'streams/operators/custom' },]
						},
						{ label: 'Joins', slug: 'streams/joins' },
						{ label: 'Branches', slug: 'streams/branches' },
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
					label: 'Mediator Design Pattern',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Overview', slug: 'mediator-design-pattern/overview' },
						{ label: 'Getting Started', slug: 'mediator-design-pattern/getting-started' },
						{ label: 'CQRS', slug: 'mediator-design-pattern/cqrs' },
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
					
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				
			],
		}),
	],
});
