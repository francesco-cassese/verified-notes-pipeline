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
function escapeYaml(valore) {
    return String(valore)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

function escapeCellaTabella(valore) {
    return String(valore).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formattaData(iso) {
    return new Date(iso).toLocaleDateString("it-IT", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// Riusa lo stesso slugify del filename per generare le ancore dei titoli di
// sezione: è la stessa logica (minuscolo, niente diacritici, solo [a-z0-9-])
// che la maggior parte dei renderer Markdown usa per gli id delle intestazioni,
// quindi i link dell'indice puntano davvero alla sezione corrispondente.
function buildIndice(sezioni, haGlossario) {
    const voci = sezioni.map((s) => `[${s.titolo}](#${slugify(s.titolo)})`);
    voci.push("[Errori Comuni](#errori-comuni)");
    voci.push("[Risorse e Documentazione](#risorse-e-documentazione)");
    voci.push("[Key Takeaways](#key-takeaways)");
    if (haGlossario) voci.push("[Glossario](#glossario)");

    return voci.map((voce, i) => `${i + 1}. ${voce}`).join("\n");
}

function buildSezioni(sezioni) {
    return sezioni.map((s) => `## ${s.titolo}\n\n${s.contenuto}`).join("\n\n");
}

function buildRisorse(fonti) {
    if (fonti.length === 0) return "Nessuna fonte ufficiale citata.";
    return fonti.map((f) => `- [${f.titolo || f.url}](${f.url})`).join("\n");
}

function buildTakeaways(keyTakeaways) {
    return keyTakeaways.map((k) => `- ${k}`).join("\n");
}

function buildErroriComuni(erroriComuni) {
    const righe = erroriComuni
        .map((e) => `| ${escapeCellaTabella(e.errore)} | ${escapeCellaTabella(e.soluzione)} |`)
        .join("\n");

    return `| Errore | Come risolverlo |\n| --- | --- |\n${righe}`;
}

function buildGlossario(glossario) {
    if (glossario.length === 0) return "";
    const righe = glossario
        .map((v) => `| ${escapeCellaTabella(v.termine)} | ${escapeCellaTabella(v.definizioneFormale)} | ${escapeCellaTabella(v.spiegazioneInformale)} |`)
        .join("\n");

    return `\n\n## 📖 Glossario\n\n| Termine | Definizione Formale | Spiegazione Informale |\n| --- | --- | --- |\n${righe}`;
}

function buildMarkdown(note, meta) {
    const fontiYaml = note.fonti.length > 0
        ? note.fonti.map((f) => `  - url: "${escapeYaml(f.url)}"${f.titolo ? `\n    titolo: "${escapeYaml(f.titolo)}"` : ""}`).join("\n")
        : "  []";

    const tagYaml = note.tag.length > 0
        ? note.tag.map((t) => `  - "${escapeYaml(t)}"`).join("\n")
        : "  []";

    const frontmatter = [
        "---",
        `titolo: "${escapeYaml(note.titolo)}"`,
        `modulo: "${escapeYaml(note.modulo)}"`,
        `argomento: "${escapeYaml(note.argomento)}"`,
        `id: ${meta.id}`,
        `creatoIl: ${meta.creatoIl}`,
        "fonti:",
        fontiYaml,
        "tag:",
        tagYaml,
        "---",
    ].join("\n");

    const haGlossario = note.glossario.length > 0;

    const corpo = [
        `# ${note.titolo}`,
        `**Modulo:** ${note.modulo}  \n**Data:** ${formattaData(meta.creatoIl)}`,
        `## 📍 Indice Rapido\n\n${buildIndice(note.sezioni, haGlossario)}`,
        buildSezioni(note.sezioni),
        `## ⚠️ Errori Comuni\n\n${buildErroriComuni(note.erroriComuni)}`,
        `## 🔗 Risorse e Documentazione\n\n${buildRisorse(note.fonti)}`,
        `## 🚀 Key Takeaways\n\n${buildTakeaways(note.keyTakeaways)}`,
    ].join("\n\n") + buildGlossario(note.glossario) + "\n";

    return `${frontmatter}\n\n${corpo}`;
}

function createWriterAgent({ notesDir, logger, archivist }) {
    async function write(note) {
        // La cartella non è più lo slug grezzo del modulo dedotto dal modello,
        // ma quella scelta dall'Archivist tramite il mapping hardcoded (o il
        // fallback allo slug se il modulo non è ancora mappato). titolo e
        // cartella passano comunque per resolveSafeNotePath, che li slugifica
        // di nuovo (idempotente) e verifica il contenimento come prima.
        const cartellaCanonica = archivist.selectFolder(note.modulo);
        const { filePath, fileName, cartella, percorsoRelativo } = resolveSafeNotePath(notesDir, note.titolo, cartellaCanonica);

        const id = crypto.randomUUID();
        const creatoIl = new Date().toISOString();
        const scritta = { ...note, id, nomeFile: fileName, cartella, percorsoRelativo, creatoIl };

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
            await fs.writeFile(filePath, buildMarkdown(note, { id, creatoIl }), "utf-8");
            await fs.writeFile(jsonPath, JSON.stringify(scritta, null, 2), "utf-8");
        } catch (error) {
            throw new AgentError(
                `Scrittura dell'appunto su disco fallita: ${percorsoRelativo}`,
                ErrorCodes.WRITE_ERROR,
                error
            );
        }

        logger.info("writerAgent", "Appunto salvato su disco", { percorsoRelativo });

        // Includo anche i campi della nota (sezioni, fonti, tag, ecc.) e non solo
        // i metadati del file: così l'interfaccia può mostrare subito il
        // risultato senza dover fare una seconda richiesta per leggere il file.
        return { ...scritta, percorso: filePath };
    }

    return { write };
}

export default createWriterAgent;
