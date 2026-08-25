import fs from "node:fs/promises";
import path from "node:path";
import { AgentError, ErrorCodes } from "./errors.js";
import { resolveSafeReadPath, isValidFolderName } from "./safePath.js";

// Estrae solo i campi che servono per l'elenco/anteprima da un frontmatter
// YAML scritto da writerAgent (formato fisso, vedi buildMarkdown): una regex
// mirata basta ed evita di aggiungere un parser YAML completo solo per questo.
function extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: content };

    const [, block, body] = match;
    const field = (name) => block.match(new RegExp(`^${name}: "(.*)"$`, "m"))?.[1]
        ?? block.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1];

    return {
        meta: {
            title: field("title") ?? "",
            module: field("module") ?? "",
            topic: field("topic") ?? "",
            id: field("id") ?? "",
            createdAt: field("createdAt") ?? "",
        },
        body: body.trim(),
    };
}

async function folderExists(baseDir, folder) {
    try {
        const stat = await fs.stat(path.join(baseDir, folder));
        return stat.isDirectory();
    } catch {
        return false;
    }
}

// Elenca le sottocartelle di baseDir (una per modulo/tecnologia) con il
// numero di appunti (.md) contenuti, ordinate alfabeticamente.
async function listFolders(baseDir) {
    let entries;
    try {
        entries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch {
        return [];
    }

    const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const results = await Promise.all(
        folders.map(async (folder) => {
            const files = await fs.readdir(path.join(baseDir, folder));
            const noteCount = files.filter((f) => f.endsWith(".md")).length;
            return { folder, noteCount };
        })
    );

    return results
        .filter((r) => r.noteCount > 0)
        .sort((a, b) => a.folder.localeCompare(b.folder));
}

// Elenca gli appunti (.md) di una cartella con i metadati minimi per una
// lista (titolo, data): legge il sidecar .json quando c'è (più veloce e
// affidabile), altrimenti ripiega sul frontmatter del .md.
async function listNotes(baseDir, folder) {
    if (!isValidFolderName(folder)) {
        throw new AgentError("Nome cartella non valido.", ErrorCodes.PATH_TRAVERSAL_ERROR);
    }

    if (!(await folderExists(baseDir, folder))) {
        throw new AgentError(`Cartella "${folder}" non trovata.`, ErrorCodes.NOT_FOUND_ERROR);
    }

    const dir = path.join(baseDir, folder);
    const files = await fs.readdir(dir);
    const mdFileNames = files.filter((f) => f.endsWith(".md"));

    const notes = await Promise.all(
        mdFileNames.map(async (fileName) => {
            const jsonPath = path.join(dir, fileName.replace(/\.md$/, ".json"));

            try {
                const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
                return { fileName, title: json.title, createdAt: json.createdAt, id: json.id };
            } catch {
                const content = await fs.readFile(path.join(dir, fileName), "utf-8");
                const { meta } = extractFrontmatter(content);
                return { fileName, title: meta.title, createdAt: meta.createdAt, id: meta.id };
            }
        })
    );

    return notes.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Legge un singolo appunto: preferisce il sidecar .json (dati strutturati,
// stesso formato usato subito dopo la generazione) e ripiega sul .md grezzo
// (frontmatter + corpo markdown) per gli appunti scritti prima che il
// sidecar esistesse.
async function readNote(baseDir, folder, fileName) {
    const mdPath = resolveSafeReadPath(baseDir, folder, fileName);
    const jsonPath = mdPath.replace(/\.md$/, ".json");

    try {
        const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
        return { format: "json", note: json };
    } catch {
        let content;
        try {
            content = await fs.readFile(mdPath, "utf-8");
        } catch {
            throw new AgentError(`Appunto "${folder}/${fileName}" non trovato.`, ErrorCodes.NOT_FOUND_ERROR);
        }
        const { meta, body } = extractFrontmatter(content);
        return { format: "markdown", meta, body };
    }
}

// Parole di collegamento (italiano/inglese, i due idiomi in cui un argomento
// viene tipicamente digitato) ignorate nel confronto tra argomenti: senza
// questo filtro "foreach in PHP" e "PHP foreach" risultano argomenti diversi
// solo per l'ordine delle parole e una preposizione, mentre sono chiaramente
// la stessa richiesta.
const IGNORED_WORDS = new Set([
    "il", "lo", "la", "i", "gli", "le", "un", "uno", "una",
    "di", "del", "dello", "della", "dei", "degli", "delle",
    "a", "al", "allo", "alla", "ai", "agli", "alle",
    "in", "con", "su", "per", "tra", "fra", "e", "ed", "o",
    "the", "an", "of", "on", "for", "to", "and",
]);

// Riduce un argomento a un insieme ordinato di parole significative
// (minuscolo, senza punteggiatura, senza duplicati, senza parole di
// collegamento): due argomenti con le stesse parole chiave ma ordine o
// preposizioni diversi producono la stessa chiave, quindi risultano uguali.
function topicKey(text) {
    const words = (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        .filter((word) => !IGNORED_WORDS.has(word));
    return [...new Set(words)].sort().join(" ");
}

// Cerca tra tutti gli appunti già salvati uno con lo stesso argomento
// (confronto per parole chiave sul campo "topic", non sul titolo scelto dal
// modello, che può differire dalla richiesta originale): permette al
// controller di rifiutare una generazione duplicata prima di avviare la
// pipeline (ricerca + più chiamate LLM, tutte a pagamento) invece di scoprire
// il doppione solo a fine generazione. Stessa strategia json-poi-frontmatter
// di listNotes/readNote sopra.
async function findNoteByTopic(baseDir, topic) {
    const searchedKey = topicKey(topic);
    const folders = await listFolders(baseDir);

    for (const { folder } of folders) {
        const dir = path.join(baseDir, folder);
        const mdFileNames = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));

        for (const fileName of mdFileNames) {
            const jsonPath = path.join(dir, fileName.replace(/\.md$/, ".json"));
            let savedTopic;
            let title;

            try {
                const json = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
                savedTopic = json.topic;
                title = json.title;
            } catch {
                const content = await fs.readFile(path.join(dir, fileName), "utf-8");
                ({ topic: savedTopic, title } = extractFrontmatter(content).meta);
            }

            if (savedTopic && topicKey(savedTopic) === searchedKey) {
                return { folder, fileName, title };
            }
        }
    }

    return null;
}

export { listFolders, listNotes, readNote, findNoteByTopic };
