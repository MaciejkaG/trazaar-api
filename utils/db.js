import pg from "pg";

// Create a pool instead of a client for better performance
const pool = new pg.Pool({
  // Will use environment variables: PGUSER, PGHOST, PGPASSWORD, PGDATABASE, PGPORT
  ssl: { rejectUnauthorized: false } // 'prefer' equivalent
});

// Helper function to execute queries
async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export default {
  query,
  pool
};