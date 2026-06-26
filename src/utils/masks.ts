export const maskCPF = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
};

export const unmaskCPF = (value: string) => value.replace(/\D/g, '');

export const maskPhone = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
};

export const maskPlate = (value: string) => {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .replace(/([A-Z]{3})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
};

export const formatCPFHidden = (cpf: string) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
};
