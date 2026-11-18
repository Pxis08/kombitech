# KombiTech

**Rastreamento inteligente, do primeiro aluno até a escola.**

Plataforma web de gestão e acompanhamento de transporte escolar para motoristas de perua (kombi) e famílias. O motorista organiza alunos e rotas, acompanha o mapa ao vivo, confirma embarques e entregas e envia avisos. A **rota da manhã** leva os alunos de casa à escola; a **rota da tarde** parte da escola e entrega cada aluno na residência, com confirmação individual do motorista. O responsável acompanha o filho, conversa com o motorista e recebe notificações de embarque, chegada, mudança de rota, risco na via e troca de van — cada perfil vê apenas o que lhe pertence.

> **Ambiente de demonstração.** Alunos, escola, histórico e mensagens são fictícios. A localização da perua é **simulada** e sempre sinalizada como “Demonstração” na interface. Nenhuma posição simulada é apresentada como GPS real.

---

## 1. Como executar

Não há build, dependências ou instalação. O projeto é 100% estático.

1. Abra `index.html` no navegador (duplo clique) **ou** sirva a pasta com qualquer servidor estático:
   ```bash
   # opcional, se tiver Python instalado
   python -m http.server 8080
   # depois acesse http://localhost:8080
   ```
2. Escolha o perfil de acesso na tela de login e entre com uma das contas demo:

   | Perfil | E-mail | Senha | Vínculo |
   |---|---|---|---|
   | Motorista | `motorista@kombitech.app` | `kombi1234` | Carlos Menezes |
   | Responsável | `responsavel@kombitech.app` | `kombi1234` | Mariana Souza · Ana Beatriz Souza |
   | Primeiro acesso (demo) | `rafael.rocha@kombitech.app` | — (conta inativa) | Rafael Rocha · Sofia Almeida Rocha |

   Também é possível clicar em **Entrar como motorista (demo)** ou **Entrar como responsável (demo)**. O login valida o perfil escolhido: uma conta de responsável não entra na aba do motorista e vice-versa.

   Para testar o **primeiro acesso**, use `rafael.rocha@kombitech.app` e o código individual **`KT-SOFIA-4821`** em **Primeiro acesso? Ative sua conta**. O código é de uso único; ao gerar um novo código em **Alunos**, o anterior deixa de valer. A **recuperação de senha** também é simulada: o código temporário aparece na própria tela, a senha anterior é invalidada e nenhum e-mail é realmente enviado.

**Internet:** o mapa usa a **Google Maps JavaScript API** (chave configurada em `assets/js/config.js`). As rotas usam OSRM público e a geocodificação usa Nominatim. Sem conexão, ou se o Google Maps falhar por restrição de chave/billing, o app cai automaticamente em um mapa esquemático em SVG e calcula a rota por linha direta entre as paradas — todas as funções continuam operando.

**Navegadores:** Chrome, Edge, Firefox e Safari recentes. O GPS real exige HTTPS ou `localhost` (restrição dos navegadores).

---

## 2. Perfis de acesso

### Motorista
Navegação com **Início, Alunos, Rotas, Mapa, Mensagens, Calendário, Relatórios, Configurações e Perfil**. O motorista é o único que inicia/encerra rotas, altera a ordem das paradas e edita dados de alunos, van e integrações.

### Responsável
Navegação própria com **Início, Mapa, Notificações, Mensagens e Perfil**. O responsável vê somente o(s) aluno(s) vinculado(s) à sua conta, o status da van, o histórico de avisos e o canal direto com o motorista. Não há acesso a relatórios, configurações técnicas, dados de outros alunos ou localização pública.

---

## 3. Funcionalidades

### Login e segurança
- Autenticação local com senha derivada por SHA-256 (Web Crypto).
- Separação explícita entre **motorista** e **responsável**, com validação de perfil no login.
- Sessão com expiração (8 h por padrão) e bloqueio por inatividade (30 min).
- Consentimento LGPD obrigatório no login, com modal explicativo.
- **Primeiro acesso do responsável:** e-mail + código individual de uso único; o próprio responsável cria a senha. Contas ainda não ativadas não conseguem entrar.
- **Recuperação de senha do responsável:** resposta neutra (não revela se a conta existe), código temporário de uso único, invalidação da senha anterior e simulação explícita de envio.
- Botão de mostrar/ocultar senha nos formulários de login, ativação e recuperação.
- Nenhuma senha armazenada é exibida na interface; os códigos de ativação/recuperação da demonstração aparecem apenas como simulação local.
- Contatos mascarados por padrão e acesso restrito ao painel autenticado.
- Sessão do responsável vinculada a `guardianId`; o motorista usa a sessão de `db.auth`.

