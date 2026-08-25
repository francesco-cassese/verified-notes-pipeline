import { Component } from "react";

// Un errore di rendering in un componente qualsiasi (es. un campo inatteso in
// una nota letta dall'archivio) altrimenti smonterebbe l'intero albero React,
// lasciando una pagina bianca senza alcun indizio per l'utente. I confini di
// errore sono l'unico modo in React per intercettare questi casi: richiedono
// un componente a classe, non esiste un equivalente a hook.
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("Errore non gestito nell'interfaccia:", error, info.componentStack);
    }

    componentDidUpdate(prevProps) {
        // Cambiare pagina (es. dalla Navbar) non rimonta questo boundary, quindi
        // senza reset esplicito l'utente resterebbe bloccato sul fallback anche
        // dopo aver navigato altrove.
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    render() {
        if (this.state.error) {
            return (
                <main className="page">
                    <h1>Qualcosa è andato storto</h1>
                    <p className="subtitle">
                        Si è verificato un errore imprevisto in questa pagina. Puoi riprovare o tornare alla home.
                    </p>
                    <div className="error">{this.state.error.message || "Errore sconosciuto"}</div>
                    <button type="button" onClick={() => this.setState({ error: null })}>
                        Riprova
                    </button>
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
