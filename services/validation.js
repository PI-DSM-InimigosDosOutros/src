const fail = (message, status = 400) => { throw { status, message }; };
const categories = ['Equilíbrio', 'Flexibilidade', 'Cardio', 'Musculação', 'HIIT', 'Calistenia'];
const genders = { Feminino: 'F', Masculino: 'M', 'Não binário': 'N', 'Prefiro não informar': 'P' };
const activityLevels = ['Nunca pratiquei', 'Já pratiquei, mas parei', 'Pratico ocasionalmente', 'Pratico regularmente', 'Outro'];
const dateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);
function text(value, label, max, optional = false) {
    if (optional && (value === null || value === undefined || value === '')) return null;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label}: informe um texto de até ${max} caracteres.`);
    return value.trim();
}
function positiveId(value, label = 'Identificador') {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) fail(`${label} inválido.`);
    return id;
}
function password(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 16 || !/[0-9]/.test(value)
        || !/\p{Lu}/u.test(value) || !/[^\p{L}\p{N}\s]/u.test(value)) fail('A senha deve ter de 8 a 16 caracteres, número, letra maiúscula e caractere especial.');
    return value;
}
function email(value) {
    const result = text(value, 'E-mail', 150).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('E-mail inválido.');
    return result;
}
function birthDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Data de nascimento inválida.');
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value > dateKey()) fail('Data de nascimento inválida.');
    return value;
}
function profile(input, sections = { measures: true, goal: true, time: true, days: true, categories: true, activity: true }) {
    const fullName = text(input.fullName ?? `${input.firstName || ''} ${input.lastName || ''}`, 'Nome completo', 201).replace(/\s+/g, ' ');
    const parts = fullName.split(' ');
    const firstName = text(parts.shift(), 'Nome', 100);
    const lastName = text(parts.join(' '), 'Sobrenome', 100);
    const gender = genders[input.gender] || (Object.values(genders).includes(input.gender) ? input.gender : null);
    if (!gender) fail('Gênero inválido.');
    const heightCm = Number(input.heightCm), weightKg = Number(input.weightKg), minutes = Number(input.availableMinutesPerDay);
    if (sections.measures && ![heightCm, weightKg].every(value => Number.isFinite(value) && value > 0 && value <= 999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001)) fail('Altura e peso devem ser positivos, com até duas casas decimais e no máximo 999,99.');
    if (sections.time && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) fail('Informe um tempo entre 1 e 1440 minutos.');
    if (sections.days && (!Array.isArray(input.availableDays) || !input.availableDays.length || input.availableDays.some(day => !Number.isInteger(day) || day < 1 || day > 7))) fail('Dias da semana inválidos.');
    if (sections.categories && (!Array.isArray(input.exerciseCategories) || !input.exerciseCategories.length || input.exerciseCategories.some(item => !categories.includes(item)))) fail('Modalidades inválidas.');
    if (sections.activity && input.activityLevel && !activityLevels.includes(input.activityLevel)) fail('Histórico de atividade inválido.');
    return { fullName, firstName, lastName, gender, birthDate: birthDate(input.birthDate), email: email(input.email), heightCm, weightKg,
        activityLevel: input.activityLevel || null, medicalNotes: text(input.medicalNotes, 'Observações', 1000, true),
        goal: sections.goal ? text(input.goal, 'Objetivo', 1000) : input.goal || '', availableMinutesPerDay: minutes,
        availableDays: [...new Set(input.availableDays)].sort((a, b) => a - b), exerciseCategories: [...new Set(input.exerciseCategories)] };
}
module.exports = { fail, text, password, email, birthDate, profile, categories, genders, positiveId, dateKey };
