export type User = { id: string; name: string; email: string };
export type Client = {
  id: string;
  name: string;
  segment: string;
  description: string;
  audience: string;
};
export type Scene = { visual: string; audio: string; duration: number };
export type Project = {
  id: string;
  name: string;
  client: string;
  clientName: string;
  objective: string;
  duration: number;
  status: string;
  version: number;
  scenes: Scene[];
  created_at: string;
};
export type Version = { version: number; created: string; scenes: Scene[] };
