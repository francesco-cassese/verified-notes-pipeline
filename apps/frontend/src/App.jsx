import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import ArchivePage from "./pages/ArchivePage.jsx";
import FolderPage from "./pages/FolderPage.jsx";
import NotePage from "./pages/NotePage.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
    return (
        <>
            <Navbar />
            <ErrorBoundary>
                <Routes>
                    <Route path="/" element={<GeneratorPage />} />
                    <Route path="/archive" element={<ArchivePage />} />
                    <Route path="/archive/:folder" element={<FolderPage />} />
                    <Route path="/archive/:folder/:fileName" element={<NotePage />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </ErrorBoundary>
        </>
    );
}

export default App;
