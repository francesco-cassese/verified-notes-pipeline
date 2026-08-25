import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { resolveSafeNotePath, slugify } from "../../utils/safePath.js";
import { AgentError, ErrorCodes } from "../../utils/errors.js";

// L'ordine conta: i backslash vanno escapati PRIMA delle virgolette, altrimenti
// il backslash appena inserito per escapare una `"` verrebbe ri-escapato al
// giro successivo. Senza questo, un titolo con un backslash letterale (es. un
// appunto su espressioni regolari, "\d" o "\s") produce un valore YAML non
// valido per un parser conforme allo standard: il lettore di questo progetto
// (notesArchive.js) è tollerante perché usa una regex, non se ne accorgerebbe,
// ma qualsiasi altro strumento YAML-aware fallirebbe ad aprire il file.
// Anche newline/tab letterali dentro il valore romperebbero lo scalare
// "tra virgolette" su una riga sola, quindi li converto nella sequenza di
// escape corrispondente invece di lasciarli passare come caratteri di controllo.
function escapeYaml(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

function escapeTableCell(value) {
    return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString("it-IT", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// Riusa lo stesso slugify del filename per generare le ancore dei titoli di
// sezione: è la stessa logica (minuscolo, niente diacritici, solo [a-z0-9-])
// che la maggior parte dei renderer Markdown usa per gli id delle intestazioni,
// quindi i link dell'indice puntano davvero alla sezione corrispondente.
function buildTableOfContents(sections, hasGlossary) {
    const entries = sections.map((s) => `[${s.title}](#${slugify(s.title)})`);
    entries.push("[Errori Comuni](#errori-comuni)");
    entries.push("[Risorse e Documentazione](#risorse-e-documentazione)");
    entries.push("[Key Takeaways](#key-takeaways)");
    if (hasGlossary) entries.push("[Glossario](#glossario)");

    return entries.map((entry, i) => `${i + 1}. ${entry}`).join("\n");
}

function buildSections(sections) {
    return sections.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n");
}

function buildResources(sources) {
    if (sources.length === 0) return "Nessuna fonte ufficiale citata.";
    return sources.map((s) => `- [${s.title || s.url}](${s.url})`).join("\n");
}

function buildTakeaways(keyTakeaways) {
    return keyTakeaways.map((takeaway) => `- ${takeaway}`).join("\n");
}

function buildCommonMistakes(commonMistakes) {
    const rows = commonMistakes
        .map((m) => `| ${escapeTableCell(m.mistake)} | ${escapeTableCell(m.solution)} |`)
        .join("\n");

    return `| Errore | Come risolverlo |\n| --- | --- |\n${rows}`;
}

function buildGlossary(glossary) {
    if (glossary.length === 0) return "";
    const rows = glossary
        .map((entry) => `| ${escapeTableCell(entry.term)} | ${escapeTableCell(entry.formalDefinition)} | ${escapeTableCell(entry.informalExplanation)} |`)
        .join("\n");

    return `\n\n## 📖 Glossario\n\n| Termine | Definizione Formale | Spiegazione Informale |\n| --- | --- | --- |\n${rows}`;
}

function buildMarkdown(note, meta) {
    const sourcesYaml = note.sources.length > 0
        ? note.sources.map((s) => `  - url: "${escapeYaml(s.url)}"${s.title ? `\n    title: "${escapeYaml(s.title)}"` : ""}`).join("\n")
        : "  []";

    const tagsYaml = note.tags.length > 0
        ? note.tags.map((t) => `  - "${escapeYaml(t)}"`).join("\n")
        : "  []";

    const frontmatter = [
        "---",
        `title: "${escapeYaml(note.title)}"`,
        `module: "${escapeYaml(note.module)}"`,
        `topic: "${escapeYaml(note.topic)}"`,
        `id: ${meta.id}`,
        `createdAt: ${meta.createdAt}`,
        "sources:",
        sourcesYaml,
        "tags:",
        tagsYaml,
        "---",
    ].join("\n");

    const hasGlossary = note.glossary.length > 0;

    const body = [
        `# ${note.title}`,
        `**Modulo:** ${note.module}  \n**Data:** ${formatDate(meta.createdAt)}`,
        `## 📍 Indice Rapido\n\n${buildTableOfContents(note.sections, hasGlossary)}`,
        buildSections(note.sections),
        `## ⚠️ Errori Comuni\n\n${buildCommonMistakes(note.commonMistakes)}`,
        `## 🔗 Risorse e Documentazione\n\n${buildResources(note.sources)}`,
        `## 🚀 Key Takeaways\n\n${buildTakeaways(note.keyTakeaways)}`,
    ].join("\n\n") + buildGlossary(note.glossary) + "\n";

    return `${frontmatter}\n\n${body}`;
}

function createWriterAgent({ notesDir, logger, archivist }) {
    async function write(note) {
        // La cartella non è più lo slug grezzo del modulo dedotto dal modello,
        // ma quella scelta dall'Archivist tramite il mapping hardcoded (o il
        // fallback allo slug se il modulo non è ancora mappato). title e
        // folder passano comunque per resolveSafeNotePath, che li slugifica
        // di nuovo (idempotente) e verifica il contenimento come prima.
        const canonicalFolder = archivist.selectFolder(note.module);
        const { filePath, fileName, folder, relativePath } = resolveSafeNotePath(notesDir, note.title, canonicalFolder);

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const written = { ...note, id, fileName, folder, relativePath, createdAt };

        // Il .md resta la fonte "leggibile" (frontmatter + corpo formattato); il
        // .json accanto è un sidecar con gli stessi dati ancora strutturati, per
        // permettere all'archivio di ri-renderizzare la nota con lo stesso
        // componente usato in fase di generazione invece di re-interpretare il
        // markdown. Se manca (note scritte prima di questa modifica), l'archivio
        // ripiega sulla sola lettura del .md.
        const jsonPath = filePath.replace(/\.md$/, ".json");

        try {
            // mkdir sulla directory del file (non più solo su notesDir): crea anche
            // la sottocartella del modulo se non esiste già.
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buildMarkdown(note, { id, createdAt }), "utf-8");
            await fs.writeFile(jsonPath, JSON.stringify(written, null, 2), "utf-8");
        } catch (error) {
            throw new AgentError(
                `Scrittura dell'appunto su disco fallita: ${relativePath}`,
                ErrorCodes.WRITE_ERROR,
                error
            );
        }

        logger.info("writerAgent", "Appunto salvato su disco", { relativePath });

        // Includo anche i campi della nota (sections, sources, tags, ecc.) e non
        // solo i metadati del file: così l'interfaccia può mostrare subito il
        // risultato senza dover fare una seconda richiesta per leggere il file.
        return { ...written, path: filePath };
    }

    return { write };
}

export default createWriterAgent;
