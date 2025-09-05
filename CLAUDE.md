# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a MySQL MCP (Model Context Protocol) server that provides read-only access to MySQL databases. The server exposes two main tools for querying MySQL databases while enforcing strict read-only access controls.

## Commands

### Development
- `npm start` - Start the MCP server
- `npm run dev` - Start the server with file watching for development
- `npm install` - Install dependencies

### Testing the Server
The server communicates via stdio and is designed to be used with MCP-compatible clients. To test manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npm start
```

## Architecture

### Core Components

**src/index.js**: Main server implementation containing:
- `MySQLMCPServer` class: Core server logic and tool handlers
- `mysql_query` tool: Executes read-only SQL queries with validation
- `mysql_schema` tool: Retrieves comprehensive database schema information
- Query validation system that blocks write operations (UPDATE, DELETE, INSERT, etc.)

### Security Features

The server implements strict read-only access:
- Validates queries before execution
- Blocks all write operations: UPDATE, DELETE, INSERT, DROP, ALTER, CREATE, TRUNCATE, etc.
- Only allows: SELECT, SHOW, DESCRIBE, EXPLAIN, ANALYZE
- Throws errors for any non-approved operations

### Database Connection

Connection configuration via environment variables:
- `MYSQL_HOST` (default: localhost)
- `MYSQL_PORT` (default: 3306) 
- `MYSQL_USER` (default: root)
- `MYSQL_PASSWORD` (default: empty)
- `MYSQL_DATABASE` (default: test)
- `MYSQL_SSL` (default: false)

Copy `.env.example` to `.env` and configure your database credentials.

### Tools Available

1. **mysql_query**: Execute read-only SQL commands
   - Supports complex SELECT queries
   - Can query INFORMATION_SCHEMA tables
   - Returns formatted table output

2. **mysql_schema**: Get database schema information  
   - Without parameters: Returns overview of all tables
   - With table_name: Returns detailed schema including columns, indexes, constraints
   - Queries INFORMATION_SCHEMA for comprehensive metadata

### Output Formatting

Query results are formatted as markdown tables for readability, including:
- Column headers
- Proper spacing and alignment
- NULL value handling
- Row count information