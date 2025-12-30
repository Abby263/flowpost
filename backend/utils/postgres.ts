import pg from "pg";
const { Pool } = pg;

const DATABASE_URI = process.env.DATABASE_URI;

if (!DATABASE_URI) {
  console.warn(
    "DATABASE_URI is not set. Database operations will fail at runtime.",
  );
}

// Create a connection pool for better performance
const pool = DATABASE_URI
  ? new Pool({
      connectionString: DATABASE_URI,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Wait max 10 seconds for connection
    })
  : null;

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

/**
 * Execute a SQL query with parameterized values
 * @param text SQL query string with $1, $2, etc. placeholders
 * @param params Array of parameter values
 * @returns Query result with rows
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error("Database connection not configured. Set DATABASE_URI.");
  }

  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries in development
  if (process.env.NODE_ENV === "development" && duration > 100) {
    console.log("Slow query:", { text, duration, rows: result.rowCount });
  }

  return {
    rows: result.rows as T[],
    rowCount: result.rowCount,
  };
}

/**
 * Get a single row from a query
 * @param text SQL query string
 * @param params Array of parameter values
 * @returns Single row or null if not found
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Get all rows from a query
 * @param text SQL query string
 * @param params Array of parameter values
 * @returns Array of rows
 */
export async function queryMany<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute an INSERT query and return the inserted row
 * @param table Table name
 * @param data Object with column names and values
 * @param returning Columns to return (default: *)
 * @returns Inserted row
 */
export async function insert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  returning = "*",
): Promise<T | null> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  const text = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
    RETURNING ${returning}
  `;

  return queryOne<T>(text, values);
}

/**
 * Execute an UPDATE query
 * @param table Table name
 * @param data Object with column names and values to update
 * @param where WHERE clause conditions
 * @param whereParams Parameters for WHERE clause
 * @param returning Columns to return (default: *)
 * @returns Updated row
 */
export async function update<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  where: string,
  whereParams: unknown[],
  returning = "*",
): Promise<T | null> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

  // Offset the where params by the number of data params
  const offsetWhereParams = whereParams.map(
    (_, i) => `$${columns.length + i + 1}`,
  );
  const adjustedWhere = where.replace(
    /\$(\d+)/g,
    (_, num) => offsetWhereParams[parseInt(num) - 1],
  );

  const text = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${adjustedWhere}
    RETURNING ${returning}
  `;

  return queryOne<T>(text, [...values, ...whereParams]);
}

/**
 * Execute a DELETE query
 * @param table Table name
 * @param where WHERE clause conditions
 * @param whereParams Parameters for WHERE clause
 * @param returning Columns to return (default: *)
 * @returns Deleted row
 */
export async function remove<T = Record<string, unknown>>(
  table: string,
  where: string,
  whereParams: unknown[],
  returning = "*",
): Promise<T | null> {
  const text = `
    DELETE FROM ${table}
    WHERE ${where}
    RETURNING ${returning}
  `;

  return queryOne<T>(text, whereParams);
}

/**
 * Execute an UPSERT (INSERT ... ON CONFLICT UPDATE) query
 * @param table Table name
 * @param data Object with column names and values
 * @param conflictColumn Column(s) to check for conflicts
 * @param returning Columns to return (default: *)
 * @returns Upserted row
 */
export async function upsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  conflictColumn: string | string[],
  returning = "*",
): Promise<T | null> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const conflictColumns = Array.isArray(conflictColumn)
    ? conflictColumn.join(", ")
    : conflictColumn;
  const updateClause = columns
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(", ");

  const text = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumns})
    DO UPDATE SET ${updateClause}
    RETURNING ${returning}
  `;

  return queryOne<T>(text, values);
}

/**
 * Check if the database connection is healthy
 * @returns true if connection is healthy
 */
export async function isHealthy(): Promise<boolean> {
  if (!pool) return false;

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the database connection pool
 */
export async function close(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}

/**
 * Get the pool instance for advanced operations
 */
export function getPool() {
  return pool;
}
