import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const player = fs.readFileSync(`${root}/src/literary-player.js`, 'utf8');
const localization = fs.readFileSync(`${root}/src/localization.js`, 'utf8');

test('all destructive menu operations use one in-game confirm dialog', () => {
  assert.doesNotMatch(player, /window\.confirm\s*\(/);
  assert.match(player, /function ConfirmDialog\s*\(/);
  assert.equal((player.match(/openConfirmDialog\(\{/g) ?? []).length, 4, 'one definition plus three operation call sites');
  assert.match(player, /setAttribute\(['\"]role['\"],['\"]dialog['\"]\)/);
  assert.match(player, /setAttribute\(['\"]aria-modal['\"],['\"]true['\"]\)/);
  assert.match(player, /history\.pushState/);
  assert.match(player, /addEventListener\(['\"]popstate['\"]/);
  assert.match(player, /event\.key===['\"]Escape['\"]/);
  assert.match(player, /app\.inert=true/);
});

test('confirm dialog guards cancel, explicit confirmation and repeated touch processing', () => {
  assert.match(player, /data-confirm-dialog-action/);
  assert.match(player, /pointerdown/);
  assert.match(player, /pointerup/);
  assert.match(player, /settled/);
  assert.match(player, /stopPropagation\(\)/);
  assert.match(player, /preventDefault\(\)/);
});

test('confirm dialog labels are localized in Russian and English', () => {
  for (const locale of ['ru', 'en']) {
    for (const key of ['confirmDialogTitle', 'confirmDialogCancel', 'confirmDialogConfirm']) {
      assert.match(localization, new RegExp(`ui\\.${locale}\\.${key}=`), `${locale} is missing ${key}`);
    }
  }
});