### Início (motorista)
- Saudação contextual, data e frase de destaque.
- Cartões: total de alunos, alunos buscados, aguardando, próximo destino e status da rota.
- Mapa grande com rota planejada, trecho percorrido, perua, alunos e escola.
- Lista de sequência com status (verde = pego, azul = próximo, cinza = aguardando, vermelho = problema).
- Barra de progresso com ETA, distância restante e ações da rota.
- Barra de rota fixa no celular priorizando mapa, próximo destino e controles.
- **Rota da tarde:** origem na escola, contadores de embarcados/entregues/restantes e botões explícitos de **Confirmar embarque** e **Confirmar entrega** por aluno. A proximidade da van apenas sugere a chegada; a entrega só é registrada por ação do motorista.

### Alunos
- Cadastro completo: nome, endereço, número, bairro, cidade, escola, responsável, telefone, **e-mail do responsável** e observações.
- E-mail do responsável cria/vincula automaticamente a conta da família e gera um **código individual de ativação** quando ainda não existe senha.
- Status da conta na lista (**Conta ativa** / **Ativação pendente**) e ação para visualizar ou gerar um novo código de ativação.
- Busca por nome/endereço/responsável, filtros por status e escola.
- Criar, editar, excluir e visualizar o aluno no mapa.
- Geocodificação do endereço via Nominatim (com posição aproximada de fallback).
- Exportação em CSV e visualização mobile em cartões.

### Rotas e trânsito
- Duas rotas com regras próprias: **manhã** (casa → escola) e **tarde** (escola → casa), com ativação e bloqueio de troca durante a rota.
- **Manhã:** embarque por proximidade ou confirmação manual; a escola é o destino final.
- **Tarde:** todos começam como *aguardando embarque na escola*; o motorista confirma o embarque individual e, depois, a entrega individual na residência. A finalização é bloqueada até todos os alunos terem status final (entregue, não embarcou ou entrega não realizada).
- Reordenação manual das paradas (subir/descer) e otimização por vizinho mais próximo.
- Inclusão/remoção de alunos na rota.
- Painel de trânsito com obras/imprevistos, severidade, atraso estimado e rota mais rápida.
- **Avisar** durante a rota envia um alerta de risco apenas às famílias dos alunos da rota ativa.
- **Desviar** resolve o imprevisto, recalcula a ordem das paradas e avisa as famílias afetadas.
- Resumo com distância, tempo estimado, raio de confirmação e escola de destino.
- Ações: iniciar, pausar, retomar, confirmar embarque, confirmar entrega, registrar entrega não realizada, pular aluno e finalizar.

### Mapa ao vivo
- Perua, alunos, escola e linha planejada em azul; trecho percorrido em verde.
- Destaque da próxima parada e cartão com endereço completo.
- Painel lateral com progresso, detalhes do aluno selecionado e lista de paradas.
- Botões de enquadrar rota e localizar a perua.
- **Tarde:** o trajeto começa na escola; o cartão do aluno oferece **Confirmar embarque**, **Confirmar entrega** e **Registrar entrega não realizada**, sempre com ação explícita do motorista.
- Google Maps como renderer ativo; fallback SVG automático se a API falhar.

### Mensagens
- Canal direto entre motorista e responsável, por conversa.
- Histórico de mensagens, indicador de não lidas e marcação de leitura.
- Envio pelo responsável gera notificação para o motorista; resposta do motorista gera notificação para o responsável.
- O mesmo componente de chat se adapta ao perfil autenticado.

### Calendário escolar (motorista)
- Grade mensal com navegação entre meses.
- Eventos escolares, feriados e compromissos da rota.
- Criação e exclusão de eventos com data, horário, tipo e observação.
- Os eventos ficam visíveis no painel do motorista e servem de base para avisos futuros.

