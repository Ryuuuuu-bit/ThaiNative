// Authored durations are absolute milliseconds, as in Phaser AnimationFrame.
// Omitting them keeps the existing constant-FPS playback.
export function frameIndexAt(elapsedMs, count, fps, loop = false, durations) {
  const elapsed = Math.max(0, elapsedMs);
  if (!durations || durations.length !== count) {
    const index = Math.floor(elapsed * fps / 1000);
    return loop ? index % count : Math.min(index, count - 1);
  }
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  let time = loop ? elapsed % total : elapsed;
  for (let index = 0; index < count; index++) {
    if (time < durations[index]) return index;
    time -= durations[index];
  }
  return count - 1;
}
