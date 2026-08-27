# Rafael Cabeleireiros — site

Site estático (HTML/CSS/JS puro, sem build/bundler) no estilo **provençal**: branco e preto, minimalista, sem cor — hero em preto e branco, botões e textos em tons de cinza/preto sobre fundo branco. Feito pra rodar de graça no GitHub Pages — sem custo de deploy.

## Estrutura

```
index.html            → landing page (hero + botão de agendar + menu hambúrguer)
institucional.html    → sobre a casa, galeria de fotos, serviços, endereço/contato
profissionais.html    → equipe (Rafael e Carla), com botão "agendar" pré-selecionando o profissional
admin.html            → prévia visual do painel interno (não é funcional, é só o layout planejado)
assets/css/styles.css → tokens de cor/fonte, header, menu hambúrguer, hero, seções, rodapé
assets/css/widget.css → o widget de agendamento (passo a passo)
assets/css/admin.css  → visual do admin, proposital e diferente do site do cliente
assets/js/menu.js     → abrir/fechar o menu hambúrguer
assets/js/widget.js   → lógica do agendamento (passo a passo + link do WhatsApp)
robots.txt, sitemap.xml → SEO básico
```

Todas as páginas (menos o admin) carregam o mesmo header, menu e widget de agendamento — copiados em cada HTML de propósito, pra funcionar mesmo sem servidor (abrindo o arquivo direto no navegador do celular).

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

- **Fotos reais**: troque `assets/img/placeholder-portrait.svg` / `placeholder-square.svg` pelos arquivos de foto de verdade (ex: `assets/img/rafael.jpg`) — evite base64 embutido no HTML, deixa a página pesada e lenta pra carregar no celular. As fotos já entram em preto e branco automaticamente (classe `.provence-tone` em `styles.css`), pra combinar com o resto do site sem precisar editar cor na mão.
- **Cores**: tudo fica em `:root` no topo do `assets/css/styles.css`.
- **Endereço/telefone**: aparecem em vários lugares (menu, rodapé, JSON-LD do `index.html`, número do WhatsApp em `assets/js/widget.js`) — procure por `99650-7174` pra achar todos.
- **Admin**: é só prévia visual por enquanto (login e agenda de verdade ainda não existem) — quando for construir de verdade, seguir as regras de segurança do `PADROES-AGENCIA.md` (autenticação separada da área do cliente, nunca só escondida no front).
