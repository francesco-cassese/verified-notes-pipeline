import { test } from "node:test";
import assert from "node:assert/strict";
import createAderenzaAgent from "../../../src/ai/agents/aderenzaAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

const draftMinimo = {
    sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
};

const risultatiRicercaMinimi = [{ title: "React Docs", url: "https://react.dev/learn/hooks", contenuto: "I hook sono funzioni speciali." }];

test("verifica: verdetto aderente restituito così com'è", async () => {
    const verdettoFinto = { aderente: true, motivi: [] };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const agente = createAderenzaAgent({ model, logger: loggerSilenzioso });

    const risultato = await agente.verifica("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato, verdettoFinto);
});

test("verifica: verdetto non aderente restituito con i motivi", async () => {
    const verdettoFinto = { aderente: false, motivi: ["la sezione 'Cos'è un hook' descrive un'API non presente negli estratti"] };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const agente = createAderenzaAgent({ model, logger: loggerSilenzioso });

    const risultato = await agente.verifica("hooks react", draftMinimo, risultatiRicercaMinimi);

    assert.equal(risultato.aderente, false);
    assert.deepEqual(risultato.motivi, verdettoFinto.motivi);
});

test("verifica: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const erroreOriginale = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreOriginale; } }) };
    const agente = createAderenzaAgent({ model, logger: loggerSilenzioso });

    await assert.rejects(
        () => agente.verifica("hooks react", draftMinimo, risultatiRicercaMinimi),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === erroreOriginale
    );
});
