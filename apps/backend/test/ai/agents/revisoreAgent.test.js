import { test } from "node:test";
import assert from "node:assert/strict";
import createRevisoreAgent from "../../../src/ai/agents/revisoreAgent.js";
import { ErrorCodes } from "../../../src/utils/errors.js";

const loggerSilenzioso = { info() {}, warn() {}, error() {} };

const draftMinimo = {
    titolo: "Introduzione agli Hooks",
    modulo: "React",
    sezioni: [{ titolo: "Cos'è un hook", contenuto: "Un hook è una funzione speciale." }],
};

test("revisiona: verdetto approvato restituito così com'è", async () => {
    const verdettoFinto = { approvato: true, motivi: [] };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const agente = createRevisoreAgent({ model, logger: loggerSilenzioso });

    const risultato = await agente.revisiona("hooks react", draftMinimo);

    assert.equal(risultato, verdettoFinto);
});

test("revisiona: verdetto non approvato restituito con i motivi", async () => {
    const verdettoFinto = { approvato: false, motivi: ["la sezione 'Cos'è un hook' spiega a fondo il reconciler, fuori perimetro"] };
    const model = { withStructuredOutput: () => ({ invoke: async () => verdettoFinto }) };
    const agente = createRevisoreAgent({ model, logger: loggerSilenzioso });

    const risultato = await agente.revisiona("hooks react", draftMinimo);

    assert.equal(risultato.approvato, false);
    assert.deepEqual(risultato.motivi, verdettoFinto.motivi);
});

test("revisiona: errore del modello viene incapsulato in GENERATION_ERROR con causa", async () => {
    const erroreOriginale = new Error("modello non disponibile");
    const model = { withStructuredOutput: () => ({ invoke: async () => { throw erroreOriginale; } }) };
    const agente = createRevisoreAgent({ model, logger: loggerSilenzioso });

    await assert.rejects(
        () => agente.revisiona("hooks react", draftMinimo),
        (err) => err.code === ErrorCodes.GENERATION_ERROR && err.cause === erroreOriginale
    );
});
