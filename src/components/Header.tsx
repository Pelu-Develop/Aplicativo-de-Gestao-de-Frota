import { useLocation } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

const getTitle = (pathname: string) => {
    if (pathname === '/') return { title: 'Dashboard', subtitle: 'Análise logística' };
    if (pathname === '/motoristas') return { title: 'Motoristas', subtitle: 'Gestão de frota' };
    if (pathname === '/cargas') return { title: 'Viagens', subtitle: 'Status de rotas' };
    if (pathname === '/comissoes') return { title: 'Comissões', subtitle: 'Listagem' };
    if (pathname === '/perfil') return { title: 'Perfil', subtitle: 'Configurações' };
    return { title: 'Golden', subtitle: 'Premium' };
};

export default function Header() {
    const location = useLocation();
    const { title, subtitle } = getTitle(location.pathname);
    const authInstance = getAuth();
    const { theme, toggleTheme } = useAuth();

    const handleLogout = () => {
        signOut(authInstance);
    };

    return (
        <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6 lg:px-8 bg-surface/80 backdrop-blur-md sticky top-0 z-10 w-full transition-colors duration-300">
            <div className="flex flex-col min-w-0">
                <h2 className="text-base lg:text-lg font-bold text-text-primary truncate">{title}</h2>
                <p className="hidden xs:block text-[10px] lg:text-xs text-text-muted truncate font-medium uppercase tracking-tight">{subtitle}</p>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
                <div className="flex items-center h-8 bg-background/50 rounded-xl border border-border mr-2 p-1">
                    <button
                        onClick={toggleTheme}
                        className="p-1 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface"
                        title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>
                    <button className="relative p-1 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface">
                        <span className="material-symbols-outlined text-[20px]">notifications</span>
                        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-red-500"></span>
                    </button>
                    <button onClick={handleLogout} className="p-1 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-surface" title="Sair do sistema">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
