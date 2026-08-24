import { useEffect, useState } from "react";

// Condiviso dalle pagine di Archivio (cartelle, elenco appunti, dettaglio):
// stesso identico pattern fetch-on-mount, ripetuto tre volte prima di questa
// estrazione. Il risultato è taggato con l'url a cui appartiene: finché non
// arriva risultato.url !== url siamo ancora in caricamento per il nuovo url,
// senza dover azzerare lo stato con una setState sincrona nel corpo dell'effect.
function useFetchJson(url) {
    const [risultato, setRisultato] = useState({ url: null, dati: null, errore: null });

    useEffect(() => {
        let annullato = false;

        fetch(url)
            .then(async (risposta) => {
                const corpo = await risposta.json();
                if (annullato) return;

                if (!risposta.ok) {
                    setRisultato({ url, dati: null, errore: corpo.errore || "Errore sconosciuto" });
                } else {
                    setRisultato({ url, dati: corpo, errore: null });
                }
            })
            .catch((err) => {
                if (!annullato) {
                    setRisultato({ url, dati: null, errore: "Impossibile contattare il server: " + err.message });
                }
            });

        return () => {
            annullato = true;
        };
    }, [url]);

    const caricamento = risultato.url !== url;

    return {
        dati: caricamento ? null : risultato.dati,
        errore: caricamento ? null : risultato.errore,
        caricamento,
    };
}

export default useFetchJson;
