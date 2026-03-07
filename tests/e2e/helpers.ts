import { expect, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type SeedOutput = {
  staffCookie?: string;
  clientCookie?: string;
};

const readSeedOutput = (): SeedOutput => {
  const outputFile = process.env.E2E_SEED_OUTPUT ?? '.playwright-artifacts/e2e-seed.json';
  const absolutePath = resolve(process.cwd(), outputFile);
  if (!existsSync(absolutePath)) return {};

  try {
    const raw = readFileSync(absolutePath, 'utf-8');
    const parsed = JSON.parse(raw) as SeedOutput;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const seedOutput = readSeedOutput();

export const staffCookie = (process.env.E2E_STAFF_COOKIE ?? seedOutput.staffCookie ?? 'gymcrm_open_role=admin').trim();
export const clientCookie = (process.env.E2E_CLIENT_COOKIE ?? seedOutput.clientCookie ?? 'gymcrm_open_role=cliente').trim();

export const hasStaffCookie = staffCookie.length > 0;
export const hasClientCookie = clientCookie.length > 0;

export const applyCookieHeader = async (context: BrowserContext, cookieHeader: string) => {
  await context.setExtraHTTPHeaders({ cookie: cookieHeader });

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';
  const cookies = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf('=');
      if (separator <= 0) return null;
      return {
        name: entry.slice(0, separator).trim(),
        value: entry.slice(separator + 1).trim(),
        url: baseUrl,
      };
    })
    .filter((entry): entry is { name: string; value: string; url: string } => Boolean(entry));

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }
};

export const localDateTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const expectNoBrokenCriticalResources = async (page: Page) => {
  const broken: string[] = [];

  page.on('response', (response) => {
    const type = response.request().resourceType();
    if (!['image', 'stylesheet', 'script', 'font'].includes(type)) return;
    if (response.status() >= 400) {
      broken.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.waitForLoadState('networkidle');
  expect(
    broken,
    broken.length > 0
      ? `Se detectaron recursos rotos:\n${broken.join('\n')}`
      : 'No se detectaron recursos críticos rotos'
  ).toEqual([]);
};

export const ensureQaClient = async (request: APIRequestContext): Promise<string> => {
  const seed = Date.now();
  const create = await request.post('/api/gymcrm/clientes', {
    headers: { cookie: staffCookie },
    data: {
      nombres: `QA${seed}`,
      apellidos: 'E2E',
      email: `qa+${seed}@gymcrm.test`,
      telefono: '099000000',
      estado: 'activo',
    },
  });

  if (create.ok()) {
    const payload = (await create.json()) as { data?: { id?: string } };
    if (payload?.data?.id) return payload.data.id;
  }

  const list = await request.get('/api/gymcrm/clientes?pageSize=1', {
    headers: { cookie: staffCookie },
  });
  expect(list.ok(), 'No se pudo crear ni listar cliente QA').toBeTruthy();
  const payload = (await list.json()) as { data?: Array<{ id: string }> };
  const firstId = payload?.data?.[0]?.id;
  expect(firstId, 'No existe cliente para pruebas').toBeTruthy();
  return firstId as string;
};
