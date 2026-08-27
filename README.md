# Rafael Cabeleireiros — site

Site estático (HTML/CSS/JS puro, sem build/bundler) no estilo **casarão antigo, com boiseries**: branco e preto, molduras duplas nas bordas dos cartões/fotos, ornamento de canto no hero e no menu. Feito pra rodar de graça no GitHub Pages — sem custo de deploy.

## Estrutura

```
index.html               → landing page (hero + botão de agendar + menu hambúrguer)
institucional.html       → sobre a casa, galeria de fotos, serviços, endereço/contato
profissionais.html       → equipe (Rafael e Carla), com botão "agendar" pré-selecionando o profissional
admin.html               → painel interno: Caixa PDV, Dashboard, Clientes, Serviços e Valores, Galeria
assets/css/styles.css    → tokens de cor/fonte, header, menu hambúrguer, hero, seções, rodapé
assets/css/widget.css    → o widget de agendamento (passo a passo)
assets/css/admin.css     → visual do admin (preto + off-white + bordas finas douradas)
assets/js/menu.js        → abrir/fechar o menu hambúrguer
assets/js/widget.js      → lógica do agendamento (passo a passo + link do WhatsApp + reconhecimento de cliente)
assets/js/admin-store.js → dados do painel (localStorage): vendas, serviços, equipe, clientes, galeria
assets/js/admin-charts.js→ gráficos do dashboard (SVG simples, sem lib externa)
assets/js/admin-app.js   → telas do painel (PDV, Dashboard, Clientes, Serviços, Galeria) e o PIN
robots.txt, sitemap.xml  → SEO básico
```

Todas as páginas do site público (menos o admin) carregam o mesmo header, menu e widget de agendamento — copiados em cada HTML de propósito, pra funcionar mesmo sem servidor (abrindo o arquivo direto no navegador do celular).

## Como agendar funciona (sem backend, sem custo)

Não há servidor nem banco de dados. O widget de agendamento é 100% no navegador: a pessoa escolhe profissional → serviço → dia/horário → confirma, e no final abrimos o WhatsApp do Rafael já com a mensagem pronta (`wa.me`). Zero custo de hospedagem de backend.

## Testar pelo Termux (Android)

```bash
pkg install python git -y
git clone <url-do-repositorio>
cd rafael-cabeleireiros-
python -m http.server 8080
```

Depois abra `http://localhost:8080` no navegador do celular. Servir por HTTP (em vez de abrir o arquivo direto) evita qualquer diferença de comportamento em relação ao GitHub Pages — mas o site também funciona abrindo o `index.html` direto pelo gerenciador de arquivos, já que não depende de `fetch`/servidor pra nada.

## Publicar de graça no GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em "Source", escolha a branch (`main` ou a branch atual) e a pasta `/ (root)`.
3. Salve — o GitHub gera a URL pública em alguns minutos (algo como `https://<usuario>.github.io/<repo>/`).
4. Se trocar de branch/domínio, atualize as tags `canonical`, `og:url` e o `sitemap.xml`/`robots.txt` pra apontar pro endereço final.

## Editando conteúdo

- **Fotos reais**: troque `assets/img/placeholder-portrait.svg` / `placeholder-square.svg` pelos arquivos de foto de verdade (ex: `assets/img/rafael.jpg`) — evite base64 embutido no HTML, deixa a página pesada e lenta pra carregar no celular. As fotos já entram em preto e branco automaticamente (classe `.tone-bw` em `styles.css`), pra combinar com o resto do site sem precisar editar cor na mão.
- **Cores**: tudo fica em `:root` no topo do `assets/css/styles.css` (site público) e `assets/css/admin.css` (painel).
- **Endereço/telefone**: aparecem em vários lugares (menu, rodapé, JSON-LD do `index.html`, número do WhatsApp em `assets/js/widget.js`) — procure por `99650-7174` pra achar todos.

## O painel (admin.html)

Funcional de verdade, mas **100% no navegador** — sem servidor, sem banco de dados:

- **Onde os dados ficam**: tudo salvo no `localStorage` do navegador (`rafaelAdminData`). Isso quer dizer que o painel só lembra do que foi digitado *naquele aparelho, naquele navegador*. Não sincroniza entre o celular do Rafael e um tablet no balcão, por exemplo — cada um teria sua própria cópia dos dados. Pra sincronizar de verdade entre aparelhos precisaria de um banco de dados de verdade (Supabase, Firebase etc.), o que já sai do "de graça, sem backend".
- **A senha (PIN) não é segurança de verdade**: é uma trava simples (`localStorage` também) pra alguém não mexer se pegar o celular na mão. Qualquer pessoa com acesso ao aparelho e um pouco de curiosidade no DevTools consegue contornar. Pra autenticação de verdade (a exigida pelo `PADROES-AGENCIA.md`) precisaria de um backend.
- **Fotos da galeria/equipe**: comprimidas no navegador antes de salvar (canvas + JPEG), mas ainda assim o `localStorage` tem limite (geralmente uns 5-10MB por site). Uma galeria com muitas fotos de alta resolução pode estourar esse limite — nesse ponto o próximo passo seria um serviço de imagens (Cloudinary, Supabase Storage) com um plano gratuito.
- **Caixa PDV → Dashboard**: registrar uma venda no Caixa atualiza o Dashboard na hora (mesma sessão do navegador). O botão "Agendar pra depois" do Caixa abre a mesma agenda do site público.
