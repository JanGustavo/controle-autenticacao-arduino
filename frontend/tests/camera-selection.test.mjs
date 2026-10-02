import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirCameraPreferida } from '../src/app/services/camera-selection.ts';

const devices = [
  { kind: 'videoinput', deviceId: 'internal', label: 'Integrated USB Webcam' },
  { kind: 'videoinput', deviceId: 'usb', label: 'Logitech USB Webcam' },
  { kind: 'videoinput', deviceId: 'droid', label: 'DroidCam Video' },
];
function stream(id) {
  const track = { stopped: false, stop() { this.stopped = true; }, getSettings: () => ({ deviceId: id }) };
  return { getTracks: () => [track], getVideoTracks: () => [track] };
}
function media(failed = [], cameras = devices) {
  const calls = [];
  return {
    calls,
    enumerateDevices: async () => cameras,
    getUserMedia: async ({ video }) => {
      assert.ok(video.deviceId?.exact, 'Não deve escolher a câmera padrão quando os nomes já são conhecidos');
      const id = video.deviceId.exact;
      calls.push(id);
      if (failed.includes(id)) throw Object.assign(new Error('Câmera indisponível'), { name: 'NotReadableError' });
      return stream(id);
    },
  };
}
test('DroidCam tem prioridade, sem abrir a câmera interna antes', async () => {
  const source = media();
  await abrirCameraPreferida(source);
  assert.deepEqual(source.calls, ['droid']);
});
test('DroidCam falha: tenta USB antes da interna', async () => {
  const source = media(['droid']);
  await abrirCameraPreferida(source);
  assert.deepEqual(source.calls, ['droid', 'usb']);
});
test('DroidCam e USB falham: abre a câmera interna', async () => {
  const source = media(['droid', 'usb']);
  await abrirCameraPreferida(source);
  assert.deepEqual(source.calls, ['droid', 'usb', 'internal']);
});
test('Sem DroidCam: usa USB', async () => {
  const source = media([], devices.slice(0, 2));
  await abrirCameraPreferida(source);
  assert.deepEqual(source.calls, ['usb']);
});
test('Só interna disponível: abre a interna', async () => {
  const source = media([], devices.slice(0, 1));
  await abrirCameraPreferida(source);
  assert.deepEqual(source.calls, ['internal']);
});
test('Permissão negada: não insiste em outras câmeras', async () => {
  const source = media();
  source.getUserMedia = async () => { source.calls.push('droid'); throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); };
  await assert.rejects(abrirCameraPreferida(source), { name: 'NotAllowedError' });
  assert.deepEqual(source.calls, ['droid']);
});
test('Libera nomes e fecha a câmera inicial antes de selecionar DroidCam', async () => {
  let enumerations = 0;
  const initial = stream('internal');
  const calls = [];
  const source = {
    enumerateDevices: async () => ++enumerations === 1 ? devices.map(d => ({ ...d, label: '' })) : devices,
    getUserMedia: async ({ video }) => { calls.push(video); return video === true ? initial : stream(video.deviceId.exact); },
  };
  await abrirCameraPreferida(source);
  assert.deepEqual(calls, [true, { deviceId: { exact: 'droid' } }]);
  assert.equal(initial.getTracks()[0].stopped, true);
});
test('Todas falham: informa erro', async () => {
  const source = media(['droid', 'usb', 'internal']);
  await assert.rejects(abrirCameraPreferida(source));
  assert.deepEqual(source.calls, ['droid', 'usb', 'internal']);
});
