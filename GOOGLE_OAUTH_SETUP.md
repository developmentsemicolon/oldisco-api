# Configuração do Google OAuth e Autenticação Admin

## Variáveis de Ambiente Necessárias

No arquivo `.env` da API (pasta `api/`), configure todas as seguintes variáveis:

```env
# Porta da API (padrão: 3001)
PORT=3001

# URL do Frontend (usado para redirecionamentos após OAuth)
FRONTEND_URL=http://localhost:3000

# JWT Secret (obrigatório para autenticação)
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=7d

# Google OAuth - IMPORTANTE: usar porta da API (3001), não do frontend!
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Database (PostgreSQL)
DATABASE_URL=postgresql://usuario:senha@localhost:5432/demotapesdodemo

# Cloudflare R2 (para armazenamento de arquivos de áudio)
R2_ACCOUNT_ID=seu_account_id
R2_ACCESS_KEY_ID=seu_access_key
R2_SECRET_ACCESS_KEY=seu_secret_key
R2_BUCKET_NAME=demotapes-radio
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
```

### Configuração no Google Cloud Console

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Selecione seu projeto
3. Edite as credenciais OAuth 2.0
4. Em "Authorized redirect URIs", adicione:
   ```
   http://localhost:3001/auth/google/callback
   ```

**IMPORTANTE**: A URL deve apontar para a porta da API (3001), não do frontend (3000)!

### ⚠️ Resolvendo o Erro "redirect_uri_mismatch"

Se você receber o erro `redirect_uri_mismatch` do Google, significa que o `GOOGLE_CALLBACK_URL` no arquivo `.env` **não corresponde exatamente** ao configurado no Google Cloud Console.

**A correspondência deve ser EXATA, incluindo:**
- ✅ Protocolo: `http://` (desenvolvimento) ou `https://` (produção)
- ✅ Domínio: `localhost` (desenvolvimento) ou seu domínio (produção)
- ✅ Porta: `3001` (porta da API, não do frontend)
- ✅ Caminho: `/auth/google/callback` (sem barra final)
- ✅ Sem espaços ou caracteres extras

**Exemplo correto para desenvolvimento:**
```
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

**No Google Cloud Console, adicione exatamente:**
```
http://localhost:3001/auth/google/callback
```

**Erros comuns que causam o problema:**
- ❌ `http://localhost:3000/auth/google/callback` (porta errada - frontend)
- ❌ `http://localhost:3001/auth/google/callback/` (barra final)
- ❌ `https://localhost:3001/auth/google/callback` (https em localhost)
- ❌ Espaços ou quebras de linha no valor da variável

## Fluxo Correto

1. Frontend (porta 3000) → redireciona para `http://localhost:3001/auth/google`
2. API (porta 3001) → redireciona para Google OAuth
3. Google → redireciona para `http://localhost:3001/auth/google/callback` (API)
4. API → processa e redireciona para `http://localhost:3000/auth/callback` (Frontend)

## Verificação

Para testar se a configuração está correta:

```bash
# Testar endpoint de início do OAuth
curl http://localhost:3001/auth/google

# Deve redirecionar para Google (não retornar 404)
```

### Checklist de Validação

Antes de testar o login com Google, verifique:

1. ✅ **Arquivo `.env` na pasta `api/` existe e contém:**
   - `GOOGLE_CLIENT_ID` preenchido com seu Client ID
   - `GOOGLE_CLIENT_SECRET` preenchido com seu Client Secret
   - `GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback` (exatamente assim, sem barra final)
   - `FRONTEND_URL=http://localhost:3000` (URL do frontend)
   - `PORT=3001` (porta da API)

2. ✅ **Google Cloud Console configurado:**
   - Credenciais OAuth 2.0 criadas
   - "Authorized redirect URIs" contém exatamente: `http://localhost:3001/auth/google/callback`
   - Client ID e Client Secret copiados para o `.env`

3. ✅ **Correspondência exata:**
   - O valor de `GOOGLE_CALLBACK_URL` no `.env` deve ser **idêntico** ao URI em "Authorized redirect URIs" no Google Cloud Console
   - Sem diferenças de maiúsculas/minúsculas, espaços, barras finais ou protocolos

4. ✅ **API rodando:**
   - API iniciada na porta 3001
   - Frontend rodando na porta 3000
   - Nenhum erro ao iniciar a API relacionado a variáveis de ambiente faltando

## Como Obter as Credenciais do Google OAuth

1. Acesse: https://console.cloud.google.com/
2. Crie um novo projeto ou selecione um existente
3. Vá em "APIs & Services" > "Credentials"
4. Clique em "Create Credentials" > "OAuth client ID"
5. Configure:
   - Application type: Web application
   - Name: Demo Tapes API (ou qualquer nome)
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback` (desenvolvimento)
   - Para produção: `https://sua-api.com/auth/google/callback`
6. Copie o Client ID e Client Secret para o `.env`

## Como Criar Usuário Admin

Para criar um usuário admin, você pode:

1. **Via seed do Prisma** (recomendado):
   ```bash
   cd api
   npm run seed
   ```
   Isso criará um usuário admin com:
   - Email: `admin@demotapes.com`
   - Senha: `admin123`
   - Role: `ADMIN`

2. **Via registro e atualização manual**:
   - Registre um usuário normalmente
   - No banco de dados, atualize o campo `role` para `ADMIN`:
     ```sql
     UPDATE users SET role = 'ADMIN' WHERE email = 'seu@email.com';
     ```

## Notas Importantes

- A API roda na porta 3001 por padrão (conforme `main.ts`)
- O frontend roda na porta 3000
- O callback do Google deve sempre apontar para a API, não para o frontend
- Após processar o callback, a API redireciona para o frontend com os dados na URL
- O `JWT_SECRET` deve ser uma string longa e aleatória (use `openssl rand -base64 32` para gerar)
- Para produção, atualize `FRONTEND_URL` e `GOOGLE_CALLBACK_URL` com as URLs reais

### Estrutura do Arquivo `.env` (Linhas 7-12)

As linhas 7-12 do arquivo `.env` devem conter exatamente:

```env
# Porta da API (padrão: 3001)
PORT=3001

# URL do Frontend (usado para redirecionamentos após OAuth)
FRONTEND_URL=http://localhost:3000
```

**Importante:** Mantenha essa estrutura exata para evitar problemas de configuração.

