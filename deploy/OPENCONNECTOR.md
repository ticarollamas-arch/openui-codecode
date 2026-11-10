# OpenConnector no OpenCodeLab

Esta pasta adiciona a Central de Conectores à interface Next.js e prepara o runtime OpenConnector para execução no VPS. O catálogo é consultado pelo backend; o token administrativo não é enviado ao navegador.

## O que foi integrado no site

- Nova aba **Central de Conectores** no menu desktop e mobile.
- Consulta do catálogo do runtime por `GET /api/providers`.
- Busca de ações e inspeção das ações por aplicativo.
- API intermediária Next.js em `GET /api/connectors`.
- URL do console configurável por `OPENCONNECTOR_CONSOLE_URL`.
- Modelo de configuração MCP remoto para o OpenCode em `opencode.json` (desativado por padrão até existir isolamento por usuário).

O runtime OpenConnector publica ações por MCP, HTTP e OpenAPI. O catálogo oficial anuncia mais de 1.000 provedores e 10.000 ações, mas a lista efetivamente disponível depende da versão e dos executores instalados no runtime.

## 1. Instalar no VPS

Requisitos: Docker Engine com Docker Compose e um domínio/subdomínio apontado para o IPv4 público do VPS.

```bash
mkdir -p /opt/opencodelab-connectors
cd /opt/opencodelab-connectors
```

Copie `deploy/docker-compose.openconnector.yml` para esta pasta como `docker-compose.yml` e `deploy/openconnector.env.example` como `openconnector.env`.

Gere dois segredos fortes no VPS:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use o primeiro em `OOMOL_CONNECT_ADMIN_TOKEN` e o segundo em `OOMOL_CONNECT_ENCRYPTION_KEY`. Edite `openconnector.env` e troque o domínio de exemplo pelo domínio real, por exemplo `https://connect.seudominio.com.br`.

Suba o serviço:

```bash
docker compose up -d

docker compose logs -f openconnector
```

O serviço escuta somente em `127.0.0.1:30100`. Não abra essa porta diretamente na firewall.

## 2. Publicar por HTTPS

Configure um registro DNS `A` para `connect.seudominio.com.br` apontando para o IPv4 público do VPS. Instale o certificado TLS e adapte `deploy/nginx-openconnector.conf.example` ao Nginx do servidor.

O endereço público precisa corresponder exatamente a `OOMOL_CONNECT_ORIGIN`. O callback OAuth dos provedores usa esse domínio e o caminho `/oauth/callback`.

## 3. Configurar a Vercel

No projeto da Vercel, em **Settings → Environment Variables**, configure estas variáveis server-side:

```env
OPENCONNECTOR_BASE_URL=https://connect.seudominio.com.br
OPENCONNECTOR_ADMIN_TOKEN=O_MESMO_TOKEN_ADMIN_DO_VPS
OPENCONNECTOR_CONSOLE_URL=https://connect.seudominio.com.br
OPENCONNECTOR_MCP_URL=https://connect.seudominio.com.br/mcp
OPENCONNECTOR_RUNTIME_TOKEN=TOKEN_RUNTIME_RESTRITO
```

Não use prefixo `NEXT_PUBLIC_` nessas variáveis. Faça um novo deploy depois de salvar.

## 4. Configurar provedores OAuth

No runtime auto-hospedado, muitos provedores OAuth exigem que o administrador crie um OAuth App no próprio serviço (Google, Slack, GitHub etc.), configure o callback exato e cadastre Client ID/Client Secret no console do OpenConnector. A autorização do usuário acontece depois disso.

A lista de provedores não significa que todas as integrações estejam prontas para uso sem configuração: provedores podem exigir OAuth próprio, API key, escopos e permissões.

## 5. Disponibilizar as ações ao OpenCode via MCP

O `opencode.json` contém um servidor MCP remoto chamado `openconnector`, desativado por padrão (`enabled: false`). Quando houver um runtime token apropriado, configure `OPENCONNECTOR_MCP_URL` e `OPENCONNECTOR_RUNTIME_TOKEN` no ambiente do processo OpenCode e habilite `mcp.openconnector.enabled` na configuração carregada pelo servidor OpenCode. O endpoint MCP é `/mcp`.

O OpenCode descobre as ferramentas MCP e as disponibiliza ao agente. Não habilite um token irrestrito compartilhado em sessões públicas: ele pode conceder acesso às mesmas conexões e ações para todos os usuários do servidor.

## 6. Isolamento de clientes — obrigatório antes de abrir conexões ao público

Esta entrega integra o catálogo e a descoberta de ações, mas **não habilita ainda o fluxo público de conexão OAuth por cliente**. O projeto atual não possui autenticação multiusuário nem identidade persistente confiável. Conectar contas de clientes em uma conexão global compartilhada poderia expor dados de uma conta a outros usuários.

Antes de liberar o botão “Conectar minha conta” para todos:

1. Implementar autenticação de usuários e sessões no OpenCodeLab.
2. Criar uma conexão OpenConnector nomeada e exclusiva para cada usuário/tenant.
3. Emitir runtime tokens com grants restritos às conexões e ações necessárias.
4. Validar o usuário no callback OAuth e impedir que o navegador escolha o alias de outra pessoa.
5. Guardar tokens apenas no runtime e criptografar o armazenamento persistente.

Até essa etapa, o console é administrativo. Não compartilhe conexões de produção entre clientes.

## 7. Licença e uso comercial

Confira a licença e a versão exata do OpenConnector antes de vender uma implantação gerenciada. A documentação atual descreve condições adicionais para oferecer o próprio gateway/conector como serviço gerenciado a terceiros; o uso embarcado em um produto cujo valor principal é outro pode ter tratamento diferente. Se a função principal do OpenCodeLab passar a ser vender acesso ao gateway de conectores, obtenha orientação/licença comercial da OOMOL. Verifique também os termos e marcas de cada provedor.

Referências:

- https://github.com/oomol-lab/open-connector
- https://openconnector.io/docs/
- https://openconnector.io/docs/authentication/
- https://oomol.com/docs/openconnector-self-hosting/
