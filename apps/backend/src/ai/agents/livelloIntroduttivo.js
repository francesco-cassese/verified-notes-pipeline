// Testo condiviso tra generatorAgent (istruisce cosa scrivere) e reviewerAgent
// (giudica se il perimetro/livello è stato rispettato): prima erano due
// formulazioni scritte indipendentemente, e il Reviewer finiva per giudicare
// contro un criterio "reinventato" a ogni chiamata invece che contro la
// regola che il Generator aveva davvero ricevuto. Risultato osservato in
// pratica su argomenti con documentazione ufficiale molto ricca (es.
// useEffect): un tentativo veniva bocciato per "manca una spiegazione dello
// Strict Mode", il successivo per "la sezione sullo Strict Mode è troppo
// avanzata" — stesso identico argomento, giudizio opposto. Usare la stessa
// identica lista di categorie "sempre fuori perimetro" in entrambi i prompt
// non elimina la soggettività del modello, ma la ancora a un criterio
// stabile invece di lasciarla libera di oscillare a ogni chiamata.
function buildIstruzioneLivelloIntroduttivo(argomento) {
    return `Adatta la profondità al livello implicito dall'argomento stesso: trattalo come primo contatto per chi lo sta imparando ora. Restano SEMPRE fuori da un'introduzione a "${argomento}", indipendentemente da quanto le fonti ne parlino:
- funzioni, metodi, classi o strumenti alternativi/correlati (anche se una fonte li cita come riferimento incrociato);
- dettagli di tooling che assistono l'uso ma non fanno parte del meccanismo stesso (es. linter, plugin, formattatori, librerie di terze parti alternative);
- comportamenti interni specifici di ambienti di sviluppo/debug (es. perché qualcosa viene eseguito più volte in modalità sviluppo, meccanismi di stress-test interni);
- ottimizzazioni, casi limite di produzione, sicurezza, autenticazione, gestione errori avanzata, a meno che l'argomento stesso li nomini esplicitamente.
Su uno qualsiasi di questi punti puoi accennare con una frase per dare contesto ("questo si collega a X, che vedrai più avanti"), ma non spiegarlo o approfondirlo: se merita una spiegazione corposa, appartiene a un appunto successivo, non a questo.`;
}

export { buildIstruzioneLivelloIntroduttivo };
