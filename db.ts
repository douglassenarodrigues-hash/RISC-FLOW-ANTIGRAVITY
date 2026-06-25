import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Memory store initialized from db.json
let store: Record<string, any[]> = {
  users: [],
  proposals: [],
  decision_history: [],
  agenda: [],
  rules: [],
  partners: [],
  parceiro_usuarios: [],
  templates_email: [],
  bank_layouts: [],
  imported_bases: []
};

// Seed default data if store is empty
function seedDefaultData() {
  if (store.users.length === 0) {
    store.users = [
      {
        id: "master-1",
        username: "administrador",
        password: "123",
        role: "Master",
        actingAreas: JSON.stringify(["TODAS"]),
        permissions: JSON.stringify({ viewFullCpf: true, viewValues: true, editRules: true, deleteProposals: true, viewFraudPreventionChart: true }),
        active: 1,
        status: "Offline"
      },
      {
        id: "analista-1",
        username: "George Andrey",
        password: "123",
        role: "Analista",
        actingAreas: JSON.stringify(["TODAS"]),
        permissions: JSON.stringify({ viewFullCpf: false, viewValues: true, editRules: false, deleteProposals: true, viewFraudPreventionChart: false }),
        active: 1,
        status: "Offline"
      }
    ];
  }

  if (store.templates_email.length === 0) {
    store.templates_email = [{
      id: 1,
      assunto: "Pendência Identificada - Parceiro {codigo_parceiro} - Proposta {numero_proposta}",
      corpo: `Olá, parceiro (Código: {codigo_parceiro}).\n\nIdentificamos uma pendência na operação do cliente {nome_cliente} (CPF: {cpf_cliente}).\n\nDetalhes da Operação:\n- Proposta/ADE: {numero_proposta}\n- Valor: R$ {valor_operacao}\n- Motivo da Pendência: {motivo_pendencia}\n\nPor favor, verifique a documentação e nos envie o retorno respondendo a este e-mail para darmos continuidade à operação.\n\nAtenciosamente,\nEquipe de Operações`,
      remetente: null,
      smtp_host: null,
      smtp_port: 587,
      smtp_user: null,
      smtp_pass: null,
      envio_automatico: 0
    }];
  }

  if (store.rules.length === 0) {
    store.rules = [
      {
        id: 1,
        rule_key: "covenants",
        rule_data: JSON.stringify({ 'INSS': { documents: ['RG/CNH'], teto: 4000.00 } })
      }
    ];
  }

  if (store.partners.length === 0) {
    store.partners = [
      { codigo_parceiro: 'SISTEMA', nome_parceiro: 'Direto Loja', email_parceiro: null, regua: 'Master', selfie: 1, doc: 0, sla: 'Urgente', limite: 50000.00, status: 'ACTING', score: 100, driveUrl: null, contato_telefonico: 0 },
      { codigo_parceiro: 'AD01', nome_parceiro: 'Parceiro Centro', email_parceiro: null, regua: 'Ouro', selfie: 1, doc: 0, sla: 'Normal', limite: 25000.00, status: 'ACTING', score: 100, driveUrl: null, contato_telefonico: 0 }
    ];
  }

  if (store.bank_layouts.length === 0) {
    store.bank_layouts = [
      {
        bank_name: "ITAÚ",
        layout_data: JSON.stringify({
          bankName: 'ITAÚ',
          ade: 'ADE',
          cpf: 'CPF',
          cliente: 'Nome',
          atividade: 'Situação',
          fase: 'Consistência',
          valor: 'Valor Solic.',
          valorFinanciado: 'Valor Solic.',
          convenio: 'Convênio',
          corretor: 'Corretor',
          produto: 'Produto',
          filterValue: '',
          sep: ';'
        })
      },
      {
        bank_name: "PAN",
        layout_data: JSON.stringify({
          bankName: 'PAN',
          ade: 'ADE',
          cpf: 'CPF',
          cliente: 'Nome',
          atividade: 'Situação',
          fase: 'Fase',
          valor: 'Valor',
          valorFinanciado: 'Valor',
          convenio: 'Convênio',
          corretor: 'Corretor',
          produto: 'Produto',
          filterValue: '',
          sep: ';'
        })
      }
    ];
  }
}

