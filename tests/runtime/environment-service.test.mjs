import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnvironmentStatus } from '../../src/runtime/environment-service.js';

test('normalizeEnvironmentStatus returns structured version state', () => {
  const status = normalizeEnvironmentStatus({
    winworkVersion: '0.2.24',
    windcli: { found: 'true', version: 'wind 0.3.0', path: '/usr/local/bin/wind' },
    wiki: { found: 'true' }
  });

  assert.equal(status.winwork.version, '0.2.24');
  assert.equal(status.windcli.installed, true);
  assert.equal(status.windcli.current, '0.3.0');
  assert.equal(status.windcli.display, 'wind-cli 0.3.0');
  assert.equal(status.wiki.available, true);
});

test('normalizeEnvironmentStatus handles missing windcli', () => {
  const status = normalizeEnvironmentStatus({
    winworkVersion: '0.2.24',
    windcli: { found: 'false' },
    wiki: { found: 'false', reason: 'not installed' }
  });

  assert.equal(status.windcli.installed, false);
  assert.equal(status.windcli.display, 'wind-cli 未安装');
  assert.equal(status.wiki.available, false);
});
