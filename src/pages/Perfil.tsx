import { useState, useRef } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

// Função auxiliar para redimensionar a imagem e converter para Base64 (JPEG 0.5)
const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Reduzido para 80px para garantir que caiba no limite de 2KB do Firebase Auth
                const MAX_WIDTH = 80;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas não disponível'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                // Qualidade 0.5 para economizar espaço e evitar erro de limite do Firebase
                const base64 = canvas.toDataURL('image/jpeg', 0.5);
                resolve(base64);
            };
            img.onerror = () => reject(new Error('Formato de imagem inválido'));
            img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
        reader.readAsDataURL(file);
    });
};

export default function Perfil() {
    const { user, refreshUser } = useAuth();

    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPassword, setLoadingPassword] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setProfileMessage({ type: '', text: '' });
        setLoadingProfile(true);

        try {
            await updateProfile(user, {
                displayName: displayName || null,
                photoURL: photoURL || null
            });
            await refreshUser();
            setProfileMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error: any) {
            setProfileMessage({ type: 'error', text: `Erro: Imagem muito grande ou formato inválido.` });
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setProfileMessage({ type: '', text: '' });
        setLoadingProfile(true);

        try {
            const base64Image = await resizeImage(file);

            // Verifica se excedeu o limite seguro (aprox 3500 chars para Base64 no Auth)
            if (base64Image.length > 3500) {
                throw new Error('A imagem ainda é muito detalhada. Tente outra.');
            }

            await updateProfile(user, {
                photoURL: base64Image
            });

            setPhotoURL(base64Image);
            await refreshUser();

            setProfileMessage({ type: 'success', text: 'Logo atualizada com sucesso!' });
        } catch (error: any) {
            console.error('Erro no processamento da imagem:', error);
            setProfileMessage({ type: 'error', text: error.message || 'Erro ao processar imagem.' });
        } finally {
            setLoadingProfile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
            return;
        }

        setPasswordMessage({ type: '', text: '' });
        setLoadingPassword(true);

        try {
            await updatePassword(user, newPassword);
            setPasswordMessage({ type: 'success', text: 'Senha atualizada com sucesso!' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            if (error.code === 'auth/requires-recent-login') {
                setPasswordMessage({ type: 'error', text: 'Esta operação requer login recente. Saia e entre novamente.' });
            } else {
                setPasswordMessage({ type: 'error', text: 'Erro ao atualizar a senha. Tente novamente.' });
            }
        } finally {
            setLoadingPassword(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <div className="flex flex-col gap-3">
                <h1 className="text-text-primary text-3xl font-black leading-tight tracking-[-0.033em]">Meu Perfil</h1>
                <p className="text-text-muted text-sm font-normal leading-normal">Gerencie suas informações pessoais e configurações da empresa.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Info Form */}
                <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                        <span className="material-symbols-outlined text-primary text-2xl">manage_accounts</span>
                        <h2 className="text-xl font-bold text-text-primary">Informações da Empresa</h2>
                    </div>

                    {profileMessage.text && (
                        <div className={`w-full p-3 rounded-lg mb-4 flex items-center gap-2 text-sm ${profileMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-500' : 'bg-green-500/10 border border-green-500/30 text-green-500'}`}>
                            <span className="material-symbols-outlined text-[18px]">
                                {profileMessage.type === 'error' ? 'error' : 'check_circle'}
                            </span>
                            {profileMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5 flex-1">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text-secondary">Email de Acesso</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full h-12 bg-background border border-border rounded-xl pl-10 pr-4 text-text-muted cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text-secondary">Nome de Exibição / Empresa</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">badge</span>
                                </div>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full h-12 bg-background border border-border rounded-xl pl-10 pr-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="Nome da sua Empresa"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-sm font-medium text-text-secondary">Logo da Empresa</label>
                            <div className="flex items-center gap-4">
                                <div className="size-16 rounded-full bg-border flex-shrink-0 border border-border bg-cover bg-center overflow-hidden flex items-center justify-center text-text-muted" style={photoURL ? { backgroundImage: `url("${photoURL}")` } : {}}>
                                    {!photoURL && <span className="material-symbols-outlined text-2xl">store</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loadingProfile}
                                        className="h-9 px-4 bg-background border border-border hover:border-primary/50 text-text-primary hover:text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        Escolher imagem do PC
                                    </button>
                                    <p className="text-xs text-text-muted">JPG, PNG ou GIF. Redimensionada automaticamente.</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/png, image/jpeg, image/gif"
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loadingProfile}
                            className="w-full h-12 mt-4 bg-primary text-white dark:text-background-dark font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_15px_rgba(245,165,36,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loadingProfile ? (
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                    Salvar Perfil
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Change Password Form */}
                <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                        <span className="material-symbols-outlined text-primary text-2xl">password</span>
                        <h2 className="text-xl font-bold text-text-primary">Segurança</h2>
                    </div>

                    {passwordMessage.text && (
                        <div className={`w-full p-3 rounded-lg mb-4 flex items-center gap-2 text-sm ${passwordMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-500' : 'bg-green-500/10 border border-green-500/30 text-green-500'}`}>
                            <span className="material-symbols-outlined text-[18px]">
                                {passwordMessage.type === 'error' ? 'error' : 'check_circle'}
                            </span>
                            {passwordMessage.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="flex flex-col gap-5 flex-1">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-text-secondary">Nova Senha</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                                </div>
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full h-12 bg-background border border-border rounded-xl pl-10 pr-12 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors flex items-center"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showNewPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-sm font-medium text-text-secondary">Confirmar Nova Senha</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex items-center">
                                    <span className="material-symbols-outlined text-[20px]">lock</span>
                                </div>
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full h-12 bg-background border border-border rounded-xl pl-10 pr-12 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors flex items-center"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loadingPassword || !newPassword || !confirmPassword}
                            className="w-full h-12 mt-4 bg-background border border-border text-text-primary hover:border-primary/50 hover:text-primary font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingPassword ? (
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">key</span>
                                    Alterar Senha
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
