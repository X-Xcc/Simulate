import { Camera } from '../types';
import type { DiscoveredCamera } from '../types';
import { addCamera, batchAddCameras, deleteAllCameras, deleteCamera, discoverCameras, fetchCameras, testCamera, updateCamera } from './dataService';
import { DEFAULT_DEVICE_FORM, toDevicePayload } from './devices-data';

export async function loadDevices(signal?: AbortSignal) {
  return fetchCameras(signal);
}

export async function createDevice(form: typeof DEFAULT_DEVICE_FORM) {
  return addCamera(toDevicePayload(form));
}

export async function saveDevice(deviceId: string, form: typeof DEFAULT_DEVICE_FORM) {
  return updateCamera(deviceId, toDevicePayload(form));
}

export async function removeDevice(deviceId: string) {
  return deleteCamera(deviceId);
}

export async function clearDevices() {
  return deleteAllCameras();
}

export async function validateDeviceConnection(form: typeof DEFAULT_DEVICE_FORM) {
  return testCamera(toDevicePayload(form));
}

export async function scanDevices(): Promise<DiscoveredCamera[]> {
  return discoverCameras();
}

export async function addDiscoveredDevices(cameras: Partial<Camera>[]) {
  return batchAddCameras(cameras);
}
