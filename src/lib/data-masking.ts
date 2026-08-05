/**
 * Utilitários para mascaramento de dados sensíveis (LGPD)
 */

/**
 * Mascara CPF: 123.456.789-10 -> 123.***.***-**
 */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';

  // Remove caracteres não numéricos
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return cpf; // Retorna original se não for CPF válido

  // Mascara mantendo apenas os 3 primeiros dígitos
  return `${cleaned.substring(0, 3)}.***.***-**`;
}

/**
 * Mascara telefone: (11) 98765-4321 -> (11) 9****-****
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length < 10) return phone; // Retorna original se não for telefone válido

  // Para celular (11 dígitos)
  if (cleaned.length === 11) {
    const ddd = cleaned.substring(0, 2);
    const firstDigit = cleaned.substring(2, 3);
    return `(${ddd}) ${firstDigit}****-****`;
  }

  // Para fixo (10 dígitos)
  if (cleaned.length === 10) {
    const ddd = cleaned.substring(0, 2);
    return `(${ddd}) ****-****`;
  }

  return phone;
}

/**
 * Mascara email: joao.silva@email.com -> j***.***a@email.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';

  const parts = email.split('@');
  if (parts.length !== 2) return email;

  const [localPart, domain] = parts;

  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }

  // Mantém primeira e última letra do local part
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  const masked = '*'.repeat(Math.min(localPart.length - 2, 5));

  return `${first}${masked}${last}@${domain}`;
}

/**
 * Mascara nome completo: João Silva Santos -> João S*** S***
 */
export function maskFullName(name: string | null | undefined): string {
  if (!name) return '';

  const parts = name.trim().split(' ');

  if (parts.length === 1) return name; // Não mascara se for apenas um nome

  // Mantém primeiro nome completo e mascara os demais
  const firstName = parts[0];
  const maskedParts = parts.slice(1).map(part => {
    if (part.length <= 2) return part; // Não mascara preposições
    return part[0] + '*'.repeat(Math.min(part.length - 1, 3));
  });

  return [firstName, ...maskedParts].join(' ');
}

/**
 * Mascara endereço: Rua dos Exemplos, 123 -> Rua dos E***, ***
 */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return '';

  // Procura por números no endereço
  const parts = address.split(',');
  if (parts.length > 1) {
    // Mascara o número
    parts[1] = parts[1].replace(/\d/g, '*');
  }

  // Mascara parte do nome da rua
  if (parts[0].length > 10) {
    const words = parts[0].split(' ');
    if (words.length > 2) {
      const lastWord = words[words.length - 1];
      if (lastWord.length > 3) {
        words[words.length - 1] = lastWord.substring(0, 1) + '***';
      }
    }
    parts[0] = words.join(' ');
  }

  return parts.join(',');
}

/**
 * Verifica se um dado já está mascarado
 */
export function isMasked(value: string | null | undefined): boolean {
  if (!value) return true; // Considera vazio como mascarado
  return value.includes('*') || value.includes('X');
}

/**
 * Máscara genérica baseada no tipo de dado
 */
export function autoMask(value: string | null | undefined, type?: 'cpf' | 'phone' | 'email' | 'name' | 'address'): string {
  if (!value) return '';

  // Tenta detectar o tipo automaticamente se não fornecido
  if (!type) {
    // CPF
    if (value.match(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/) || value.match(/^\d{11}$/)) {
      return maskCPF(value);
    }

    // Email
    if (value.includes('@')) {
      return maskEmail(value);
    }

    // Telefone
    if (value.match(/^\(\d{2}\)/) || value.match(/^\d{10,11}$/)) {
      return maskPhone(value);
    }

    // Se não detectar, retorna original
    return value;
  }

  // Máscara baseada no tipo fornecido
  switch (type) {
    case 'cpf': return maskCPF(value);
    case 'phone': return maskPhone(value);
    case 'email': return maskEmail(value);
    case 'name': return maskFullName(value);
    case 'address': return maskAddress(value);
    default: return value;
  }
}

/**
 * Hook para usar mascaramento em componentes React
 */
export function useMasking() {
  return {
    maskCPF,
    maskPhone,
    maskEmail,
    maskFullName,
    maskAddress,
    autoMask,
    isMasked
  };
}