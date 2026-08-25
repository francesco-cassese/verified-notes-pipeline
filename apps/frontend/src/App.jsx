import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { GenerationProvider } from "./context/GenerationContext.jsx";
import GeneratorPage from "./pages/GeneratorPage.jsx";
import ArchivePage from "./pages/ArchivePage.jsx";
import FolderPage from "./pages/FolderPage.jsx";
import NotePage from "./pages/NotePage.jsx";
import NotFound from "./pages/NotFound.jsx";

function App() {
    const location = useLocation();

    return (
        <GenerationProvider>
            <Navbar />
            <ErrorBoundary resetKey={location.pathname}>
                <Routes>
                    <Route path="/" element={<GeneratorPage />} />
                    <Route path="/archive" element={<ArchivePage />} />
                    <Route path="/archive/:folder" element={<FolderPage />} />
                    <Route path="/archive/:folder/:fileName" element={<NotePage />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </ErrorBoundary>
        </GenerationProvider>
    );
}

export default App;
