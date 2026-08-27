# Rafael Cabeleireiros — site

Site estático (HTML/CSS/JS puro, sem build/bundler) no estilo **casarão antigo, com boiseries**: branco e preto, molduras duplas nas bordas dos cartões/fotos, ornamento de canto no hero e no menu. O site em si roda de graça no GitHub Pages; o banco de dados por trás (agenda, vendas, clientes, PINs) é o **Supabase**, também no plano gratuito.

## Estrutura

```
index.html               → landing page (hero + botão de agendar + menu hambúrguer)
institucional.html       → sobre a casa, galeria de fotos (real, do Supabase), serviços, endereço/contato
profissionais.html       → equipe (Rafael e Carla), com botão "agendar" pré-selecionando o profissional
admin.html               → painel interno: Caixa PDV, Agenda, Dashboard, Clientes, Serviços e Valores, Galeria
assets/css/styles.css    → tokens de cor/fonte, header, menu hambúrguer, hero, seções, rodapé
assets/css/widget.css    → o widget de agendamento (passo a passo)
assets/css/admin.css     → visual do admin (preto + off-white + bordas finas douradas)
assets/js/menu.js            → abrir/fechar o menu hambúrguer
assets/js/supabase-client.js → cria a conexão com o Supabase (URL + chave pública, sem segredo nenhum)
assets/js/widget.js           → agendamento do site (passo a passo), com horários reais vindos do banco
assets/js/gallery-public.js   → carrega as fotos da galeria pública (institucional.html) direto do Supabase
assets/js/admin-store.js      → camada de dados do painel — fala com o Supabase (login, agenda, vendas, clientes, serviços, galeria)
assets/js/admin-charts.js     → gráficos do dashboard (SVG simples, sem lib externa)
assets/js/admin-app.js        → telas do painel (Caixa PDV, Agenda, Dashboard, Clientes, Serviços, Galeria) e o login por PIN
robots.txt, sitemap.xml  → SEO básico
```

Todas as páginas do site público (menos o admin) carregam o mesmo header, menu e widget de agendamento — copiados em cada HTML de propósito, pra funcionar mesmo sem servidor (abrindo o arquivo direto no navegador do celular). A diferença é que agora esses arquivos também carregam o SDK do Supabase pra ler dados reais (profissionais, serviços, horários livres, fotos da galeria); se a rede/CDN não responder, cada página cai de volta pro conteúdo fixo que já está no HTML, então o site nunca fica com uma tela vazia.

## Arquitetura: GitHub Pages + Supabase

- **Front-end** (HTML/CSS/JS, sem build) → GitHub Pages, de graça.
- **Banco de dados** → Supabase (Postgres) no plano gratuito ($0/mês): agenda, vendas, clientes, serviços, equipe, PINs e fotos da galeria.
- **Login não usa "Supabase Auth"** — usa PIN numérico de 4 a 6 dígitos por funcionário, verificado inteiramente dentro do banco (nunca no navegador). Isso porque o pedido era "PIN simples, mas seguro":
  - o PIN é conferido por uma função do banco (`login_pin`), guardado como hash (`pgcrypto`), nunca em texto puro;
  - a função devolve um token de sessão (válido por 12h), guardado em `localStorage` só pra sobreviver a um F5 — o PIN em si nunca fica salvo no aparelho;
  - toda ação sensível (ver vendas, mexer em serviços, adicionar funcionário, etc.) passa por uma função do banco que confere esse token e o papel (`owner`/`staff`) antes de fazer qualquer coisa — a trava real está no banco, não só escondendo botão na tela;
  - há um limite de tentativas de PIN errado (10 a cada 15 minutos) pra dificultar força bruta.
- **Permissões por papel**:
  - **Rafael (dono)** — PIN `5786` — vê e mexe em tudo: Caixa PDV, Agenda, Dashboard, Clientes, Serviços e Valores (inclui cadastrar/remover gente da equipe e criar o PIN de cada um) e Galeria (adicionar, remover, marcar profissional).
  - **Equipe (funcionários)** — PIN cadastrado pelo Rafael em Serviços e Valores — só acessam Caixa PDV, Agenda (marcar/desmarcar horário) e Galeria (só adicionar foto, sem remover/marcar).
  - **⚠️ Troque o PIN `2468` da Carla** (veio como exemplo/placeholder) assim que o painel estiver no ar — é só entrar como Rafael, ir em Serviços e Valores e recadastrar.

## Agenda e horário de funcionamento

- O horário de funcionamento (segunda a sábado, 8h às 18h; quinta e sexta até 19h; domingo fechado) fica numa tabela própria (`business_hours`) no banco — é o que o widget do site e o painel usam pra saber quais dias/horários oferecer.
- **Ninguém consegue marcar fora do horário de funcionamento nem em cima de outro agendamento já feito com o mesmo profissional** — essa regra é garantida dentro do banco (um *trigger* no Postgres), não só na tela. Mesmo que alguém tente forçar por fora do site, o banco recusa.
- **Cliente pelo site**: agenda em passo a passo (dados → profissional → serviço → dia → horário → confirmar), vendo só os horários realmente livres. Ao confirmar, grava no banco e abre o WhatsApp do Rafael com o resumo pronto pra enviar.
- **Equipe e Rafael pelo painel** (aba **Agenda**, visível pra todo mundo logado): veem os próximos agendamentos (inclusive os feitos pelo site, de casa), podem confirmar/desmarcar qualquer um, e também marcar um horário manualmente pra quem ligou ou chegou no balcão.

