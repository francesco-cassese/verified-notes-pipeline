import { useEffect, useState } from "react";

// Condiviso dalle pagine di Archivio (cartelle, elenco appunti, dettaglio):
// stesso identico pattern fetch-on-mount, ripetuto tre volte prima di questa
// estrazione. Il risultato è taggato con l'url a cui appartiene: finché non
// arriva result.url !== url siamo ancora in caricamento per il nuovo url,
// senza dover azzerare lo stato con una setState sincrona nel corpo dell'effect.
function useFetchJson(url) {
    const [result, setResult] = useState({ url: null, data: null, error: null });

    useEffect(() => {
        let cancelled = false;

        fetch(url)
            .then(async (response) => {
                const body = await response.json();
                if (cancelled) return;

                if (!response.ok) {
                    setResult({ url, data: null, error: body.error || "Errore sconosciuto" });
                } else {
                    setResult({ url, data: body, error: null });
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setResult({ url, data: null, error: "Impossibile contattare il server: " + err.message });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [url]);

    const isLoading = result.url !== url;

    return {
        data: isLoading ? null : result.data,
        error: isLoading ? null : result.error,
        isLoading,
    };
}

export default useFetchJson;
