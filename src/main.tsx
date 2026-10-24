import { useState, useEffect, useCallback, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  LogOut,
  Plus,
  Search,
  ArrowRight,
  Clapperboard,
  Film,
  FileText,
  Menu,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./style.css";
import { api, ApiError, message } from "./api";
import type { User, Client, Project } from "./types";
import { Brand, Dialog, ErrorBox, Empty, ProjectCard } from "./components";
import { Editor } from "./editor";

type Page = "Visão geral" | "Projetos" | "Clientes";
const pages = [
  { name: "Visão geral" as Page, icon: LayoutDashboard, short: "Início" },
  { name: "Projetos" as Page, icon: FolderOpen, short: "Projetos" },
  { name: "Clientes" as Page, icon: Users, short: "Clientes" },
];
function data(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}

function Auth({
  onLogin,
  initialError,
}: {
  onLogin: (user: User) => Promise<void>;
  initialError: string;
}) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    const values = data(e);
    setError("");
    setBusy(true);
    try {
      await onLogin(
        await api<User>(
          "/auth/" + (register ? "register" : "login"),
          "POST",
          values,
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="authStory">
        <Brand />
        <div>
          <span className="eyebrow">DA IDEIA À ÚLTIMA CENA</span>
          <h1>
            Boas histórias
            <br />
            começam aqui.
          </h1>
          <p>
            Organize suas marcas, dê forma às suas ideias e transforme briefings
            em roteiros que conectam.
          </p>
          <div className="authIllustration" aria-hidden="true">
            <Clapperboard size={100} strokeWidth={1} />
            <span>UMA IDEIA. INFINITAS POSSIBILIDADES.</span>
          </div>
        </div>
        <small>Um espaço para sua próxima grande história.</small>
      </section>
      <section className="authForm">
        <form onSubmit={submit}>
          <span className="eyebrow">SEU ESTÚDIO, ORGANIZADO</span>
          <h2>{register ? "Crie seu espaço" : "Bem-vindo de volta"}</h2>
          <p>
            {register
              ? "Comece sua organização e dê vida aos seus roteiros."
              : "Entre para continuar de onde sua história parou."}
          </p>
          <ErrorBox error={error} />
          <fieldset disabled={busy}>
            {register && (
              <label>
                Seu nome
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            <label>
              E-mail
              <input
                name="email"
                type="email"
                maxLength={254}
                required
                autoComplete="email"
                placeholder="voce@empresa.com.br"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={200}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="Sua senha"
              />
              <small>Mínimo de 12 caracteres</small>
            </label>
            <button className="fullWidth" type="submit">
              {busy
                ? "Aguarde…"
                : register
                  ? "Criar meu estúdio"
                  : "Entrar no estúdio"}
              <ArrowRight size={17} />
            </button>
          </fieldset>
          <div className="authSwitch">
            <span>
              {register
                ? "Já tem uma conta?"
                : "Sua primeira história por aqui?"}
            </span>
            <button
              type="button"
              className="text"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Entrar" : "Criar uma conta"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function RecordForm({
  kind,
  clients,
  onClose,
  onDone,
}: {
  kind: "client" | "project";
  clients: Client[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    const values = data(e);
    setBusy(true);
    setError("");
    try {
      await api(
        kind === "client" ? "/clients" : "/projects",
        "POST",
        kind === "client"
          ? values
          : { ...values, duration: Number(values.duration) },
      );
      await onDone();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={kind === "client" ? "Novo cliente" : "Novo projeto"}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialogDescription">
        {kind === "client"
          ? "Conheça a voz da marca antes de contar sua história."
          : "Um bom roteiro começa com um bom briefing."}
      </p>
      <form onSubmit={submit}>
        <ErrorBox error={error} />
        <fieldset disabled={busy}>
          {kind === "client" ? (
            <>
              <label>
                Nome da marca <span className="required">*</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Ex.: Aurora Arquitetura"
                  autoFocus
                />
              </label>
              <div className="formGrid">
                <label>
                  Segmento
                  <input
                    name="segment"
                    maxLength={200}
                    placeholder="Ex.: Arquitetura"
                  />
                </label>
                <label>
                  Público-alvo
                  <input
                    name="audience"
                    maxLength={1000}
                    placeholder="Para quem a marca fala?"
                  />
                </label>
              </div>
              <label>
                Sobre a marca e suas referências
                <textarea
                  name="description"
                  maxLength={20000}
                  rows={5}
                  placeholder="Empresa, produtos, diferenciais e tom de comunicação. Inclua apenas informações verificadas."
                />
              </label>
              <small>
                Essas informações formam a base de conhecimento do cliente.
              </small>
            </>
          ) : (
            <>
              <label>
                Cliente <span className="required">*</span>
                <select name="client" required autoFocus>
                  <option value="">Selecione um cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nome do projeto <span className="required">*</span>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Ex.: Uma nova forma de morar"
                />
              </label>
              <label>
                Objetivo e mensagem principal
                <textarea
                  name="objective"
                  maxLength={20000}
                  rows={5}
                  placeholder="Qual história o vídeo deve contar? Inclua o público, a mensagem e a chamada para ação."
                />
              </label>
              <label>
                Duração planejada (segundos) <span className="required">*</span>
                <input
                  name="duration"
                  type="number"
                  min={5}
                  max={3600}
                  defaultValue={60}
                  required
                />
              </label>
            </>
          )}
          <div className="dialogFooter">
            <button className="secondary" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit">
              {busy
                ? "Salvando…"
                : kind === "client"
                  ? "Salvar cliente"
                  : "Criar projeto"}
              <ArrowRight size={16} />
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

function App() {
  const [databaseLabel, setDatabaseLabel] = useState("Banco de dados");
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState<Page>("Projetos"),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [ai, setAi] = useState(false),
    [aiModel, setAiModel] = useState("");
  const [modal, setModal] = useState<"client" | "project" | "account" | null>(
      null,
    ),
    [selected, setSelected] = useState<Project | null>(null),
    [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("Todos"),
    [clientFilter, setClientFilter] = useState(""),
    [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    const [c, p, caps] = await Promise.all([
      api<Client[]>("/clients"),
      api<Project[]>("/projects"),
      api<{ ai: boolean; aiModel: string; database: string }>("/capabilities"),
    ]);
    setClients(c);
    setProjects(p);
    setAi(caps.ai);
    setAiModel(caps.aiModel);
    setDatabaseLabel(caps.database);
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const u = await api<User>("/me");
        if (live) setUser(u);
        await refresh();
      } catch (e) {
        if (live && !(e instanceof ApiError && e.status === 401))
          setError(message(e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    function leave(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  function leave() {
    return !dirty || confirm("Descartar as alterações não salvas?");
  }
  function navigate(p: Page) {
    if (!leave()) return;
    setSelected(null);
    setDirty(false);
    setPage(p);
    setQuery("");
    setFilter("Todos");
    setClientFilter("");
    setError("");
  }
  function openProject(p: Project) {
    setSelected(structuredClone(p));
    setDirty(false);
    setError("");
    window.scrollTo(0, 0);
  }
  function createProject() {
    if (!clients.length) {
      setToast("Cadastre o primeiro cliente para criar um projeto.");
      setModal("client");
    } else setModal("project");
  }
  async function logout() {
    if (!leave()) return;
    setBusy(true);
    setError("");
    try {
      await api("/logout", "POST");
      setUser(null);
      setSelected(null);
      setDirty(false);
      setModal(null);
      setClients([]);
      setProjects([]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading">
        <Brand />
        <span className="spinner" />
        <p>Preparando seu estúdio…</p>
      </main>
    );
  if (!user)
    return (
      <Auth
        initialError={error}
        onLogin={async (u) => {
          setUser(u);
          setError("");
          try {
            await refresh();
          } catch (e) {
            setError(message(e));
          }
        }}
      />
    );
  const filteredProjects = projects.filter(
    (p) =>
      (p.name + " " + p.clientName)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()) &&
      (!clientFilter || p.client === clientFilter) &&
      (filter === "Todos" ||
        (filter === "Com cenas" ? p.scenes.length > 0 : p.scenes.length === 0)),
  );
  const filteredClients = clients.filter((c) =>
    (c.name + " " + c.segment)
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const stats = [
    {
      name: "Projetos",
      value: projects.length,
      icon: FolderOpen,
      color: "green",
    },
    {
      name: "Com roteiro",
      value: projects.filter((p) => p.scenes.length > 0).length,
      icon: FileText,
      color: "blue",
    },
    { name: "Clientes", value: clients.length, icon: Users, color: "amber" },
    {
      name: "Cenas criadas",
      value: projects.reduce((n, p) => n + p.scenes.length, 0),
      icon: Film,
      color: "green",
    },
  ];
  return (
    <div className={"shell " + (selected ? "editing" : "")}>
      <a className="skipLink" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Brand />
        <span className="navLabel">WORKSPACE</span>
        <nav aria-label="Navegação principal">
          {pages.map((p) => (
            <button
              className={"nav " + (page === p.name ? "active" : "")}
              key={p.name}
              aria-current={page === p.name ? "page" : undefined}
              onClick={() => navigate(p.name)}
            >
              <p.icon size={19} />
              {p.name}
            </button>
          ))}
        </nav>
        <div className="asideNote">
          <Sparkles size={24} />
          <strong>Da ideia à produção.</strong>
          <p>Seu próximo grande roteiro começa com um bom briefing.</p>
          <button className="text" onClick={createProject}>
            Começar uma história
            <ArrowRight size={15} />
          </button>
        </div>
        <button className="profile" onClick={() => setModal("account")}>
          <span className="avatar">{user.name[0].toUpperCase()}</span>
          <span>
            {user.name}
            <small>Meu estúdio</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace
            <ChevronRight size={13} />
            <span>{selected ? "Editor de roteiro" : page}</span>
          </div>
          <div className="mobileBrand">
            <Brand />
          </div>
          <button
            className="accountButton"
            aria-label="Minha conta"
            onClick={() => setModal("account")}
          >
            <span className="avatar">{user.name[0].toUpperCase()}</span>
            <span>{user.name.split(" ")[0]}</span>
          </button>
        </header>
        <main className="content" id="main-content">
          <ErrorBox error={error} onClose={() => setError("")} />
          {selected ? (
            <Editor
              key={selected.id}
              project={selected}
              ai={ai}
              onDirty={setDirty}
              onSaved={refresh}
              onBack={() => navigate("Projetos")}
            />
          ) : (
            <>
              <div className="titleRow">
                <div>
                  <span className="eyebrow">SEU ESPAÇO DE CRIAÇÃO</span>
                  <h1>
                    {page === "Clientes"
                      ? "Marcas com história."
                      : page === "Visão geral"
                        ? "Seu estúdio em movimento."
                        : "Histórias em movimento."}
                  </h1>
                  <p>
                    {page === "Clientes"
                      ? "Reúna o conhecimento que dá personalidade a cada roteiro."
                      : "Do primeiro briefing à última cena, tudo em um só lugar."}
                  </p>
                </div>
                <button
                  onClick={() =>
                    page === "Clientes" ? setModal("client") : createProject()
                  }
                >
                  <Plus size={18} />
                  {page === "Clientes" ? "Novo cliente" : "Novo projeto"}
                </button>
              </div>
              <section className="stats" aria-label="Resumo do estúdio">
                {stats.map((s) => (
                  <div key={s.name}>
                    <span className={"statIcon " + s.color}>
                      <s.icon size={21} />
                    </span>
                    <div>
                      <span>{s.name}</span>
                      <strong>{s.value}</strong>
                    </div>
                  </div>
                ))}
              </section>
              <div className="sectionTitle">
                <h2>
                  {page === "Clientes"
                    ? "Seus clientes"
                    : page === "Visão geral"
                      ? "Projetos recentes"
                      : "Seus projetos"}
                  <small>
                    {page === "Clientes" ? clients.length : projects.length}
                  </small>
                </h2>
                {page === "Visão geral" ? (
                  <button className="text" onClick={() => navigate("Projetos")}>
                    Ver todos
                    <ArrowRight size={15} />
                  </button>
                ) : (
                  <div className="searchWrap">
                    <Search size={17} />
                    <input
                      aria-label={
                        page === "Clientes"
                          ? "Buscar cliente"
                          : "Buscar projeto ou cliente"
                      }
                      type="search"
                      placeholder={
                        page === "Clientes"
                          ? "Buscar cliente…"
                          : "Buscar projeto ou cliente…"
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {page === "Projetos" && (
                <div className="filterRow">
                  <div
                    className="filterChips"
                    aria-label="Filtrar projetos por roteiro"
                  >
                    {["Todos", "Com cenas", "Sem cenas"].map((f) => (
                      <button
                        className={filter === f ? "selected" : ""}
                        aria-pressed={filter === f}
                        key={f}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <label className="clientFilter">
                    <SlidersHorizontal size={16} />
                    <select
                      aria-label="Filtrar por cliente"
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                    >
                      <option value="">Todos os clientes</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="cards">
                {page === "Clientes"
                  ? filteredClients.map((c) => (
                      <button
                        className="clientCard"
                        key={c.id}
                        onClick={() => {
                          setClientFilter(c.id);
                          setQuery("");
                          setPage("Projetos");
                          setFilter("Todos");
                        }}
                      >
                        <div className="clientCardHeading">
                          <span className="avatar">{c.name[0]}</span>
                          <ChevronRight size={18} />
                        </div>
                        <h3>{c.name}</h3>
                        <span className="badge">
                          {c.segment || "Sem segmento"}
                        </span>
                        <p>{c.description || "Sem descrição cadastrada."}</p>
                        <div className="clientCardFooter">
                          <span>
                            {projects.filter((p) => p.client === c.id).length}{" "}
                            projetos
                          </span>
                          <small>
                            Ver projetos
                            <ArrowRight size={13} />
                          </small>
                        </div>
                      </button>
                    ))
                  : (page === "Visão geral"
                      ? projects.slice(0, 3)
                      : filteredProjects
                    ).map((p, i) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        index={i}
                        onOpen={() => openProject(p)}
                      />
                    ))}
              </div>
              {(page === "Clientes"
                ? filteredClients
                : page === "Visão geral"
                  ? projects
                  : filteredProjects
              ).length === 0 && (
                <Empty
                  title={
                    (page === "Clientes" ? clients : projects).length
                      ? "Nenhum resultado por aqui"
                      : page === "Clientes"
                        ? "Conheça a voz de cada marca"
                        : "Sua próxima história começa aqui"
                  }
                  description={
                    (page === "Clientes" ? clients : projects).length
                      ? "Tente outro nome ou ajuste os filtros."
                      : page === "Clientes"
                        ? "Cadastre o primeiro cliente para construir sua base de conhecimento."
                        : "Cadastre um cliente e crie um projeto com seu briefing."
                  }
                  action={
                    (page === "Clientes" ? clients : projects).length ? (
                      <button
                        className="secondary"
                        onClick={() => {
                          setQuery("");
                          setFilter("Todos");
                          setClientFilter("");
                        }}
                      >
                        Limpar filtros
                      </button>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() =>
                          page === "Clientes"
                            ? setModal("client")
                            : createProject()
                        }
                      >
                        <Plus size={16} />
                        {page === "Clientes"
                          ? "Cadastrar cliente"
                          : "Criar primeiro projeto"}
                      </button>
                    )
                  }
                />
              )}
              {page === "Visão geral" && (
                <div className="workflow">
                  <span className="workflowIcon">
                    <Clapperboard size={28} />
                  </span>
                  <div>
                    <h3>Uma boa história tem um bom começo.</h3>
                    <p>
                      Reúna as informações da marca, prepare o briefing e dê
                      vida a cada cena.
                    </p>
                  </div>
                  <button className="secondary" onClick={createProject}>
                    Criar projeto
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {!selected && (
        <nav className="bottomNav" aria-label="Navegação no celular">
          {pages.map((p) => (
            <button
              key={p.name}
              className={page === p.name ? "active" : ""}
              aria-current={page === p.name ? "page" : undefined}
              onClick={() => navigate(p.name)}
            >
              <p.icon size={21} />
              <span>{p.short}</span>
            </button>
          ))}
          <button onClick={() => setModal("account")}>
            <Menu size={21} />
            <span>Menu</span>
          </button>
        </nav>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="iconButton"
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal === "client" || modal === "project" ? (
        <RecordForm
          kind={modal}
          clients={clients}
          onClose={() => setModal(null)}
          onDone={async () => {
            await refresh();
            setToast(
              modal === "client" ? "Cliente cadastrado." : "Projeto criado.",
            );
          }}
        />
      ) : modal === "account" ? (
        <Dialog title="Minha conta" onClose={() => setModal(null)} busy={busy}>
          <div className="accountDetails">
            <span className="avatar">{user.name[0]}</span>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <small>Seu estúdio é independente de outras contas.</small>
          </div>
          <section className="connectionPanel">
            <h3>Conexões do estúdio</h3>
            <div>
              <span>Banco {databaseLabel}</span>
              <span className="badge">Disponível</span>
            </div>
            <div>
              <span>OpenAI · modelos GPT</span>
              <span className={"badge " + (!ai ? "pending" : "")}>
                {ai ? "Configurada" : "Chave pendente"}
              </span>
            </div>
            {ai && (
              <small>
                Modelo configurado: {aiModel}. A disponibilidade é verificada a
                cada geração.
              </small>
            )}
          </section>
          <button
            className="secondary fullWidth"
            disabled={busy}
            onClick={logout}
          >
            <LogOut size={18} />
            {busy ? "Saindo…" : "Sair da conta"}
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
