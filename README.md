# MySQL MCP Server

A MySQL Model Context Protocol (MCP) server that provides secure, read-only access to MySQL databases.

## Features

- **Read-only operations**: Only SELECT, SHOW, DESCRIBE, EXPLAIN queries allowed
- **Schema inspection**: Get detailed information about tables, columns, indexes, and constraints
- **Security**: Blocks all write operations (UPDATE, DELETE, INSERT, etc.)
- **Information Schema access**: Query database metadata and structure
- **Formatted output**: Results displayed as readable tables

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and configure your database connection:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL connection details:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
MYSQL_SSL=false
```

## Usage

Start the MCP server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Available Tools

### mysql_query

Execute read-only SQL queries:

```sql
SELECT * FROM users LIMIT 10;
SHOW TABLES;
DESCRIBE users;
EXPLAIN SELECT * FROM users WHERE id = 1;
```

### mysql_schema

Get schema information:

- `mysql_schema` - Overview of all tables
- `mysql_schema` with table_name - Detailed schema for specific table

## Security

This server enforces strict read-only access:

- ✅ **Allowed**: SELECT, SHOW, DESCRIBE, EXPLAIN, ANALYZE
- ❌ **Blocked**: UPDATE, DELETE, INSERT, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, SET, USE, LOCK, UNLOCK

## Requirements

- Node.js 18.0.0 or higher
- MySQL 5.7+ or MariaDB 10.2+
- Network access to MySQL server

## License

MIT