### Relatórios
- Alunos transportados, rotas concluídas, tempo médio e distância total.
- Gráficos SVG nativos: barras (7 dias), rosca (status) e linha (duração).
- Histórico de trajetos com detalhes de horários, alunos embarcados e ocorrências.
- Exportação CSV/JSON e impressão.

### Configurações
- Alternância entre **Demonstração** e **GPS real**.
- Raio de proximidade para confirmação automática (40–400 m).
- Avanço automático, finalização na escola e rota ativa.
- Integrações de mapa (OSRM, chave Google) e geocodificação.
- Privacidade: mascarar contatos, ocultar endereços, compartilhamento com a escola, retenção e consentimento.
- Segurança: duração da sessão, bloqueio por inatividade e troca de senha.
- Manutenção: exportar dados, limpar histórico, excluir alunos e restaurar demonstração.

### Perfil do motorista
- Dados pessoais, CNH, contato e tempo de casa.
- Dados da van (modelo, ano, placa, cor, capacidade) e garagem/base.
- Troca de van gera aviso para as famílias vinculadas (respeitando a preferência de notificação).
- Segurança da conta, permissões, privacidade e exportação de dados.

### Área do responsável
- **Início:** saudação, dados do filho, status da rota, próxima parada, ETA, mapa resumido e últimos avisos.
- **Status do filho:** aguardando embarque, embarcado na van, entregue na residência, não embarcou ou entrega não realizada.
- **Horários:** hora do embarque e hora da entrega (ou registro da ocorrência), além do horário previsto.
- **Mapa:** mapa dedicado com a van, o aluno e a escola, posição simulada claramente rotulada e aviso de privacidade. Na tarde, o trajeto exibido começa na escola.
- **Notificações:** filtros por tipo (chegada, rota, risco, van, mensagem, embarque, entrega, ocorrência), cartões com data/hora e ação de marcar todas como lidas.
- **Mensagens:** conversa direta com o motorista e histórico.
- **Perfil:** dados da família, vínculo com o aluno, consentimento LGPD e preferências de notificação (casa, escola, rota, risco, van, mensagens).
- O responsável vê somente o próprio filho: status, horários, avisos, conversa e localização disponível.

### Notificações do responsável
- `school` — chegada à escola.
- `home` — chegada/entrega em casa.
- `route` — rota ajustada/otimizada.
- `hazard` — risco ou trânsito na via.
- `van` — troca de van/placa.
- `message` — nova mensagem do motorista.
- `boarding` — embarque confirmado.
- `delivery` — entrega na residência confirmada.
- `no_delivery` — entrega não realizada.
- `issue` — aluno não localizado na coleta ou não embarcou na escola.

As preferências valem para `home`, `school`, `route`, `hazard` e `van`; avisos de embarque, entrega, não entrega e ocorrência são sempre entregues por segurança. Na rota da tarde, cada entrega é notificada individualmente à família do aluno correto; a finalização não duplica esse aviso.

---

## 4. Fluxo de demonstração sugerido

### Motorista
1. Entre com `motorista@kombitech.app` / `kombi1234`.
2. No **Início**, clique em **Iniciar rota**.
3. Observe a perua percorrendo o trajeto simulado (12× mais rápido que o tempo real).
4. Ao se aproximar de um aluno, o embarque é confirmado automaticamente; use **Confirmar embarque** para testar a confirmação manual.
5. Teste **Pausar**, **Retomar**, **Pular aluno** e **Finalizar rota**.
6. Em **Rotas**, teste **Avisar** durante a rota e **Desviar** antes de sair.
7. Em **Mensagens**, responda a uma família; em **Calendário**, crie um evento.
8. Em **Perfil**, altere a placa da van e confira o aviso gerado para as famílias.

### Rota da tarde (escola → casa)
1. Em **Rotas**, selecione **Rota da Tarde** e clique em **Iniciar rota** (a origem é a escola).
2. No **Início**, confirme o embarque de cada aluno na escola pelos botões **Confirmar embarque** (o mesmo está disponível no **Mapa**).
3. Aproxime-se de uma residência: a van apenas **sugere** a chegada; clique em **Confirmar entrega** para registrar o horário e notificar a família.
4. Use **Registrar entrega não realizada** quando não for possível entregar; o responsável é avisado e o aluno recebe status final.
5. Tente **Finalizar rota** com pendências: a ação é bloqueada até todos os alunos terem status final.
6. Confira no histórico os horários de embarque/entrega e as ocorrências.

