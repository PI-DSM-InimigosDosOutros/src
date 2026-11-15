const db = require('../config/database');
const transaction = require('./transaction');
const { genders, fail } = require('../services/validation');
const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

async function writeProfile(connection, userId, profile, sections = { measures: true, preferences: true, categories: true, days: true }) {
    const [categories] = await connection.execute('SELECT IdExerciseCategory AS id, Name AS name FROM ExerciseCategory');
    const categoryIds = profile.exerciseCategories.map(name => categories.find(item => item.name === name)?.id);
    const [days] = await connection.execute('SELECT IdDaysWeek AS id, Day AS name FROM DaysWeek');
    const dayIds = profile.availableDays.map(day => days.find(item => item.name === dayNames[day - 1])?.id);
    if ((sections.categories && categoryIds.some(id => !id)) || (sections.days && dayIds.some(id => !id))) fail('O catálogo de modalidades ou dias da semana está incompleto.', 409);
    if (sections.measures) await connection.execute('INSERT INTO UserMeasures (IdUser, Weight, Height) VALUES (?, ?, ?)', [userId, profile.weightKg, profile.heightCm]);
    if (sections.preferences || sections.categories) await connection.execute(`INSERT INTO UserPreferences (IdUser, Goal, FreeTimePerDay, HealthySituation, WorkoutHistory)
        VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE Goal=VALUES(Goal), FreeTimePerDay=VALUES(FreeTimePerDay),
        HealthySituation=VALUES(HealthySituation), WorkoutHistory=VALUES(WorkoutHistory)`,
    [userId, profile.goal, profile.availableMinutesPerDay, profile.medicalNotes, profile.activityLevel]);
    if (sections.categories) {
        const [[preference]] = await connection.execute('SELECT IdUserPreferences AS id FROM UserPreferences WHERE IdUser=?', [userId]);
        await connection.execute('DELETE FROM UserPreferencesCategory WHERE IdUserPreferences=?', [preference.id]);
        for (const id of categoryIds) await connection.execute('INSERT INTO UserPreferencesCategory (IdUserPreferences, IdExerciseCategory) VALUES (?, ?)', [preference.id, id]);
    }
    if (sections.days) {
        await connection.execute('DELETE FROM UserAvailableDay WHERE IdUser=?', [userId]);
        for (const id of dayIds) await connection.execute('INSERT INTO UserAvailableDay (IdUser, IdDaysWeek) VALUES (?, ?)', [userId, id]);
        await connection.execute(`INSERT INTO UserScheduleVersion (IdUser, EffectiveDate, Days) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE Days=VALUES(Days)`, [userId, require('../services/validation').dateKey(), JSON.stringify(profile.availableDays)]);
    }
    await connection.execute('INSERT INTO Streak (IdUser) VALUES (?) ON DUPLICATE KEY UPDATE IdUser=VALUES(IdUser)', [userId]);
}

async function getProfile(userId, connection = db) {
    const [[user]] = await connection.execute(`SELECT u.FirstName AS firstName, u.LastName AS lastName,
        DATE_FORMAT(u.BirthDate, '%Y-%m-%d') AS birthDate, u.Gender AS gender, l.Email AS email,
        p.Goal AS goal, p.FreeTimePerDay AS availableMinutesPerDay, p.HealthySituation AS medicalNotes, p.WorkoutHistory AS activityLevel
        FROM User u JOIN UserLogin l ON l.IdUser=u.IdUser LEFT JOIN UserPreferences p ON p.IdUser=u.IdUser WHERE u.IdUser=?`, [userId]);
    if (!user) fail('Conta não encontrada.', 404);
    const [[measures]] = await connection.execute('SELECT Height AS heightCm, Weight AS weightKg FROM UserMeasures WHERE IdUser=? ORDER BY UpdateDate DESC, IdUserMeasures DESC LIMIT 1', [userId]);
    const [categories] = await connection.execute(`SELECT c.Name AS name FROM ExerciseCategory c JOIN UserPreferencesCategory pc ON pc.IdExerciseCategory=c.IdExerciseCategory
        JOIN UserPreferences p ON p.IdUserPreferences=pc.IdUserPreferences WHERE p.IdUser=? ORDER BY c.IdExerciseCategory`, [userId]);
    const [days] = await connection.execute('SELECT d.Day AS name FROM DaysWeek d JOIN UserAvailableDay ud ON ud.IdDaysWeek=d.IdDaysWeek WHERE ud.IdUser=?', [userId]);
    return { fullName: `${user.firstName} ${user.lastName}`, birthDate: user.birthDate, gender: Object.keys(genders).find(key => genders[key] === user.gender) || user.gender,
        email: user.email, heightCm: measures ? Number(measures.heightCm) : 0, weightKg: measures ? Number(measures.weightKg) : 0,
        goal: user.goal || '', availableMinutesPerDay: Number(user.availableMinutesPerDay || 0), medicalNotes: user.medicalNotes || null, activityLevel: user.activityLevel || null,
        exerciseCategories: categories.map(item => item.name), availableDays: days.map(item => dayNames.indexOf(item.name) + 1).filter(Boolean).sort((a, b) => a - b) };
}

async function update(userId, input) {
    await transaction(async connection => {
        await connection.execute('SELECT IdUser FROM User WHERE IdUser=? FOR UPDATE', [userId]);
        const current = await getProfile(userId, connection);
        const has = key => Object.hasOwn(input, key);
        const sections = { measures: has('heightCm') || has('weightKg'), goal: has('goal'), time: has('availableMinutesPerDay'),
            days: has('availableDays'), categories: has('exerciseCategories'), activity: has('activityLevel') };
        const profile = require('../services/validation').profile({ ...current, ...input }, sections);
        await connection.execute('UPDATE User SET FirstName=?, LastName=?, BirthDate=?, Gender=? WHERE IdUser=?', [profile.firstName, profile.lastName, profile.birthDate, profile.gender, userId]);
        await connection.execute('UPDATE UserLogin SET Email=? WHERE IdUser=?', [profile.email, userId]);
        await writeProfile(connection, userId, profile, { ...sections, preferences: sections.goal || sections.time || sections.activity || has('medicalNotes') });
    });
    return getProfile(userId);
}
module.exports = { writeProfile, getProfile, update };