## O painel (admin.html)

- **Caixa PDV**: escolhe o barbeiro, o serviço, se é "agendar" (abre a Agenda) ou "já foi cortado agora", e o pagamento (crédito/débito/pix/dinheiro, com troco e fracionamento). Ao finalizar, cai direto no Dashboard.
- **Agenda**: ver acima.
- **Dashboard** (só o dono): cortes no mês, ganhos, quem cortou, ticket médio e histórico, em gráficos simples (SVG, sem lib externa) na paleta preto + bordas finas douradas.
- **Clientes**: mini card com histórico de cortes, frequência de retorno, botão pra abrir o WhatsApp oficial e feedback (deixado pela própria pessoa, opcional — nunca obrigatório).
- **Serviços e Valores** (só o dono): adicionar/remover serviço, editar preço, adicionar/remover gente da equipe (e o PIN de cada um), foto de perfil do funcionário.
- **Galeria**: adicionar fotos (grade estilo Instagram, borda com as cores oficiais do Instagram), marcar o profissional (opcional, só o dono marca/edita depois de adicionada), link pro `@rafael_cabeleireiros` e horário de funcionamento. A mesma galeria aparece pros clientes em `institucional.html`, só que ali é **só visualização** (sem os controles de adicionar/remover), com moldura dourada fina — o mesmo acervo de fotos, duas vitrines diferentes.

## Publicar de graça no GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em "Source", escolha a branch (`main` ou a branch atual) e a pasta `/ (root)`.
3. Salve — o GitHub gera a URL pública em alguns minutos (algo como `https://<usuario>.github.io/<repo>/`).
4. Se trocar de branch/domínio, atualize as tags `canonical`, `og:url` e o `sitemap.xml`/`robots.txt` pra apontar pro endereço final.

O Supabase já está no ar e configurado (URL e chave pública em `assets/js/supabase-client.js` — é seguro expor essa chave, ela só permite o que as regras do banco liberam publicamente).

## Editando conteúdo

- **Fotos reais**: as fotos de galeria/equipe agora sobem direto pelo painel (comprimidas no navegador antes de subir) e ficam guardadas no Supabase Storage — não precisa mais editar HTML pra trocar foto. As fotos institucionais fixas (`assets/img/placeholder-*.svg`) continuam trocáveis à mão, se quiser.
- **Cores**: tudo fica em `:root` no topo do `assets/css/styles.css` (site público) e `assets/css/admin.css` (painel).
- **Endereço/telefone**: aparecem em vários lugares (menu, rodapé, JSON-LD do `index.html`, número do WhatsApp em `assets/js/widget.js`) — procure por `99650-7174` pra achar todos.
- **Horário de funcionamento**: fica na tabela `business_hours` do Supabase (não tem editor visual no painel ainda — dá pra ajustar direto no painel do Supabase ou chamando a função `admin_update_business_hours` como o Rafael).

## Limites conhecidos (aceitos por enquanto)

- **Upload de foto não é travado pelo PIN**: como o login é por PIN (não pelo login de verdade do Supabase), o Storage aceita upload de qualquer pessoa com a chave pública do site — não só de quem está logado no painel. Baixo risco (só sobe imagem, não vê dado nenhum), mas vale saber.
- **Feedback de cliente**: o banco já tem espaço pra feedback deixado pelo próprio cliente (`origem = 'cliente'`), mas ainda não existe uma tela pública pra ele deixar esse feedback sozinho — hoje quem registra é a equipe, pelo painel.
- **Limite de tentativas de PIN é geral, não por pessoa**: 10 tentativas erradas a cada 15 minutos pra qualquer PIN, não por funcionário — suficiente pra afastar tentativa de força bruta, mas não é um "bloqueio de conta" individual.
- **Sem teste ao vivo feito por mim**: este ambiente de desenvolvimento não tem acesso à internet pra falar com o Supabase de verdade — tudo foi validado com consultas SQL diretas no banco (login, permissões, agenda, conflito de horário) e com testes automatizados usando uma simulação do Supabase no navegador. Depois de publicado, vale um teste rápido de verdade: abrir o site, agendar um horário, e conferir se ele aparece na aba Agenda do painel.

## Testar pelo Termux (Android)

```bash
pkg install python git -y
git clone <url-do-repositorio>
cd rafael-cabeleireiros-
python -m http.server 8080
```

Depois abra `http://localhost:8080` no navegador do celular. Servir por HTTP (em vez de abrir o arquivo direto) evita qualquer diferença de comportamento em relação ao GitHub Pages.