### Primeiro acesso e recuperação de senha
1. Na tela de login, clique em **Primeiro acesso? Ative sua conta**.
2. Informe `rafael.rocha@kombitech.app` e o código `KT-SOFIA-4821`; defina uma senha com pelo menos 8 caracteres.
3. Saia e entre com o e-mail e a nova senha. O código não pode ser reutilizado.
4. Clique em **Esqueci minha senha**, informe o e-mail e use o código temporário exibido na simulação; a senha anterior deixa de funcionar e o código é de uso único.
5. Em **Alunos**, abra o aluno de Sofia e use a ação de **código de ativação** para ver ou gerar um novo código.

### Responsável
1. Saia e entre com `responsavel@kombitech.app` / `kombi1234`.
2. Confira o **Início** com o status do filho, horários de embarque/entrega e o mapa resumido.
3. Abra **Mapa** e verifique o rótulo de posição simulada e o aviso de privacidade.
4. Em **Notificações**, filtre por embarque, entrega ou van e marque todas como lidas.
5. Em **Mensagens**, envie uma resposta ao motorista.
6. Em **Perfil**, desative uma preferência (ex.: avisos de van) e confirme que ela deixa de ser entregue.

A rota em andamento é salva. Se recarregar a página, ela é restaurada pausada e pode ser retomada.

---

## 5. Arquitetura

```
Kombi Tech/
├── index.html                  # Login com seleção de perfil, primeiro acesso e recuperação
├── app.html                    # Shell SPA (hash router)
├── qa.html                     # Testes de regressão do app
├── qa-login.html               # Testes do login
├── qa-layout.html              # Testes de responsividade
├── qa-map.html                 # Testes do mapa
├── qa-v2.html                  # Testes da rota da tarde e da autenticação do responsável
├── README.md
└── assets/
    ├── css/
    │   └── styles.css          # Design system completo
    ├── img/
    │   └── favicon.svg
    └── js/
        ├── config.js           # Integrações, chaves e padrões
        ├── core.js             # DOM, ícones, formatadores, modais, toasts
        ├── services.js         # Geocodificação, OSRM e otimização
        ├── store.js            # Camada de dados (localStorage)
        ├── map.js              # Google Maps + fallback SVG/Leaflet
        ├── engine.js           # Motor de rota manhã/tarde, simulação e GPS
        ├── app.js              # Shell, navegação por perfil e orquestração
        ├── login.js            # Login, primeiro acesso e recuperação
        └── views/
            ├── dashboard.js
            ├── alunos.js
            ├── rotas.js
            ├── mapa.js
            ├── mensagens.js
            ├── calendario.js
            ├── relatorios.js
            ├── configuracoes.js
            ├── perfil.js
            └── responsavel.js
```

### Camadas
- **`KT.store`** — única porta de acesso aos dados. Hoje usa `localStorage`; para produção, basta reimplementar a mesma interface consumindo uma API autenticada. Inclui autenticação por perfil, primeiro acesso/recuperação do responsável, alunos, rotas, conversas, mensagens, notificações e calendário.
- **`KT.engine`** — controla o ciclo da rota (início, pausa, retomada, confirmações, finalização), com regras específicas para manhã e tarde, simulação, GPS real e gravação do histórico.
- **`KT.MapView`** — abstrai o mapa. Usa Google Maps quando disponível e cai para SVG esquemático (ou Leaflet/OSM, se `maps.provider` for alterado) quando não há conexão ou a API falha.
- **Views** — cada tela expõe `mount`, `unmount`, `onRoute` e `onResize`; o roteador em `app.js` monta e desmonta sob demanda. O conjunto de views e a navegação mudam conforme o perfil.

### Chaves de armazenamento local
| Chave | Conteúdo |
|---|---|
| `kombitech.db.v1` | Banco de dados fictício (alunos, rotas, histórico, responsáveis, conversas, notificações, calendário, trânsito e configurações) |
| `kombitech.session.v1` | Sessão autenticada (perfil, motorista ou `guardianId`) |
| `kombitech.lastActivity.v1` | Controle de inatividade |

