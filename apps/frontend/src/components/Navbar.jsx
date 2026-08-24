import { NavLink } from "react-router-dom";

function Navbar() {
    return (
        <header className="navbar">
            <div className="navbar-inner">
                <NavLink to="/" className="navbar-brand" end>
                    📚 Appunti Tecnici
                </NavLink>
                <nav className="navbar-links">
                    <NavLink to="/" end>Genera</NavLink>
                    <NavLink to="/archivio">Archivio</NavLink>
                </nav>
            </div>
        </header>
    );
}

export default Navbar;