// Load database from file
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      store = { ...store, ...parsed };
      console.log(`[JSON DB] Loaded successfully from ${DB_FILE}`);
    } else {
      console.log(`[JSON DB] Database file not found. Creating new at ${DB_FILE}`);
      saveDatabase();
    }
  } catch (err) {
    console.error(`[JSON DB] Error loading database:`, err);
  }
  seedDefaultData();
  saveDatabase();
}

// Save database to file
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error(`[JSON DB] Error saving database:`, err);
  }
}

// Load database immediately
loadDatabase();

// getPool Mock
export async function getPool(): Promise<any> {
  return {
    execute: async (sql: string, params?: any[]) => {
      const rows = await query(sql, params);
      return [rows];
    },
    end: async () => {}
  };
}

// query Emulator
export async function query(sql: string, params: any[] = []): Promise<any> {
  const normSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  // --- SELECT QUERY ---
  if (normSql.startsWith('select')) {
    if (normSql.includes('from proposals')) {
      let data = [...store.proposals];
      if (normSql.includes('where id = ?')) {
        data = data.filter(p => p.id === params[0]);
      }
      if (normSql.includes('order by createdat desc')) {
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
      return data;
    }

    if (normSql.includes('from users')) {
      if (normSql.includes('where id = ?')) {
        return store.users.filter(u => u.id === params[0]);
      }
      return store.users;
    }

    if (normSql.includes('from decision_history')) {
      let data = [...store.decision_history];
      if (normSql.includes('order by timestamp desc')) {
        // Sort using timestamp locale parser if needed or keep as is
      }
      return data;
    }

    if (normSql.includes('from agenda')) {
      let data = [...store.agenda];
      if (normSql.includes('order by id desc')) {
        data.sort((a, b) => b.id.localeCompare(a.id));
      }
      return data;
    }

    if (normSql.includes('from rules')) {
      if (normSql.includes("where rule_key = 'covenants'")) {
        return store.rules.filter(r => r.rule_key === 'covenants');
      }
      return store.rules;
    }

    if (normSql.includes('from partners')) {
      if (normSql.includes('where codigo_parceiro = ?')) {
        return store.partners.filter(p => p.codigo_parceiro === params[0]);
      }
      return store.partners;
    }

    if (normSql.includes('from parceiro_usuarios')) {
      return store.parceiro_usuarios;
    }

    if (normSql.includes('from templates_email')) {
      return store.templates_email;
    }

    if (normSql.includes('from bank_layouts')) {
      return store.bank_layouts;
    }

    if (normSql.includes('from imported_bases')) {
      let data = [...store.imported_bases];
      if (normSql.includes('order by importedat desc')) {
        data.sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
      }
      return data;
    }
  }

  // --- INSERT / UPDATE QUERY ---
  if (normSql.startsWith('insert into') || normSql.startsWith('update')) {
    
    // --- PROPOSALS INSERT/UPDATE ---
    if (normSql.includes('into proposals') || normSql.includes('update proposals')) {
      if (normSql.startsWith('insert into')) {
        const id = params[0];
        const existingIdx = store.proposals.findIndex(p => p.id === id);
        const proposalObj = {
          id: params[0],
          ade: params[1],
          nomeCliente: params[2],
          banco: params[3],
          convenio: params[4],
          produto: params[5],
          corretor: params[6],
          valor: params[7],
          valorFinanciado: params[8],
          cpf: params[9],
          sla: params[10],
          obs: params[11],
          status: params[12],
          originalStatus: params[13],
          faseAtuacao: params[14],
          dataSistema: params[15],
          documentacao: params[16],
          lockedBy: params[17],
          createdAt: params[18],
          lastUpdatedStatusAt: params[19],
          slaRemainingMs: params[20],
          fraudCategory: params[21],
          fraudSubMotive: params[22]
        };

        if (existingIdx > -1) {
          store.proposals[existingIdx] = { ...store.proposals[existingIdx], ...proposalObj };
        } else {
          store.proposals.push(proposalObj);
        }
      } else if (normSql.startsWith('update proposals')) {
        // Parse set fields
        const id = params[params.length - 1];
        const existingIdx = store.proposals.findIndex(p => p.id === id);
        if (existingIdx > -1) {
          const sets = sql.substring(sql.toLowerCase().indexOf('set') + 3, sql.toLowerCase().indexOf('where')).split(',');
          sets.forEach((set, idx) => {
            const field = set.split('=')[0].trim();
            store.proposals[existingIdx][field] = params[idx];
          });
        }
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- USERS INSERT/UPDATE ---
    if (normSql.includes('into users') || normSql.includes('update users')) {
      if (normSql.startsWith('insert into')) {
        const id = params[0];
        const userObj = {
          id: params[0],
          username: params[1],
          password: params[2],
          role: params[3],
          actingAreas: params[4],
          permissions: params[5],
          active: params[6],
          status: params[7]
        };
        const existingIdx = store.users.findIndex(u => u.id === id);
        if (existingIdx > -1) {
          store.users[existingIdx] = userObj;
        } else {
          store.users.push(userObj);
        }
      } else {
        const id = params[params.length - 1];
        const existingIdx = store.users.findIndex(u => u.id === id);
        if (existingIdx > -1) {
          store.users[existingIdx] = {
            ...store.users[existingIdx],
            username: params[0],
            password: params[1],
            role: params[2],
            actingAreas: params[3],
            permissions: params[4],
            active: params[5],
            status: params[6]
          };
        }
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- DECISION HISTORY INSERT ---
    if (normSql.includes('into decision_history')) {
      const entry = {
        id: params[0],
        timestamp: params[1],
        ade: params[2],
        cliente: params[3],
        banco: params[4],
        decisao: params[5],
        motivo: params[6],
        analista: params[7],
        acao: params[8],
        aiAnalysisResult: params[9],
        contactAttachment: params[10],
        fraudCategory: params[11],
        fraudSubMotive: params[12]
      };
      store.decision_history.push(entry);
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- AGENDA INSERT/UPDATE ---
    if (normSql.includes('into agenda') || normSql.includes('update agenda')) {
      if (normSql.startsWith('insert into')) {
        const entry = {
          id: params[0],
          ade: params[1],
          contato: params[2],
          data: params[3],
          hora: params[4],
          motivo: params[5],
          analista: params[6],
          status: params[7]
        };
        store.agenda.push(entry);
      } else {
        const id = params[1];
        const existingIdx = store.agenda.findIndex(a => a.id === id);
        if (existingIdx > -1) {
          store.agenda[existingIdx].status = params[0];
        }
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- RULES INSERT/UPDATE ---
    if (normSql.includes('into rules')) {
      const ruleKey = params[0];
      const ruleData = params[1];
      const existingIdx = store.rules.findIndex(r => r.rule_key === ruleKey);
      if (existingIdx > -1) {
        store.rules[existingIdx].rule_data = ruleData;
      } else {
        store.rules.push({ id: store.rules.length + 1, rule_key: ruleKey, rule_data: ruleData });
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- PARTNERS INSERT/UPDATE ---
    if (normSql.includes('into partners')) {
      const code = params[0];
      const partnerObj = {
        codigo_parceiro: params[0],
        nome_parceiro: params[1],
        email_parceiro: params[2],
        regua: params[3],
        selfie: params[4],
        doc: params[5],
        sla: params[6],
        limite: params[7],
        status: params[8],
        score: params[9],
        driveUrl: params[10],
        contato_telefonico: params[11]
      };
      const existingIdx = store.partners.findIndex(p => p.codigo_parceiro === code);
      if (existingIdx > -1) {
        store.partners[existingIdx] = partnerObj;
      } else {
        store.partners.push(partnerObj);
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- PARCEIRO USUARIOS INSERT ---
    if (normSql.includes('into parceiro_usuarios')) {
      const entry = {
        id: store.parceiro_usuarios.length + 1,
        codigo_parceiro: params[0],
        usuario: params[1]
      };
      store.parceiro_usuarios.push(entry);
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- EMAIL TEMPLATES INSERT/UPDATE ---
    if (normSql.includes('into templates_email') || normSql.includes('update templates_email')) {
      if (normSql.startsWith('insert into')) {
        const entry = {
          id: store.templates_email.length + 1,
          assunto: params[0],
          corpo: params[1],
          remetente: params[2],
          smtp_host: params[3],
          smtp_port: params[4],
          smtp_user: params[5],
          smtp_pass: params[6],
          envio_automatico: params[7]
        };
        store.templates_email.push(entry);
      } else {
        const id = params[8];
        const existingIdx = store.templates_email.findIndex(t => t.id === id);
        if (existingIdx > -1) {
          store.templates_email[existingIdx] = {
            id,
            assunto: params[0],
            corpo: params[1],
            remetente: params[2],
            smtp_host: params[3],
            smtp_port: params[4],
            smtp_user: params[5],
            smtp_pass: params[6],
            envio_automatico: params[7]
          };
        }
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- BANK LAYOUTS INSERT/UPDATE ---
    if (normSql.includes('into bank_layouts')) {
      const name = params[0];
      const layoutObj = {
        bank_name: params[0],
        layout_data: params[1]
      };
      const existingIdx = store.bank_layouts.findIndex(l => l.bank_name === name);
      if (existingIdx > -1) {
        store.bank_layouts[existingIdx].layout_data = params[2];
      } else {
        store.bank_layouts.push(layoutObj);
      }
      saveDatabase();
      return { affectedRows: 1 };
    }

    // --- IMPORTED BASES INSERT/UPDATE ---
    if (normSql.includes('into imported_bases')) {
      const id = params[0];
      const baseObj = {
        id: params[0],
        bankName: params[1],
        fileName: params[2],
        importedAt: params[3],
        importedBy: params[4],
        newCount: params[5],
        dupCount: params[6],
        rawContent: params[7],
        proposalIds: params[8]
      };
      const existingIdx = store.imported_bases.findIndex(b => b.id === id);
      if (existingIdx > -1) {
        store.imported_bases[existingIdx] = baseObj;
      } else {
        store.imported_bases.push(baseObj);
      }
      saveDatabase();
      return { affectedRows: 1 };
    }
  }

  // --- DELETE QUERY ---
  if (normSql.startsWith('delete')) {
    if (normSql.includes('from proposals')) {
      if (normSql.includes('where id = ?')) {
        store.proposals = store.proposals.filter(p => p.id !== params[0]);
      } else {
        store.proposals = [];
      }
    }

    if (normSql.includes('from users')) {
      if (normSql.includes('where id = ?')) {
        store.users = store.users.filter(u => u.id !== params[0]);
      }
    }

    if (normSql.includes('from bank_layouts')) {
      if (normSql.includes('where bank_name = ?')) {
        store.bank_layouts = store.bank_layouts.filter(l => l.bank_name !== params[0]);
      }
    }

    if (normSql.includes('from decision_history')) {
      if (normSql.includes('where id = ?')) {
        store.decision_history = store.decision_history.filter(h => h.id !== params[0]);
      }
    }

    if (normSql.includes('from agenda')) {
      if (normSql.includes('where id = ?')) {
        store.agenda = store.agenda.filter(a => a.id !== params[0]);
      } else {
        store.agenda = [];
      }
    }

    if (normSql.includes('from imported_bases')) {
      if (normSql.includes('where id = ?')) {
        store.imported_bases = store.imported_bases.filter(b => b.id !== params[0]);
      } else {
        store.imported_bases = [];
      }
    }

    if (normSql.includes('from parceiro_usuarios')) {
      if (normSql.includes('where codigo_parceiro = ?')) {
        store.parceiro_usuarios = store.parceiro_usuarios.filter(u => u.codigo_parceiro !== params[0]);
      } else {
        store.parceiro_usuarios = [];
      }
    }

    if (normSql.includes('from partners')) {
      if (normSql.includes('not in')) {
        store.partners = store.partners.filter(p => params.includes(p.codigo_parceiro));
      } else {
        store.partners = [];
      }
    }

    saveDatabase();
    return { affectedRows: 1 };
  }

  return [];
}
