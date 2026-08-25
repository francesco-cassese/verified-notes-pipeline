import { NavLink } from "react-router-dom";
import styles from "./Navbar.module.css";

// NavLink applica di suo la classe letterale "active" quando il link
// corrisponde alla rotta corrente: con i CSS module quella stringa non
// combacia con nessuna classe locale hashata, quindi scegliamo esplicitamente
// styles.navLink/styles.navLinkActive invece di affidarci al nome che
// aggiunge il router.
function classeLink({ isActive }) {
    return isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;
}

function Navbar() {
    return (
        <header className={styles.navbar}>
            <div className={styles.navbarInner}>
                <NavLink to="/" className={styles.navbarBrand} end>
                    📚 Appunti Tecnici
                </NavLink>
                <nav className={styles.navbarLinks}>
                    <NavLink to="/" end className={classeLink}>Genera</NavLink>
                    <NavLink to="/archivio" className={classeLink}>Archivio</NavLink>
                </nav>
            </div>
        </header>
    );
}

export default Navbar;
