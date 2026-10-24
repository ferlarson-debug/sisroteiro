import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  Clock3,
  Film,
  Target,
  History,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, message, time } from "./api";
import { ErrorBox, Empty, Saved } from "./components";
import type { Project, Scene, Version } from "./types";

type Props = {
  project: Project;
  ai: boolean;
  onBack: () => void;
  onDirty: (value: boolean) => void;
  onSaved: () => Promise<void>;
};
export function Editor({ project, ai, onBack, onDirty, onSaved }: Props) {
  const [scenes, setScenes] = useState<Scene[]>(
    structuredClone(project.scenes),
  );
  const [saved, setSaved] = useState(JSON.stringify(project.scenes));
  const [version, setVersion] = useState(project.version);
  const [tab, setTab] = useState<"Roteiro" | "Briefing" | "Histórico">(
    "Roteiro",
  );
  const [active, setActive] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [versions, setVersions] = useState<Version[]>([]),
    [historyLoaded, setHistoryLoaded] = useState(false);
  const [past, setPast] = useState<Scene[][]>([]),
    [future, setFuture] = useState<Scene[][]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const dirty = JSON.stringify(scenes) !== saved;
  const duration = scenes.reduce((sum, s) => sum + s.duration, 0);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(scenes.length - 1, 0)));
  }, [scenes.length]);
  function change(next: Scene[]) {
    setPast((p) => [...p.slice(-49), scenes]);
    setFuture([]);
    setScenes(next);
  }
  function update(index: number, patch: Partial<Scene>) {
    change(scenes.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [scenes, ...f]);
    setScenes(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, scenes]);
    setScenes(future[0]);
    setFuture((f) => f.slice(1));
  }
  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    await perform(async () => {
      const result = await api<{ version: number }>(
        "/projects/" + project.id,
        "PUT",
        { version, scenes },
      );
      setVersion(result.version);
      setSaved(JSON.stringify(scenes));
      setHistoryLoaded(false);
      await onSaved();
    });
  }
  async function history() {
    setTab("Histórico");
    if (!historyLoaded)
      await perform(async () => {
        setVersions(
          await api<Version[]>("/projects/" + project.id + "/versions"),
        );
        setHistoryLoaded(true);
      });
  }
  function add() {
    change([...scenes, { visual: "", audio: "", duration: 5 }]);
    setActive(scenes.length);
  }
  function move(index: number, direction: number) {
    const next = [...scenes];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    change(next);
    setActive(index + direction);
  }
  async function generate() {
    if (
      (dirty || scenes.length) &&
      !confirm(
        "Gerar uma nova versão? As alterações não salvas serão descartadas. As versões já salvas serão preservadas.",
      )
    )
      return;
    await perform(async () => {
      const result = await api<{ version: number; scenes: Scene[] }>(
        "/projects/" + project.id + "/generate",
        "POST",
        { version },
      );
      setScenes(result.scenes);
      setSaved(JSON.stringify(result.scenes));
      setVersion(result.version);
      setPast([]);
      setFuture([]);
      setActive(0);
      setHistoryLoaded(false);
      await onSaved();
    });
  }
  const exportLinks = (
    <>
      <p>Exportar a última versão salva (v{version})</p>
      <a href={"/api/projects/" + project.id + "/export/pdf"}>
        <FileText size={16} />
        PDF
      </a>
      <a href={"/api/projects/" + project.id + "/export/docx"}>
        <FileText size={16} />
        DOCX editável
      </a>
      <a href={"/api/projects/" + project.id + "/narration"}>
        <FileText size={16} />
        Narração TXT
      </a>
      {dirty && <small>Salve para incluir suas alterações.</small>}
    </>
  );
  return (
    <div className="editor">
      <button className="backLink" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar aos projetos
      </button>
      <div className="editorHeading">
        <div>
          <h1>{project.name}</h1>
          <p>
            {project.clientName}
            <span>·</span>
            {project.duration} segundos<span>·</span>
            <span className="badge">{project.status}</span>
          </p>
        </div>
        <div className="desktopActions">
          <div className="exportWrap">
            <button
              className="secondary"
              aria-expanded={exportOpen}
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download size={17} />
              Exportar
            </button>
            {exportOpen && (
              <>
                <button
                  className="popoverBackdrop"
                  aria-label="Fechar exportações"
                  onClick={() => setExportOpen(false)}
                />
                <div className="exportMenu">{exportLinks}</div>
              </>
            )}
          </div>
          <button disabled={busy || !dirty} onClick={save}>
            <Save size={17} />
            {busy ? "Aguarde…" : "Salvar roteiro"}
          </button>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Seções do projeto">
        {(["Briefing", "Roteiro", "Histórico"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={"tab-" + t}
            aria-selected={tab === t}
            aria-controls="editor-panel"
            onClick={() => (t === "Histórico" ? void history() : setTab(t))}
          >
            {t === "Briefing" ? (
              <Target size={16} />
            ) : t === "Histórico" ? (
              <History size={16} />
            ) : (
              <Film size={16} />
            )}
            <span>{t}</span>
          </button>
        ))}
      </div>
      <ErrorBox error={error} onClose={() => setError("")} />
      <div role="tabpanel" id="editor-panel" aria-labelledby={"tab-" + tab}>
        {tab === "Briefing" ? (
          <section className="briefingPage">
            <div className="panel">
              <span className="eyebrow">A IDEIA POR TRÁS DO VÍDEO</span>
              <h2>Briefing do projeto</h2>
              <dl>
                <dt>Cliente</dt>
                <dd>{project.clientName}</dd>
                <dt>Nome do projeto</dt>
                <dd>{project.name}</dd>
                <dt>Duração planejada</dt>
                <dd>{project.duration} segundos</dd>
                <dt>Objetivo e mensagem principal</dt>
                <dd className="preserve">
                  {project.objective || "Não informado."}
                </dd>
              </dl>
            </div>
            <div className="hint">
              <Target size={22} />
              <p>
                Use o briefing como referência para construir a narrativa e
                revisar cada cena.
              </p>
            </div>
          </section>
        ) : tab === "Histórico" ? (
          <section className="panel historyPanel">
            <span className="eyebrow">SUA HISTÓRIA, PRESERVADA</span>
            <h2>Versões do roteiro</h2>
            <p>
              Carregue uma versão no editor e salve para criar uma nova versão,
              preservando as anteriores.
            </p>
            {busy && !historyLoaded ? (
              <p role="status">Carregando versões…</p>
            ) : (
              versions.map((v) => (
                <div className="version" key={v.version}>
                  <span className="versionIcon">
                    <History size={18} />
                  </span>
                  <div>
                    <strong>Versão {v.version}</strong>
                    <small>
                      {new Date(v.created).toLocaleString("pt-BR")} ·{" "}
                      {v.scenes.length} cenas
                    </small>
                  </div>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (
                        dirty &&
                        !confirm(
                          "Descartar suas alterações não salvas e carregar esta versão?",
                        )
                      )
                        return;
                      change(structuredClone(v.scenes));
                      setActive(0);
                      setTab("Roteiro");
                    }}
                  >
                    Carregar<span className="srOnly"> versão {v.version}</span>
                  </button>
                </div>
              ))
            )}
          </section>
        ) : (
          <>
            <div className="editorLayout">
              <div className="scriptArea">
                <div className="briefStrip">
                  <Target size={18} />
                  <p>
                    <strong>Objetivo:</strong>{" "}
                    {project.objective || "Nenhum objetivo informado."}
                  </p>
                </div>
                <div className="toolbar">
                  <div className="toolbarButtons">
                    <button onClick={add} disabled={busy}>
                      <Plus size={17} />
                      Adicionar cena
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !ai}
                      onClick={generate}
                      title={
                        ai
                          ? "Criar uma nova versão a partir do briefing"
                          : "Geração com IA indisponível neste ambiente"
                      }
                    >
                      <Sparkles size={17} />
                      Assistente IA
                    </button>
                  </div>
                  <div
                    className={
                      "duration " +
                      (duration === project.duration ? "durationOk" : "")
                    }
                  >
                    <Clock3 size={15} />
                    {duration}s / {project.duration}s{" "}
                    {duration === project.duration ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <AlertCircle size={17} />
                    )}
                  </div>
                </div>
                {!ai && (
                  <p className="availability">
                    OpenAI indisponível. A edição manual continua disponível.
                  </p>
                )}
                <div className="editorTools">
                  <span>
                    {scenes.length} {scenes.length === 1 ? "cena" : "cenas"}
                  </span>
                  <div>
                    <button
                      className="iconButton"
                      onClick={undo}
                      disabled={busy || !past.length}
                      aria-label="Desfazer"
                    >
                      <Undo2 size={17} />
                    </button>
                    <button
                      className="iconButton"
                      onClick={redo}
                      disabled={busy || !future.length}
                      aria-label="Refazer"
                    >
                      <Redo2 size={17} />
                    </button>
                  </div>
                </div>
                {scenes.length > 0 && (
                  <>
                    <div className="sceneNav">
                      <button
                        className="iconButton"
                        aria-label="Cena anterior"
                        disabled={active === 0}
                        onClick={() => setActive(active - 1)}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <label className="srOnly" htmlFor="scene-select">
                        Cena atual
                      </label>
                      <select
                        id="scene-select"
                        value={active}
                        onChange={(e) => setActive(Number(e.target.value))}
                      >
                        {scenes.map((_, i) => (
                          <option key={i} value={i}>
                            Cena {i + 1} de {scenes.length}
                          </option>
                        ))}
                      </select>
                      <button
                        className="iconButton"
                        aria-label="Próxima cena"
                        disabled={active === scenes.length - 1}
                        onClick={() => setActive(active + 1)}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="sceneHeader">
                      <span>VÍDEO / IMAGEM</span>
                      <span>ÁUDIO / NARRAÇÃO</span>
                    </div>
                  </>
                )}
                {scenes.map((s, i) => {
                  const start = scenes
                    .slice(0, i)
                    .reduce((n, x) => n + x.duration, 0);
                  return (
                    <article
                      className={
                        "scene " + (active === i ? "currentScene" : "")
                      }
                      key={i}
                      aria-label={"Cena " + (i + 1)}
                    >
                      <div className="sceneMeta">
                        <div className="sceneTitle">
                          <strong>CENA {String(i + 1).padStart(2, "0")}</strong>
                          <span>
                            {time(start)} — {time(start + s.duration)}
                          </span>
                        </div>
                        <label className="sceneDuration">
                          <span>Duração</span>
                          <input
                            aria-label={"Duração da cena " + (i + 1)}
                            type="number"
                            min={1}
                            max={3600}
                            value={s.duration || ""}
                            disabled={busy}
                            onChange={(e) =>
                              update(i, { duration: Number(e.target.value) })
                            }
                          />
                          <span>s</span>
                        </label>
                      </div>
                      <div className="sceneColumns">
                        <label>
                          <span>VÍDEO / IMAGEM</span>
                          <textarea
                            aria-label={"Visual da cena " + (i + 1)}
                            maxLength={10000}
                            disabled={busy}
                            placeholder="Ação, enquadramento e movimento de câmera…"
                            value={s.visual}
                            onChange={(e) =>
                              update(i, { visual: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          <span>ÁUDIO / NARRAÇÃO</span>
                          <textarea
                            aria-label={"Narração da cena " + (i + 1)}
                            maxLength={10000}
                            disabled={busy}
                            placeholder="Fala, narração, trilha e efeitos sonoros…"
                            value={s.audio}
                            onChange={(e) =>
                              update(i, { audio: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className="sceneActions">
                        <button
                          className="text"
                          disabled={busy || i === 0}
                          onClick={() => move(i, -1)}
                          aria-label={"Mover cena " + (i + 1) + " para cima"}
                        >
                          <ArrowUp size={15} />
                          <span>Subir</span>
                        </button>
                        <button
                          className="text"
                          disabled={busy || i === scenes.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label={"Mover cena " + (i + 1) + " para baixo"}
                        >
                          <ArrowDown size={15} />
                          <span>Descer</span>
                        </button>
                        <button
                          className="text"
                          disabled={busy}
                          onClick={() => {
                            change(
                              scenes.flatMap((x, j) =>
                                j === i ? [x, { ...x }] : [x],
                              ),
                            );
                            setActive(i + 1);
                          }}
                          aria-label={"Duplicar cena " + (i + 1)}
                        >
                          <Copy size={15} />
                          <span>Duplicar</span>
                        </button>
                        <button
                          className="text danger"
                          disabled={busy}
                          onClick={() =>
                            change(scenes.filter((_, j) => j !== i))
                          }
                          aria-label={"Excluir cena " + (i + 1)}
                        >
                          <Trash2 size={15} />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!scenes.length && (
                  <Empty
                    title="Sua história começa com uma cena"
                    description="Adicione a primeira cena ou use o assistente de IA quando estiver disponível."
                    action={
                      <button className="secondary" onClick={add}>
                        <Plus size={17} />
                        Adicionar primeira cena
                      </button>
                    }
                  />
                )}
                <div className="scriptFooter">
                  <Saved dirty={dirty} />
                  <span>Versão {version}</span>
                </div>
              </div>
              <aside className="projectSummary">
                <h3>Resumo do projeto</h3>
                <dl>
                  <dt>Cliente</dt>
                  <dd>{project.clientName}</dd>
                  <dt>Duração</dt>
                  <dd>{project.duration} segundos</dd>
                  <dt>Status</dt>
                  <dd>{project.status}</dd>
                  <dt>Versão salva</dt>
                  <dd>{version}</dd>
                  <dt>Cenas</dt>
                  <dd>{scenes.length}</dd>
                </dl>
                <div className="summaryNote">
                  <FileText size={18} />
                  <p>
                    Descreva o que aparece na tela e o que será ouvido. Mantenha
                    a duração de cada cena alinhada ao ritmo da narrativa.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
      <div className="mobileEditorBar">
        <div className="exportWrap">
          <button
            className="secondary iconButton"
            aria-label="Exportar roteiro"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen(!exportOpen)}
          >
            <Download size={20} />
          </button>
          {exportOpen && (
            <>
              <button
                className="popoverBackdrop"
                aria-label="Fechar exportações"
                onClick={() => setExportOpen(false)}
              />
              <div className="exportMenu">{exportLinks}</div>
            </>
          )}
        </div>
        <button disabled={busy || !dirty} onClick={save}>
          <Save size={18} />
          {busy ? "Aguarde…" : "Salvar roteiro"}
        </button>
      </div>
    </div>
  );
}
