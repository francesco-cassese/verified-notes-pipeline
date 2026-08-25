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
// modello generalizzi meglio invece di seguirla alla lettera).
//
// Seconda versione: riformulata in positivo, ma "meccanismo interno" da solo
// si è rivelato troppo ambiguo — il Reviewer ha iniziato a bocciare anche il
// comportamento ESSENZIALE dello strumento (es. quando si riesegue in base
// alle dipendenze) trattandolo come un dettaglio interno opzionale, quando
// invece è il contratto stesso che serve per usarlo correttamente. Questa
// versione traccia esplicitamente quella linea: il comportamento osservabile
// in base a cosa scrive il lettore è nucleo, non importa quante frasi serva
// spiegarlo; il perché quel comportamento esiste a livello di implementazione,
// o cosa succede solo in modalità/ambienti speciali, è il dettaglio da
// ridurre o omettere.
function buildIstruzioneLivelloIntroduttivo(argomento) {
    return `Chi legge sta usando "${argomento}" per la prima volta oggi, in un progetto normale: non sa nulla oltre a quello che scrivi in questo appunto, e il tuo unico obiettivo è farglielo usare correttamente in un caso comune. Scrivi solo:
- cos'è e a cosa serve "${argomento}", con parole semplici;
- la sintassi essenziale per usarlo: come si dichiara/invoca, quali parametri servono davvero;
- un esempio minimo e concreto che funziona così com'è;
- il comportamento che il lettore osserva usandolo nel modo più comune: COSA cambia nel risultato in base a COSA scrive (es. cosa succede se ometti un parametro, o se una condizione cambia). Questo fa parte del nucleo anche se richiede due o tre frasi per essere spiegato con chiarezza: non è un dettaglio da ridurre.

Sono invece da ridurre a un accenno di una frase, o da omettere del tutto:
- il PERCHÉ interno "${argomento}" si comporta così a livello di implementazione: motivazioni di design, meccanismi interni del linguaggio/framework, o l'ordine/le fasi di esecuzione che spiegano perché un certo effetto si verifica. Se l'errore che ne deriva ha un nome tecnico riconoscibile, puoi nominarlo in una frase come avviso pratico ("usarlo prima della dichiarazione genera un errore"), ma senza spiegare la fase o il meccanismo interno che lo causa: il nome dell'errore è nucleo, il perché tecnico dietro non lo è;
- comportamenti che si manifestano solo in modalità o ambienti speciali (debug, sviluppo, test, produzione);
- alternative sconsigliate o superate a "${argomento}" (una sintassi più vecchia, un modo di fare la stessa cosa non più raccomandato): meritano al massimo una frase di avviso sul perché evitarle ("X esiste ma va evitato perché Y"), mai un approfondimento del loro comportamento interno — chi legge userà "${argomento}", non l'alternativa;
- strumenti, funzioni o API diverse citate come alternativa o corredo.

Scrivi come se fosse l'unico appunto che questa persona leggerà oggi su "${argomento}": uno di questi dettagli aggiunge carico cognitivo senza aiutarla a scrivere la prima riga di codice funzionante, anche se la fonte ne parla diffusamente perché serve anche a un pubblico più avanzato. In caso di dubbio tra includere un comportamento osservabile o un dettaglio di implementazione, includi il primo e taglia il secondo.

Esempio: se l'argomento fosse "l'operatore === in JavaScript", spiegare che confronta valore E tipo, con un esempio che mostra 1 === "1" dare false, è nucleo (comportamento osservabile). Una sezione sulle differenze di performance interne rispetto a == non lo è: va omessa, anche se la fonte la tratta a lungo.`;
}

export { buildIstruzioneLivelloIntroduttivo };