Para restaurar o estado inicial: **Configurações → Restaurar demonstração**.

---

## 6. Integrações e onde colocar as chaves

Tudo que depende de serviços externos está centralizado em **`assets/js/config.js`**.

| Integração | Onde configurar | Observação |
|---|---|---|
| Google Maps | `config.maps.google.apiKey` + **Configurações → Chave do Google Maps** | Provedor ativo. A chave salva em Configurações tem prioridade após recarregar a página. Restrinja por HTTP referrer e habilite apenas as APIs necessárias (Maps JavaScript API). |
| OpenStreetMap (tiles) | `config.maps.osm.tileUrl` | Alternativa sem chave; sujeita à política dos servidores voluntários. |
| OSRM (rotas) | `config.maps.routing.osrmBaseUrl` + **Configurações → Servidor de rotas** | Servidor público é limitado; use instância própria em produção. A URL salva em Configurações é usada nas próximas requisições. |
| Nominatim (geocodificação) | `config.maps.geocoding.nominatimUrl` | Respeite o limite de 1 requisição/segundo. |
| GPS | `config.location` e **Configurações → Modo de localização** | `demo` ou `gps` real. |

Para trocar o renderer de mapa, altere `config.maps.provider` para `'openstreetmap'`; o código mantém o caminho Leaflet/OSM como alternativa.

**Nunca exponha chaves secretas no front-end em produção.** As variáveis sugeridas para o backend estão documentadas no topo de `config.js`:

```
MAPS_PROVIDER=google|openstreetmap
GOOGLE_MAPS_API_KEY=...
OSRM_BASE_URL=https://router.project-osrm.org
NOMINATIM_URL=https://nominatim.openstreetmap.org
DATABASE_URL=postgres://...
JWT_SECRET=...
SESSION_TTL_MINUTES=480
```

A chave presente no repositório é de desenvolvimento. Em produção, use um proxy/backend para assinar as requisições e aplicar limites por conta.

---

## 7. LGPD e segurança

- Acesso somente após autenticação; nenhuma tela de dados é pública.
- Separação de permissões por perfil: o responsável acessa apenas o(s) aluno(s) vinculado(s) e seus próprios avisos/conversas.
- Localização da perua e dos alunos nunca é exposta fora do painel autenticado; o mapa do responsável exibe aviso de privacidade e rótulo de simulação.
- Avisos de trânsito e mudanças de rota são enviados apenas às famílias dos alunos da rota ativa.
- Contatos mascarados por padrão; endereços completos podem ser ocultados nas listas.
- Compartilhamento com a escola (quando ativado) expõe apenas o status de chegada, nunca o trajeto em tempo real.
- Consentimento do responsável registrado com data/hora.
- Exportação e exclusão de dados disponíveis ao titular.
- Sessão com expiração e bloqueio por inatividade.
- **Primeiro acesso e recuperação:** códigos individuais de uso único; a recuperação não revela se o e-mail existe; a senha anterior é invalidada quando uma nova é definida.
- **Entrega na residência:** só é aceita após o embarque registrado e exige ação explícita do motorista; a proximidade da van nunca confirma sozinha.
- **Isolamento por família:** status, horários, avisos, conversa e localização são filtrados pelo `guardianId`; uma família não recebe avisos de outra.
- Nenhuma senha armazenada é exibida na interface; os formulários de senha têm botão de mostrar/ocultar.

> **Aviso de segurança da demonstração.** A autenticação é 100% local: o banco e a sessão ficam no `localStorage`, a sessão pode ser forjada e `role`/`guardianId` são confiados pelo cliente. Isso **não é seguro para produção**. Os códigos de ativação/recuperação aparecem em texto puro para permitir testes; em produção devem ser enviados por e-mail/SMS, armazenados apenas como hash no servidor e validados com expiração e uso único. As senhas são armazenadas como SHA-256 sem salt — adequado apenas para a demonstração; use bcrypt/argon2 no servidor.

**Para produção**, ainda é necessário:
1. Autenticação e autorização no servidor (JWT/sessão segura), com senhas em bcrypt/argon2.
2. HTTPS obrigatório e criptografia em repouso.
3. Banco de dados com controle de acesso por perfil e trilha de auditoria.
4. Backend proxy para chaves de mapas e limites de requisição.
5. Política de retenção e anonimização automatizada.
6. Revisão jurídica do consentimento e dos contratos com escolas/famílias.

