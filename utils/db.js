import postgres from "postgres";

const db = postgres({
    ssl: 'prefer',
}); // will use psql environment variables

export default db;