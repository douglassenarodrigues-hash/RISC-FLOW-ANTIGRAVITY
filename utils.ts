
import { Proposal, RiskStatus } from './types';

export const shortenName = (name: string): string => {
  if (!name) return '---';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  // Keep first and last name
  return `${parts[0]} ${parts[parts.length - 1]}`;
};

export const translateStatus = (status: string): string => {
  switch (status) {
    case 'PENDING': return 'Aguardando Análise';
    case 'APPROVED': return 'Aprovado';
    case 'REJECTED': return 'Reprovado';
    case 'WAITING_DOCS': return 'Pendente';
    case 'CONTACT': return 'Em Contato';
    case 'WAITING_REQUEST': return 'Em Espera';
    case 'AUTO_APPROVED': return 'Aprovação Automática';
    case 'AGENDADO': return 'Agendado';
    default: return status;
  }
};

export const isSlaPaused = (status: RiskStatus): boolean => {
  return status === 'APPROVED' || status === 'AUTO_APPROVED' || status === 'WAITING_DOCS' || status === 'REJECTED';
};

export const transitionProposalStatus = (p: Proposal, newStatus: RiskStatus): Proposal => {
  const now = Date.now();
  const prevStatus = p.status;
  const createdAt = p.createdAt || now;
  const lastUpdatedStatusAt = p.lastUpdatedStatusAt || createdAt;
  const slaRemainingMs = p.slaRemainingMs !== undefined ? p.slaRemainingMs : 3 * 3600000;

  let newSlaRemainingMs = slaRemainingMs;

  if (!isSlaPaused(prevStatus)) {
    const elapsed = now - lastUpdatedStatusAt;
    newSlaRemainingMs = Math.max(0, slaRemainingMs - elapsed);
  }

  return {
    ...p,
    status: newStatus,
    createdAt,
    lastUpdatedStatusAt: now,
    slaRemainingMs: newSlaRemainingMs
  };
};

export const formatDuration = (ms: number): string => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return `${hStr}:${mStr}:${sStr}`;
};

export const formatAge = (ms: number): string => {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
};

export const decodeArrayBuffer = (arrayBuffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(arrayBuffer);
  let isValidUtf8 = true;
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const byte = bytes[i];
    if (byte <= 0x7F) {
      i++;
    } else if ((byte & 0xE0) === 0xC0) {
      if (i + 1 >= len || (bytes[i + 1] & 0xC0) !== 0x80) {
        isValidUtf8 = false;
        break;
      }
      i += 2;
    } else if ((byte & 0xF0) === 0xE0) {
      if (i + 2 >= len || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80) {
        isValidUtf8 = false;
        break;
      }
      i += 3;
    } else if ((byte & 0xF8) === 0xF0) {
      if (i + 3 >= len || (bytes[i + 1] & 0xC0) !== 0x80 || (bytes[i + 2] & 0xC0) !== 0x80 || (bytes[i + 3] & 0xC0) !== 0x80) {
        isValidUtf8 = false;
        break;
      }
      i += 4;
    } else {
      isValidUtf8 = false;
      break;
    }
  }

  const decoder = new TextDecoder(isValidUtf8 ? 'utf-8' : 'windows-1252');
  return decoder.decode(bytes);
};



