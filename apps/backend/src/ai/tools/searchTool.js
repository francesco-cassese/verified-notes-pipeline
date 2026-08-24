import { tool } from "langchain";
import z from "zod";
import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";
import settings from "../../utils/settings.js";
import { isOfficialUrl } from "../../utils/officialSources.js";

// Imposto questo limite perché l'LLM ha una finestra di contesto limitata:
// troppi risultati consumano troppi token e rischiano di distrarre il modello.
const MAX_RISULTATI = 3;

// Tetto ai caratteri di testo estratto per singola pagina: senza questo limite
// una pagina di doc molto lunga (es. un intero manuale) esaurirebbe da sola il
// budget di token utile per generare l'appunto.
const MAX_CONTENUTO_CHARS = 6000;

// Blocca SSRF verso la rete interna: anche se l'hostname è su un dominio della
// whitelist (isOfficialUrl), un DNS compromesso/rebinding potrebbe farlo
// risolvere a un IP privato. Whitelist di dominio e "non è un IP privato" sono
// due controlli indipendenti, va fatto entrambi.
function isIndirizzoPrivato(ip) {
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

async function isHostPubblico(hostname) {
    try {
        const { address } = await dns.lookup(hostname);
        return !isIndirizzoPrivato(address);
    } catch {
        return false;
    }
}

// Recupera il testo effettivo di una pagina ufficiale, non solo titolo/URL dei
// risultati di ricerca: senza questo, l'LLM cita un link legittimo ma scrive il
// contenuto a memoria (rischio di informazioni datate o inventate). Se il fetch
// o l'estrazione falliscono (pagina JS-rendered, timeout, non-HTML, ...) torno
// null: quella fonte resta comunque citabile come link, solo senza testo a supporto.
async function fetchPageText(url) {
    if (!(await isHostPubblico(new URL(url).hostname))) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), settings.pageFetchTimeoutMs);

    try {
        const response = await fetch(url, {
            headers: { Accept: "text/html" },
            signal: controller.signal,
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

        const testo = $("body").text().replace(/\s+/g, " ").trim();
        if (!testo) return null;

        return testo.slice(0, MAX_CONTENUTO_CHARS);
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

        // Filtro per dominio ufficiale PRIMA di tagliare a MAX_RISULTATI: se filtrassi
        // dopo, rischierei di scartare risultati ufficiali che Brave ha messo oltre
        // i primi 3 e tenere invece risultati non ufficiali arrivati prima.
        const risultatiFiltrati = (data.web?.results ?? [])
            .filter((r) => isOfficialUrl(r.url))
            .slice(0, MAX_RISULTATI);

        // Fetch del contenuto in parallelo: sono richieste indipendenti verso
        // domini diversi, farle in sequenza sommerebbe i tempi inutilmente.
        const risultatiGrezzi = await Promise.all(
            risultatiFiltrati.map(async (r) => ({
                title: r.title,
                url: r.url,
                contenuto: await fetchPageText(r.url),
            }))
        );

        const output = {
            argomento: query,
            dati_grezzi: risultatiGrezzi
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