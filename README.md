# Manual do Cliente — Sistema CEC

Central de ajuda (site) com todo o conteúdo do **Manual do Cliente CEC**, gerada a partir
do PDF original (213 páginas), com **painel administrativo** para cadastrar, editar e excluir
cada tópico. Dados, autenticação e imagens ficam no **Supabase** (nuvem).

---

## 📁 Estrutura dos arquivos

```
site-manual/
├── index.html              → Site público (central de ajuda)
├── admin.html              → Painel administrativo (login + CRUD)
├── assets/
│   ├── css/style.css        → Estilos (site + admin)
│   └── js/
│       ├── supabase-config.js  → URL e chave pública do Supabase
│       ├── app.js              → Lógica do site público
│       └── admin.js            → Lógica do painel admin
└── README.md
```

O site é **estático** (HTML/CSS/JS puro) e conversa com o Supabase pela internet.
Não há build nem dependências para instalar.

---

## ▶️ Como executar localmente

Sirva a pasta por HTTP (não abra o `index.html` direto pelo `file://`, pois o login
depende de `localStorage`/HTTP). No terminal, dentro da pasta `site-manual`:

```bash
python -m http.server 5599
```

Depois acesse **http://localhost:5599/index.html** (site) e
**http://localhost:5599/admin.html** (painel).

> Alternativa: `npx serve` ou a extensão *Live Server* do VS Code.

---

## 🌐 Como publicar (deploy)

Por ser um site estático, basta enviar a pasta para qualquer hospedagem:

- **Netlify** ou **Vercel**: arraste a pasta `site-manual` na interface (deploy por drag-and-drop).
- **GitHub Pages**: suba os arquivos num repositório e ative o Pages.
- Qualquer servidor web (Apache/Nginx/IIS): copie a pasta para o diretório público.

Nenhuma configuração extra é necessária — as chaves do Supabase já estão embutidas
(chave *publishable*, segura para uso público; a escrita é protegida por autenticação).

---

## 🔐 Painel administrativo

Acesse **`admin.html`** e faça login.

**Credenciais iniciais** (troque a senha no primeiro acesso pelo botão **“Alterar senha”**):

- **E-mail:** `pedroriquelmefoz@gmail.com`
- **Senha:** *(enviada separadamente — altere após entrar)*

### O que dá para fazer

| Ação | Como |
|------|------|
| **Criar PARTE** | Botão **“+ Nova PARTE”** no topo da lista |
| **Criar subtópico** | Selecione um tópico e clique **“+ Subtópico”** |
| **Editar** | Clique no tópico na árvore à esquerda, altere e clique **Salvar** |
| **Excluir** | Botão **Excluir** (pede confirmação; remove também os subtópicos) |
| **Reordenar** | Setas **↑ / ↓** movem o tópico entre os irmãos |
| **Mover de lugar** | Campo **“Pertence a”** muda o tópico de PARTE/pai |
| **Inserir imagem** | Botão **🖼 Imagem** na barra do editor (envia ao Supabase Storage) |
| **Bloco de terminal** | Botão **⌨ Tela** (para telas do sistema em modo texto) |
| **Editar HTML** | Botão **`</> HTML`** alterna entre editor visual e HTML |

O editor é **visual (WYSIWYG)**: negrito, itálico, títulos, listas, links, imagens e
blocos de terminal. Cada alteração salva reflete imediatamente no site público.

---

## 🗄️ Supabase (backend)

- **Projeto:** `Manual CEC` (`yyirausqbojcehtajfvs`) — região `sa-east-1`.
- **Tabela `public.sections`** — hierarquia do manual:
  `id, parent_id, level, part_number, title, slug, content (HTML), position, page_ref, created_at, updated_at`.
- **Segurança (RLS):** leitura **pública**; criar/editar/excluir apenas para **usuários autenticados**.
- **Storage `manual-images`** (bucket público): imagens do manual e uploads do editor.

### Adicionar outro administrador
No painel do Supabase → **Authentication → Users → Add user** (marque *Auto Confirm User*).
Qualquer usuário autenticado tem acesso de edição.

---

## 📖 Origem do conteúdo

Os 101 tópicos (9 PARTES) e as 247 imagens foram extraídos automaticamente do
`Manual CEC.pdf`, preservando a hierarquia do sumário, os textos, as telas do sistema
(em modo texto) e as capturas de tela. Todo o conteúdo é editável pelo painel.
