const db = require('../config/database');
module.exports = async function transaction(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
};
