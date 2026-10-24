import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Clapperboard,
  ArrowRight,
  Clock3,
  Film,
  Check,
  AlertCircle,
} from "lucide-react";
import type { Project } from "./types";

export function Brand() {
  return (
    <div className="brand">
      <span className="brandMark">◈</span>
      <div>
        sisroteiro<small>ESTÚDIO CRIATIVO</small>
      </div>
    </div>
  );
}
export function ErrorBox({
  error,
  onClose,
}: {
  error: string;
  onClose?: () => void;
}) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{error}</span>
      {onClose && (
        <button
          className="iconButton"
          aria-label="Fechar mensagem"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      )}
    </div>
  ) : null;
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialogHeading">
        <div>
          <span className="eyebrow">SEU ESTÚDIO</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="iconButton"
          aria-label="Fechar janela"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="emptyIcon">
        <Clapperboard size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ProjectCard({
  project,
  onOpen,
  index = 0,
}: {
  project: Project;
  onOpen: () => void;
  index?: number;
}) {
  return (
    <button className="projectCard" onClick={onOpen}>
      <div className={"cover cover" + (index % 3)}>
        <svg className="coverArt" viewBox="0 0 400 180" aria-hidden="true">
          <circle cx="316" cy="40" r="28" />
          <path d="M0 147L73 76L150 147L260 37L400 178H0Z" />
          <path d="M47 178V91L170 53L282 94V178M170 53V178M69 121H144V178M198 123H257V178" />
        </svg>
        <span className="badge">
          <span className="dot" />
          {project.status}
        </span>
        <small>
          <Clock3 size={12} />
          {project.duration}s
        </small>
      </div>
      <div className="cardBody">
        <h3>{project.name}</h3>
        <p>{project.clientName}</p>
        <div className="cardFooter">
          <span>
            <Film size={13} />
            {project.scenes.length} cenas · v{project.version}
          </span>
          <span className="cardArrow">
            <ArrowRight size={17} />
          </span>
        </div>
      </div>
    </button>
  );
}
export function Saved({ dirty }: { dirty: boolean }) {
  return (
    <span className={"saveStatus " + (dirty ? "unsaved" : "")}>
      <Check size={14} />
      {dirty ? "Alterações não salvas" : "Tudo salvo"}
    </span>
  );
}
