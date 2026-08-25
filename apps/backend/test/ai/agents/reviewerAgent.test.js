import { test } from "node:test";
import assert from "node:assert/strict";
import createReviewerAgent from "../../../src/ai/agents/reviewerAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

const draftMinimo = {
    titolo: "Introduzione agli Hooks",
    modulo: "React",
    sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
};

const risultatiRicercaMinimi = [{ title: "React Docs", url: "https://react.dev/learn/hooks", contenuto: "I hook sono funzioni speciali." }];

test("review: verdetto con tutti gli aspetti approvati restituito così com'è", async () => {
    const verdettoFinto = {
        perimetro: { approvato: true, motivi: [] },
        aderenza: { aderente: true, motivi: [] },
        bestPractice: { aggiornato: true, motivi: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    const risultato = await reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato, verdettoFinto);
});

test("review: perimetro non approvato restituito con i motivi", async () => {
    const verdettoFinto = {
        perimetro: { approvato: false, motivi: ["la sezione 'Cos'è un hook' spiega a fondo il reconciler, fuori perimetro"] },
        aderenza: { aderente: true, motivi: [] },
        bestPractice: { aggiornato: true, motivi: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    const risultato = await reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato.perimetro.approvato, false);
    assert.deepEqual(risultato.perimetro.motivi, verdettoFinto.perimetro.motivi);
});

test("review: aderenza non superata restituita con i motivi", async () => {
    const verdettoFinto = {
        perimetro: { approvato: true, motivi: [] },
        aderenza: { aderente: false, motivi: ["la sezione 'Cos'è un hook' descrive un'API non presente negli estratti"] },
        bestPractice: { aggiornato: true, motivi: [] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    const risultato = await reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato.aderenza.aderente, false);
    assert.deepEqual(risultato.aderenza.motivi, verdettoFinto.aderenza.motivi);
});

test("review: best practice non rispettata restituita con i motivi", async () => {
    const verdettoFinto = {
        perimetro: { approvato: true, motivi: [] },
        aderenza: { aderente: true, motivi: [] },
        bestPractice: { aggiornato: false, motivi: ["la sezione 'Cos'è un hook' mostra componentWillMount, che le fonti segnalano come deprecato in favore di useEffect"] },
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    const risultato = await reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato.bestPractice.aggiornato, false);
    assert.deepEqual(risultato.bestPractice.motivi, verdettoFinto.bestPractice.motivi);
});

test("review: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const erroreOriginale = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreOriginale; } }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    await assert.rejects(
        () => reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === erroreOriginale && err.issues === null
    );
});

test("review: OutputParserException (verdetto fuori schema) espone issues leggibili per il retry successivo", async () => {
    const erroreParsing = new Error(
        'Failed to parse. Text: "{...}". Error: [{"code":"invalid_type","expected":"object","path":["perimetro"],"message":"Invalid input: expected object, received string"}]\n\nTroubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/OUTPUT_PARSING_FAILURE/'
    );
    erroreParsing.name = "OutputParserException";
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreParsing; } }) };
    const reviewer = createReviewerAgent({ model, logger: loggerSilenzioso });

    await assert.rejects(
        () => reviewer.review("hooks react", draftMinimo, risultatiRicercaMinimi),
        (err) => {
            assert.equal(err.code, ErrorCodes.GENERATION_ERROR);
            assert.deepEqual(err.issues, [
                'Il campo "perimetro" non rispetta lo schema: Invalid input: expected object, received string',
            ]);
            return true;
        }
    );
});
