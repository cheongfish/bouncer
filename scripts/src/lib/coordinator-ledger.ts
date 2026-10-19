'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
import runtime = require('./runtime-state');
import type { Ledger } from './execution-contracts';

const LEDGER_REL = runtime.COORDINATOR_LEDGER_REL;

function atomicWrite(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

/**
 * 원장 bytes와 파싱 결과를 같은 snapshot에서 읽어 fence가 TOCTOU로 느슨해지지 않게 한다.
 *
 * @param {string} file - 원장 절대 경로
 * @returns {{ ledger: Ledger, bytes: Buffer } | null} 파일이 없으면 null
 */
function loadLedgerBytes(file: string): { ledger: Ledger; bytes: Buffer } | null {
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return { ledger: JSON.parse(bytes.toString('utf8')) as Ledger, bytes };
}

function loadLedger(file: string): Ledger | null {
  const loaded = loadLedgerBytes(file);
  return loaded ? loaded.ledger : null;
}

/** @param {Buffer} bytes - load 시점의 원장 bytes @returns {string} SHA-256 hex */
function ledgerBytesHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * mutation이 들고 온 원장 경로와 hash를 검사하고 detached ledger를 차단한다.
 *
 * @param {{ ledgerPath?: string, ledgerHash?: string, ledgerBytes: Buffer }} opts - fence 입력
 * @returns {{ok: true} | {ok: false, reason: string}} 기존 거절 reason 또는 통과
 */
function assertLedgerFence(opts: {
  ledgerPath?: string; ledgerHash?: string; ledgerBytes: Buffer;
}): { ok: true } | { ok: false; reason: string } {
  const { ledgerPath, ledgerHash, ledgerBytes } = opts;
  if (typeof ledgerPath !== 'string' || ledgerPath === ''
    || typeof ledgerHash !== 'string' || ledgerHash === '') return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (path.isAbsolute(ledgerPath)) return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (ledgerPath.includes('\\') || ledgerPath.split('/').includes('..')
    || ledgerPath.split('/').includes('') || ledgerPath !== LEDGER_REL) {
    return { ok: false, reason: 'ledger-checkpoint-invalid' };
  }
  if (!/^[a-f0-9]{64}$/.test(ledgerHash)) return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (!Buffer.isBuffer(ledgerBytes) || ledgerBytes.length === 0) return { ok: false, reason: 'ledger-checkpoint-invalid' };
  if (ledgerBytesHash(ledgerBytes) !== ledgerHash) return { ok: false, reason: 'stale-ledger-checkpoint' };
  // 모든 fenced mutation이 공유하는 끝단 검사라 새 명령도 detached 상태를 빠뜨리지 않는다.
  const parsed = JSON.parse(ledgerBytes.toString('utf8')) as { status?: unknown };
  if (parsed && parsed.status === 'detached') return { ok: false, reason: 'run-detached' };
  return { ok: true };
}

/**
 * 잠금 소유를 확인한 뒤에만 원장을 쓴다.
 *
 * @param {() => boolean} owns - 현재 잠금 소유 확인
 * @param {(file: string, data: unknown) => void} writeLedger - 원자 쓰기 구현
 * @param {string} file - 원장 경로
 * @param {Ledger} ledger - 기록할 원장
 * @returns {{ok: false, reason: 'ledger-lock-lost'} | null} 소유 상실 시 실패
 */
function writeOwnedLedger(
  owns: () => boolean, writeLedger: (file: string, data: unknown) => void, file: string, ledger: Ledger,
): { ok: false; reason: 'ledger-lock-lost' } | null {
  if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
  writeLedger(file, ledger);
  return null;
}

export = { atomicWrite, loadLedgerBytes, loadLedger, ledgerBytesHash, assertLedgerFence, writeOwnedLedger, LEDGER_REL };
