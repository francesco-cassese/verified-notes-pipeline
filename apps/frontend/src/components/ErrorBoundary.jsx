import { Component } from "react";

// Un errore di rendering in un componente qualsiasi (es. un campo inatteso in
// una nota letta dall'archivio) altrimenti smonterebbe l'intero albero React,
// lasciando una pagina bianca senza alcun indizio per l'utente. I confini di
// errore sono l'unico modo in React per intercettare questi casi: richiedono
// un componente a classe, non esiste un equivalente a hook.
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { errore: null };
    }

    static getDerivedStateFromError(errore) {
        return { errore };
    }

    componentDidCatch(errore, info) {
        console.error("Errore non gestito nell'interfaccia:", errore, info.componentStack);
    }

    render() {
        if (this.state.errore) {
            return (
                <main className="page">
                    <h1>Qualcosa è andato storto</h1>
                    <p className="sottotitolo">
                        Si è verificato un errore imprevisto in questa pagina. Puoi provare a ricaricarla.
                    </p>
                    <div className="errore">{this.state.errore.message || "Errore sconosciuto"}</div>
                    <button type="button" onClick={() => window.location.assign("/")}>
                        Torna alla home
                    </button>
                </main>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
