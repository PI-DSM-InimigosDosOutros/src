const db = require('../config/database');

const userRepository = {
    findByEmail: async (email) => {
        const query = `
            SELECT 
                ul.IdUser AS id, 
                ul.Email AS email, 
                ul.PasswordHash AS passwordHash,
                u.FirstName AS firstName,
                u.LastName AS lastName
            FROM UserLogin ul
            JOIN User u ON ul.IdUser = u.IdUser
            WHERE ul.Email = ?
            LIMIT 1;
        `;
        const [rows] = await db.execute(query, [email]);
        return rows[0] || null;
    },

    findLoginById: async (userId) => {
        const query = `
            SELECT 
                ul.IdUser AS id, 
                ul.Email AS email, 
                ul.PasswordHash AS passwordHash
            FROM UserLogin ul
            WHERE ul.IdUser = ?
            LIMIT 1;
        `;
        const [rows] = await db.execute(query, [userId]);
        return rows[0] || null;
    },

    createWithLogin: async ({ firstName, lastName, birthDate, gender, email, passwordHash }) => {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [userResult] = await connection.execute(
                `INSERT INTO User (FirstName, LastName, BirthDate, Gender) VALUES (?, ?, ?, ?);`,
                [firstName, lastName, birthDate, gender]
            );
            const userId = userResult.insertId;

            await connection.execute(
                `INSERT INTO UserLogin (IdUser, Email, PasswordHash) VALUES (?, ?, ?);`,
                [userId, email, passwordHash]
            );

            await connection.commit();

            return { id: userId, email, firstName, lastName };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    updatePasswordByUserId: async (userId, passwordHash) => {
        const query = `UPDATE UserLogin SET PasswordHash = ? WHERE IdUser = ?;`;
        await db.execute(query, [passwordHash, userId]);
    }
};

module.exports = userRepository;