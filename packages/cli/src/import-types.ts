'use strict';

// 임포트 세 모듈이 공유하는 타입만. 런타임 값은 없고 emit 은 빈 exports 스텁.
// moduleDetection: force 라 파일 간 타입은 export 없이는 보이지 않는다 —
// 소비자는 import type { … } from './import-types' 로만 가져온다.

export type ImportRefusal = { code: string; message: string };
export type ImportError = { code: string; message: string };
export type ImportEntry = {
  sha: string;
  subject: string;
  date: string;
  author: string;
  files: string[];
  blueprintId: string;
  slug: string;
  blueprintDir: string;
};
export type ImportPlan = {
  ok: boolean;
  source: 'merges' | 'commits';
  fellBack: boolean;
  epicId: string;
  epicName: string;
  epicDir: string;
  total: number;
  limit: number;
  entries: ImportEntry[];
  refusals: ImportRefusal[];
  error?: ImportError;
};
export type ImportResult = {
  ok: boolean;
  created: string[];
  committed: boolean;
  message?: string;
  error?: ImportError;
};
export type RawCommit = {
  sha: string;
  subject: string;
  date: string;
  author: string;
};
