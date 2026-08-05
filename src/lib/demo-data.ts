// Dados fictícios para demonstração
export const DEMO_DATA = {
  user: {
    id: 'demo-user-id',
    email: 'demo@ledivan.com.br',
    name: 'Usuário Demonstração',
    role: 'Terapeuta',
    isDemo: true
  },
  patients: [
    {
      id: '1',
      name: 'Maria Silva',
      email: 'maria.demo@example.com',
      phone: '(11) 9****-****',
      cpf: '123.***.**-**',
      status: 'ativo',
      paymentType: 'Mensal',
      sessionValue: 150.00,
      paymentStatus: 'Em dia',
      birthDate: '1985-03-15',
      address: 'Rua Demo, 123 - São Paulo/SP'
    },
    {
      id: '2',
      name: 'João Santos',
      email: 'joao.demo@example.com',
      phone: '(11) 9****-****',
      cpf: '456.***.**-**',
      status: 'ativo',
      paymentType: 'Avulso',
      sessionValue: 180.00,
      paymentStatus: 'Em dia',
      birthDate: '1990-07-22',
      address: 'Av. Exemplo, 456 - São Paulo/SP'
    },
    {
      id: '3',
      name: 'Ana Costa',
      email: 'ana.demo@example.com',
      phone: '(11) 9****-****',
      cpf: '789.***.**-**',
      status: 'ativo',
      paymentType: 'Pacote',
      sessionValue: 120.00,
      paymentStatus: 'Em dia',
      birthDate: '1978-11-08',
      address: 'Praça Demo, 789 - São Paulo/SP'
    },
    {
      id: '4',
      name: 'Pedro Oliveira',
      email: 'pedro.demo@example.com',
      phone: '(11) 9****-****',
      cpf: '012.***.**-**',
      status: 'ativo',
      paymentType: 'Quinzenal',
      sessionValue: 160.00,
      paymentStatus: 'Pendente',
      birthDate: '1982-05-30',
      address: 'Travessa Teste, 321 - São Paulo/SP'
    },
    {
      id: '5',
      name: 'Lucia Ferreira',
      email: 'lucia.demo@example.com',
      phone: '(11) 9****-****',
      cpf: '345.***.**-**',
      status: 'inativo',
      paymentType: 'Avulso',
      sessionValue: 140.00,
      paymentStatus: 'Em dia',
      birthDate: '1995-09-12',
      address: 'Alameda Demo, 654 - São Paulo/SP'
    }
  ],
  sessions: [
    {
      id: '1',
      patientId: '1',
      patientName: 'Maria Silva',
      date: '2026-08-06',
      time: '14:00',
      status: 'confirmada',
      type: 'presencial',
      duration: '50min'
    },
    {
      id: '2',
      patientId: '2',
      patientName: 'João Santos',
      date: '2026-08-06',
      time: '15:00',
      status: 'confirmada',
      type: 'online',
      duration: '50min'
    },
    {
      id: '3',
      patientId: '3',
      patientName: 'Ana Costa',
      date: '2026-08-07',
      time: '10:00',
      status: 'pendente',
      type: 'presencial',
      duration: '50min'
    },
    {
      id: '4',
      patientId: '4',
      patientName: 'Pedro Oliveira',
      date: '2026-08-08',
      time: '16:00',
      status: 'confirmada',
      type: 'online',
      duration: '50min'
    }
  ],
  transactions: [
    {
      id: '1',
      description: 'Sessão - Maria Silva',
      value: 150.00,
      type: 'receita',
      category: 'Atendimento',
      date: '2026-08-01',
      status: 'pago'
    },
    {
      id: '2',
      description: 'Sessão - João Santos',
      value: 180.00,
      type: 'receita',
      category: 'Atendimento',
      date: '2026-08-01',
      status: 'pago'
    },
    {
      id: '3',
      description: 'Material de escritório',
      value: -75.00,
      type: 'despesa',
      category: 'Material',
      date: '2026-08-02',
      status: 'pago'
    },
    {
      id: '4',
      description: 'Aluguel consultório',
      value: -1200.00,
      type: 'despesa',
      category: 'Aluguel',
      date: '2026-08-01',
      status: 'pago'
    },
    {
      id: '5',
      description: 'Sessão - Ana Costa',
      value: 120.00,
      type: 'receita',
      category: 'Atendimento',
      date: '2026-08-03',
      status: 'pendente'
    }
  ],
  analytics: {
    totalPatients: 5,
    activePatients: 4,
    weekSessions: 4,
    monthRevenue: 2850.00,
    monthExpenses: 1275.00,
    pendingPayments: 1,
    completionRate: 85,
    averageSessionValue: 146.00
  },
  notifications: [
    {
      id: '1',
      title: 'Modo Demonstração',
      message: 'Você está explorando o Ledivan em modo demo. Os dados são fictícios.',
      type: 'info',
      date: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Experimente todas as funcionalidades',
      message: 'Navegue livremente, mas lembre-se que as alterações não serão salvas.',
      type: 'info',
      date: new Date().toISOString()
    }
  ]
};

// Função auxiliar para verificar se estamos em modo demo
export function isDemoMode(request: Request | undefined): boolean {
  if (!request) return false;

  const cookies = request.headers.get('cookie') || '';
  return cookies.includes('is-demo=true');
}

// Função para obter dados apropriados (demo ou real)
export async function getDataForSession(request: Request, realDataFn: () => Promise<any>) {
  if (isDemoMode(request)) {
    // Retornar dados demo
    return DEMO_DATA;
  } else {
    // Retornar dados reais
    return await realDataFn();
  }
}