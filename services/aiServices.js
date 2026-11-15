const { GoogleGenAI } = require('@google/genai');

const { fail } = require('./validation');
let quota = { day: '', count: 0, tokens: 0, recent: [] };

function reserveGeneration() {
    const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
    if (quota.day !== day) quota = { day, count: 0, tokens: 0, recent: [] };
    quota.recent = quota.recent.filter(time => now - time < 60000);
    if (quota.count >= Number(process.env.AI_MAX_REQUESTS_PER_DAY || 100)
        || quota.recent.length >= Number(process.env.AI_MAX_REQUESTS_PER_MINUTE || 5)
        || quota.tokens >= Number(process.env.AI_MAX_TOKENS_PER_DAY || 150000)) fail('Limite de geração atingido. Tente novamente mais tarde.', 429);
    quota.count++; quota.recent.push(now);
}

const SYSTEM_PROMPT = `Você monta treinos diários personalizados.
Responda APENAS com JSON válido, sem texto extra e sem markdown, neste formato:
{"exercises":[{"IdWorkout":number,"ExerciseOrder":number,"DurationEstimate":number}]}

Regras:
- Use somente IdWorkout que existam no catálogo recebido.
- ExerciseOrder começa em 1 e é sequencial.
- DurationEstimate é em minutos.
- A soma das durações não pode passar do tempo livre do usuário.`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAI(fn, { tentativas = 5, delayInicial = 1000, delayMax = 10000 } = {}) {
    //tentar conectar na IA
    let ultimoErro;
    for (let i = 0; i < tentativas; i++) {
        try {
            return await fn();
            //vai receber função e tentar executar
            //pode reutilizar com outras funções
        } catch (err) {
            ultimoErro = err;
            console.warn(`IA: tentativa ${i + 1}/${tentativas} falhou: ${err.message}`);
            if (i < tentativas - 1) await sleep(Math.min(delayInicial * 2 ** i, delayMax));
        }
    }
    throw new Error(`IA falhou após ${tentativas} tentativas: ${ultimoErro.message}`);
}

function validarTreino(parsed, catalog, tempoLivre) {
    const exercises = parsed?.exercises;
    if (!Array.isArray(exercises) || exercises.length === 0) {
        throw new Error('Resposta da IA sem exercícios');
    }

    const idsValidos = new Set(catalog.map((w) => w.IdWorkout));
    let total = 0;

    for (const [index, e] of exercises.entries()) {
        if (!idsValidos.has(e.IdWorkout)) throw new Error(`IdWorkout inválido: ${e.IdWorkout}`);
        if (e.ExerciseOrder !== index + 1) throw new Error('ExerciseOrder deve ser único e sequencial');
        if (!Number.isInteger(e.DurationEstimate) || e.DurationEstimate < 1) throw new Error('DurationEstimate deve ser um inteiro positivo em minutos');
        total += e.DurationEstimate;
    }

    if (total > tempoLivre) throw new Error(`Treino de ${total}min excede ${tempoLivre}min`);
    return exercises;
}


async function createWorkout(preferences, catalog) {
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) fail('Geração de treino indisponível. Configure o serviço de geração.', 503);
    reserveGeneration();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 10000 } });
    const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL,
        contents: JSON.stringify({ preferences, catalog }),
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json', // força saída em JSON
            maxOutputTokens: 1000,
        },
    });

    const parsed = JSON.parse(response.text);
    quota.tokens += response.usageMetadata?.totalTokenCount || 0;
    return validarTreino(parsed, catalog, preferences.FreeTimePerDay);
}

module.exports = { getAI, createWorkout, validarTreino };
