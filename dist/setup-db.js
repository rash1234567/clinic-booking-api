"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const database_1 = require("./config/database");
async function setupDatabase() {
    try {
        const schema = await (0, promises_1.readFile)((0, node_path_1.resolve)(process.cwd(), 'database/schema.sql'), 'utf8');
        await database_1.pool.query(schema);
        console.log('Database schema created successfully!');
    }
    catch (error) {
        console.error('Database setup failed:', error);
        process.exitCode = 1;
    }
    finally {
        await database_1.pool.end();
    }
}
setupDatabase();
