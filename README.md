# Open UI Code Code

**Agentes, cloud e ferramentas de desenvolvimento em um só espaço.**

O Open UI Code Code é um workspace para organizar tarefas de desenvolvimento, modelos de IA, skills, projetos ZIP, integrações e fluxos de trabalho. A proposta é reduzir a complexidade de quem está começando a trabalhar com agentes e ferramentas modernas.

## O que existe nesta versão

- Interface web responsiva em tema escuro com detalhes em laranja.
- Chat de desenvolvimento com seleção de modelos.
- Catálogo de modelos e integração com 9Router.
- Integração server-side com Groq quando configurada.
- Biblioteca de skills com carregamento progressivo.
- Análise de arquivos ZIP e fluxo de atualização de projetos.
- Preparação e publicação de projetos no GitHub.
- Referência e documentação de economia de contexto.
- API de saúde para diagnóstico básico.

## Princípios do produto

- O usuário final não deve precisar cadastrar chaves pessoais de provedores de IA.
- Credenciais de provedores ficam exclusivamente no ambiente seguro do servidor.
- Integrações de contas devem usar OAuth, GitHub App ou mecanismos oficiais quando implementados e configurados.
- A interface não deve anunciar funcionalidades que ainda não estejam implementadas.
- Serviços gratuitos e cotas promocionais estão sujeitos a limites, disponibilidade e termos de cada fornecedor.
- Nenhuma marca exibida na vitrine implica parceria, patrocínio ou endosso.

## Requisitos

- Node.js 20 ou superior (recomendado).
- Um ambiente para executar Next.js.
- Um serviço de modelos configurado no servidor: 9Router, Groq ou o motor de execução compatível utilizado por esta instalação.

## Instalação local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Consulte `.env.example`. Configure apenas no servidor:

- `APP_ACCESS_TOKEN`: token administrativo exigido pelo endpoint de gestão de provedores; não substitui autenticação completa de usuários.
- `GROQ_API_KEY`: credencial administrada pela plataforma para o fallback Groq.
- `NINEROUTER_BASE_URL`, `NINEROUTER_API_KEY`, `NINEROUTER_DEFAULT_COMBO`: gateway compartilhado de modelos.
- `EXECUTOR_SERVER_URL`, `EXECUTOR_SERVER_PASSWORD`: endpoint privado do motor de execução já utilizado pela aplicação.
- `GITHUB_TOKEN`: credencial administrativa para publicação no GitHub.
- `GITHUB_PUBLISH_ENABLED`: precisa ser `true` para liberar o endpoint de publicação; mantenha `false` até existir autenticação/autorização por usuário na aplicação.
- Variáveis `S3_*`: armazenamento compatível com S3, quando configurado.

**Não coloque segredos em variáveis `NEXT_PUBLIC_*`, no código-fonte ou no navegador.** Não compartilhe o mesmo ambiente de credenciais entre usuários sem implementar isolamento, autorização e limites por conta.

## Conectores e disponibilidade

A vitrine apresenta fornecedores e tecnologias relevantes para o ecossistema. Exibir uma marca não significa que a integração esteja ativa. A disponibilidade efetiva depende da configuração server-side e dos fluxos de autorização implementados.

A integração GitHub nesta versão usa credencial administrativa server-side (`GITHUB_TOKEN`) para publicação. Ela não representa OAuth individual por usuário. Não solicite nem armazene tokens pessoais no navegador.

## Segurança e operação

- Não exponha o endpoint do motor de execução ou o painel administrativo do 9Router diretamente à internet.
- Use HTTPS e rede privada entre serviços sempre que possível.
- A aplicação ainda não possui autenticação completa de usuários, isolamento de credenciais nem cotas individuais. Não disponibilize a instância publicamente como serviço multiusuário nem habilite `GITHUB_PUBLISH_ENABLED` antes de implementar e testar essas proteções.
- Defina cotas e limites de uso por usuário antes de oferecer modelos compartilhados.
- Revise permissões de publicação do GitHub e use o menor escopo possível.
- A função serverless atual limita arquivos e duração de execução; projetos grandes precisam de executor persistente e armazenamento de artefatos.

## Verificações

```bash
npm run lint
npm run build
```

A execução desses comandos deve ser registrada no relatório de entrega. A documentação não afirma que testes foram executados quando não foram.

## Marcas e componentes de terceiros

Consulte [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) e [`UPSTREAMS.md`](./UPSTREAMS.md) para avisos de licença, atribuições e dependências técnicas.
