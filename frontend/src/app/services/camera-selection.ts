/** O nome divulgado pelo driver é a única indicação de tipo disponível no navegador. */
export function prioridadeCamera(camera: Pick<MediaDeviceInfo, 'label'>): number {
  const label = camera.label.trim().toLowerCase();
  if (label.includes('droidcam')) return 0;
  if (['positivo', 'theia', 'integrated', 'built-in', 'internal', 'interno', 'facetime', 'laptop', 'notebook']
    .some((word) => label.includes(word))) return 3;
  if (['usb', 'webcam', 'logitech', 'external', 'virtual', 'obs', 'ndi', 'epoccam', 'ivcam', 'snap']
    .some((word) => label.includes(word))) return 1;
  return 2;
}

export async function abrirCameraPreferida(
  media: Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'>,
): Promise<MediaStream> {
  let cameras = (await media.enumerateDevices()).filter((device) => device.kind === 'videoinput');
  let inicial: MediaStream | null = null;

  // A primeira autorização pode ser necessária para revelar nomes e deviceIds.
  if (!cameras.length || cameras.every((camera) => !camera.label)) {
    inicial = await media.getUserMedia({ video: true });
    try {
      cameras = (await media.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    } catch (error) {
      inicial.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  const ordenadas = [...cameras].sort((a, b) => prioridadeCamera(a) - prioridadeCamera(b));
  if (!ordenadas.length && inicial) return inicial;
  const atual = inicial?.getVideoTracks()[0]?.getSettings().deviceId;
  if (inicial && atual === ordenadas[0]?.deviceId) return inicial;
  inicial?.getTracks().forEach((track) => track.stop());

  let ultimoErro: unknown = new Error('Nenhuma câmera disponível.');
  for (const camera of ordenadas) {
    try {
      // exact impede o navegador de substituir DroidCam/USB pela câmera interna.
      return await media.getUserMedia({ video: { deviceId: { exact: camera.deviceId } } });
    } catch (error) {
      ultimoErro = error;
      if (error instanceof Error && ['NotAllowedError', 'SecurityError'].includes(error.name)) throw error;
      console.warn(`[Webcam] Não foi possível abrir ${camera.label}; tentando a próxima câmera.`, error);
    }
  }
  throw ultimoErro;
}
