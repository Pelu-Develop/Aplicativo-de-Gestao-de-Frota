import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import logoGolden from '../assets/logo-golden.png';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetting, setResetting] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err: any) {
            setError('Falha no login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError('Por favor, informe seu email para redefinir a senha.');
            return;
        }
        setError('');
        setMessage('');
        setResetting(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Verifique seu e-mail para obter as instruções de redefinição de senha.');
        } catch (err: any) {
            setError('Falha ao redefinir senha. Verifique se o endereço de e-mail está correto.');
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark text-slate-100 p-4">
            {/* Background patterns */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="bg-surface-dark border border-border-dark rounded-2xl p-8 shadow-2xl flex flex-col items-center">

                    <img src={logoGolden} alt="Golden Transportes" className="h-32 mb-6 object-contain" />

                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-white">Golden Transportes</h1>
                        <p className="text-text-muted text-sm mt-1">Acesse o sistema de gestão de frota</p>
                    </div>

                    {error && (
                        <div className="w-full bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="w-full bg-green-500/10 border border-green-500/30 text-green-500 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-slate-300">Email</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-12 bg-background-dark border border-border-dark rounded-xl pl-10 pr-4 text-slate-100 placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="admin@golden.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">Senha</label>
                                <button
                                    type="button"
                                    onClick={handleResetPassword}
                                    disabled={resetting}
                                    className="text-primary hover:text-primary/80 text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                    {resetting ? 'Enviando...' : 'Esqueceu a senha?'}
                                </button>
                            </div>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">lock</span>
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-12 bg-background-dark border border-border-dark rounded-xl pl-10 pr-12 text-slate-100 placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors flex items-center"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || resetting}
                            className="w-full h-12 mt-2 bg-primary text-background-dark font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(245,165,36,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                            ) : (
                                <>
                                    Entrar
                                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                </div>
            </div>
        </div>
    );
}
