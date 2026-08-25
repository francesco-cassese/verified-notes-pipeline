// Condiviso tra generatorAgent e reviewerAgent: entrambi chiamano
// withStructuredOutput(...).invoke(...), ed entrambi possono incontrare lo
// stesso fallimento quando l'output del modello viola lo schema Zod atteso
// (un campo troppo lungo, un tipo sbagliato, JSON malformato) — in quel caso
// LangChain lancia un OutputParserException PRIMA che il codice veda mai il
// risultato. Senza questa estrazione l'orchestrator ritenterebbe alla cieca,
// senza sapere cosa è andato storto, e il modello tenderebbe a ripetere lo
// stesso identico errore su ogni tentativo (osservato in pratica: fallimenti
// ripetuti sullo stesso campo troppo lungo, sia nel Generator che nel
// Reviewer). Il messaggio non espone un campo strutturato con gli issues di
// Zod, solo una stringa che li incorpora via JSON.stringify: l'estrazione è
// quindi best-effort, con fallback a nessun feedback specifico se il formato
// cambia o l'errore non è nella forma attesa (es. l'intero oggetto di
// verdetto è arrivato come stringa invece che come oggetto annidato).
function estraiIssuesDaOutputParserException(error) {
    if (error?.name !== "OutputParserException" || typeof error.message !== "string") return null;

    const senzaTroubleshooting = error.message.split("\n\nTroubleshooting URL:")[0];
    const match = /Error: (\[[\s\S]*\])$/.exec(senzaTroubleshooting);
    if (!match) return null;

    try {
        const issues = JSON.parse(match[1]);
        if (!Array.isArray(issues) || issues.length === 0) return null;

        return issues.map((issue) => {
            const percorso = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : null;
            return percorso ? `Il campo "${percorso}" non rispetta lo schema: ${issue.message}` : issue.message;
        });
    } catch {
        return null;
    }
}

export { estraiIssuesDaOutputParserException };
