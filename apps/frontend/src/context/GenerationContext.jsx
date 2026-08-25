import { createContext, useCallback, useContext, useState } from "react";

const GenerationContext = createContext(null);

// Sollevato sopra <Routes> in App.jsx così l'avanzamento di una generazione
// sopravvive alla navigazione: prima viveva come stato locale di GeneratorPage,
// quindi aprire l'Archivio a metà generazione smontava il componente e perdeva
// sia lo stream in corso di lettura sia l'esito finale.
export function GenerationProvider({ children }) {
    const [topic, setTopic] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [status, setStatus] = useState("");
    const [confirmation, setConfirmation] = useState(null);
    const [duplicate, setDuplicate] = useState(null);
    const [error, setError] = useState(null);

    const startGeneration = useCallback(async (rawTopic) => {
        const value = rawTopic.trim();
        if (value.length < 3) return;

        setIsGenerating(true);
        setStatus("Avvio della generazione...");
        setConfirmation(null);
        setDuplicate(null);
        setError(null);

        function handleEvent(eventName, data) {
            if (eventName === "phase") {
                const attemptText = data.maxAttempts > 1 ? ` (tentativo ${data.attempt} di ${data.maxAttempts})` : "";
                setStatus(data.message + attemptText);
            } else if (eventName === "result") {
                if (data.outcome === "success") {
                    setConfirmation(data.note);
                    setTopic("");
                } else if (data.outcome === "duplicate") {
                    setDuplicate(data);
                } else {
                    setError(data);
                }
            }
        }

        try {
            const response = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: value }),
            });

            // La risposta è uno stream Server-Sent Events (event: ...\ndata: ...\n\n),
            // non un singolo JSON: la leggiamo a blocchi man mano che arrivano, così
            // possiamo mostrare la fase corrente invece di attendere in silenzio
            // fino all'evento finale "result".
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value: chunk, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(chunk, { stream: true });

                let boundaryIndex;
                while ((boundaryIndex = buffer.indexOf("\n\n")) !== -1) {
                    const block = buffer.slice(0, boundaryIndex);
                    buffer = buffer.slice(boundaryIndex + 2);

                    const lines = block.split("\n");
                    const eventLine = lines.find((r) => r.startsWith("event:"));
                    const dataLine = lines.find((r) => r.startsWith("data:"));
                    if (!eventLine || !dataLine) continue;

                    handleEvent(eventLine.slice("event:".length).trim(), JSON.parse(dataLine.slice("data:".length).trim()));
                }
            }

            setStatus("");
        } catch (err) {
            setStatus("");
            setError({ error: "Impossibile contattare il server: " + err.message });
        } finally {
            setIsGenerating(false);
        }
    }, []);

    const value = {
        topic,
        setTopic,
        isGenerating,
        status,
        confirmation,
        duplicate,
        error,
        startGeneration,
    };

    return <GenerationContext.Provider value={value}>{children}</GenerationContext.Provider>;
}

export function useGeneration() {
    const context = useContext(GenerationContext);
    if (!context) throw new Error("useGeneration must be used within a GenerationProvider");
    return context;
}
