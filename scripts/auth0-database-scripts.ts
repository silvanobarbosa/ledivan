/**
 * Scripts de Custom Database para Auth0 - Ledivan Plus
 *
 * Estes scripts conectam o Auth0 ao banco Neon do Ledivan
 * usando a tabela users existente com bcrypt para senhas.
 *
 * IMPORTANTE:
 * - Estes scripts rodam no ambiente isolado do Auth0 (Webtask)
 * - Módulos disponíveis: pg@8.11.3, bcryptjs@2.4.3
 * - DATABASE_URL deve estar em Configuration (sem exposição no código)
 * - Erros devem usar os construtores específicos do Auth0
 */

/**
 * LOGIN SCRIPT
 *
 * Chamado quando usuário tenta fazer login com email/senha.
 * Deve validar credenciais e retornar perfil do usuário.
 *
 * @param email - Email do usuário
 * @param password - Senha em texto plano
 * @param callback - (error, profile) => void
 */
export const loginScript = `
function login(email, password, callback) {
  const postgres = require('pg@8.11.3');
  const bcrypt = require('bcryptjs@2.4.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) {
      console.error('Database connection error:', err);
      return callback(err);
    }

    const query = 'SELECT id, email, name, image, password_hash, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';

    client.query(query, [email], function(err, result) {
      if (err) {
        console.error('Query error:', err);
        client.end();
        return callback(err);
      }

      if (result.rows.length === 0) {
        client.end();
        return callback(new WrongUsernameOrPasswordError(email));
      }

      const user = result.rows[0];

      // Usuário sem senha configurada (pode ter vindo do Google)
      if (!user.password_hash) {
        client.end();
        return callback(new WrongUsernameOrPasswordError(email));
      }

      bcrypt.compare(password, user.password_hash, function(err, isValid) {
        client.end();

        if (err) {
          console.error('Bcrypt error:', err);
          return callback(err);
        }

        if (!isValid) {
          return callback(new WrongUsernameOrPasswordError(email));
        }

        // Retornar perfil do usuário
        callback(null, {
          user_id: user.id.toString(),
          email: user.email,
          name: user.name || email.split('@')[0],
          picture: user.image || 'https://www.gravatar.com/avatar/' + email,
          // Metadata customizada
          app_metadata: {
            role: user.role || 'user'
          }
        });
      });
    });
  });
}
`;

/**
 * GET USER SCRIPT
 *
 * Chamado para buscar informações de um usuário existente.
 * Usado em cenários como password reset, atualização de perfil, etc.
 *
 * @param email - Email do usuário
 * @param callback - (error, profile) => void
 */
export const getUserScript = `
function getUser(email, callback) {
  const postgres = require('pg@8.11.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) {
      console.error('Database connection error:', err);
      return callback(err);
    }

    const query = 'SELECT id, email, name, image, role, created_at FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';

    client.query(query, [email], function(err, result) {
      client.end();

      if (err) {
        console.error('Query error:', err);
        return callback(err);
      }

      if (result.rows.length === 0) {
        // Usuário não encontrado - retornar null (não é erro)
        return callback(null);
      }

      const user = result.rows[0];

      callback(null, {
        user_id: user.id.toString(),
        email: user.email,
        name: user.name || email.split('@')[0],
        picture: user.image || 'https://www.gravatar.com/avatar/' + email,
        app_metadata: {
          role: user.role || 'user'
        },
        email_verified: true, // Assumir verificado se está no banco
        created_at: user.created_at
      });
    });
  });
}
`;

/**
 * CREATE USER SCRIPT (opcional)
 *
 * Chamado quando um novo usuário se registra.
 * IMPORTANTE: No Ledivan, disable_signup=true na conexão,
 * então este script não será usado (usuários criados via app).
 *
 * Mantido aqui para referência caso seja necessário no futuro.
 */
