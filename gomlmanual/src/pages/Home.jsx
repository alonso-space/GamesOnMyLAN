import { Link } from 'react-router-dom';
import HorizontalCard from '../components/HorizontalCard';
import { asset } from '../utils/asset';
import './Home.css';

function Home() {
    return (
        <>
            <p className="page-kicker">Manual de uso</p>
            <h1 className="text-secondary">Manual de uso de GamesOnMyLAN</h1>
            <p className="text-tertiary lead-copy">
                Este manual explica cómo instalar, configurar y poner en marcha GamesOnMyLan en tu propio equipo,
                además de cómo resolver los problemas más comunes que pueden aparecer durante el proceso.
                Aquí encontrarás los requisitos previos que necesitas cumplir, los pasos de instalación en orden,
                y una sección de solución de problemas para los errores más frecuentes.
            </p>

            <img className="hero-art d-block" src={asset('/img/goml.png')} alt="Captura de GamesOnMyLAN" />

            <HorizontalCard img="/img/logo.png" alt="¿Qué es GamesOnMyLAN?" title="¿Qué es GamesOnMyLAN?">
                GamesOnMyLAN es un servicio self-hosted cuyo rol principal es almacenar, servir y conservar
                videojuegos web o cualquier aplicación estática creada por los usuarios. Permite centralizar
                estos proyectos en un servidor propio, facilitando su administración, acceso y distribución
                dentro de una red local, sin depender de servicios externos de alojamiento. De esta forma, los
                usuarios pueden publicar y mantener sus propios proyectos de manera sencilla, manteniendo el
                control sobre sus archivos y recursos.
            </HorizontalCard>

            <div className="action-grid">
                <Link to="/requirements" className="action-card">
                    <span>Paso 1</span>
                    <strong>Antes de instalar</strong>
                </Link>
                <Link to="/installation" className="action-card">
                    <span>Paso 2</span>
                    <strong>Instalación</strong>
                </Link>
                <Link to="/docker" className="action-card">
                    <span>Alternativa</span>
                    <strong>Usar GOML con Docker</strong>
                </Link>
                <Link to="/internet" className="action-card">
                    <span>Avanzado</span>
                    <strong>Publicar GOML en internet</strong>
                </Link>
                <Link to="/solutions" className="action-card">
                    <span>Paso 3</span>
                    <strong>Problemas comunes</strong>
                </Link>
                <Link to="/backup-restore" className="action-card">
                    <span>Respaldo y Restauración</span>
                    <strong>Como respaldar los juegos y usuarios, y restaurarlos en otra instalación</strong>
                </Link>
                <a
                    href="https://alonso-space.github.io/GamesOnMyLAN/"
                    className="action-card"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span>Código</span>
                    <strong>Repositorio GitHub</strong>
                </a>
                <a
                    href="https://alonso-space.github.io/alonso-space/"
                    className="action-card"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span>Créditos</span>
                    <strong>Sobre el autor</strong>
                </a>
            </div>
        </>
    );
}

export default Home;
