import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { isHapticsOn } from './settingsStore.js';

function canUseHaptics() {
  return isHapticsOn() && Capacitor.isNativePlatform();
}

export async function hapticLight() {
  if (!canUseHaptics()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function hapticMedium() {
  if (!canUseHaptics()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticSuccess() {
  if (!canUseHaptics()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

export async function hapticError() {
  if (!canUseHaptics()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}
