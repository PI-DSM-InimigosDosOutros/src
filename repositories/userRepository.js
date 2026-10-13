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

};

module.exports = userRepository;