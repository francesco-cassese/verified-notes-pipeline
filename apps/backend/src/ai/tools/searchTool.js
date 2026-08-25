import { tool } from "langchain";
import z from "zod";
import * as cheerio from "cheerio";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import settings from "../../utils/settings.js";
import { isOfficialUrl } from "../../utils/officialSources.js";

// Imposto questo limite perché l'LLM ha una finestra di contesto limitata:
// troppi risultati consumano troppi token e rischiano di distrarre il modello.
const MAX_RESULTS = 3;

// Tetto ai caratteri di testo estratto per singola pagina: senza questo limite
// una pagina di doc molto lunga (es. un intero manuale) esaurirebbe da sola il
// budget di token utile per generare l'appunto. 6000 si è rivelato troppo
// stretto per pagine di riferimento ufficiali densE (es. react.dev/useEffect,
// 37.000+ caratteri): il generatore riceveva solo il 16% della pagina,
// troncata a metà frase, e completava i dettagli mancanti a memoria — proprio
// ciò che il controllo di aderenza alle fonti è pensato per rifiutare. 20000
// copre molto più contenuto reale a un costo aggiuntivo minimo (pochi
// centesimi per tentativo con il modello di default).
const MAX_CONTENT_CHARS = 20_000;

// Blocca SSRF verso la rete interna: anche se l'hostname è su un dominio della
// whitelist (isOfficialUrl), un DNS compromesso/rebinding potrebbe farlo
// risolvere a un IP privato. Whitelist di dominio e "non è un IP privato" sono
// due controlli indipendenti, va fatto entrambi.
function isPrivateAddress(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    }
    if (net.isIPv6(ip)) {
        const norm = ip.toLowerCase();
        return norm === "::1" || norm.startsWith("fc") || norm.startsWith("fd") || norm.startsWith("fe80");
    }
    return true; // formato non riconosciuto: per sicurezza, tratta come non pubblico
}

// Risolve l'hostname e valida l'IP nello stesso identico lookup che poi apre
// davvero la connessione TCP (passato come `connect.lookup` all'Agent sotto),
// invece di controllare l'IP con una chiamata dns separata e sperare che
// `fetch` risolva allo stesso indirizzo. Con due lookup distinti un DNS
// malevolo (TTL bassissimo, DNS rebinding) potrebbe restituire un IP pubblico
// al controllo e uno privato alla connessione reale: qui non c'è finestra fra
// "controllato" e "usato", sono la stessa chiamata.
function publicOnlyLookup(hostname, options, callback) {
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err);

        // undici chiama questo lookup con { all: true }: `address` è quindi un
        // array di { address, family }, non una singola stringa. Blocco se manca
        // del tutto una risposta o se anche solo uno degli indirizzi risolti è
        // privato, invece di controllare solo il primo.
        const resolved = Array.isArray(address) ? address : [{ address, family }];
        if (resolved.length === 0 || resolved.some((r) => isPrivateAddress(r.address))) {
            return callback(new Error(`Indirizzo non pubblico bloccato per ${hostname}`));
        }
        callback(null, address, family);
    });
}

// Dispatcher condiviso: ogni richiesta fatta attraverso questo Agent risolve
// l'host con publicOnlyLookup, quindi non può mai stabilire una connessione
// verso un IP privato, indipendentemente dal dominio (anche se in whitelist).
// Va abbinato a undiciFetch (sotto), non al fetch globale: mescolare un Agent
// creato dal pacchetto undici con l'implementazione di fetch interna di Node
// (versione diversa di undici) fa fallire la richiesta con un errore interno
// oscuro ("invalid onRequestStart method").
const publicOnlyAgent = new Agent({
    connect: { lookup: publicOnlyLookup },
});

// Recupera il testo effettivo di una pagina ufficiale, non solo titolo/URL dei
// risultati di ricerca: senza questo, l'LLM cita un link legittimo ma scrive il
// contenuto a memoria (rischio di informazioni datate o inventate). Se il fetch
// o l'estrazione falliscono (pagina JS-rendered, timeout, non-HTML, IP privato
// bloccato dal dispatcher, ...) torno null: quella fonte resta comunque
// citabile come link, solo senza testo a supporto.
async function fetchPageText(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.pageFetchTimeoutMs);

    try {
        const response = await undiciFetch(url, {
            headers: { Accept: "text/html" },
            signal: controller.signal,
            dispatcher: publicOnlyAgent,
        });

        if (!response.ok) return null;

        // Difesa contro redirect fuori whitelist: se la pagina ha rimandato a un
        // host non ufficiale, non fidarti del contenuto restituito.
        if (!isOfficialUrl(response.url)) return null;

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) return null;

        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style, nav, header, footer, noscript, svg").remove();

        const text = $("body").text().replace(/\s+/g, " ").trim();
        if (!text) return null;

        return text.slice(0, MAX_CONTENT_CHARS);
    } catch {
        // Fetch fallito o andato in timeout: nessun testo, ma non blocco la ricerca.
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

const searchTool = tool(
    async ({ query }) => {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        // "official documentation" in inglese perché argomenti scritti in italiano
        // (es. "introduzione a PHP") portano Brave a privilegiare tutorial/blog
        // italiani rispetto alla doc ufficiale (quasi sempre in inglese), facendo
        // fallire il filtro isOfficialUrl anche quando la doc ufficiale esiste.
        url.searchParams.set("q", `${query} official documentation`);

        // Uso AbortController perché se la API è lenta, non voglio
        // che l'intera applicazione resti bloccata in attesa.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), settings.searchTimeoutMs);

        let response;

        try {
            response = await fetch(url, {
                method: "GET",
                headers: {
                    "X-Subscription-Token": settings.braveApiKey,
                    "Accept": "application/json"
                },
                signal: controller.signal
            });
        } catch (error) {
            // Qui gestisco il caso in cui il tempo scade
            if (error.name === "AbortError") {
                throw new Error(`Errore Brave API: timeout dopo ${settings.searchTimeoutMs}ms`);
            }
            throw error;
        } finally {
            // Mi assicuro sempre di pulire il timer, per evitare bug strani
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            throw new Error(`Errore Brave API: ${response.statusText}`);
        }

        const data = await response.json();

        // Filtro per dominio ufficiale PRIMA di tagliare a MAX_RESULTS: se filtrassi
        // dopo, rischierei di scartare risultati ufficiali che Brave ha messo oltre
        // i primi 3 e tenere invece risultati non ufficiali arrivati prima.
        const filteredResults = (data.web?.results ?? [])
            .filter((r) => isOfficialUrl(r.url))
            .slice(0, MAX_RESULTS);

        // Fetch del contenuto in parallelo: sono richieste indipendenti verso
        // domini diversi, farle in sequenza sommerebbe i tempi inutilmente.
        const rawResults = await Promise.all(
            filteredResults.map(async (r) => ({
                title: r.title,
                url: r.url,
                content: await fetchPageText(r.url),
            }))
        );

        const output = {
            topic: query,
            rawResults
        };

        return JSON.stringify(output);
    },
    {
        name: "brave_search",
        description: "Recupera dati grezzi da una ricerca web per un dato argomento.",
        schema: z.object({
            query: z.string().min(1).describe("L'argomento da cercare"),
        }),
    }
)

export default searchTool;
