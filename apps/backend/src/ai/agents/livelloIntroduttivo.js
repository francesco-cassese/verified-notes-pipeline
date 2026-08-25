// Testo condiviso tra generatorAgent (istruisce cosa scrivere) e reviewerAgent
// (giudica se il perimetro/livello è stato rispettato): prima erano due
// formulazioni scritte indipendentemente, e il Reviewer finiva per giudicare
// contro un criterio "reinventato" a ogni chiamata invece che contro la
// regola che il Generator aveva davvero ricevuto. Risultato osservato in
// pratica su argomenti con documentazione ufficiale molto ricca (es.
// useEffect): un tentativo veniva bocciato per "manca una spiegazione dello
// Strict Mode", il successivo per "la sezione sullo Strict Mode è troppo
// avanzata" — stesso identico argomento, giudizio opposto. Usare la stessa
// identica formulazione in entrambi i prompt non elimina la soggettività del
// modello, ma la ancora a un criterio stabile invece di lasciarla libera di
// oscillare a ogni chiamata.
//
// Prima versione: un elenco di categorie "sempre escluse" (tooling, dettagli
// interni, casi limite...). Anche con criterio condiviso, il Generator
// continuava a includerle quando le fonti ne parlavano diffusamente — un
// elenco di divieti nomina esplicitamente ciò che vuole vietare, e un modello
// istruito a "non parlare di X" deve comunque elaborare X per capire cosa
// evitare, il che lo rende più presente nell'output, non meno (le linee guida
// ufficiali di prompt engineering di Anthropic lo chiamano esplicitamente:
// "Tell Claude what to do instead of what not to do", e raccomandano di
// spiegare anche il PERCHÉ di una regola, non solo elencarla, perché il
// modello generalizzi meglio invece di seguirla alla lettera). Questa
// versione definisce quindi in positivo cosa scrivere e perché, con un solo
// esempio a fare da ancora, invece di un elenco di cosa evitare.
function buildIstruzioneLivelloIntroduttivo(argomento) {
    return `Chi legge sta usando "${argomento}" per la prima volta oggi, in un progetto normale: non sa nulla oltre a quello che scrivi in questo appunto, e il tuo unico obiettivo è farglielo usare correttamente in un caso comune. Scrivi solo:
- cos'è e a cosa serve "${argomento}", con parole semplici;
- la sintassi essenziale per usarlo: come si dichiara/invoca, quali parametri servono davvero;
- un esempio minimo e concreto che funziona così com'è;
- il comportamento che il lettore osserva usandolo nel modo più comune.

Scrivi come se fosse l'unico appunto che questa persona leggerà oggi su "${argomento}": qualunque dettaglio che richiede di spiegare un secondo concetto per essere capito (uno strumento diverso, un meccanismo interno, un caso limite, un'ottimizzazione) aggiunge carico cognitivo senza aiutarla a scrivere la prima riga di codice funzionante. Se una fonte dedica ampio spazio a uno di questi dettagli, è perché quella fonte serve anche a un pubblico più avanzato di questo lettore: raccontalo con al massimo una frase di contesto, o ometti quella parte, come faresti raccontando l'argomento a voce a qualcuno che lo vede per la prima volta. In caso di dubbio, taglia: un appunto essenziale e verificabile vale più di uno ricco ma dispersivo.

Esempio: se l'argomento fosse "l'operatore === in JavaScript" e la fonte dedicasse una sezione alle differenze di performance rispetto a ==, un buon appunto introduttivo non la tratterebbe affatto: si limiterebbe a spiegare cos'è il confronto stretto e a mostrarne un esempio. Dedicarle anche solo un paragrafo significherebbe scrivere per un lettore più avanzato di quello a cui questo appunto è destinato.`;
}

export { buildIstruzioneLivelloIntroduttivo };