---

## 8. Responsividade

- **Desktop:** sidebar fixa, dashboard em duas colunas, mapa amplo, chat em duas colunas e tabelas completas.
- **Tablet:** sidebar compacta em ícones e grids reorganizados.
- **Celular:** menu lateral deslizante, navegação inferior priorizando mapa e rota (motorista: Início, Alunos, Mapa, Rotas, Mais; responsável: Início, Mapa, Notificações, Mensagens, Perfil), cartões no lugar de tabelas e barra de rota fixa com próximo destino e controles.

---

## 9. Preparado para o futuro

- Camada de dados isolada — pronta para trocar `localStorage` por API REST/GraphQL.
- Views desacopladas e roteador por hash — fáceis de portar para um app mobile (Capacitor/React Native WebView) ou PWA.
- Configuração de integrações centralizada e chave de mapas substituível.
- Motor de rota independente da interface.
- Modelo de perfis (`driver`/`guardian`) e notificações por aluno já separado, pronto para autenticação real.
- Sem dependências de build: pode ser publicado em qualquer hospedagem estática.

---

## 10. Limitações da demonstração

- Dados ficam apenas no navegador e são fictícios; não há backend, API ou sincronização entre dispositivos. Motorista e responsável só compartilham dados no mesmo navegador/perfil.
- A localização é simulada; o modo GPS real depende da permissão e do dispositivo. A chegada por proximidade é apenas uma sugestão — a entrega exige confirmação explícita do motorista.
- Google Maps depende de chave válida, APIs habilitadas e billing; em caso de falha, o mapa cai para SVG.
- **Primeiro acesso e recuperação são simulados:** os códigos aparecem na tela e nenhum e-mail/SMS é enviado. Não há verificação de e-mail, limite de tentativas no servidor nem invalidação global de sessões.
- **Autenticação local:** o `localStorage` não é seguro para produção (sessão forjável, dados e códigos legíveis, SHA-256 sem salt).
- **Integridade:** não há trilha de auditoria/event log; rotas ainda podem ser editadas durante a viagem e a rota da manhã pode ser finalizada com alunos aguardando.
- Verificação em duas etapas, push notifications nativas, PWA/offline e múltiplos responsáveis por aluno estão previstos, mas não implementados.
- O histórico inicial é gerado para ilustrar os relatórios.

---

## 11. Testes automatizados

Os harnesses são páginas estáticas que rodam no navegador, sem framework. Sirva a pasta com um servidor local e abra cada arquivo:

```bash
python -m http.server 8080
# http://localhost:8080/qa.html
# http://localhost:8080/qa-login.html
# http://localhost:8080/qa-layout.html
# http://localhost:8080/qa-map.html
# http://localhost:8080/qa-v2.html
```

| Harness | Cobertura | Resultado esperado |
|---|---|---|
| `qa.html` | Regressão geral do app, rotas, notificações, chat, calendário, relatórios e responsável | `QA OK 54` |
| `qa-login.html` | Login por perfil, validação de credenciais e estados da tela | `LOGIN OK 18` |
| `qa-layout.html` | Responsividade desktop/mobile e ausência de overflow horizontal | `LAYOUT OK 37` |
| `qa-map.html` | Renderização do Google Maps/fallback | `MAP GOOGLE OK` |
| `qa-v2.html` | Rota da manhã preservada, rota da tarde ponta a ponta, primeiro acesso + logout/login, recuperação com código antigo rejeitado e isolamento de segurança | `QA V2 OK 79` |

O título da aba mostra o resultado (`QA OK N` / `QA FAIL N`), e a página lista cada verificação com `PASS`/`FAIL`. O `qa-v2.html` também cobre: entrega sem embarque bloqueada, entrega duplicada bloqueada, aluno entregue que não pode reembarcar, finalização bloqueada com pendências, notificação segmentada por família, troca de e-mail que desvincula a família anterior, hash de senha sem texto puro, código de ativação/recuperação de uso único e modal de login em 390 px.

---

© KombiTech — projeto de demonstração. Substitua os dados fictícios e configure um backend antes de qualquer uso real.
