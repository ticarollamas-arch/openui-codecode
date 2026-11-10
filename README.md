# Web UI CodeCode

> Interface Web moderna, rápida e intuitiva desenvolvida para o ecossistema de desenvolvimento e execução aberta **OpenCode**.

Repositório Oficial do CodeCode: [Web UI CodeCode](https://github.com/ticarollamas-arch/opencode-workspace-vercel)

---

## ⭐️ Créditos e Reconhecimento ao OpenCode

O **Web UI CodeCode** é uma interface visual projetada para operar em sinergia com o motor oficial de execução de código aberto **OpenCode**.

- **Projeto Open Source de Origem**: [OpenCode no GitHub](https://github.com/opencode-ai/opencode) (`github.com/OpenCode`)
- **SDK Oficial**: `@opencode-ai/sdk`
- **Reconhecimento**: Todos os créditos do motor de execução, arquitetura de agente e execução de código são atribuídos aos criadores e mantenedores do projeto open source **OpenCode**. O CodeCode atua exclusivamente como camada de interface web (Web UI) proporcionando uma experiência de desenvolvimento rica, visual e com suporte a chaves próprias de API.

---

## 🚀 Funcionalidades Principais do Web UI CodeCode

1. **Paleta Oficial OpenCode Dark**:
   - Design moderno em tema escuro baseado na identidade visual do OpenCode (painéis elegantes, tons profundos de grafite e detalhes em laranja/âmbar característicos).
   
2. **Navegação com Menu Hambúrguer (Drawer)**:
   - A lateral fixa foi substituída por um menu hambúrguer compacto e acessível, liberando 100% da área útil da tela para escrita de código e conversa com o executor.

3. **Página de Apresentação Integrada**:
   - Visão geral completa sobre o **Web UI CodeCode**, com atalhos rápidos e direcionamento aos créditos do **OpenCode**.

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

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para utilizar o **Web UI CodeCode**.

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

**Limites e cobrança:** o CodeCode não impõe cotas próprias de tokens. O uso continua sujeito aos créditos, planos, limites, rate limits e termos do provedor. Código aberto não significa APIs pagas ilimitadas.

### Referência de economia de tokens

A página de apresentação inclui [RTK — Rust Token Killer](https://github.com/rtk-ai/rtk), ferramenta open source que filtra e compacta saídas de comandos antes que cheguem ao contexto do modelo e oferece integração com OpenCode. É uma referência relevante de economia de tokens; não afirmamos que seja necessariamente o repositório citado pelo criador de conteúdo do Instagram. Para confirmar o projeto exato, precisamos do perfil ou vídeo original.

### Configuração do servidor OpenCode

Defina `OPENCODE_SERVER_URL` para o endereço do servidor OpenCode acessível pelo backend Next.js e, se necessário, `OPENCODE_SERVER_PASSWORD`. O servidor precisa estar ativo e protegido adequadamente. Não exponha a porta do OpenCode publicamente sem autenticação e regras de rede.
