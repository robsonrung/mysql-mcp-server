#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';

class MySQLMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mysql-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.connection = null;
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'mysql_query',
            description:
              'Execute a read-only MySQL query. Supports SELECT, SHOW, DESCRIBE, EXPLAIN commands. UPDATE, DELETE, INSERT, DROP, ALTER, CREATE operations are blocked.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The SQL query to execute',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'mysql_schema',
            description:
              'Get comprehensive schema information including tables, views, columns, indexes, and constraints',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description:
                    'Optional: Get schema for a specific table. If not provided, returns all tables.',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.ensureConnection();

        switch (name) {
          case 'mysql_query':
            return await this.handleQuery(args.query);
          case 'mysql_schema':
            return await this.handleSchema(args.table_name);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async ensureConnection() {
    if (!this.connection) {
      const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'test',
        ssl: process.env.MYSQL_SSL === 'true' ? {} : false,
      };

      this.connection = await mysql.createConnection(config);
    }
  }

  validateQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();

    const forbiddenOperations = [
      'update',
      'delete',
      'insert',
      'drop',
      'alter',
      'create',
      'truncate',
      'grant',
      'revoke',
      'set',
      'use',
      'lock',
      'unlock',
    ];

    const firstWord = trimmedQuery.split(/\s+/)[0];

    if (forbiddenOperations.includes(firstWord)) {
      throw new Error(
        `Operation '${firstWord.toUpperCase()}' is not allowed. Only read-only operations are permitted.`,
      );
    }

    const allowedOperations = [
      'select',
      'show',
      'describe',
      'desc',
      'explain',
      'analyze',
      'with',
    ];
    if (!allowedOperations.includes(firstWord)) {
      throw new Error(
        `Operation '${firstWord.toUpperCase()}' is not recognized as a safe read-only operation.`,
      );
    }
  }

  async handleQuery(query) {
    this.validateQuery(query);

    try {
      const [rows, fields] = await this.connection.execute(query);

      let result = '';

      if (Array.isArray(rows)) {
        if (rows.length === 0) {
          result = 'Query executed successfully. No rows returned.';
        } else {
          const headers = fields.map((field) => field.name);
          result = this.formatTableOutput(rows, headers);
        }
      } else {
        result = JSON.stringify(rows, null, 2);
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  async handleSchema(tableName) {
    try {
      let result = '';

      if (tableName) {
        result += await this.getTableSchema(tableName);
      } else {
        result += await this.getAllTablesSchema();
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Schema retrieval failed: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    let result = `Schema for table: ${tableName}\n\n`;

    const [tableInfo] = await this.connection.execute(
      'SELECT TABLE_SCHEMA, TABLE_TYPE, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_NAME = ?',
      [tableName],
    );

    if (tableInfo.length === 0) {
      throw new Error(`Table '${tableName}' not found`);
    }

    result += `Table Type: ${tableInfo[0].TABLE_TYPE}\n`;
    result += `Engine: ${tableInfo[0].ENGINE || 'N/A'}\n`;
    result += `Collation: ${tableInfo[0].TABLE_COLLATION || 'N/A'}\n\n`;

    const [columns] = await this.connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY, COLUMN_COMMENT
       FROM information_schema.COLUMNS 
       WHERE TABLE_NAME = ? 
       ORDER BY ORDINAL_POSITION`,
      [tableName],
    );

    result += 'COLUMNS:\n';
    result += this.formatTableOutput(columns, [
      'COLUMN_NAME',
      'DATA_TYPE',
      'IS_NULLABLE',
      'COLUMN_DEFAULT',
      'EXTRA',
      'COLUMN_KEY',
      'COLUMN_COMMENT',
    ]);
    result += '\n';

    const [indexes] = await this.connection.execute(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE, COMMENT
       FROM information_schema.STATISTICS 
       WHERE TABLE_NAME = ? 
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [tableName],
    );

    if (indexes.length > 0) {
      result += 'INDEXES:\n';
      result += this.formatTableOutput(indexes, [
        'INDEX_NAME',
        'COLUMN_NAME',
        'NON_UNIQUE',
        'INDEX_TYPE',
        'COMMENT',
      ]);
      result += '\n';
    }

    const [constraints] = await this.connection.execute(
      `SELECT tc.CONSTRAINT_NAME, CONSTRAINT_TYPE, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE kcu
       JOIN information_schema.TABLE_CONSTRAINTS tc ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
       WHERE kcu.TABLE_NAME = ?`,
      [tableName],
    );

    if (constraints.length > 0) {
      result += 'CONSTRAINTS:\n';
      result += this.formatTableOutput(constraints, [
        'CONSTRAINT_NAME',
        'CONSTRAINT_TYPE',
        'COLUMN_NAME',
        'REFERENCED_TABLE_NAME',
        'REFERENCED_COLUMN_NAME',
      ]);
    }

    return result;
  }

  async getAllTablesSchema() {
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
    );

    let result = 'DATABASE SCHEMA OVERVIEW:\n\n';
    result += this.formatTableOutput(tables, [
      'TABLE_NAME',
      'TABLE_TYPE',
      'ENGINE',
      'TABLE_ROWS',
      'DATA_LENGTH',
      'INDEX_LENGTH',
    ]);

    return result;
  }

  formatTableOutput(rows, headers) {
    if (rows.length === 0) return 'No data found.';

    const columnWidths = headers.map((header) => {
      const maxContentWidth = Math.max(
        ...rows.map((row) => String(row[header] || '').length),
      );
      return Math.max(header.length, maxContentWidth);
    });

    let output = '';

    output +=
      '| ' +
      headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ') +
      ' |\n';
    output +=
      '| ' +
      columnWidths.map((width) => '-'.repeat(width)).join(' | ') +
      ' |\n';

    for (const row of rows) {
      output +=
        '| ' +
        headers
          .map((header, i) => {
            const value =
              row[header] === null ? 'NULL' : String(row[header] || '');
            return value.padEnd(columnWidths[i]);
          })
          .join(' | ') +
        ' |\n';
    }

    return output;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new MySQLMCPServer();
server.run().catch(console.error);
