const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 30_000 },
});

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

    for (const e of exercises) {
        if (!idsValidos.has(e.IdWorkout)) throw new Error(`IdWorkout inválido: ${e.IdWorkout}`);
        if (!Number.isInteger(e.ExerciseOrder) || e.ExerciseOrder < 1) throw new Error('ExerciseOrder inválido');
        if (!(e.DurationEstimate > 0)) throw new Error('DurationEstimate inválido');
        total += e.DurationEstimate;
    }

    if (total > tempoLivre) throw new Error(`Treino de ${total}min excede ${tempoLivre}min`);
    return exercises;
}


async function createWorkout(preferences, catalog) {
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite', 
        contents: JSON.stringify({ preferences, catalog }),
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json', // força saída em JSON
            maxOutputTokens: 1000,
        },
    });

    const parsed = JSON.parse(response.text);
    return validarTreino(parsed, catalog, preferences.FreeTimePerDay);
}

module.exports = { getAI, createWorkout };