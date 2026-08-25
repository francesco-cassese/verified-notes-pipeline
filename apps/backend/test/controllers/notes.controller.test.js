import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import createNotesController from "../../src/controllers/notes.controller.js";

function createServer(fakeOrchestrator, fakeArchive = { findNoteByTopic: async () => null }) {
    const app = express();
    app.use(express.json());
    const controller = createNotesController(fakeOrchestrator, fakeArchive, "notesDir-test");
    app.post("/api/notes", controller.generateNote);
    return http.createServer(app);
}

function parseSSEEvents(text) {
    return text
        .split("\n\n")
        .filter(Boolean)
        .map((block) => {
            const lines = block.split("\n");
            const event = lines.find((r) => r.startsWith("event:")).slice("event:".length).trim();
            const data = JSON.parse(lines.find((r) => r.startsWith("data:")).slice("data:".length).trim());
            return { event, data };
        });
}

async function startServer(server) {
    await new Promise((resolve) => server.listen(0, resolve));
    return server.address().port;
}

test("generateNote: inoltra le fasi dell'orchestrator e chiude con risultato di successo", async () => {
    const fakeOrchestrator = {
        run: async (topic, { onPhase }) => {
            onPhase({ phase: "search", message: "Ricerca...", attempt: 1, maxAttempts: 3 });
            onPhase({ phase: "generation", message: "Generazione...", attempt: 1, maxAttempts: 3 });
            return { status: "success", note: { title: "Fake" }, attempts: 1 };
        },
    };
    const server = createServer(fakeOrchestrator);
    const port = await startServer(server);

    try {
        const response = await fetch(`http://localhost:${port}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "react hooks" }),
        });

        assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");

        const events = parseSSEEvents(await response.text());

        assert.equal(events.length, 3);
        assert.equal(events[0].data.phase, "search");
        assert.equal(events[1].data.phase, "generation");
        assert.equal(events[2].event, "result");
        assert.equal(events[2].data.outcome, "success");
        assert.equal(events[2].data.note.title, "Fake");
    } finally {
        server.close();
    }
});

test("generateNote: argomento non valido -> subito un evento result di errore, nessuna fase", async () => {
    const fakeOrchestrator = { run: async () => { throw new Error("non deve essere chiamato"); } };
    const server = createServer(fakeOrchestrator);
    const port = await startServer(server);

    try {
        const response = await fetch(`http://localhost:${port}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "ab" }),
        });

        const events = parseSSEEvents(await response.text());

        assert.equal(events.length, 1);
        assert.equal(events[0].event, "result");
        assert.equal(events[0].data.outcome, "error");
        assert.ok(events[0].data.issues.length > 0);
    } finally {
        server.close();
    }
});

test("generateNote: argomento già presente in archivio -> evento result duplicate, orchestrator mai chiamato", async () => {
    const fakeOrchestrator = { run: async () => { throw new Error("non deve essere chiamato"); } };
    const fakeArchive = {
        findNoteByTopic: async () => ({ folder: "react", fileName: "hooks.md", title: "Introduzione agli Hooks" }),
    };
    const server = createServer(fakeOrchestrator, fakeArchive);
    const port = await startServer(server);

    try {
        const response = await fetch(`http://localhost:${port}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "react hooks" }),
        });

        const events = parseSSEEvents(await response.text());

        assert.equal(events.length, 1);
        assert.equal(events[0].event, "result");
        assert.equal(events[0].data.outcome, "duplicate");
        assert.equal(events[0].data.folder, "react");
        assert.equal(events[0].data.fileName, "hooks.md");
        assert.equal(events[0].data.title, "Introduzione agli Hooks");
    } finally {
        server.close();
    }
});

test("generateNote: il controllo doppioni fallisce -> prosegue comunque con la generazione", async () => {
    const fakeOrchestrator = {
        run: async (topic, { onPhase }) => {
            onPhase({ phase: "search", message: "Ricerca...", attempt: 1, maxAttempts: 3 });
            return { status: "success", note: { title: "Fake" }, attempts: 1 };
        },
    };
    const fakeArchive = { findNoteByTopic: async () => { throw new Error("disco non disponibile"); } };
    const server = createServer(fakeOrchestrator, fakeArchive);
    const port = await startServer(server);

    try {
        const response = await fetch(`http://localhost:${port}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "react hooks" }),
        });

        const events = parseSSEEvents(await response.text());

        assert.equal(events.at(-1).event, "result");
        assert.equal(events.at(-1).data.outcome, "success");
    } finally {
        server.close();
    }
});

test("generateNote: l'orchestrator fallisce -> evento result di errore col motivo", async () => {
    const fakeOrchestrator = {
        run: async (topic, { onPhase }) => {
            onPhase({ phase: "search", message: "Ricerca...", attempt: 1, maxAttempts: 3 });
            return { status: "failed", reason: "no_official_source", attempts: 1 };
        },
    };
    const server = createServer(fakeOrchestrator);
    const port = await startServer(server);

    try {
        const response = await fetch(`http://localhost:${port}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: "react hooks" }),
        });

        const events = parseSSEEvents(await response.text());

        assert.equal(events.at(-1).event, "result");
        assert.equal(events.at(-1).data.outcome, "error");
        assert.equal(events.at(-1).data.reason, "no_official_source");
    } finally {
        server.close();
    }
});