export const createUserScript = `
function create(user, callback) {
  const postgres = require('pg@8.11.3');
  const bcrypt = require('bcryptjs@2.4.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) {
      console.error('Database connection error:', err);
      return callback(err);
    }

    bcrypt.hash(user.password, 10, function(err, hash) {
      if (err) {
        client.end();
        return callback(err);
      }

      const query = 'INSERT INTO users (email, name, password_hash, role, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, email, name, image';

      client.query(query, [
        user.email.toLowerCase(),
        user.name || user.email.split('@')[0],
        hash,
        'user'
      ], function(err, result) {
        client.end();

        if (err) {
          // Violação de unique constraint (usuário já existe)
          if (err.code === '23505') {
            return callback(new Error('User already exists'));
          }
          console.error('Insert error:', err);
          return callback(err);
        }

        const newUser = result.rows[0];
        callback(null, {
          user_id: newUser.id.toString(),
          email: newUser.email,
          name: newUser.name,
          picture: newUser.image || 'https://www.gravatar.com/avatar/' + newUser.email
        });
      });
    });
  });
}
`;

/**
 * VERIFY EMAIL SCRIPT (opcional)
 *
 * Chamado para marcar email como verificado.
 * No Ledivan, assumimos emails verificados se estão no banco.
 */
export const verifyEmailScript = `
function verify(email, callback) {
  // No Ledivan, emails já estão verificados se estão no banco
  // Este script pode ser usado para atualizar um campo email_verified se necessário
  callback(null, true);
}
`;

/**
 * CHANGE PASSWORD SCRIPT (opcional)
 *
 * Chamado quando usuário solicita mudança de senha.
 */
export const changePasswordScript = `
function changePassword(email, newPassword, callback) {
  const postgres = require('pg@8.11.3');
  const bcrypt = require('bcryptjs@2.4.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) {
      console.error('Database connection error:', err);
      return callback(err);
    }

    bcrypt.hash(newPassword, 10, function(err, hash) {
      if (err) {
        client.end();
        return callback(err);
      }

      const query = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)';

      client.query(query, [hash, email], function(err, result) {
        client.end();

        if (err) {
          console.error('Update error:', err);
          return callback(err);
        }

        if (result.rowCount === 0) {
          return callback(new Error('User not found'));
        }

        callback(null, true);
      });
    });
  });
}
`;

/**
 * DELETE USER SCRIPT (opcional)
 *
 * Chamado quando usuário é deletado do Auth0.
 * Por questões de LGPD, pode ser necessário remover dados pessoais.
 */
export const deleteUserScript = `
function remove(id, callback) {
  const postgres = require('pg@8.11.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) {
      console.error('Database connection error:', err);
      return callback(err);
    }

    // LGPD: Anonimizar ou deletar dados do usuário
    const query = 'UPDATE users SET email = $1, name = $2, password_hash = NULL, image = NULL, updated_at = NOW() WHERE id = $3';

    client.query(query, [
      'deleted_' + id + '@deleted.local',
      'Usuário Removido',
      parseInt(id, 10)
    ], function(err, result) {
      client.end();

      if (err) {
        console.error('Delete error:', err);
        return callback(err);
      }

      callback(null);
    });
  });
}
`;

console.log("Scripts de Custom Database para Auth0 - Ledivan Plus");
console.log("\nPara usar:");
console.log("1. Acesse Auth0 Dashboard > Authentication > Database > ledivan-db");
console.log("2. Aba 'Custom Database' > Enable 'Use my own database'");
console.log("3. Cole os scripts nos campos correspondentes:");
console.log("   - Login Script");
console.log("   - Get User Script");
console.log("   - Create Script (opcional, signup desabilitado)");
console.log("   - Verify Script (opcional)");
console.log("   - Change Password Script (opcional)");
console.log("   - Delete Script (opcional, LGPD)");
console.log("\n4. Em Settings > Configuration, adicione:");
console.log("   DATABASE_URL: <sua connection string do Neon>");
