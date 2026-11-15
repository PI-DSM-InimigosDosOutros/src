function buildProgress(history, availableDays, today, schedules = []) {
    const dayKey = date => date.toISOString().slice(0, 10);
    const current = new Date(`${today}T12:00:00Z`);
    const planned = date => schedules.filter(item => item.effectiveDate <= dayKey(date)).at(-1)?.days || availableDays;
    const state = date => {
        const sessions = history.filter(item => item.date === dayKey(date));
        if (sessions.some(item => item.status === 'completed')) return 'completed';
        if (sessions.length) return 'ended';
        return planned(date).includes(date.getUTCDay() || 7) ? 'scheduled' : 'rest';
    };
    const earliest = history.map(item => item.date).sort()[0];
    let currentStreak = 0;
    for (const cursor = new Date(current); earliest && dayKey(cursor) >= earliest; cursor.setUTCDate(cursor.getUTCDate() - 1)) {
        const status = state(cursor);
        if (status === 'completed') currentStreak++;
        else if (dayKey(cursor) !== today && planned(cursor).includes(cursor.getUTCDay() || 7)) break;
    }
    return { currentStreak, lastWorkoutDate: history.filter(item => item.status === 'completed').map(item => item.date).sort().pop() || null,
        week: Array.from({ length: 7 }, (_, index) => {
            const date = new Date(current); date.setUTCDate(date.getUTCDate() + index - 6);
            return { date: dayKey(date), status: state(date) };
        }) };
}
module.exports = { buildProgress };
