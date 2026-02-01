const db = require('../config/db');

const createUsersTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

    try {
        await db.query(queryText);
        console.log("Table 'users' created or already exists.");
    } catch (error) {
        console.error("Error creating 'users' table:", error);
    }
};

// Auto-run if executed directly
if (require.main === module) {
    createUsersTable().then(() => process.exit());
}

module.exports = createUsersTable;
