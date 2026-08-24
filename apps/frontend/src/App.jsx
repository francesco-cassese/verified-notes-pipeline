import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import ArchivioCartelle from "./pages/ArchivioCartelle.jsx";
import ArchivioAppunti from "./pages/ArchivioAppunti.jsx";
import ArchivioDettaglio from "./pages/ArchivioDettaglio.jsx";
import "./App.css";

function App() {
    return (
        <>
            <Navbar />
            <Routes>
                <Route path="/" element={<GeneratorPage />} />
                <Route path="/archivio" element={<ArchivioCartelle />} />
                <Route path="/archivio/:cartella" element={<ArchivioAppunti />} />
                <Route path="/archivio/:cartella/:nomeFile" element={<ArchivioDettaglio />} />
            </Routes>
        </>
    );
}

export default App;
