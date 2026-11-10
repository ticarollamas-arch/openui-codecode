# OpenUI Code Code

> Interface Web moderna, rápida e intuitiva desenvolvida para o ecossistema de desenvolvimento e execução aberta **OpenCode**.

Repositório Oficial do OpenUI Code Code: [OpenUI Code Code](https://github.com/ticarollamas-arch/opencode-workspace-vercel)

---

## ⭐️ Créditos e Reconhecimento ao OpenCode

O **OpenUI Code Code** é uma interface visual projetada para operar em sinergia com o motor oficial de execução de código aberto **OpenCode**.

- **Projeto Open Source de Origem**: [OpenCode no GitHub](https://github.com/opencode-ai/opencode) (`github.com/OpenCode`)
- **SDK Oficial**: `@opencode-ai/sdk`
- **Reconhecimento**: Todos os créditos do motor de execução, arquitetura de agente e execução de código são atribuídos aos criadores e mantenedores do projeto open source **OpenCode**. O OpenUI Code Code atua exclusivamente como camada de interface web (Web UI) proporcionando uma experiência de desenvolvimento rica, visual e com suporte a chaves próprias de API.

---

## 🚀 Funcionalidades Principais do OpenUI Code Code

1. **Paleta Oficial OpenCode Dark**:
   - Design moderno em tema escuro baseado na identidade visual do OpenCode (painéis elegantes, tons profundos de grafite e detalhes em laranja/âmbar característicos).
   
2. **Navegação com Menu Hambúrguer (Drawer)**:
   - A lateral fixa foi substituída por um menu hambúrguer compacto e acessível, liberando 100% da área útil da tela para escrita de código e conversa com o executor.

3. **Página de Apresentação Integrada**:
   - Visão geral completa sobre o **OpenUI Code Code**, com atalhos rápidos e direcionamento aos créditos do **OpenCode**.

4. **Gerenciamento de Chaves de API no Painel (BYOK - Bring Your Own Key)**:
   - Os usuários podem inserir suas próprias chaves de API (OpenAI, Anthropic, Google Gemini, GitHub e OpenCode Server) diretamente no painel de configurações no rodapé da aplicação.
   - Cada desenvolvedor utiliza suas próprias credenciais com total privacidade e armazenamento local seguro no navegador (`localStorage`).

5. **Autenticação Direta no GitHub (PAT Simplificado)**:
   - Conexão fácil com um clique: gere um token pessoal único no GitHub e conecte imediatamente sem precisar cadastrar aplicações OAuth, Client ID ou Client Secret.

6. **ZipToGit & Biblioteca de Skills**:
   - Envio de projetos compactados diretamente para repositórios do GitHub.
   - Detecção de habilidades modulares (`SKILL.md`) para orientar fluxos de trabalho especializados.

---

## 🛠️ Como Executar Localmente

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar variáveis de ambiente (opcional, pois você pode configurar as chaves direto na interface)
cp .env.example .env.local

# 3. Iniciar o servidor de desenvolvimento
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para utilizar o **OpenUI Code Code**.

---

## 📄 Licença e Atribuição

Este projeto é disponibilizado sob os princípios de código aberto, respeitando as diretrizes do ecossistema [OpenCode](https://github.com/opencode-ai/opencode).


## Atualização visual e responsiva

A interface foi refinada para telas estreitas, largas e orientação vertical, com ajustes fluidos de espaçamento, tipografia e grades. A página de apresentação inclui agora links para GitHub e Instagram, uma vitrine animada de tecnologias e informações sobre a proposta do projeto e futuras demonstrações em vídeo. As etiquetas de categoria das skills passaram a usar estilo neutro, sem os antigos fundos verdes.


## Catálogo dinâmico de provedores e modelos

A Central de modelos consulta o endpoint oficial `GET /provider` do servidor OpenCode conectado. Assim, a lista acompanha os provedores e modelos que a versão instalada do OpenCode disponibiliza, em vez de depender de uma lista fixa no frontend.

- Busca por nome de provedor, nome de modelo ou ID.
- Exibe modelos gratuitos quando o catálogo do OpenCode informa preço de entrada zero; a disponibilidade e as condições podem mudar.
- Permite conectar provedores por API key usando `PUT /auth/:id` no servidor OpenCode. A credencial é enviada ao servidor e armazenada pelo mecanismo de autenticação do OpenCode, não no `localStorage` do navegador. No modo atual, o servidor OpenCode é compartilhado; portanto, não habilite conexão de provedores para usuários públicos sem implementar isolamento de credenciais por usuário (instância ou cofre separado).
- O modelo selecionado é enviado como `providerID/modelID` ao SDK.
- OAuth, autenticações com formulários especiais e provedores que exigem variáveis de ambiente ainda podem precisar do fluxo nativo `/connect` ou da configuração do servidor.

**Limites e cobrança:** o OpenUI Code Code não impõe cotas próprias de tokens. O uso continua sujeito aos créditos, planos, limites, rate limits e termos do provedor. Código aberto não significa APIs pagas ilimitadas.

### Referência de economia de tokens

A página de apresentação inclui [RTK — Rust Token Killer](https://github.com/rtk-ai/rtk), ferramenta open source que filtra e compacta saídas de comandos antes que cheguem ao contexto do modelo e oferece integração com OpenCode. É uma referência relevante de economia de tokens; não afirmamos que seja necessariamente o repositório citado pelo criador de conteúdo do Instagram. Para confirmar o projeto exato, precisamos do perfil ou vídeo original.

### Configuração do servidor OpenCode

Defina `OPENCODE_SERVER_URL` para o endereço do servidor OpenCode acessível pelo backend Next.js e, se necessário, `OPENCODE_SERVER_PASSWORD`. O servidor precisa estar ativo e protegido adequadamente. Não exponha a porta do OpenCode publicamente sem autenticação e regras de rede.

## Agente de projetos e entrega ZIP

O chat separa conversa comum de tarefas de projeto. Pedidos de criação/alteração de projeto e anexos ZIP são encaminhados a `POST /api/workspace`.

- **Criar do zero:** a IA retorna um manifesto estruturado de arquivos; o backend valida caminhos, monta a árvore com JSZip e entrega um ZIP para download.
- **Atualizar projeto:** o ZIP de origem é analisado; arquivos seguros e não modificados são preservados, enquanto os arquivos retornados pela IA substituem ou complementam a árvore. A conversa mantém o último ZIP gerado durante a sessão do navegador para revisões subsequentes.
- **README:** a geração solicita documentação de instalação, execução e configuração. Se nenhum README for produzido, o servidor inclui um README básico.
- **Entrega compacta:** a conversa exibe um resumo e um botão de download, não despeja o código integral no histórico.
- **Fila de tarefas:** novas instruções enviadas durante uma execução são enfileiradas e processadas em sequência; não abortam a tarefa atual.
- **Engenharia reversa:** a análise técnica do ZIP é seguida pelo envio do próprio arquivo ao agente de projetos. A recriação deve ser autorizada e independente; não copia código proprietário nem remove marcas d'água para ocultar autoria.
- **Segurança:** `.env`, chaves, credenciais, `.git`, `node_modules` e artefatos de build são excluídos do contexto/ZIP. `.env.example` é permitido.

### Provedores do agente

Quando `OPENCODE_SERVER_URL` (e opcionalmente `OPENCODE_SERVER_PASSWORD`) estiver configurado, a geração usa a sessão e o modelo selecionado no servidor OpenCode. Sem servidor OpenCode, a geração utiliza Groq e requer `GROQ_API_KEY` no ambiente ou uma chave informada pelo usuário. Modelos/provedores selecionados fora da Groq exigem o servidor OpenCode conectado.

### Limites da implantação Vercel

Esta versão serverless limita ZIP de entrada e saída a 3 MB para respeitar limites de payload da plataforma. A função tem duração máxima configurada de 60 segundos. Projetos maiores ou execuções longas precisam de executor persistente em VPS e armazenamento de artefatos (por exemplo, S3 compatível). O backend não afirma que executou `npm install`, build ou testes; o resultado informa explicitamente quando essas verificações não foram executadas.

## 9Router — catálogo sincronizado, Start e fallback automático

O OpenUI Code Code integra o [9Router](https://github.com/decolua/9router) como gateway compartilhado OpenAI-compatible. A Central de modelos possui **Carregar modelos**, **Sincronizar 9Router** e **Start 9Router**. Ao iniciar, o backend verifica `/health`, sincroniza `/v1/models` e seleciona o combo padrão definido pela administração. As mensagens do chat e a geração/atualização de projetos ZIP são encaminhadas para `/v1/chat/completions`; o 9Router executa a estratégia de fallback/rotação configurada nesse combo.

### Configuração obrigatória no servidor

1. Instale e execute o 9Router no mesmo VPS/rede privada do Next.js (porta padrão `20128`). Consulte a documentação oficial do projeto para instalação e atualização.
2. No painel do 9Router, conecte os provedores/contas que a administração disponibilizará aos usuários. Use os fluxos OAuth oficiais ou credenciais autorizadas. Crie um combo em **Dashboard → Combos**, por exemplo `openui-coding`, com os modelos em ordem de prioridade e estratégia `Fallback` ou `Round Robin`. O nome precisa aparecer em `GET /v1/models`.
3. Crie uma chave de acesso do próprio 9Router para o OpenUI Code Code. Mantenha o serviço em `127.0.0.1` ou rede privada; não exponha a porta de administração diretamente à internet.
4. Configure no ambiente server-side do Next.js/Vercel/VPS:

```env
NINEROUTER_BASE_URL=http://127.0.0.1:20128
NINEROUTER_API_KEY=sua-chave-de-acesso-do-9router
NINEROUTER_DEFAULT_COMBO=openui-coding
```

Se Next.js e 9Router estiverem em containers separados, use o hostname interno do serviço Docker, não `127.0.0.1`. **Se a interface estiver na Vercel e o 9Router no VPS**, `127.0.0.1` aponta para a própria infraestrutura da Vercel, não para seu VPS: configure um subdomínio HTTPS do VPS e use-o em `NINEROUTER_BASE_URL` (por exemplo, `https://router-api.cyberhuntlab.com.br`). Há um exemplo em `deploy/nginx-9router-api.conf.example` que publica somente `/v1/*` e `/health`, bloqueando o dashboard e as rotas administrativas. Mantenha o 9Router escutando em `127.0.0.1:20128` e proteja a API com a chave server-side.

### Como o usuário utiliza

- Abre **Configurações → Central de modelos**.
- Clica em **Carregar modelos** ou **Sincronizar 9Router**.
- Clica em **Start 9Router**; o app verifica o serviço e seleciona o combo `NINEROUTER_DEFAULT_COMBO`, que faz o fallback/rotação configurado.
- Não precisa inserir a própria API key: o backend usa a chave do roteador, guardada somente nas variáveis de ambiente do servidor.

**Importante:** isso é uma integração compartilhada administrada pelo dono do serviço. As contas/provedores do 9Router precisam ser conectados e mantidos pela administração. A rotação pode continuar em outro provedor quando houver cota disponível, mas não cria tokens ilimitados nem garante disponibilidade permanente. A elegibilidade, cotas, autenticação, termos e cobrança continuam sendo definidos por cada provedor. Nunca compartilhe uma chave administrativa do 9Router no navegador.

## Central de Conectores — OpenConnector

A interface inclui uma Central de Conectores integrada ao runtime [OpenConnector da OOMOL](https://github.com/oomol-lab/open-connector), cujo catálogo anuncia 1.000+ provedores e 10.000+ ações. O Next.js consulta o catálogo e as ações pelo backend (`/api/connectors`); o token administrativo permanece no ambiente server-side.

Para instalar o runtime no VPS, configurar HTTPS, DNS e as variáveis da Vercel, siga [`deploy/OPENCONNECTOR.md`](deploy/OPENCONNECTOR.md). Os arquivos de implantação ficam em `deploy/docker-compose.openconnector.yml`, `deploy/openconnector.env.example` e `deploy/nginx-openconnector.conf.example`.

**Limitação de segurança desta etapa:** a Central permite explorar provedores e ações, mas não habilita o fluxo público de OAuth individual por cliente. O projeto ainda precisa de autenticação multiusuário, conexões nomeadas por usuário e runtime tokens com permissões restritas antes de permitir que clientes finais conectem suas contas. Não reutilize uma conexão global entre clientes. Confira também a licença comercial vigente do OpenConnector antes de oferecer o gateway como serviço gerenciado.
