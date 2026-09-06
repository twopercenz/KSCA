// lib/types.ts
// Mirrors the DB schema in README.md §8 (plus the `authors` column added
// in migration 0002 — see docs/superpowers/plans/2026-09-05-ksca-web-service.md).

export type Role = 'user' | 'admin';
export type ContentStatus = 'public' | 'hidden';
export type ReportStatus = 'pending' | 'reviewed';
export type TargetType = 'paper' | 'post' | 'comment' | 'paper_comment';
export type BoardCategory = 'free' | 'question' | 'study' | 'notice';

export type Profile = {
  id: string;
  nickname: string;
  school: string | null;
  role: Role;
  created_at: string;
};

export type Paper = {
  id: string;
  concept_id: string;
  version_no: number;
  author_id: string;
  authors: string;
  title: string;
  abstract: string;
  tags: string[];
  school: string | null;
  file_path: string;
  view_count: number;
  status: ContentStatus;
  created_at: string;
};

export type PaperComment = {
  id: string;
  paper_id: string;
  author_id: string;
  content: string;
  written_at_version: number;
  status: ContentStatus;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  category: BoardCategory;
  title: string;
  content: string;
  status: ContentStatus;
  created_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  status: ContentStatus;
  created_at: string;
};

export type Report = {
  id: string;
  target_type: TargetType;
  target_id: string;
  reporter_id: string;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  created_at: string;
};
