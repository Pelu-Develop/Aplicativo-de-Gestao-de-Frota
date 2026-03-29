import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoGolden from '../assets/logo-golden.png';

export default function Sidebar() {
    const location = useLocation();
    const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
    const { user } = useAuth();

    const photoUrl = user?.photoURL || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOelzaA2LmQ-8yzwjZfMgDM94DLpP1Zp1UTmQnxTLPhtF2GUpNOtoJLLcqG2j3HsgDh2FVH1SuBnPHpeyeVJ-Yg2whB6vOnyllIm4zV7pKtiTG1vzPO1PifTHC0ZJ_yVAZrUQFyQv67c690RrE9ZQzxydV64_jDZIc9FmoiQUetsAY-4DLDDKtdPcTxuwGuaqm8B5HZJO2QYU4tcyKoWwt1Xfdge5uGGre7du5sYyelRJVvV54-4DGiNZT-HNc5qYvtgq0yS687Q';

    return (
        <aside className="w-64 bg-surface border-r border-border flex flex-col h-full flex-shrink-0 transition-colors duration-300">
            <div className="p-4 border-b border-border flex items-center gap-3">
                <img src={logoGolden} alt="Golden Logo" className="h-10 w-auto object-contain" />
                <div className="flex flex-col">
                    <h1 className="text-text-primary text-sm font-bold leading-tight">Golden Transportes</h1>
                    <p className="text-primary/80 text-[10px] font-medium uppercase tracking-wider">Gestão Premium</p>
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
                <Link to="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">dashboard</span>
                    <span className="text-sm font-medium">Dashboard Geral</span>
                </Link>
                <div className="flex flex-col gap-1 mt-2">
                    <p className="px-3 text-[10px] font-black uppercase text-text-muted tracking-widest mb-1 opacity-50">Análises</p>
                    <Link to="/dashboards/viagens" className={`flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors ${isActive('/dashboards/viagens') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                        <span className="text-xs font-semibold">Viagens</span>
                    </Link>
                    <Link to="/dashboards/despesas" className={`flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors ${isActive('/dashboards/despesas') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                        <span className="material-symbols-outlined text-[18px]">query_stats</span>
                        <span className="text-xs font-semibold">Despesas</span>
                    </Link>
                    <Link to="/dashboards/comissoes" className={`flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors ${isActive('/dashboards/comissoes') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                        <span className="text-xs font-semibold">DB Comissões</span>
                    </Link>
                </div>
                <div className="h-px bg-border my-2"></div>
                <Link to="/cargas" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/cargas') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">local_shipping</span>
                    <span className="text-sm font-medium">Viagens</span>
                </Link>
                <Link to="/motoristas" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/motoristas') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">group</span>
                    <span className="text-sm font-medium">Motoristas</span>
                </Link>
                <Link to="/comissoes" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/comissoes') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">receipt_long</span>
                    <span className="text-sm font-medium">Comissões</span>
                </Link>
                <Link to="/despesas" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/despesas') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">account_balance_wallet</span>
                    <span className="text-sm font-medium">Despesas</span>
                </Link>
                <Link to="/conciliacao" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-colors ${isActive('/conciliacao') ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:bg-surface/80 hover:text-text-primary'}`}>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">rule</span>
                    <span className="text-sm font-medium">Conciliação</span>
                </Link>
            </nav>
            <div className="p-4 border-t border-border">
                <Link to="/perfil" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-border cursor-pointer hover:bg-border/30 hover:border-primary/50 transition-colors group">
                    <div className="size-8 rounded-full bg-border flex items-center justify-center text-text-muted bg-cover bg-center overflow-hidden border border-border group-hover:border-primary/50 transition-colors" style={user?.photoURL ? { backgroundImage: `url("${photoUrl}")` } : {}}>
                        {!user?.photoURL && <span className="material-symbols-outlined text-[18px]">person</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{user?.displayName || 'Admin Usuário'}</p>
                        <p className="text-xs text-text-muted truncate">{user?.email}</p>
                    </div>
                    <span className="material-symbols-outlined text-text-muted text-[18px] group-hover:text-primary transition-colors">settings</span>
                </Link>
            </div>
        </aside>
    );
}
